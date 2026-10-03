# 07-02 — Relatórios básicos

> Implemente somente esta tarefa. Leia as convenções. A 07-01 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 7 — Administração, auditoria e relatórios |
| Depende de | 07-01 |
| Desbloqueia | 07-03 |
| Critério da fase que esta tarefa avança | A empresa consulta o movimento do período sem planilha manual |

## Objetivo

Entregar os relatórios do MVP (seção 34), calculados no MySQL, sem BI.

## API

Todos exigem `reports.read`. Período obrigatório `from` e `to` (máximo 366 dias). Datas inclusivas no fuso da loja, convertidas para UTC na query.

```text
GET /api/v1/admin/reports/overview
GET /api/v1/admin/reports/products
GET /api/v1/admin/reports/customers
GET /api/v1/admin/reports/couriers
GET /api/v1/admin/reports/orders.csv
```

`overview`:

- quantidade de pedidos;
- soma de `total_cents` dos pedidos não cancelados e não rejeitados (faturamento informado pelo pedido, não pagamento liquidado);
- ticket médio inteiro (divisão truncada);
- contagem por status;
- cancelados;
- contagem por `source`.

Origem: coluna `orders.source` se ainda não existir, adicionar agora. Valores `STOREFRONT` (default na criação atual) e `WHATSAPP` (reservado à Fase 9; o relatório já agrupa).

`products`: mais vendidos por quantidade e por `subtotal_cents` do snapshot, top 20.

`customers`: clientes com 2 ou mais pedidos no período (recorrentes), telefone mascarado na lista.

`couriers`: entregas `DELIVERED` por entregador no período.

CSV de pedidos: número, data, status, total, origem, tipo. Só do tenant. `Content-Disposition` attachment. Não exporte tracking token.

Índices da seção 36 que ainda não existirem entram nesta migration:

```text
orders(tenant_id, status, created_at)
orders(tenant_id, customer_id, created_at)
products(tenant_id, category_id, active)
customers(tenant_id, phone)
delivery_assignments(tenant_id, courier_id, status)
messages(tenant_id, conversation_id, created_at)
outbox_events(status, created_at)
```

Evite N+1. Uma query agregada por relatório.

## UI

Rota `/relatorios`: filtro de datas (atalhos hoje, 7 dias, 30 dias), cartões do overview, tabela de produtos, recorrentes e entregadores, botão exportar CSV. Loading e vazio (“sem pedidos no período”).

## Testes

- Dois pedidos delivered e um cancelled: faturamento soma só os delivered; ticket médio coerente; cancelados = 1.
- Pedido de outro tenant não entra na soma.
- CSV não contém token nem telefone completo se a coluna de telefone nem existir no CSV (não inclua telefone no CSV).

## Como validar

```bash
npm run migration:run
npx nx test api
npx nx test admin
```

## Critério de conclusão

O owner vê faturamento, ticket, status, cancelados, recorrentes, produtos e entregas do entregador no período, só da própria loja, e exporta o CSV.
