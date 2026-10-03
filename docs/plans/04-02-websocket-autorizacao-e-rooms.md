# 04-02 — WebSocket, autorização e rooms

> Implemente somente esta tarefa. Leia as convenções. A 04-01 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 4 — Operação em tempo real |
| Depende de | 04-01 |
| Desbloqueia | 04-03, 04-04 |
| Critério da fase que esta tarefa avança | O painel e o cliente podem receber o evento sem recarregar |

## Objetivo

Emitir os eventos de pedido por Socket.IO, depois do commit, só para quem pode ouvir aquela sala.

## Gateway

No processo da API (não no worker). O worker, ao tratar o outbox, publica no Redis pub/sub canal `realtime`. A API assina e emite no Socket.IO. Assim há um só lugar de emissão mesmo com mais de uma instância da API no futuro.

Namespace `/realtime`.

Autenticação na conexão:

- staff: query ou `auth: { token: accessToken }`. JWT válido. Sala permitida: `tenant:{tenantId}` e `store:{storeId}` do token, se tiver `orders.read`. `KITCHEN` e `ATTENDANT` entram. `COURIER` **não** entra na sala da loja inteira; a sala `courier:{userId}` fica na Fase 5;
- consumidor: `auth: { trackingToken }`. Entra só em `order:{orderId}` daquele token. Não recebe a sala do tenant.

Tentativa de `join` em sala não autorizada: o servidor ignora e loga `warn`. O cliente não escolhe o `tenantId` da sala; o servidor associa sozinho depois do auth.

Eventos emitidos, payload mínimo `{ orderId, status, orderNumber, occurredAt }`:

```text
order.created
order.updated
order.accepted
order.rejected
order.in_preparation
order.ready
order.delivered
order.cancelled
```

`order.created` vai para `store:{storeId}`. Os demais vão para a loja e também para `order:{orderId}`.

Se não houver cliente conectado, o evento do outbox ainda fica `PROCESSED`. Tempo real é efeito, não persistência. A timeline continua vindo do GET.

## Notificações

Tabela `notifications`: `id`, `tenant_id`, `store_id`, `type`, `title`, `body`, `order_id` null, `read_at` null, `created_at`.

Ao processar `order.created`, insira uma notificação “Novo pedido #N”. Idempotente pelo `event_id` (único `event_id` na notificação, coluna nullable única).

```text
GET  /api/v1/admin/notifications          orders.read
POST /api/v1/admin/notifications/:id/read orders.read
```

Emita também `notification.created` para a sala da loja.

## Testes

- Integração com `socket.io-client`: owner conectado recebe `order.created` depois do POST público, sem GET no meio.
- Token de tracking recebe `order.accepted` e não recebe `order.created` de outro pedido da mesma loja.
- JWT de outro tenant não recebe o evento da loja A.
- Conexão sem token é desligada.

## Como validar

```bash
npx nx test api
npx nx test worker
```

## Critério de conclusão

Um cliente Socket.IO autorizado observa o pedido novo e a mudança de status. Um cliente de outro tenant não observa. O banco continua sendo a fonte do status.
