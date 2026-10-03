# 01-01 — Tenant, loja e resolução de contexto

> Implemente somente esta tarefa. Leia `docs/plans/00-00-convencoes-para-agentes.md`. A Fase 0 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 1 — Multi-tenancy, autenticação e whitelabel |
| Depende de | 00-04 |
| Desbloqueia | 01-02, 01-03 |
| Critério da fase que esta tarefa avança | Empresas existem e o tenant vem de contexto seguro |

## Objetivo

Persistir tenant e loja e resolver o tenant pelo hostname, sem aceitar um `tenant_id` enviado pelo cliente.

## Fora de escopo

Login, senha, branding visual, horários, catálogo. Papel `SUPER_ADMIN` aqui é só um guard provisório por token estático de bootstrap, substituído na 01-02.

## Modelo

### `tenants`

| Coluna | Tipo | Regra |
|---|---|---|
| id | char(36) PK | UUID da aplicação |
| name | varchar(160) | obrigatório |
| slug | varchar(63) | único, `[a-z0-9-]+`, não reservado |
| status | varchar(20) | `ACTIVE`, `SUSPENDED`, `TRIAL` |
| plan_code | varchar(40) | default `STANDARD`. Sem cobrança |
| custom_domain | varchar(255) null | único quando preenchido |
| created_at / updated_at | datetime(3) | UTC |

Slugs reservados, recusados com `TENANT_SLUG_RESERVED`: `www`, `painel`, `api`, `admin`, `app`, `mail`, `cdn`.

### `stores`

| Coluna | Tipo | Regra |
|---|---|---|
| id | char(36) PK | |
| tenant_id | char(36) | FK, único (uma loja por tenant no MVP) |
| name | varchar(160) | |
| phone | varchar(20) | |
| address_line, address_number, district, city, state, postal_code | varchar | obrigatórios |
| latitude / longitude | decimal(9,6) null | preenchidos depois |
| minimum_order_cents | int unsigned | default 0 |
| is_manually_closed | tinyint | default 0 |
| created_at / updated_at | datetime(3) | |

Índice único `(tenant_id)` em `stores`. Índice único `tenants.slug`. Índice único `tenants.custom_domain`.

Criar tenant cria a loja na mesma transação. Tentar a segunda loja retorna `409` `STORE_LIMIT_REACHED`.

## Resolução de host

Porta `TenantResolver` no domínio de tenancy:

1. Ignore porta do host (`:4201`).
2. Se o host for exatamente `PLATFORM_DOMAIN`, `www.{PLATFORM_DOMAIN}` ou `painel.{PLATFORM_DOMAIN}`, não há tenant (landing ou painel).
3. Se o host for `{slug}.{PLATFORM_DOMAIN}`, busque slug com status `ACTIVE` ou `TRIAL`. `SUSPENDED` resulta em `403` `TENANT_SUSPENDED`.
4. Senão, busque `custom_domain` igual ao host.
5. Desconhecido resulta em `404` `TENANT_NOT_FOUND`.

`TenantContext` fica no request (AsyncLocalStorage). Repositórios de negócio das próximas tarefas leem desse contexto. Esta tarefa já aplica o contexto nas rotas públicas da loja.

Header `X-Tenant-Host` somente quando `NODE_ENV` é `local` ou `development`.

## API

Protegida por `PLATFORM_BOOTSTRAP_TOKEN` no header `X-Platform-Token` (env, só até a 01-02 trocar pelo JWT de `SUPER_ADMIN`):

```text
POST   /api/v1/platform/tenants
GET    /api/v1/platform/tenants
GET    /api/v1/platform/tenants/:id
PATCH  /api/v1/platform/tenants/:id
```

`POST` recebe nome, slug, telefone e endereço e devolve tenant + store. `PATCH` altera nome, status, plan_code e custom_domain. Não receba `tenant_id` no body das rotas de loja.

Públicas, tenant pelo host:

```text
GET /api/v1/public/store
```

Resposta: id da loja, nome, telefone, endereço, `minimumOrderCents`, `isManuallyClosed`, slug. Sem dados de outro tenant e sem token de plataforma.

## Testes

- Unitário do parser de host, incluindo slug reservado, suspenso e domínio próprio.
- Integração: criar dois tenants; `GET /public/store` com host A não contém o nome de B; host desconhecido é 404; body com `tenantId` de B no PATCH público não existe (não crie rota que o aceite); segunda loja é 409.
- `SUSPENDED` retorna 403 na rota pública.

## Como validar

```bash
npm run migration:run
npx nx test api
npm run openapi:generate
```

## Critério de conclusão

Dois tenants persistem com uma loja cada, a loja pública sai só do hostname, e nenhum endpoint desta tarefa confia em `tenant_id` do cliente.
