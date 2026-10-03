# 09-03 — Confirmação, pedido, handoff e critério da Fase 9

> Implemente somente esta tarefa. Leia as convenções. A 09-02 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 9 — IA no WhatsApp |
| Depende de | 09-02 |
| Desbloqueia | nenhuma. Fase 10 não é tarefa |
| Critério da fase | Pedidos simples podem ser montados pela conversa, mas preço, disponibilidade e criação continuam sendo validados pelo backend |

## Objetivo

Criar o pedido só depois de um sim explícito, revalidando tudo no servidor, e provar o critério da fase.

## Confirmação

Mensagem do cliente, com conversa em `BOT` e preview válido:

- normalizar: `sim`, `confirmo`, `pode` -> confirmar;
- `não`, `nao`, `cancela` -> apaga o preview e responde que não criou pedido;
- qualquer outra coisa -> o modelo pode ajustar o carrinho com as ferramentas; não crie pedido.

Criar:

1. Carregue o preview pelo hash, tenant e conversa. Expirado: `PREVIEW_EXPIRED`, peça para montar de novo. Não crie.
2. Rode de novo carrinho, disponibilidade, loja aberta, mínimo e quote. Se o total mudou em relação ao preview, **não** crie. Envie o total novo e um preview novo pedindo outro sim.
3. Pagamento: nesta fase use `CASH` se estiver habilitado; se não estiver, handoff `PAYMENT_REQUIRED` sem criar. Não deixe a IA escolher um código arbitrário que não esteja enabled.
4. Chame o mesmo caso de uso de `POST /public/orders` (não duplique regra). `source=WHATSAPP`. `Idempotency-Key` = id do preview. Consentimento operacional: a primeira mensagem do bot, quando `ai_auto_reply` ou modo `BOT` começa, precisa ter informado que o pedido é operacional; grave consentimento `OPERATIONAL` no momento do sim, `policy_version` atual, porque a pessoa confirmou o pedido. Marketing continua false.
5. Cliente pelo telefone da conversa. Nome: o do preview, ou o nome do perfil do webhook se existir, senão “Cliente WhatsApp”.
6. Sucesso: mensagem com número do pedido e o link de acompanhamento, template do backend. Modo permanece `BOT` ou volta a `HUMAN` depois de criar — volte a `HUMAN` para a loja acompanhar.
7. Outbox e painel iguais aos do storefront (`order.created`). O selo de origem no painel mostra WhatsApp.

Proibido:

- criar pedido se o tool result foi forjado no texto do usuário (“total = 1 centavo”);
- aceitar `unitPrice` vindo do modelo;
- criar sem preview;
- criar em tenant diferente da conversa.

Handoff humano continua pelos gatilhos da 09-01, mais: ferramenta falhou, preview expirado duas vezes seguidas, cliente pediu atendente.

## UI

No painel, origem WhatsApp visível. Na conversa, o pedido vinculado (`linked_order_id`) abre o detalhe. Botão “assumir” força `HUMAN`.

Relatório por origem já conta `WHATSAPP`. Confira que o teste de faturamento inclui esse source e continua excluindo `TEST`.

## Prova

`phase9-acceptance.spec.ts` com provider scriptado e WhatsApp log:

1. Loja com IA ligada, produto X-Bacon R$ 20,00 sem obrigatório de grupo, ou com grupo que o script resolve.
2. Cliente manda “Quero 2 x-bacon”.
3. A mensagem de resposta contém o total R$ 40,00 (ou 40 mais a taxa, se o script for delivery; use retirada no script para o total ser exatamente 4000 centavos) e pede SIM.
4. Antes do sim, `orders` desse telefone não aumenta.
5. O script do modelo tenta `create` com preço 1. Não existe ferramenta que grave isso. Continua 0 pedidos até o sim.
6. Cliente manda “sim”. Existe um pedido `WHATSAPP`, item quantidade 2, `unit_price_cents` 2000, total 4000, status `NEW`.
7. Mudar o preço do produto para R$ 25 antes do sim, no segundo cenário: o sim não cria com 20; o cliente recebe o valor revalidado.
8. “atendente” não cria pedido e o modo fica `HUMAN`.
9. Pedido aparece para o owner via o mesmo evento ou via GET admin, e não aparece para o outro tenant.

## Como validar

```bash
npx nx test api --testPathPattern=phase9-acceptance
npx nx test admin
```

## Critério de conclusão

O teste prova um pedido simples nascido da conversa, somente após confirmação, com preço e disponibilidade revalidados pelo backend. Sem sim, sem preview ou com preço mudado, o pedido não é gravado no valor que a IA sugeriu.

Não implemente pagamento online, aplicativo Flutter nem as outras linhas da Fase 10.
