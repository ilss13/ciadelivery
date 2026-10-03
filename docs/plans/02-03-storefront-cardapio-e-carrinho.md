# 02-03 — Storefront: cardápio e carrinho

> Implemente somente esta tarefa. Leia as convenções. A 02-02 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 2 — Catálogo e storefront |
| Depende de | 02-02 |
| Desbloqueia | 02-04 |
| Critério da fase que esta tarefa avança | O consumidor vê o cardápio e monta um carrinho |

## Objetivo

Cardápio público navegável e carrinho no navegador, com validação no servidor antes de considerar o carrinho válido.

## Fora de escopo

Checkout, telefone, endereço, criação de pedido, pagamento. O carrinho não vira pedido nesta tarefa.

## API

```text
POST /api/v1/public/cart/validate
```

Body:

```json
{
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "optionIds": ["uuid"],
      "notes": "sem cebola"
    }
  ]
}
```

Regras do validador, no domínio de catálogo:

- produto existe, `active`, pertence ao tenant do host;
- `available`, senão `PRODUCT_UNAVAILABLE` naquele item;
- quantidade inteira de 1 a 99;
- cada grupo do produto respeita `min_select` e `max_select` entre opções `available`;
- opção de outro produto ou outro tenant é `OPTION_NOT_FOUND`;
- nota com no máximo 280 caracteres;
- subtotal do item = (`price_cents` + soma dos acréscimos) × quantidade;
- a resposta devolve nomes e preços **lidos agora do banco**, ignorando qualquer preço que o cliente envie (o cliente nem envia preço).

Resposta `200`:

```json
{
  "items": [],
  "subtotalCents": 0,
  "minimumOrderCents": 0,
  "meetsMinimumOrder": true,
  "storeOpen": true,
  "valid": true,
  "errors": []
}
```

Carrinho vazio é `valid: false` com code `CART_EMPTY`. Não use 422 para item inválido misturado: responda `200` com `valid: false` e `errors[]` `{ "code", "itemIndex", "message" }` para a UI apontar o item. Body malformado continua `400`.

O pedido mínimo e a loja fechada podem deixar `valid: false` nesta tarefa se a 02-04 ainda não refinou a cópia; chame as regras já existentes de `isOpen` e `minimum_order_cents`. A 02-04 fecha os casos de borda.

## Storefront

Feature `features/catalog` e `features/cart`:

- categorias em lista ou âncora;
- produtos com foto, preço em BRL, selo “indisponível”;
- abrir produto: grupos obrigatórios e opcionais, quantidade, observação;
- botão adicionar desabilitado até a variação obrigatória estar escolhida;
- carrinho persistido em `sessionStorage` chaveada pelo slug do tenant (trocar de host não reaproveita item);
- editar quantidade, remover, ver subtotal;
- botão “validar carrinho” chama a API e mostra erros por item;
- loading, vazio (“o cardápio ainda não tem itens”) e erro de rede com tentar de novo;
- mobile-first. Largura estreita: carrinho acessível sem perder o cardápio.

Não há conta de consumidor.

## Testes

- Unitário do validador: grupo obrigatório faltando; adicional acima do máximo; produto inativo; preço calculado no servidor.
- Integração HTTP do `cart/validate` com dois tenants (opção de A não valida no host de B).
- Componente: produto indisponível não emite adicionar; carrinho mostra subtotal dos dois itens.

## Como validar

```bash
npx nx test api
npx nx test storefront
```

No navegador, monte um item com variação e adicional e valide. O subtotal deve bater com o preço do banco.

## Critério de conclusão

O consumidor de uma loja monta um carrinho com produto e adicionais, e o servidor confirma que ele é estruturalmente válido para aquela loja.
