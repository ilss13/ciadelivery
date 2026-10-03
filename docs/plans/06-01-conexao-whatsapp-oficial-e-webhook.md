# 06-01 — Conexão WhatsApp oficial e webhook

> Implemente somente esta tarefa. Leia as convenções. A 05-04 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 6 — WhatsApp operacional |
| Depende de | 05-04 |
| Desbloqueia | 06-02, 06-03 |
| Critério da fase que esta tarefa avança | Cada estabelecimento tem o próprio número oficial |

## Objetivo

Conectar o número de WhatsApp Business do tenant pela Cloud API da Meta e receber webhooks assinados. Não envie notificação de pedido ainda.

## Proibido

WhatsApp Web, Baileys, whatsapp-web.js, Puppeteer, sessão QR de aparelho, ou qualquer automação fora da API oficial. Se uma lib sugerir isso, não adicione.

## Porta

```typescript
interface WhatsAppProvider {
  sendText(input: SendTextInput): Promise<ProviderMessageRef>;
  sendTemplate(input: SendTemplateInput): Promise<ProviderMessageRef>;
  parseWebhook(headers: Headers, rawBody: Buffer): ParsedWebhook;
  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean;
}
```

- `MetaCloudWhatsAppProvider`: Graph API `https://graph.facebook.com/${META_GRAPH_VERSION}/{phoneNumberId}/messages`. Token e ids vêm da conexão do tenant, não de um token global da plataforma (o app secret da plataforma verifica o webhook; o token de envio é o da conta do estabelecimento, guardado cifrado).
- `LoggingWhatsAppProvider`: usado em teste e quando `WHATSAPP_DRIVER=log`. Grava a mensagem numa tabela `whatsapp_outbox_log` ou simplesmente devolve id falso e registra em memória no teste. Não chama a rede.

## Modelo `whatsapp_connections`

Uma conexão por loja.

| Coluna | Regra |
|---|---|
| id, tenant_id, store_id | store único |
| provider | `META_CLOUD` |
| phone_number | exibido |
| business_account_id, phone_number_id | |
| status | `PENDING`, `CONNECTED`, `DISCONNECTED`, `ERROR` |
| encrypted_credentials | texto cifrado AES-256-GCM (access token) |
| connected_at, disconnected_at | |
| created_at, updated_at | |

Nunca devolva o token em GET. GET mostra os quatro últimos caracteres apenas, campo `credentialsHint`.

Chave `CREDENTIALS_ENCRYPTION_KEY` de 32 bytes em base64. Sem ela, a API não sobe quando alguém chama o connect; em local, exija a variável sempre para não cifrar com chave vazia.

## API

```text
GET    /api/v1/admin/whatsapp/connection     whatsapp.operate
POST   /api/v1/admin/whatsapp/connect        whatsapp.operate
DELETE /api/v1/admin/whatsapp/connection     whatsapp.operate
GET    /api/v1/webhooks/whatsapp
POST   /api/v1/webhooks/whatsapp
```

`POST connect` body: `phoneNumber`, `businessAccountId`, `phoneNumberId`, `accessToken`. Valide com uma chamada `GET /{phoneNumberId}` na Graph API quando o driver for Meta. No driver log, marque `CONNECTED` sem rede. Substituir conexão desconecta a anterior.

`DELETE` marca `DISCONNECTED` e apaga o segredo cifrado.

Webhook GET: parâmetros `hub.mode`, `hub.verify_token`, `hub.challenge`. Token comparado com `META_WEBHOOK_VERIFY_TOKEN` em tempo constante. Se bater, responda o challenge em texto puro. Senão `403`.

Webhook POST:

- leia o raw body (desligue o json parser só nessa rota) para validar `X-Hub-Signature-256` com `META_APP_SECRET`;
- assinatura inválida: `401`, sem processar;
- `Idempotency-Key` não vem da Meta: use o id da mensagem do payload (`entry[].changes[].value.messages[].id`) como chave única. Duplicata responde `200` e não reinsere;
- responda `200` rápido. Persista e enfileire. A 06-03 cria conversa; nesta tarefa grave o evento bruto em `whatsapp_webhook_events` (`id`, `tenant_id` resolvido pelo `phone_number_id`, `external_id` único, `payload` JSON, `received_at`, `processed_at` null). Número desconhecido: `200` e log `warn`, para a Meta não reenviar indefinidamente, sem criar dado de tenant nenhum.

Resolução do tenant: `phone_number_id` da conexão `CONNECTED`. Não aceite tenant no query do webhook.

## UI

Tela “WhatsApp” nas configurações: status, número, formulário de conexão, botão desconectar com confirmação. Texto deixando claro que é a API oficial e que cada loja usa o próprio número.

## Testes

- Assinatura inválida não grava evento.
- O mesmo `wamid` duas vezes grava uma linha.
- `phone_number_id` da loja A não grava evento no tenant B.
- GET de conexão não contém o access token.
- Driver log conecta sem HTTP externo.

## Como validar

```bash
npm run migration:run
npx nx test api
```

## Critério de conclusão

A loja guarda a própria credencial cifrada, o webhook só entra com assinatura válida e o evento cai no tenant do número, não em outro.
