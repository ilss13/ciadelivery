# 05-02 — Geocodificação e quote no checkout

> Implemente somente esta tarefa. Leia as convenções. A 05-01 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 5 — Delivery e entregadores |
| Depende de | 05-01 |
| Desbloqueia | 05-03, 05-04 |
| Critério da fase que esta tarefa avança | Pedido fora da área permitida é bloqueado |

## Objetivo

Transformar endereço em coordenada atrás de uma porta, cotar a entrega no checkout e recusar o que estiver fora do raio ou da faixa.

## Porta

```typescript
interface GeocodingProvider {
  geocode(address: AddressInput): Promise<Coordinates>;
  reverseGeocode(coords: Coordinates): Promise<AddressResult>;
}
```

O domínio não importa SDK de mapa.

Implementações:

- `StubGeocodingProvider` em teste e quando `GEOCODING_DRIVER=stub`. Mapa em memória carregado no teste. Fora do teste, o stub de desenvolvimento pode usar um hash estável do CEP para uma coordenada dentro de uma caixa perto da origem da loja de demo, documentado no README, para o seed funcionar sem rede.
- `HttpGeocodingProvider` quando `GEOCODING_DRIVER=http`: `GET ${GEOCODING_URL}` com o endereço na query, timeout 3 s, espera JSON `{ "latitude", "longitude" }`. Não fixe Google no código. Falha de rede: `503` `GEOCODING_UNAVAILABLE`. Resultado vazio: `422` `ADDRESS_NOT_FOUND`.

Não chame o provedor a cada tecla. Chame no quote e de novo na criação do pedido.

Guarde latitude e longitude no endereço do cliente e no `address_snapshot` do pedido.

Origem: se a loja não tiver coordenada, geocodifique o endereço da loja uma vez no `PUT` da config ou da loja e persista. Sem origem: `422` `STORE_ORIGIN_MISSING` ao cotar entrega.

## API

```text
POST /api/v1/public/delivery/quote
```

Body: endereço completo ou `{ "fulfillment": "PICKUP" }`.

Resposta `200`:

```json
{
  "accepted": true,
  "fulfillment": "DELIVERY",
  "distanceKm": 2.4,
  "feeCents": 500,
  "estimatedMinutes": 40,
  "reason": null
}
```

Fora da área: `200` com `accepted: false` e `reason: "OUT_OF_AREA"` para a UI explicar, **e** o `POST /public/orders` com esse endereço responde `422` `OUT_OF_AREA` e não grava pedido. Endereço que o stub/http não resolve: `422` `ADDRESS_NOT_FOUND` também no POST.

`FlatDeliveryQuote` deixa de ser o adapter ativo. O adapter único usa config + Haversine + zonas. Retirada continua taxa 0 e não geocodifica destino.

Mostre no checkout, antes de pagar: distância aproximada, taxa e tempo. Se `accepted` for falso, o botão de concluir fica desabilitado e o texto diz que o endereço está fora da área. A pessoa pode trocar para retirada se `pickup_enabled`.

Confirme o endereço em texto na revisão (rua, número, bairro, cidade). Não desenhe mapa obrigatório.

## Testes

- Com stub: endereço dentro do raio cria pedido com a taxa da faixa; endereço fora não cria pedido e a contagem de `orders` não sobe.
- Trocar o preço da faixa depois não altera `delivery_fee_cents` do pedido já criado.
- Provider HTTP é testado com servidor falso local, sem chave de Google.

## Como validar

```bash
npx nx test api
npx nx test storefront
```

No storefront de demonstração, um endereço interno segue e um externo mostra fora da área.

## Critério de conclusão

O checkout bloqueia endereço fora da área e grava a taxa calculada pelo servidor quando o endereço é aceito.
