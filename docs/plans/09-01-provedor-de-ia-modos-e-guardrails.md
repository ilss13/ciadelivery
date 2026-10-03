# 09-01 — Provedor de IA, modos e guardrails

> Implemente somente esta tarefa. Leia as convenções. A 08-03 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 9 — IA no WhatsApp |
| Depende de | 08-03 |
| Desbloqueia | 09-02 |
| Critério da fase que esta tarefa avança | A conversa pode entrar em modo bot sem a IA decidir valor comercial |

## Objetivo

Preparar o modo `BOT` da conversa, a porta do modelo e as travas. Nesta tarefa o bot ainda não monta pedido; ele só responde dentro das regras ou entrega para uma pessoa.

## Porta

```typescript
interface LlmProvider {
  complete(input: LlmInput): Promise<LlmResult>;
}
```

`LlmInput` contém o histórico recente (máximo 20 mensagens), o catálogo **não** vai inteiro em texto livre nesta tarefa, e a lista de ferramentas vazia por enquanto.

`LlmResult`: `{ "assistantMessage": string, "toolCalls": [], "confidence": number }`.

`confidence` entre 0 e 1. Abaixo de `AI_CONFIDENCE_MIN` (default 0,6): não envie a mensagem do modelo; mude a conversa para `HUMAN` e avise o painel.

Implementações:

- `ScriptedLlmProvider` em teste, com respostas programadas.
- `HttpLlmProvider` se `LLM_DRIVER=http` e `LLM_API_URL` existir. Timeout 15 s. Não fixe um vendor no domínio. Sem a variável, o modo bot não chama rede: responda ao cliente que o atendimento humano vai assumir e vá para `HUMAN`.

Nenhum preço, taxa ou status sai do texto do modelo para o banco. Se o texto contiver padrão de valor (`R$`), descarte a resposta, logue `ai.price_stripped` e faça handoff. A 09-03 cria pedido; aqui é proibido inserir em `orders` a partir do bot.

## Modos

Já existem `BOT`, `HUMAN`, `PAUSED`, `CLOSED`.

- Conversa nova continua `HUMAN` por default.
- Owner liga o bot por loja: `stores.ai_enabled` default false.
- Com `ai_enabled` e conexão WhatsApp, mensagem nova em conversa `HUMAN` **não** muda sozinha para `BOT`. A pessoa do painel clica “passar para o bot”, ou uma configuração `ai_auto_reply` default false passa a conversa sem pedido vinculado para `BOT`.
- Cliente escreve “atendente”, “humano” ou “pessoa”: modo `HUMAN`, notificação no painel, o modelo não é chamado.
- `PAUSED`: ninguém automático responde.
- `CLOSED`: nova mensagem do cliente reabre em `HUMAN`.

Métricas de confiança: grave `ai_turns` (`id`, `tenant_id`, `conversation_id`, `confidence`, `outcome` `REPLIED|HANDOFF|BLOCKED`, `created_at`). Sem o prompt completo se ele contiver telefone; guarde hash do prompt e o outcome.

Limite: 30 turnos de bot por conversa por dia. No 31º, handoff.

## API e UI

```text
POST /api/v1/admin/whatsapp/conversations/:id/mode     whatsapp.operate
PUT  /api/v1/admin/whatsapp/ai                         store.configure
```

Body de mode: `{ "mode": "HUMAN" | "BOT" | "PAUSED" }`. `CLOSED` continua no endpoint de encerrar.

Na thread, mostre o modo e os botões. Interruptores “IA habilitada” e “resposta automática”, desligados por padrão, com texto: a IA não define preço nem fecha pedido sozinha.

## Testes

- Frase “quero atendente” vai para `HUMAN` e não chama o provider (o fake conta chamadas).
- Resposta do fake com “fica R$ 10” é bloqueada, sem mensagem `OUT` do bot, outcome `BLOCKED`.
- Confiança 0,2 gera handoff.
- `ai_enabled=false` não chama o provider.
- Tenant B não altera modo da conversa de A.

## Como validar

```bash
npm run migration:run
npx nx test api
npx nx test worker
```

## Critério de conclusão

O modo bot existe, está desligado por padrão, recusa resposta com preço e entrega a conversa para uma pessoa quando a confiança é baixa ou o cliente pede.
