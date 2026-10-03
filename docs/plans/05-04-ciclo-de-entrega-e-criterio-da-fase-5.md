# 05-04 — Ciclo de entrega e critério da Fase 5

> Implemente somente esta tarefa. Leia as convenções. A 05-03 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 5 — Delivery e entregadores |
| Depende de | 05-03 |
| Desbloqueia | 06-01 |
| Critério da fase | O sistema bloqueia pedidos fora da área permitida e permite concluir todo o ciclo até a entrega |

## Objetivo

Provar o ciclo completo e garantir que a timeline do consumidor acompanhe saída e entrega.

## Regras que precisam estar verdadeiras

Revise e complete lacunas, sem reescrever o que já passa:

- endereço fora do raio ou sem faixa não cria pedido;
- pedido delivery não vai a `OUT_FOR_DELIVERY` sem entregador;
- entregador só move a própria atribuição;
- `start` e `complete` gravam histórico e outbox;
- o acompanhamento público mostra “Saiu para entrega” e “Pedido entregue” quando o socket ou o GET atualizam;
- o painel admin move o card até finalizados;
- retirada continua podendo ir de `READY` a `DELIVERED` sem courier;
- cancelar depois de `OUT_FOR_DELIVERY` não é transição válida.

## Prova

`phase5-acceptance.spec.ts`:

1. Configura raio 8 km e faixas 0–3, 3–5, 5–8 com o stub de geocoding.
2. Quote e POST de endereço mapeado para ~9 km: nenhum pedido novo.
3. POST de endereço ~2 km: pedido `NEW` com taxa da primeira faixa.
4. Accept, start-preparation, ready.
5. Assign courier.
6. Courier `start`: status `OUT_FOR_DELIVERY`.
7. Socket do tracking token recebe `order.out_for_delivery`.
8. Courier `complete`: `DELIVERED`, assignment `DELIVERED`.
9. GET público mostra a timeline com realizado, aceito, em preparação, pronto, saiu para entrega e entregue.
10. Courier B não consegue `complete` desse pedido.

Playwright em viewport de celular no app courier: login do entregador de demonstração (inclua um courier no `SEED_DEMO`), abrir o pedido atribuído pelo teste ou pelo seed e concluir. Se o seed não tiver pedido, o teste de API é o obrigatório e o Playwright cobre a tela de login e a lista vazia útil (“nenhuma entrega atribuída”).

## Como validar

```bash
npx nx test api --testPathPattern=phase5-acceptance
npx nx test courier
```

No navegador, percorra o ciclo uma vez com a pizzaria de demonstração.

## Critério de conclusão

O teste de aceite passa: fora da área não vira pedido; o ciclo interno termina em entregue, com o consumidor enxergando as etapas.
