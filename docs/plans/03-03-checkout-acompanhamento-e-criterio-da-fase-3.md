# 03-03 — Checkout, acompanhamento e critério da Fase 3

> Implemente somente esta tarefa. Leia as convenções. A 03-02 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 3 — Checkout, clientes e pedidos |
| Depende de | 03-02 |
| Desbloqueia | 04-01 |
| Critério da fase | O consumidor realiza um pedido completo sem cadastro obrigatório e consegue consultá-lo depois |

## Objetivo

Fechar o fluxo do consumidor no storefront, do carrinho até a página de acompanhamento, e automatizar o aceite da fase.

## Storefront

Fluxo em uma rota `/checkout` e outra `/pedido/:trackingToken`:

```text
Carrinho válido
  -> nome e telefone
  -> entrega ou retirada
  -> endereço, se entrega
  -> forma de pagamento habilitada
  -> revisão (itens, taxa, total)
  -> pedido criado
  -> acompanhamento
```

Regras de UX:

- não peça senha, e-mail obrigatório nem “crie sua conta”;
- checkbox de consentimento operacional obrigatório, com link para a política da landing ou texto curto da própria loja; marketing opcional;
- entrega mostra a taxa vinda da revisão no servidor. Não calcule taxa no Angular;
- revisão chama `POST /public/orders` só no botão final, com `Idempotency-Key` gerada no cliente (UUID) e reutilizada se a rede falhar e a pessoa tocar de novo;
- duplo clique não dispara dois POSTs em voo;
- erro `CART_INVALID`, `STORE_CLOSED`, `MINIMUM_ORDER_NOT_MET` e `PAYMENT_METHOD_DISABLED` aparecem em português a partir do `code`;
- PIX manual mostra `instructions` na revisão e na página do pedido;
- depois do `201`, grave o token só na memória da navegação até abrir `/pedido/:token`. Não ponha o token em `localStorage` permanente. A página de acompanhamento funciona se a pessoa guardar o link;
- a timeline lê `history` do GET e mostra hora local e o rótulo: realizado, aceito, em preparação, pronto, saiu para entrega, entregue, recusado, cancelado. Status futuros ainda não ocorrem, mas os rótulos de `NEW` já aparecem (“Pedido realizado”);
- loading, erro de rede com “tentar de novo” no GET do pedido, layout usável a 360 px.

Admin, tela simples “Pedidos” somente leitura para quem tem `orders.read`: número, horário, total, status, tipo. Sem aceite ainda. Link não é obrigatório. Id de outro tenant não abre.

## Prova do critério

`phase3-acceptance.spec.ts`:

1. Sem header Authorization, cria pedido delivery com adicional, consentimento e pagamento em dinheiro.
2. Resposta traz `trackingToken` e status `NEW`.
3. GET do token devolve os itens com o nome do adicional e o total.
4. Repetir o POST com a mesma chave devolve o mesmo `orderId` e não aumenta a contagem de pedidos.
5. Não existe chamada de cadastro prévio: o cliente nasce no POST (ou no identify interno). O teste não chama rota de signup.
6. Alterar `price_cents` do produto e ler de novo o pedido: `unit_price_cents` do item permanece o original.

Playwright: percorre o checkout da pizzaria de demonstração até a URL de acompanhamento conter o número do pedido ou o texto “Pedido realizado”.

## Como validar

```bash
npx nx test api --testPathPattern=phase3-acceptance
npx nx test storefront
npx nx e2e storefront-e2e
```

Confira no navegador o fluxo em viewport estreita: carrinho, checkout e acompanhamento.

## Critério de conclusão

Uma pessoa faz o pedido completo sem criar conta e abre o acompanhamento depois, pelo link. Os testes de aceite passam.
