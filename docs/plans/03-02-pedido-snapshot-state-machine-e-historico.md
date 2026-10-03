# 03-02 — Pedido, snapshot, state machine e histórico

> Implemente somente esta tarefa. Leia as convenções. A 03-01 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 3 — Checkout, clientes e pedidos |
| Depende de | 03-01 |
| Desbloqueia | 03-03, 04-01 |
| Critério da fase que esta tarefa avança | O pedido nasce completo, consultável depois, sem conta |

## Objetivo

Criar o pedido a partir do carrinho validado, congelar preços e permitir consulta pelo link opaco. A máquina de estados existe e é testada; os botões operacionais de transição ficam na Fase 4, exceto a criação que grava `NEW`.

## Modelo

### `orders`

| Coluna | Regra |
|---|---|
| id | UUID |
| tenant_id, store_id, customer_id | obrigatórios |
| order_number | inteiro sequencial **por tenant**, único `(tenant_id, order_number)` |
| status | `NEW` na criação |
| fulfillment | `DELIVERY` ou `PICKUP` |
| payment_method_code, payment_label, payment_instructions | snapshot da forma no momento |
| customer_name, customer_phone | snapshot |
| address_snapshot | JSON null se `PICKUP` |
| subtotal_cents, delivery_fee_cents, total_cents | inteiros |
| notes | null, máximo 280 |
| tracking_token_hash | SHA-256 de token opaco de 32 bytes. Único |
| idempotency_key | único `(tenant_id, idempotency_key)` |
| created_at, updated_at | |

### `order_items`

`id`, `tenant_id`, `order_id`, `product_id` nullável no futuro mas preenchido agora, `product_name`, `sku` null, `unit_price_cents`, `quantity`, `notes` null, `options_snapshot` JSON (`[{ optionId, groupName, name, priceCents }]`), `subtotal_cents`.

### `order_status_history`

`id`, `tenant_id`, `order_id`, `from_status` null na criação, `to_status`, `actor_type` (`CUSTOMER`, `USER`, `SYSTEM`), `actor_id` null para cliente, `note` null, `created_at`.

### `idempotency_records`

`tenant_id`, `key`, `request_hash`, `status_code`, `response_body`, `created_at`. Único `(tenant_id, key)`.

## Porta de taxa

`DeliveryQuotePort.quote(input) -> { feeCents, accepted, reason }`.

Implementação desta fase, `FlatDeliveryQuote`:

- `PICKUP`: taxa 0, accepted true, se a loja tiver `pickup_enabled` (coluna nova em `stores`, default true);
- `DELIVERY`: accepted se `delivery_enabled` (default true), taxa = `delivery_flat_fee_cents` (default 0). Sem raio e sem Haversine;
- coluna nova também: `estimated_prep_minutes` int default 40.

A Fase 5 troca o adapter. Não espalhe `if` de taxa fora da porta.

## Máquina de estados

Classe pura `OrderStateMachine` com as transições das convenções. Função `assertCanTransition(from, to)`. Sem I/O.

Nesta tarefa, o único comando exposto é criar, que grava `NEW` e a primeira linha de histórico. Não exponha accept/reject ainda. Teste a máquina por unidade para todas as transições válidas e inválidas, porque a Fase 4 vai chamá-la.

## Criação

```text
POST /api/v1/public/orders
Header Idempotency-Key: obrigatório
GET  /api/v1/public/orders/:trackingToken
```

Body de criação:

```json
{
  "customer": { "name": "Ana", "phone": "11988887777" },
  "fulfillment": "DELIVERY",
  "address": { "line": "Rua A", "number": "10", "district": "Centro", "city": "São Paulo", "state": "SP", "postalCode": "01001000", "complement": null },
  "paymentMethodCode": "CASH",
  "notes": null,
  "consents": { "operational": true, "marketing": false, "policyVersion": "2026-10-02" },
  "items": [{ "productId": "...", "quantity": 1, "optionIds": ["..."], "notes": null }]
}
```

Transação única:

1. Exija `Idempotency-Key`. Se a chave existir com o mesmo hash, devolva a resposta gravada. Se existir com hash diferente: `409` `IDEMPOTENCY_CONFLICT`.
2. Resolva ou crie o cliente neste tenant. Atualize o nome.
3. `operational: false` -> `400` `CONSENT_REQUIRED`. Grave as linhas de consentimento.
4. Rode as mesmas regras do `cart/validate`. Se inválido, `422` `CART_INVALID` com `details` dos erros. Não confie no subtotal do cliente.
5. Recuse loja fechada e pedido mínimo.
6. `paymentMethodCode` precisa estar enabled na loja. Senão `422` `PAYMENT_METHOD_DISABLED`.
7. `DELIVERY` exige endereço. `PICKUP` proíbe cobrar taxa.
8. Quote pela porta. Se `accepted` false, `422` com o reason (nesta fase, entrega desligada).
9. `total = subtotal + fee`.
10. Insira pedido, itens com snapshot, endereço do cliente, histórico `NEW`, registro de idempotência.
11. Resposta `201`: `orderId`, `orderNumber`, `status`, `totalCents`, `trackingToken` (o segredo em claro, **uma vez**), `trackingPath`.

`GET` pelo token em claro: busque pelo hash. Resposta pública sem `tenantId` interno desnecessário, com itens snapshot, totais, status, histórico (timeline) e endereço. Token errado: `404` `ORDER_NOT_FOUND` igual para token malformado. Não paginar histórico.

Alterar o preço do produto depois não muda `order_items`. Teste isso.

Concorrência do `order_number`: transação com leitura do máximo do tenant `FOR UPDATE` ou tabela `tenant_counters`. Dois posts paralelos não podem obter o mesmo número. Teste com duas criações paralelas.

## Testes

- Unitário da state machine, tabela completa.
- Integração: cria pedido; GET pelo token; segundo POST com a mesma chave não duplica; preço do produto muda e o GET antigo mantém o snapshot; host de outro tenant não acha o token (o token é globalmente único pelo hash, mas o GET não exige host — o token basta; não vaze nome de outra loja além do que é o próprio pedido). Pedido sem conta: a requisição não envia Authorization.
- Pickup sem endereço. Delivery sem endereço falha.

## Como validar

```bash
npm run migration:run
npx nx test api --testPathPattern=order
npm run openapi:generate
```

## Critério de conclusão

Dá para criar um pedido só com nome e telefone e lê-lo depois pelo token, com preços congelados e status `NEW`.
