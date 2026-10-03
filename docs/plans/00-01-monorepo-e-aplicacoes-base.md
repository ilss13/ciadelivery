# 00-01 — Monorepo e aplicações base

> Implemente somente esta tarefa. Antes, leia `docs/plans/00-00-convencoes-para-agentes.md`. Não apague `docs/`. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 0 — Fundação técnica |
| Depende de | nenhuma |
| Desbloqueia | 00-02 |
| Critério da fase que esta tarefa avança | As aplicações existem, instalam e compilam no monorepo |

## Objetivo

Criar o monorepo Nx dentro do repositório já existente, com as aplicações vazias porém compiláveis e os comandos de lint, typecheck e teste no lugar.

## Estado atual

O repositório só tem `README.md`, `docs/especificacao_tecnica_delivery_whitelabel.md` e o diagrama de arquitetura. Preserve esses arquivos.

## Fora de escopo

Docker, MySQL, Redis, autenticação, tenant, telas de produto, CI, Swagger e health checks ricos. Isso é das tarefas 00-02 a 00-04.

## Entregáveis

1. Workspace Nx com npm e TypeScript estrito (`strict`, `noImplicitOverride`, `exactOptionalPropertyTypes` se não quebrar os generators).
2. Aplicações:
   - `apps/landing` Angular, porta 4200
   - `apps/storefront` Angular, porta 4201
   - `apps/admin` Angular, porta 4202
   - `apps/courier` Angular, porta 4203
   - `apps/api` NestJS, porta 3000
   - `apps/worker` NestJS, porta 3001
3. `libs/shared` com um símbolo exportado (por exemplo `APP_NAME = 'ciadelivery'`) usado pela API, para provar o caminho de libs.
4. ESLint e Prettier na raiz, `.editorconfig`, `.gitignore` cobrindo `node_modules`, `dist`, `coverage`, `.nx`, `.env`, `.angular`.
5. `.nvmrc` com a versão Node LTS atual usada no `engines` do `package.json`.
6. README da raiz com: o que é o produto (um parágrafo), como instalar, como subir cada app e a lista de portas. Aponte para `docs/plans/README.md`.

## Implementação

- Inicialize o Nx **neste** diretório. Se o generator recusar diretório não vazio, crie `package.json`, `nx.json`, `tsconfig.base.json` e os projetos sem mover `docs/`.
- Use os generators oficiais `@nx/angular` e `@nx/nest`. Aplicações Angular com componentes standalone e roteamento. Sem NgRx. Sem SSR.
- Cada app Angular abre uma página única com o nome da superfície em português: “Landing”, “Cardápio”, “Painel”, “Entregador”. Sem layout de produto.
- `GET /` da API responde `200` com `{ "name": "ciadelivery-api" }`.
- `GET /` do worker responde `200` com `{ "name": "ciadelivery-worker" }`.
- Scripts na raiz: `start:api`, `start:worker`, `start:landing`, `start:storefront`, `start:admin`, `start:courier`, `lint`, `test`, `typecheck`.
- Path aliases no `tsconfig.base.json` para `@ciadelivery/shared`.
- Não adicione biblioteca de UI paga nem tema pronto.

## Como validar

```bash
npm install
npx nx run-many -t lint,test,build -p landing,storefront,admin,courier,api,worker
```

Suba a API e confirme `GET http://localhost:3000/` com o JSON acima. Encerre o processo ao terminar.

## Critério de conclusão

Os seis projetos compilam, o lint passa e a API responde o nome. `docs/` permanece intacto.
