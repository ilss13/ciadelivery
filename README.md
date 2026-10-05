# ciadelivery

SaaS B2B2C whitelabel de delivery. Cada empresa opera com a própria marca, cardápio, equipe, clientes, pedidos e WhatsApp, em um canal próprio, sem comissão por pedido.

## Instalar

Requer Node.js 24, a LTS ativa. A versão está no `.nvmrc`.

```bash
npm install
```

## Subir com Docker

Copie `.env.example` para `.env` quando for rodar a API ou o worker fora do Compose. O `.env` fica fora do Git.

Local, com API, worker, quatro frontends, MySQL 8 e Redis:

```bash
docker compose up --build -d
```

Staging usa as mesmas imagens. MySQL e Redis não publicam porta no host. A subida falha se `DATABASE_PASSWORD` estiver vazio:

```bash
docker compose -f docker-compose.staging.yml up --build -d
```

O volume do MySQL permanece após `docker compose down`. Os dados só são removidos com `docker compose down -v`.

## Subir as aplicações

| Aplicação             | Comando                    | Porta |
| --------------------- | -------------------------- | ----- |
| API                   | `npm run start:api`        | 3000  |
| Worker                | `npm run start:worker`     | 3001  |
| Landing               | `npm run start:landing`    | 4200  |
| Cardápio (storefront) | `npm run start:storefront` | 4201  |
| Painel (admin)        | `npm run start:admin`      | 4202  |
| Entregador (courier)  | `npm run start:courier`    | 4203  |

## Lojas de demonstração

Com `SEED_DEMO=true` e `DEMO_OWNER_PASSWORD` no `.env`, a API cria duas lojas. O cardápio local aceita o host da loja. Em macOS e na maioria dos Linux, `*.localhost` aponta para a sua máquina, sem editar `/etc/hosts`.

| Loja           | Cardápio                            | Cor primária |
| -------------- | ----------------------------------- | ------------ |
| Pizzaria do Ze | http://pizzariadoze.localhost:4201  | `#C0392B`    |
| Burger Central | http://burgercentral.localhost:4201 | `#E67E22`    |

O servidor de desenvolvimento do storefront libera esses hosts. A API lê o host da página pelo header `X-Tenant-Host` em `local` e `development`. Inclua as origens no `CORS_ORIGINS`:

```text
http://pizzariadoze.localhost:4201,http://burgercentral.localhost:4201
```

O painel fica em http://localhost:4202/login. Os donos de demonstração são `pizzariadoze-owner@example.com` e `burgercentral-owner@example.com`, com a senha de `DEMO_OWNER_PASSWORD`. O entregador da pizzaria é `pizzariadoze-courier@example.com`, com a mesma senha, e entra em http://localhost:4203/login. O seed não cria pedido atribuído: a lista abre com “Nenhuma entrega atribuída”.

O e2e do entregador usa viewport de celular. Ele não sobe os servidores: a API (com `SEED_DEMO=true`) e o app courier precisam estar no ar.

```bash
npm run start:api
npm run start:courier
npx nx e2e courier-e2e
```

Com `GEOCODING_DRIVER=stub` (o padrão), o checkout não chama um mapa externo. O stub transforma o CEP em uma coordenada estável numa caixa de cerca de 2 km ao redor da origem de demonstração `-23.550520, -46.633308` (Praça da Sé, São Paulo). O CEP `99999-999` fica cerca de 22 km ao norte dessa origem, fora do raio padrão de 8 km, para o cardápio mostrar endereço fora da área. Com `GEOCODING_DRIVER=http`, a API faz `GET` em `GEOCODING_URL` e espera JSON `{ "latitude", "longitude" }`.

O e2e do cardápio compara o nome e a variável `--brand-primary` nos dois hosts. Ele não sobe os servidores: a API (com `SEED_DEMO=true`) e o storefront precisam estar no ar. Se a API estiver fora, o teste falha com essa mensagem em vez de passar vazio.

```bash
npm run start:api
npm run start:storefront
npx nx e2e storefront-e2e
```

## Qualidade

```bash
npm run lint
npm run test
npm run typecheck
```

No CI, o job unitário ignora `*.integration.spec.ts`. O job de integração roda esses arquivos com MySQL e Redis no ar:

```bash
npx nx run-many -t test -- --testPathIgnorePatterns='integration\.spec'
npx nx run-many -t test -p api,worker -- --testPathPattern='integration\.spec'
```

## CI

O pipeline em [`.github/workflows/ci.yml`](.github/workflows/ci.yml) dispara em pull request e em push na `main`, nesta ordem: lint, typecheck, testes unitários, testes de integração, build, `npm audit --audit-level=high`, build das imagens, deploy de staging e smoke. Cada job usa o cache de npm e a versão do Node do `.nvmrc`.

O smoke do CI consulta `GET /health/liveness` e `GET /health/readiness` na API já buildada, com MySQL 8 e Redis 7 do runner. O Compose completo fica na prova local, porque construir as seis imagens de novo dentro do job deixa a esteira pesada demais. O runner do GitHub tem Docker; o job de imagens usa isso só para `docker build` da API, do worker e da landing.

Sem o secret `REGISTRY_URL`, as imagens não são publicadas. Sem o secret `STAGING_HOST`, o deploy de staging só roda em push na `main` e termina com sucesso na mensagem `staging deploy skipped: missing STAGING_HOST`. Se `STAGING_HOST` existir, o job falha com instrução explícita: não há script de SSH neste repositório.

Produção está em [`.github/workflows/production.yml`](.github/workflows/production.yml). Só `workflow_dispatch`, no environment `production`. Rollback é um novo disparo com a tag `sha` da imagem anterior (`ciadelivery-api:<sha>`, `ciadelivery-worker:<sha>`, `ciadelivery-landing:<sha>`). O workflow não envia nada a um servidor. A proteção do environment (revisores obrigatórios) fica na configuração do repositório no GitHub.

## Prova da Fase 0

```bash
bash scripts/verify-phase-0.sh
```

O script sobe o Compose local, espera os healthchecks e faz curl nas portas 3000, 3001, 4200, 4201, 4202 e 4203. Também confere que o Compose de staging não publica 3306 nem 6379. Se os containers do projeto já existirem, ele só executa os curls. O `docker compose down` (sem `-v`) roda apenas quando o próprio script subiu a stack.

Os planos de implementação estão em [`docs/plans/README.md`](docs/plans/README.md).
