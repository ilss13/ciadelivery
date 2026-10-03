# 00-02 — Docker, MySQL, Redis e ambientes

> Implemente somente esta tarefa. Leia `docs/plans/00-00-convencoes-para-agentes.md` e conclua a 00-01 antes. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 0 — Fundação técnica |
| Depende de | 00-01 |
| Desbloqueia | 00-03 |
| Critério da fase que esta tarefa avança | As aplicações sobem localmente com MySQL e Redis |

## Objetivo

Subir a plataforma inteira com um comando, com configuração separada por ambiente e sem segredo no Git.

## Fora de escopo

Migrations de negócio, Swagger, filas BullMQ, deploy na nuvem. O worker ainda não consome fila.

## Entregáveis

1. `Dockerfile` multi-stage para `api` e `worker` (build Nx e runtime Node enxuto, usuário não-root).
2. `Dockerfile` de produção para cada app Angular: build estático servido por nginx, com `try_files` para o roteador.
3. `docker-compose.yml` para local, com healthcheck em cada serviço:
   - `mysql:8` banco `ciadelivery`, volume nomeado, porta 3306
   - `redis:7` porta 6379
   - `api` depende de MySQL e Redis saudáveis
   - `worker` depende de MySQL e Redis saudáveis
   - `landing`, `storefront`, `admin`, `courier`
4. `docker-compose.staging.yml` com a mesma topologia, sem publicar MySQL e Redis na internet (somente rede interna) e com variáveis exigidas explicitamente (sem default de senha fraca).
5. `.env.example` documentando cada variável. `.env` no `.gitignore`.
6. Módulo de configuração tipada, carregada na subida e recusada se faltar variável obrigatória.

## Variáveis obrigatórias

```text
NODE_ENV=local|development|staging|production
API_PORT=3000
WORKER_PORT=3001
DATABASE_HOST
DATABASE_PORT
DATABASE_USER
DATABASE_PASSWORD
DATABASE_NAME
REDIS_HOST
REDIS_PORT
PLATFORM_DOMAIN=localhost
```

Não conecte a API a um banco na 00-02 além de um ping opcional. A conexão TypeORM entra na 00-03. O healthcheck do Compose para a API pode usar `GET /`.

## Implementação

- `docker compose up --build` sobe os seis processos mais MySQL e Redis.
- Frontends locais no Compose apontam a API para `http://localhost:3000` via arquivo `environment`. Não hardcode URL de produção.
- Staging usa as mesmas imagens e falha na subida se `DATABASE_PASSWORD` estiver vazio.
- Documente no README os dois comandos: local e staging.
- Volumes de MySQL sobrevivem a `docker compose down` sem `-v`.

## Como validar

```bash
docker compose up --build -d
docker compose ps
```

Todos os serviços ficam `healthy`. `GET` em `localhost:3000`, `3001`, `4200`, `4201`, `4202` e `4203` responde. Depois:

```bash
docker compose -f docker-compose.staging.yml config
```

O config de staging é válido e não publica `3306` nem `6379` no host. Encerre os containers ao terminar.

## Critério de conclusão

Um comando sobe API, worker, quatro frontends, MySQL 8 e Redis, todos saudáveis, e o Compose de staging está separado do local.
