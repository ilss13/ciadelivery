# 02-01 — Catálogo: categorias, produtos e opções

> Implemente somente esta tarefa. Leia as convenções. A 01-05 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 2 — Catálogo e storefront |
| Depende de | 01-05 |
| Desbloqueia | 02-02, 02-03 |
| Critério da fase que esta tarefa avança | O estabelecimento cadastra o cardápio que o consumidor vai montar |

## Objetivo

CRUD de categorias, produtos, grupos de opções e opções, isolado por tenant, com preço em centavos.

## Decisão

Variação (tamanho, sabor único) é um grupo de opções com `min_select = 1` e `max_select = 1`. Adicional é um grupo com `min_select = 0` ou mais e `max_select` maior. Não crie entidade `Variation` separada.

## Modelo

Todas as tabelas têm `tenant_id` e `store_id`. Ids UUID. `created_at` e `updated_at`.

### `categories`

`name`, `description` null, `sort_order` int, `active` bool. Índice `(tenant_id, store_id, active, sort_order)`.

### `products`

`category_id`, `name`, `description` null, `price_cents` int ≥ 0, `sku` null, `image_key` null, `active` bool, `available` bool, `sort_order`. Índice `(tenant_id, category_id, active)`.

`active=false` some do cardápio público. `available=false` aparece como indisponível e não entra no carrinho.

### `product_option_groups`

`product_id`, `name`, `min_select`, `max_select`, `sort_order`. `min_select` ≤ `max_select`. `max_select` ≥ 1.

### `product_options`

`group_id`, `name`, `price_cents` ≥ 0 (acréscimo), `available` bool, `sort_order`.

Apagar categoria com produto ativo: `409` `CATEGORY_NOT_EMPTY`. Apagar produto: se não houver pedido (ainda não existem pedidos), delete físico; quando a Fase 3 existir, esta regra muda para `active=false`. Nesta tarefa delete físico é aceitável. Delete de grupo remove opções na mesma transação.

## API admin

Exige `catalog.manage`. Sem `tenantId` no body.

```text
GET/POST        /api/v1/admin/categories
PATCH/DELETE    /api/v1/admin/categories/:id

GET/POST        /api/v1/admin/products
GET/PATCH/DELETE /api/v1/admin/products/:id

POST            /api/v1/admin/products/:id/option-groups
PATCH/DELETE    /api/v1/admin/products/:productId/option-groups/:groupId
POST            /api/v1/admin/products/:productId/option-groups/:groupId/options
PATCH/DELETE    /api/v1/admin/option-groups/:groupId/options/:optionId
```

Listagens paginadas. Filtros de produto: `categoryId`, `active`, `q` no nome.

Preço no JSON é `priceCents` número inteiro. A UI formata BRL.

## API pública

```text
GET /api/v1/public/categories
GET /api/v1/public/products
GET /api/v1/public/products/:id
```

Só o tenant do host. Só categorias e produtos `active`. Opções `available=false` vêm com a flag, para a UI riscar. Produto de outro tenant: `404` `PRODUCT_NOT_FOUND`.

## Admin UI

Feature `features/catalog` no app admin:

- lista de categorias com reordenação por `sort_order` (botões subir/descer bastam);
- lista de produtos por categoria;
- formulário de produto com preço em reais na tela e centavos na API;
- editor de grupos: marcar “obrigatório escolher 1” para variação;
- estados vazio, carregando e erro;
- confirmar antes de excluir;
- mobile-first.

Quem não tem `catalog.manage` não vê o menu.

## Testes

- Unitário: grupo com `min > max` é inválido; preço negativo é inválido.
- Integração: owner A não lê produto de B; público não devolve produto `active=false`; attendant recebe 403 no POST.

## Como validar

```bash
npm run migration:run
npx nx test api
npx nx test admin
npm run openapi:generate
```

## Critério de conclusão

Um owner cadastra categoria, produto, uma variação obrigatória e um adicional, e o `GET` público daquele host devolve essa árvore. O outro host não a vê.
