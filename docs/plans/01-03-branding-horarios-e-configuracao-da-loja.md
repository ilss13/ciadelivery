# 01-03 — Branding, horários e configuração da loja

> Implemente somente esta tarefa. Leia as convenções. A 01-02 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 1 — Multi-tenancy, autenticação e whitelabel |
| Depende de | 01-02 |
| Desbloqueia | 01-04 |
| Critério da fase que esta tarefa avança | Cada empresa tem configuração e identidade persistidas |

## Objetivo

Guardar a identidade visual, os horários e os dados operacionais da loja, e expô-los ao público só do tenant resolvido pelo host.

## Fora de escopo

Upload binário (a 02-02 faz storage). Nesta tarefa, logo, favicon e banner são URLs ou chaves de texto opcionais. CSS no Angular é a 01-04.

## Modelo

### `branding_configs`

Uma linha por loja. Único `(tenant_id, store_id)`.

| Coluna | Regra |
|---|---|
| display_name | varchar(160) |
| logo_url, favicon_url, banner_url | varchar(500) null |
| primary_color, secondary_color, accent_color | char(7) `#RRGGBB` |
| font_family | varchar(80) null |
| seo_title, seo_description | varchar |
| instagram_url, facebook_url, website_url | varchar null |
| contact_email | varchar null |
| whatsapp_phone | varchar(20) null. Só exibição. Não é a conexão da Fase 6 |

Cores inválidas: `400` `INVALID_COLOR`.

### `business_hours`

`id`, `tenant_id`, `store_id`, `weekday` 0–6 (0 = domingo), `opens_at` e `closes_at` como `time`, `closed` boolean. Único `(store_id, weekday)`.

Horário que cruza meia-noite é permitido (`opens_at` > `closes_at`). Fora desse caso, `opens_at` igual a `closes_at` com `closed=false` é `400` `INVALID_BUSINESS_HOURS`.

### Loja

Complete `GET/PUT /api/v1/admin/store` para nome, telefone, endereço, pedido mínimo e fechamento manual. Exige `store.configure`.

## API

```text
GET /api/v1/admin/branding          store.configure
PUT /api/v1/admin/branding          store.configure
GET /api/v1/admin/store/hours       store.configure
PUT /api/v1/admin/store/hours       store.configure  (substitui os 7 dias)
GET /api/v1/public/store            agora inclui branding, hours e isOpen
```

`isOpen` é calculado no servidor com o fuso `STORE_TIMEZONE` (default `America/Sao_Paulo`, gravado na loja na coluna `timezone`). Loja com `is_manually_closed=1` está fechada mesmo dentro do horário. Status `SUSPENDED` do tenant continua 403 antes disso.

`PUT` de branding e horários não aceita `tenantId` nem `storeId`.

Seed de desenvolvimento, atrás de `SEED_DEMO=true` e proibido em production: dois tenants `pizzariadoze` e `burgercentral`, owners distintos, cores diferentes (vermelho `#C0392B` e âmbar `#E67E22`), horários de terça a domingo 18:00–23:00. Senhas só via env `DEMO_OWNER_PASSWORD`.

## Testes

- Unitário de `isOpen`: dentro do horário, fora, virada de meia-noite, fechamento manual, fuso.
- Integração: owner A altera a cor primária; `GET /public/store` no host de A devolve essa cor e não a de B; manager sem `store.configure` recebe 403; owner A recebe 404 ao usar um id de branding de B se algum endpoint receber id (prefira não receber id na rota).

## Como validar

```bash
npm run migration:run
npx nx test api
npm run openapi:generate
```

## Critério de conclusão

As duas lojas de demonstração devolvem cores, horários e `isOpen` diferentes conforme o host, e só quem tem `store.configure` grava a configuração.
