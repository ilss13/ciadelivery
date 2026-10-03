# 04-01 — Outbox, BullMQ e worker de eventos

> Implemente somente esta tarefa. Leia as convenções. A 03-03 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 4 — Operação em tempo real |
| Depende de | 03-03 |
| Desbloqueia | 04-02, 04-03 |
| Critério da fase que esta tarefa avança | Mudança de pedido gera evento durável, com retry |

## Objetivo

Gravar eventos de domínio na mesma transação do pedido e processá-los no worker com retry e idempotência. O WebSocket em si é a 04-02; aqui o handler pode ser um publicador interno substituível.

## Modelo `outbox_events`

| Coluna | Regra |
|---|---|
| id | UUID |
| tenant_id | |
| aggregate_type | `order` |
| aggregate_id | id do pedido |
| type | por exemplo `order.created` |
| payload | JSON. Sem senha, sem tracking token em claro |
| status | `PENDING`, `PROCESSING`, `PROCESSED`, `FAILED` |
| attempts | int default 0 |
| available_at | datetime(3) |
| processed_at | null |
| last_error | varchar 500 null |
| locked_by | null |
| created_at | |

Índice `(status, available_at)`.

## Quando gravar

Na mesma transação de `POST /public/orders`, insira `order.created`.

Exponha agora os comandos de status, porque o evento precisa nascer com a mudança. Eles exigem permissão e usam `OrderStateMachine`:

```text
POST /api/v1/admin/orders/:id/accept              orders.accept
POST /api/v1/admin/orders/:id/reject              orders.accept   body note opcional
POST /api/v1/admin/orders/:id/start-preparation   orders.prepare
POST /api/v1/admin/orders/:id/ready               orders.prepare
POST /api/v1/admin/orders/:id/cancel              orders.accept   body note obrigatória
```

`dispatch` e `deliver` **não** entram agora (Fase 5), exceto `POST /admin/orders/:id/complete-pickup` com `orders.deliver` somente se `fulfillment=PICKUP` e status `READY`, levando a `DELIVERED`. Pedido `DELIVERY` nessa rota: `409` `DELIVERY_REQUIRES_COURIER`.

Cada comando bem-sucedido, na mesma transação:

1. valida a transição;
2. atualiza status e `updated_at`;
3. insere histórico com `actor_type=USER` e `actor_id`;
4. insere outbox com o type correspondente (`order.accepted`, `order.rejected`, `order.in_preparation`, `order.ready`, `order.cancelled`, `order.delivered`);
5. commit.

Transição inválida não grava outbox. Pedido de outro tenant: `404`.

## Worker

Fila BullMQ `outbox-events`.

- Um scheduler no worker (ou poller a cada 1 s) busca até 20 linhas `PENDING` com `available_at <= now`, marca `PROCESSING` com update condicional (`WHERE status='PENDING'`) para dois workers não pegarem a mesma linha.
- Enfileira o `id` do evento.
- O processor chama handlers registrados pelo `type`. O handler desta tarefa grava em tabela `processed_events` (`event_id` PK, `handler`, `processed_at`) e em log. Se o handler já tiver linha, retorne sem efeito.
- Sucesso: outbox `PROCESSED`.
- Falha: `attempts++`, `last_error`, `available_at = now + backoff` (2s, 4s, 8s, 16s, 32s). Na 5ª falha, `FAILED`.
- Handler de teste `FailingHandler` não fica em produção. Force falha no teste com um type `test.fail` inserido direto.

Não chame WhatsApp. Não abra Socket.IO aqui. Deixe a porta `DomainEventPublisher` com adapter `OutboxDomainEventPublisher` usado pelos casos de uso, e um `OutboxHandler` de log. A 04-02 registra o handler de WebSocket nesse mesmo pipeline.

Filas nomeadas nas convenções podem ser declaradas no módulo BullMQ mesmo que só `outbox-events` tenha processor agora.

## API de apoio operacional

Não crie endpoint para reprocessar à mão além de:

```text
POST /api/v1/platform/outbox/:id/requeue
```

somente `SUPER_ADMIN`, e só se status for `FAILED`. Volta para `PENDING` com `attempts=0`.

## Testes

- Integração com MySQL e Redis reais: criar pedido gera outbox `PENDING`; o worker marca `PROCESSED`; rodar o worker duas vezes não duplica `processed_events`.
- Transição inválida não cria outbox.
- Falha do handler até `FAILED` e requeue volta a processar.
- Se o insert do pedido der rollback (simule validações), não sobra outbox.

## Como validar

```bash
docker compose up -d mysql redis
npm run migration:run
npx nx test api
npx nx test worker
```

## Critério de conclusão

Criar o pedido e mudar o status deixam um evento na mesma transação, e o worker processa com retry e sem duplicar efeito.
