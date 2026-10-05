# Alertas

O endpoint `GET /metrics` fala o texto do Prometheus. Não há Grafana neste repositório. Quem opera sobe o Prometheus (e, se quiser, o Grafana) fora daqui e aponta o scrape para a API.

## Acesso

- Se `METRICS_TOKEN` estiver definido, o scrape envia `Authorization: Bearer <token>`.
- Se a variável estiver vazia, o endpoint fica aberto. Em local, a API deve ser alcançável só pela rede do Compose, sem publicar a porta para fora dessa rede.
- Em staging e production, defina `METRICS_TOKEN`.
- O worker também expõe `/metrics` na porta de health. As séries de HTTP ficam no processo que atendeu a requisição. Contadores de pedido, WhatsApp e job ficam no Redis e aparecem no scrape de qualquer processo.

## Séries

| Série | Uso |
|---|---|
| `http_requests_total` | Contagem por método, rota (template, sem id de pedido) e status |
| `http_request_duration_seconds` | Latência da mesma chave |
| `orders_created_total` | Pedidos criados, sem tenant no label |
| `outbox_events{state="pending\|failed"}` | Outbox pendente ou falho |
| `jobs_failed_total{queue}` | Job que esgotou tentativa (`outbox-events`, `whatsapp-outbound`) |
| `jobs_retried_total{queue}` | Retry desses jobs |
| `mysql_up` / `redis_up` | 1 quando o mesmo check do readiness passou, 0 quando falhou |
| `whatsapp_messages_sent_total` / `whatsapp_messages_failed_total` | Mensagens, sem tenant e sem id de conexão |

## Regras

```yaml
groups:
  - name: ciadelivery
    rules:
      - alert: ReadinessDown
        expr: mysql_up == 0 or redis_up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: MySQL ou Redis falhou no readiness por 2 minutos

      - alert: OutboxFailed
        expr: outbox_events{state="failed"} > 0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Existe evento de outbox em FAILED há mais de 10 minutos

      - alert: HttpServerErrors
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[5m]))
            /
            clamp_min(sum(rate(http_requests_total[5m])), 0.001)
          ) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Mais de 5% das respostas HTTP são 5xx

      - alert: WhatsAppSendFailures
        expr: increase(whatsapp_messages_failed_total[10m]) > 0 or increase(jobs_failed_total{queue="whatsapp-outbound"}[10m]) > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: A fila de WhatsApp registrou falha de envio
```

## Painéis que importam

1. Disponibilidade: `mysql_up` e `redis_up`.
2. HTTP: taxa de requisições, percentual de 5xx e latência p95 de `http_request_duration_seconds`.
3. Outbox: `pending` e `failed` no tempo.
4. Jobs: `jobs_failed_total` e `jobs_retried_total` por fila.
5. WhatsApp: enviadas contra falhas, sem quebrar por loja.
6. Pedidos: `orders_created_total` como volume global.
