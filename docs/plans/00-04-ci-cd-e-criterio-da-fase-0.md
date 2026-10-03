# 00-04 — CI/CD e critério da Fase 0

> Implemente somente esta tarefa. Leia as convenções e conclua a 00-03 antes. Não faça commit. Não faça deploy em servidor real.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 0 — Fundação técnica |
| Depende de | 00-03 |
| Desbloqueia | 01-01 |
| Critério da fase | Todas as aplicações sobem localmente e em staging com pipeline automatizado |

## Objetivo

Fechar a Fase 0 com um pipeline que reproduz a esteira da especificação (seção 42) e com a prova de que o Compose local e o de staging sobem.

## Fora de escopo

Deploy SSH real, domínio público, backup de produção, testes de negócio. Não invente um cluster.

## Pipeline

Crie `.github/workflows/ci.yml` disparado em pull request e em push na branch principal. Jobs nesta ordem, cada um dependendo do anterior quando a seta importa:

```text
lint
  -> typecheck
  -> unit tests
  -> integration tests
  -> build
  -> security checks
  -> container build
  -> deploy staging (somente na branch principal, e somente se os secrets existirem)
  -> smoke tests
```

`deploy production` fica como workflow separado `.github/workflows/production.yml` com `workflow_dispatch` e environment `production` protegido. Não dispare produção no push. O job de produção documenta rollback: redeploy da imagem anterior identificada por tag `sha`. Não implemente cloud além desse contrato.

### O que cada job faz

| Job | Ação |
|---|---|
| lint | `nx run-many -t lint` |
| typecheck | `tsc` dos projetos ou target `typecheck` |
| unit | testes sem Docker |
| integration | serviços MySQL 8 e Redis 7 do GitHub Actions; `migration:run`; testes marcados como integração |
| build | build dos seis apps |
| security | `npm audit --audit-level=high` e falha se houver high/critical. Não use `--force` para calar |
| container build | `docker build` de api, worker e um frontend (landing basta como prova do Dockerfile nginx). Não publique em registry sem secret `REGISTRY_URL` |
| deploy staging | se `STAGING_HOST` não estiver definido, o job termina com sucesso e a mensagem `staging deploy skipped: missing STAGING_HOST`. Se estiver, o job falha com instrução clara em vez de improvisar um script frágil. Não coloque senha no YAML |
| smoke | sobe `docker compose` local no runner **ou**, se Docker-in-Docker for pesado demais, executa smoke HTTP contra a API já buildada no job de integration: `/health/liveness` e `/health/readiness`. Prefira o smoke HTTP se o runner não tiver privilégio de Compose. Documente a escolha no README |

O workflow usa cache de npm. Node vem do `.nvmrc`.

## Prova local da fase

Script `scripts/verify-phase-0.sh` que:

1. Sobe `docker compose up --build -d`.
2. Espera os healthchecks.
3. Faz curl nas portas 3000, 3001, 4200, 4201, 4202, 4203.
4. Confere que `docker compose -f docker-compose.staging.yml config` não publica 3306 nem 6379.
5. Derruba o Compose com `down` sem `-v` apenas se o script tiver sido quem subiu. Não apague volume de quem já estava usando o banco. Se os containers já existirem, só execute os curls.

## Critério de conclusão

- `scripts/verify-phase-0.sh` termina com código 0.
- O workflow contém as etapas da seção 42, com produção separada e rollback descrito.
- Nenhum segredo está no repositório.
- Lint, typecheck, unit e o smoke de health passam localmente.

Esse é o aceite da Fase 0: as aplicações sobem localmente e a esteira de staging existe e é automatizada. Staging remoto permanece condicionado aos secrets, sem fingir que um servidor foi provisionado.
