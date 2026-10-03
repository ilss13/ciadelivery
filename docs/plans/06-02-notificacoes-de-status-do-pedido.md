# 06-02 — Notificações de status do pedido

> Implemente somente esta tarefa. Leia as convenções. A 06-01 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 6 — WhatsApp operacional |
| Depende de | 06-01 |
| Desbloqueia | 06-03, 06-04 |
| Critério da fase que esta tarefa avança | O cliente recebe as notificações de status definidas |

## Objetivo

Quando o pedido muda de status, enviar uma mensagem WhatsApp pelo número daquela loja, com template e retry.

## Templates

Cadastro em código, não editável pelo cliente como texto livre de preço. Chaves:

| Evento | Chave |
|---|---|
| order.created | `order_received` |
| order.accepted | `order_accepted` |
| order.rejected | `order_rejected` |
| order.in_preparation | `order_preparing` |
| order.ready | `order_ready` |
| order.out_for_delivery | `order_out_for_delivery` |
| order.delivered | `order_delivered` |
| order.cancelled | `order_cancelled` |

Variáveis permitidas, preenchidas pelo backend: nome do cliente, número do pedido, nome da loja, total formatado a partir de `total_cents`, status. O handler **não** aceita valor vindo do payload que contradiga o pedido: releia o pedido no banco antes de montar a mensagem.

Tabela `message_templates`: `id`, `tenant_id`, `key`, `language` default `pt_BR`, `meta_template_name`, `enabled`. Seed ao conectar WhatsApp com `enabled=true` e `meta_template_name` igual à chave. O owner pode desligar uma chave na UI. Desligada: não envia, e registra skipped.

## Envio

Handler do outbox (fila `whatsapp-outbound`, alimentada pelo processor de outbox):

1. Se o tenant não tem conexão `CONNECTED`, marque o efeito como skipped sem falhar o outbox do pedido.
2. Se o template está desligado, skipped.
3. Monte o envio e chame `sendTemplate`.
4. Grave `messages` de saída (a tabela completa de conversa é a 06-03; crie já a linha mínima se a tabela ainda não existir: `id`, `tenant_id`, `direction=OUT`, `to_phone`, `template_key`, `body`, `status` `QUEUED|SENT|FAILED`, `provider_message_id` null, `event_id` único, `created_at`).
5. Idempotência: `event_id` único. Reprocessar não manda de novo.
6. Falha do provider: retry da fila com backoff, 5 tentativas, depois `FAILED` na mensagem e `last_error`. O pedido não volta de status.

`LoggingWhatsAppProvider` marca `SENT` com id `log-{uuid}`.

Não envie o tracking token completo se isso couber num texto longo demais: envie o número do pedido e uma frase “acompanhe pelo link da loja”. O link pode ir se for o path público já existente; ele é o segredo de acompanhamento, então só inclua se o pedido tiver sido criado com token e o template tiver o campo. Incluir o link é aceitável porque o cliente já o recebeu na tela. Não logue o link em info.

Fora de production, se `WHATSAPP_ALLOW_SESSION_MESSAGES=true` e o driver for Meta, ausência de template aprovado pode cair em `sendText` com o mesmo corpo. Em production essa flag é ignorada e a falta de template aprovado falha com erro explícito `TEMPLATE_NOT_APPROVED` depois das tentativas, sem texto livre.

## UI

Na tela WhatsApp, lista das oito chaves com interruptor. Mostra último erro de envio recente (telefone mascarado: `*******1234`).

## Testes

- Criar pedido com driver log gera mensagem `order_received` para o telefone do cliente daquele tenant.
- Accept gera `order_accepted` uma vez, mesmo com o handler rodando duas vezes.
- Loja sem conexão não gera mensagem e o pedido continua `ACCEPTED`.
- Tenant B não recebe mensagem do pedido de A.
- Template desligado não chama o provider.

## Como validar

```bash
npx nx test api
npx nx test worker
```

## Critério de conclusão

Cada status definido produz no máximo uma mensagem, com dados relidos do pedido, pelo número da loja certa.
