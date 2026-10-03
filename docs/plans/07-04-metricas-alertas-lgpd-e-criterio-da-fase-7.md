# 07-04 — Métricas, alertas, LGPD e critério da Fase 7

> Implemente somente esta tarefa. Leia as convenções. A 07-03 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 7 — Administração, auditoria e relatórios |
| Depende de | 07-03 |
| Desbloqueia | 08-01 |
| Critério da fase | A empresa consegue operar o negócio diariamente sem depender de acesso técnico ao sistema |

## Objetivo

Fechar observabilidade mínima, os direitos operacionais de LGPD e um teste que percorre o dia da loja só pela API do produto.

## Métricas

Endpoint `GET /metrics` em texto Prometheus, protegido por `METRICS_TOKEN` se a variável existir; em local pode ficar aberto só na rede do Compose. Métricas:

- HTTP: contagem e duração por rota e status (não use o id do pedido como label);
- outbox: pendentes, falhos;
- jobs: falha e retry;
- Redis e MySQL: 1 ou 0 no readiness já existente, mais gauge se o check passou;
- WhatsApp: conexões `CONNECTED` por processo não, isso vaza tenant. Use contadores sem label de tenant: mensagens sent/failed;
- pedidos criados (contador global, sem tenant no label).

Arquivo `docs/ops/alertas.md` com regras em texto que um Prometheus pode usar:

- readiness 0 por 2 minutos;
- outbox `FAILED` > 0 por 10 minutos;
- taxa de 5xx acima de um limiar;
- fila de WhatsApp falha.

Não suba Grafana neste repositório. O documento diz quais painéis importam.

## LGPD

```text
GET  /api/v1/admin/customers/:id/export     users.manage
POST /api/v1/admin/customers/:id/anonymize  users.manage
```

Export JSON do cliente, endereços, consentimentos e pedidos (snapshot já é dado do pedido; pode incluir). Sem dados de outro cliente.

Anonymize: nome vira “Cliente anonimizado”, telefone vira hash irreversível com sal da aplicação, endereços reduzidos à cidade, consentimentos permanecem como prova. Pedidos já criados mantêm o snapshot de nome **somente** se você também substituir `customer_name` e `customer_phone` nos pedidos daquele cliente. Faça essa substituição. Não apague pedido. Confirmação na UI digitando o telefone.

Registre auditoria `customer.anonymized` sem o telefone antigo em claro.

Política de retenção: documento curto em `docs/ops/retencao.md` (pedidos ficam enquanto a conta existir; log de aplicação 30 dias é recomendação operacional, não um job destrutivo inventado). Não crie job que apague pedido.

## Prova do critério

`phase7-acceptance.spec.ts` executa, só com HTTP autenticado do owner, sem SQL direto:

1. Lê dashboard.
2. Cria categoria e produto pela API admin (ou usa o seed) e confirma o público.
3. Um pedido público é criado.
4. Owner aceita e marca em preparo.
5. Owner lê o cliente e o relatório do dia com pelo menos esse pedido.
6. Owner lê auditoria e encontra a mudança de status.
7. Attendant não lê auditoria nem desliga a loja (`store.configure` 403).
8. Nenhum passo usa rota de plataforma nem acesso ao banco.

Isso é o “sem acesso técnico”: o teste não abre mysql client para operar.

## Como validar

```bash
npx nx test api --testPathPattern=phase7-acceptance
npx nx test admin
```

Confira dashboard, relatório e auditoria no navegador.

## Critério de conclusão

O dia operacional do teste passa só pela API do estabelecimento, métricas e alertas estão descritos e expostos, e a anonimização de um cliente funciona sem apagar o histórico de pedidos.
