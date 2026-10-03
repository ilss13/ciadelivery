# 00-03 — Fundação NestJS, observabilidade e Swagger

> Implemente somente esta tarefa. Leia as convenções e conclua a 00-02 antes. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 0 — Fundação técnica |
| Depende de | 00-02 |
| Desbloqueia | 00-04, 01-01 |
| Critério da fase que esta tarefa avança | Logging, health checks, padrão de erro, Swagger e migrations existem |

## Objetivo

Deixar API e worker com a base técnica que todas as fases seguintes vão reutilizar: configuração, log, erro, saúde, OpenAPI e migrations vazias porém executáveis.

## Fora de escopo

Tabelas de tenant, usuário, pedido ou fila. Não crie entidades de negócio.

## Entregáveis

### Configuração

- Config tipada compartilhada entre API e worker em `libs/shared`.
- A aplicação não sobe se uma variável obrigatória faltar. Teste isso.

### Log

- Log JSON em uma linha: `timestamp`, `level`, `message`, `requestId`, `context`.
- Middleware gera `requestId` (header `X-Request-Id` de entrada ou UUID) e o devolve na resposta.
- Não registre senha, authorization, cookie nem body de login.

### Erro

- Filtro global no formato da seção “HTTP” das convenções.
- `404` para rota inexistente com code `ROUTE_NOT_FOUND`.
- Exceção de domínio base `DomainException` com `code` e status HTTP, para as próximas tarefas usarem.
- Validação de DTO falha com `400` e code `VALIDATION_ERROR`. `details` lista o campo e a restrição, sem ecoar o valor enviado quando o campo for senha ou token.

### Health

Rotas públicas, sem prefixo `/api`:

```text
GET /health            -> 200 { "status": "ok" }
GET /health/liveness   -> 200 se o processo está no ar
GET /health/readiness  -> 200 só se MySQL aceita SELECT 1 e Redis responde PING; senão 503
```

O worker expõe as mesmas rotas na porta 3001.

### OpenAPI

- Swagger em `/api/docs` somente quando `NODE_ENV` não é `production`.
- Documento JSON em `/api/docs-json`.
- Script `npm run openapi:generate` grava `openapi.json` na raiz (arquivo versionado).
- A spec descreve as rotas de health.

### Persistência

- TypeORM com MySQL, `synchronize: false` em todos os ambientes.
- CLI de migration: `npm run migration:generate`, `migration:run`, `migration:revert`.
- Pasta `apps/api/src/database/migrations`.
- Uma migration inicial vazia de marcação **não** é necessária. O que é necessário é o pipeline funcionar: um teste de integração sobe o schema de uma migration de prova em banco de teste e reverte. Pode criar e dropar uma tabela `schema_migrations_probe` dentro do teste, sem deixá-la na migration definitiva. A pasta de migrations pode começar vazia.
- Pool de conexões configurável por env (`DATABASE_POOL_SIZE`, default 10).

### Segurança de borda já nesta tarefa

- `helmet` na API.
- CORS com lista `CORS_ORIGINS` (separada por vírgula). Origem ausente da lista é recusada. Em local, o exemplo inclui as quatro portas de frontend.
- Body limit 1 MB.

## Testes

- Unitário do filtro de erro e do gerador de request id.
- Integração com Compose no ar:
  - readiness 200 quando MySQL e Redis sobem;
  - readiness 503 quando o host do Redis é inválido (instância de teste com config trocada, sem derrubar o Compose dos outros);
  - DTO inválido retorna o JSON padrão.

## Como validar

```bash
docker compose up -d mysql redis
npm run migration:run
npx nx test api
npx nx test worker
npm run openapi:generate
```

`GET /health/readiness` retorna 200. `/api/docs` abre fora de production.

## Critério de conclusão

API e worker logam em JSON, devolvem erro no contrato, ficam ready só com MySQL e Redis saudáveis, publicam Swagger e conseguem rodar migrations.
