# 06-03 — Conversas e atendimento manual

> Implemente somente esta tarefa. Leia as convenções. A 06-02 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 6 — WhatsApp operacional |
| Depende de | 06-02 |
| Desbloqueia | 06-04, 09-01 |
| Critério da fase que esta tarefa avança | O estabelecimento vê e responde conversas integradas |

## Objetivo

Abrir conversa quando chega mensagem, listar no painel e responder manualmente pelo número da loja.

## Modelo

### `conversations`

`id`, `tenant_id`, `store_id`, `customer_id` null, `contact_phone`, `contact_name` null, `mode` (`BOT`, `HUMAN`, `PAUSED`, `CLOSED`), `linked_order_id` null, `last_message_at`, `created_at`, `updated_at`.

Nesta fase, mensagem recebida abre ou reabre em `HUMAN`. `BOT` fica reservado à Fase 9: não chame modelo nenhum. Se no futuro o modo for `BOT`, esta tarefa ainda grava a mensagem e não responde sozinha.

Único lógico: uma conversa aberta (`mode != CLOSED`) por `(tenant_id, contact_phone)`.

### `messages`

Complete a tabela da 06-02:

`conversation_id` null apenas para template de pedido que não tinha conversa; ao enviar template, vincule ou crie conversa do telefone do cliente em modo `HUMAN` sem roubar foco (não marque não lida de sistema como se fosse cliente... marque `author=SYSTEM`).

Colunas: `direction` `IN|OUT`, `author` `CUSTOMER|USER|SYSTEM`, `body`, `template_key` null, `status`, `provider_message_id`, `event_id` null, `external_id` null, `created_at`.

Webhook da 06-01 passa a preencher conversa + mensagem `IN` de forma idempotente pelo `external_id`. Associe `customer_id` se o telefone já existir no tenant. Não crie cliente só pela mensagem recebida.

Vincular pedido: se o texto contiver o número do pedido `#123` existente no tenant, preencha `linked_order_id`. Não faça NLP.

## API

```text
GET  /api/v1/admin/whatsapp/conversations                      whatsapp.operate
GET  /api/v1/admin/whatsapp/conversations/:id/messages         whatsapp.operate
POST /api/v1/admin/whatsapp/conversations/:id/messages         whatsapp.operate
POST /api/v1/admin/whatsapp/conversations/:id/close            whatsapp.operate
```

POST body: `{ "body": "texto" }` até 1000 caracteres. Enfileira `sendText`. Sem conexão: `409` `WHATSAPP_NOT_CONNECTED`. Conversa de outro tenant: `404`.

Lista paginada por `last_message_at`. Payload de socket `conversation.message_received` na sala `store:{storeId}` para quem tem `whatsapp.operate`. Não mande o conteúdo para a sala de pedidos da cozinha se o gateway separar por permissão: só usuários com `whatsapp.operate` entram na sala `conversation:{id}` e também recebem o evento na sala da loja **apenas** se o cliente de socket tiver essa permissão. Ajuste o gateway para não entregar `conversation.message_received` a `KITCHEN`.

## UI

Rota `/whatsapp` no admin:

- lista de conversas com telefone mascarado no card e completo só no detalhe;
- thread;
- caixa de resposta;
- estado vazio “nenhuma conversa”;
- mensagem nova entra sem refresh;
- encerrar conversa pede confirmação;
- não há botão de “IA” nesta tarefa.

## Testes

- Webhook assinado cria conversa e mensagem; repetir o wamid não duplica.
- POST de resposta chama o provider log uma vez e grava `OUT`.
- Owner de B não lista conversa de A.
- Cozinha não recebe o evento de conversa (teste de socket com JWT de kitchen).

## Como validar

```bash
npx nx test api
npx nx test admin
```

Simule um webhook de teste (fixture JSON no teste, não uma conta real) e responda pela UI se a API local estiver no driver log.

## Critério de conclusão

Uma mensagem recebida no número da loja aparece na conversa daquela loja, e um operador envia a resposta por essa mesma conexão.
