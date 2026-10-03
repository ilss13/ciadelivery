# 03-01 — Clientes, endereços, consentimento e pagamento offline

> Implemente somente esta tarefa. Leia as convenções. A 02-04 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 3 — Checkout, clientes e pedidos |
| Depende de | 02-04 |
| Desbloqueia | 03-02, 03-03 |
| Critério da fase que esta tarefa avança | O pedido poderá identificar a pessoa pelo telefone, sem conta |

## Objetivo

Identificar o cliente pelo telefone dentro do tenant, guardar endereço e consentimento, e configurar formas de pagamento offline.

## Fora de escopo

Criar pedido, gateway de pagamento, OTP, conciliação de PIX.

## Modelo

### `customers`

Único `(tenant_id, phone)`. `phone` só dígitos com DDI, normalizado para Brasil: se vier com 10 ou 11 dígitos, prefixe `55`. Inválido: `400` `INVALID_PHONE`.

Colunas: `id`, `tenant_id`, `store_id`, `name`, `phone`, `created_at`, `updated_at`.

### `customer_addresses`

`id`, `tenant_id`, `customer_id`, `label` null, linha, número, complemento null, bairro, cidade, UF, CEP, `latitude`/`longitude` null, `created_at`.

Não geocodifique ainda. A Fase 5 preenche coordenadas.

### `customer_consents`

`id`, `tenant_id`, `customer_id`, `purpose` (`OPERATIONAL` ou `MARKETING`), `granted` bool, `policy_version` varchar, `ip`, `user_agent`, `created_at`.

Append-only. Novo consentimento insere linha; não atualize a antiga.

### `payment_methods`

`id`, `tenant_id`, `store_id`, `code` (`CASH`, `CARD_ON_DELIVERY`, `PIX_MANUAL`, `PAY_ON_PICKUP`, `OTHER`), `label`, `instructions` null, `enabled` bool, `sort_order`.

Único `(store_id, code)`. PIX manual guarda a chave em `instructions`. Não consulte banco nem gere cobrança.

Ao criar a loja, semeie os quatro primeiros codes desabilitados, exceto `CASH` e `PAY_ON_PICKUP` habilitados.

## API

Identificação pública, usada pelo checkout na próxima tarefa. Nesta tarefa já exponha:

```text
POST /api/v1/public/customers/identify
```

Body: `name`, `phone`. Cria ou atualiza o nome do cliente **deste** tenant. Não devolve lista de pedidos nem endereços de outro telefone. Resposta: `{ "customerId", "name", "phone" }`. Rate limit 20/min por IP.

```text
GET  /api/v1/admin/customers            customers.read, paginado, filtro phone e q
GET  /api/v1/admin/customers/:id        customers.read, inclui endereços
GET  /api/v1/admin/payment-methods      store.configure
PUT  /api/v1/admin/payment-methods      store.configure, substitui enabled, label, instructions
```

Id de cliente de outro tenant: `404` `CUSTOMER_NOT_FOUND`.

Não crie senha de cliente. Não exija e-mail.

## UI admin

Tela “Clientes” com busca por telefone. Tela em configurações para ligar/desligar formas de pagamento e editar a instrução do PIX. Confirme ao desabilitar a última forma ativa (`400` `PAYMENT_METHOD_REQUIRED` na API se nenhuma ficar enabled).

## Testes

- Unitário da normalização de telefone: `(11) 98888-7777`, `11988887777` e `5511988887777` viram o mesmo valor.
- Integração: o mesmo número em dois tenants cria dois clientes; a busca admin de A não acha o cliente de B; desabilitar todos os pagamentos falha.

## Como validar

```bash
npm run migration:run
npx nx test api
npx nx test admin
npm run openapi:generate
```

## Critério de conclusão

O mesmo telefone é a mesma pessoa dentro da loja e outra pessoa em outra loja. Há formas de pagamento offline configuráveis, sem integração financeira.
