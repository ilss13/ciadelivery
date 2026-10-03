# 04-04 — Timeline em tempo real e critério da Fase 4

> Implemente somente esta tarefa. Leia as convenções. A 04-03 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 4 — Operação em tempo real |
| Depende de | 04-03 |
| Desbloqueia | 05-01 |
| Critério da fase | Um pedido criado no storefront aparece no painel sem refresh e cada mudança de status aparece ao consumidor em tempo real |

## Objetivo

A página de acompanhamento do consumidor reage ao Socket.IO, e um teste de ponta a ponta prova o critério da fase.

## Storefront

Na rota `/pedido/:trackingToken`:

- carregue o pedido por HTTP;
- conecte no namespace `/realtime` com o tracking token;
- ao receber evento daquele `orderId`, atualize status e acrescente a linha na timeline sem recarregar. Se quiser reconciliação, pode refazer o GET; a UI não pode exigir F5;
- rótulos em português, hora local, ordem cronológica;
- se o socket cair, mostre “reconectando” e, ao voltar, faça GET para não perder evento;
- recusa e cancelamento mostram a nota, se a API pública do GET incluir `note` do histórico. Inclua a nota no GET público. Não inclua nome do operador; `actorType` basta.

## Prova do critério

Teste de integração `phase4-acceptance.spec.ts` com API, worker, MySQL e Redis:

1. Cliente Socket.IO com JWT do owner entra na sala da loja.
2. Cliente Socket.IO com tracking token (obtido depois do POST) será conectado após a criação. Para o critério “aparece sem refresh”, o owner já está conectado **antes** do POST.
3. POST público cria o pedido.
4. O owner recebe `order.created` com o `orderId` em até 5 segundos, sem chamar GET.
5. O consumidor conecta com o token.
6. Owner chama accept, start-preparation e ready.
7. O consumidor recebe os três eventos na ordem, em até 5 segundos cada.
8. Outro JWT de outro tenant, conectado o tempo todo, não recebe nenhum desses eventos.
9. GET do token mostra o histórico coerente com o último status (`READY`).

Playwright, se o ambiente aguentar dois contextos: página do admin logada e storefront. Crie o pedido e afirme que o número aparece no painel. Aceite no painel e afirme que o acompanhamento mudou o texto para aceito sem `reload`. Se o e2e for instável por causa de som ou permissão do browser, o teste de integração acima é o aceite obrigatório; o Playwright continua obrigatório para a aparição do card.

## Como validar

```bash
npx nx test api --testPathPattern=phase4-acceptance
npx nx e2e storefront-e2e
```

Verifique no navegador os dois lados abertos ao mesmo tempo.

## Critério de conclusão

O teste de aceite passa nos dois sentidos: painel recebe o pedido sem refresh; consumidor recebe cada mudança de status em tempo real; o outro tenant não recebe nada.
