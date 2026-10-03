# 02-04 — Loja fechada, pedido mínimo e critério da Fase 2

> Implemente somente esta tarefa. Leia as convenções. A 02-03 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 2 — Catálogo e storefront |
| Depende de | 02-03 |
| Desbloqueia | 03-01 |
| Critério da fase | O consumidor consegue montar um carrinho válido com produtos e adicionais de uma loja |

## Objetivo

Completar as regras comerciais do carrinho e provar o aceite da Fase 2 de ponta a ponta.

## Regras

No `cart/validate` e na UI:

- se `storeOpen` for falso, `valid` é falso e o erro global é `STORE_CLOSED`. O cardápio continua visível. O botão de confirmar carrinho não segue adiante;
- se o subtotal for menor que `minimumOrderCents`, `valid` é falso com `MINIMUM_ORDER_NOT_MET` e a UI mostra quanto falta em BRL;
- produto que ficou `available=false` depois de entrar no `sessionStorage` aparece no validate como `PRODUCT_UNAVAILABLE` e a UI pede para remover;
- opção que ficou indisponível: `OPTION_UNAVAILABLE`;
- carrinho com itens de uma validação antiga não é reaproveitado se o slug mudou.

Seed de demonstração (`SEED_DEMO=true`): em `pizzariadoze`, categoria “Pizzas”, produto “Calabresa” R$ 49,90, grupo obrigatório “Tamanho” (média R$ 0, grande R$ 10,00), grupo “Adicionais” máximo 3 (borda R$ 8,00, extra queijo R$ 6,00). Um produto “Esgotado” com `available=false`.

## Prova do critério

Teste de integração `phase2-acceptance.spec.ts`:

1. Host da pizzaria.
2. Lê o produto público Calabresa.
3. `cart/validate` com tamanho grande e borda.
4. `valid` true, `subtotalCents` = (4990 + 1000 + 800).
5. O mesmo body no host do burger retorna item inválido (`PRODUCT_NOT_FOUND` ou equivalente no erro do item), nunca preço da pizzaria.
6. Sem tamanho: `valid` false.
7. Loja com fechamento manual: `STORE_CLOSED`.
8. Subtotal abaixo do mínimo configurado no teste: `MINIMUM_ORDER_NOT_MET`.

Playwright do storefront: adiciona Calabresa com tamanho e adicional, abre o carrinho e vê o nome do adicional e o valor. Não é obrigatório clicar em checkout (não existe ainda).

## Como validar

```bash
npx nx test api --testPathPattern=phase2-acceptance
npx nx e2e storefront-e2e
```

## Critério de conclusão

O teste de aceite passa: o carrinho válido tem produto e adicional daquela loja, e os casos inválidos (outra loja, sem variação, fechada, abaixo do mínimo) não passam como válidos.
