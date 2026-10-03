# 06-04 — Retries, logs e critério da Fase 6

> Implemente somente esta tarefa. Leia as convenções. A 06-03 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 6 — WhatsApp operacional |
| Depende de | 06-03 |
| Desbloqueia | 07-01 |
| Critério da fase | O cliente recebe as notificações definidas e o estabelecimento consegue visualizar e responder conversas integradas |

## Objetivo

Fechar falha, retry e rastreio do WhatsApp e provar o aceite da fase sem depender de uma conta Meta real.

## O que completar

- Log estruturado de envio: `tenantId`, `messageId`, `templateKey`, `attempt`, `outcome`. Telefone mascarado. Sem token e sem corpo se o corpo tiver link de tracking; nesse caso logue só a chave do template.
- Retry já definido na 06-02 permanece: 5 tentativas, depois `FAILED`.
- Tela ou seção “Envios” com as últimas 50 mensagens de sistema do tenant: template, status, horário, erro curto.
- `SUPER_ADMIN` não lê o corpo das conversas de um tenant por rota de plataforma. Não crie essa rota.
- Métrica interna simples já pode ser contador em log; Prometheus fica na Fase 7. Não antecipe o stack inteiro.

## Prova

`phase6-acceptance.spec.ts` com `WHATSAPP_DRIVER=log`:

1. Conecta a loja A no driver log.
2. Cria pedido. Existe mensagem `order_received` `SENT` para o telefone do cliente, `event_id` único.
3. Accept, preparing, ready. Existem as três chaves seguintes, uma cada.
4. Provider que falha nas duas primeiras chamadas e sucede na terceira (fake injetado) termina `SENT` e não triplica mensagem.
5. Webhook assinado com texto “oi” cria conversa visível em `GET /admin/whatsapp/conversations` do owner A.
6. Owner A envia “Olá, já vimos seu pedido”. A mensagem `OUT` fica na thread.
7. Owner B não vê a conversa nem as mensagens.
8. Pedido da loja B com conexão própria gera `order_received` só com o número configurado em B.

Não marque o teste como pulado. Não use rede da Meta.

## Como validar

```bash
npx nx test api --testPathPattern=phase6-acceptance
npx nx test admin
```

## Critério de conclusão

O teste mostra as notificações de status definidas e uma conversa consultada e respondida no tenant certo, com retry sem duplicar.
