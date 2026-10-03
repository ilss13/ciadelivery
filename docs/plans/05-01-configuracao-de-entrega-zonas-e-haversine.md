# 05-01 — Configuração de entrega, zonas e Haversine

> Implemente somente esta tarefa. Leia as convenções. A 04-04 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 5 — Delivery e entregadores |
| Depende de | 04-04 |
| Desbloqueia | 05-02 |
| Critério da fase que esta tarefa avança | A loja configura raio e taxa; a distância é calculável |

## Objetivo

Persistir a política de entrega e calcular distância e taxa em memória, ainda sem geocoding externo.

## Modelo

### `delivery_configs`

Um por loja. Único `store_id`.

| Coluna | Regra |
|---|---|
| tenant_id, store_id | |
| delivery_enabled, pickup_enabled | bool |
| max_radius_km | decimal(6,2) > 0 |
| fee_mode | `FLAT` ou `ZONE` |
| flat_fee_cents | int ≥ 0 |
| estimated_minutes | int > 0 |
| origin_latitude, origin_longitude | decimal(9,6), copiados do endereço da loja quando existirem |

Migre `delivery_enabled`, `pickup_enabled` e `delivery_flat_fee_cents` da loja (Fase 3) para esta tabela, sem perder valor. O pedido mínimo continua na loja.

### `delivery_zones`

`id`, `tenant_id`, `store_id`, `from_km` decimal, `to_km` decimal, `fee_cents`, `sort_order`. `from_km` < `to_km`. Faixas não podem se sobrepor. A última faixa pode ir até `max_radius_km`. Fora de qualquer faixa e dentro do raio, em modo `ZONE`: `422` no quote futuro com `DELIVERY_ZONE_NOT_FOUND` — não invente taxa.

Exemplo válido de teste: 0–3 km R$ 5,00; 3–5 km R$ 7,00; 5–8 km R$ 10,00; raio 8.

## Domínio

Função pura `haversineKm(a, b)` em quilômetros, raio da Terra 6371. Teste com distância conhecida (por exemplo dois pontos fixos com tolerância de 0,05 km).

`resolveFee(config, zones, distanceKm)`:

- distância > raio: não atende (`OUT_OF_AREA`);
- `FLAT`: `flat_fee_cents`;
- `ZONE`: a faixa em que `from_km <= distance < to_km`, e a última faixa inclui o `to_km`.

Substitua o uso interno de colunas antigas da loja pela config. O `FlatDeliveryQuote` da Fase 3 passa a delegar a este cálculo quando a config existir. Sem coordenadas, o quote de entrega ainda não mede distância: isso é a 05-02. Nesta tarefa o cálculo é testado com coordenadas explícitas, via serviço de domínio, e a API de configuração já grava.

## API

```text
GET    /api/v1/admin/delivery/config          store.configure
PUT    /api/v1/admin/delivery/config          store.configure
GET    /api/v1/admin/delivery/zones           store.configure
POST   /api/v1/admin/delivery/zones           store.configure
PATCH  /api/v1/admin/delivery/zones/:id       store.configure
DELETE /api/v1/admin/delivery/zones/:id       store.configure
```

`PUT` rejeita sobreposição se o body trouxer o conjunto. Também permita substituir todas as faixas com `PUT /api/v1/admin/delivery/zones` recebendo a lista inteira, para a tela salvar de uma vez. Documente as duas formas no OpenAPI. Isolamento por tenant.

## UI

Em configurações da loja: entrega ligada, retirada ligada, raio, modo taxa fixa ou faixas, lista de faixas, tempo estimado. Mostre erro de sobreposição vindo da API.

## Testes

- Haversine e faixas: 2 km -> 500; 3 km exato na fronteira conforme a regra; 8,1 km -> fora; sobreposição -> erro de domínio.
- Integração: owner B não altera zona de A.

## Como validar

```bash
npm run migration:run
npx nx test api
npx nx test admin
```

## Critério de conclusão

A loja grava raio, taxa fixa e faixas, e o cálculo puro devolve a taxa certa ou “fora da área”.
