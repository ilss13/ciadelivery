# 01-05 — Isolamento e critério da Fase 1

> Implemente somente esta tarefa. Leia as convenções. A 01-04 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 1 — Multi-tenancy, autenticação e whitelabel |
| Depende de | 01-04 |
| Desbloqueia | 02-01 |
| Critério da fase | Duas empresas operam ao mesmo tempo sem visualizar dados uma da outra e com identidade visual distinta |

## Objetivo

Provar o aceite da Fase 1 com teste automatizado e fechar buracos de isolamento que as tarefas anteriores deixaram.

## O que fazer

1. Suite `apps/api` (integração) `phase1-acceptance.spec.ts`:
   - sobe dois tenants com owners, cores e horários diferentes;
   - `GET /public/store` no host de cada um retorna só a própria marca;
   - o access token do owner A em `/api/v1/admin/store`, `/admin/branding` e `/admin/users` nunca retorna registro de B;
   - id conhecido de B na URL do admin de A responde `404`, não `403`;
   - request autenticado de A com host de B nas rotas admin continua no tenant de A (o host não troca o tenant autenticado);
   - `tenantId` injetado no body é ignorado;
   - usuário de tenant suspenso não faz login;
   - `SUPER_ADMIN` lista os dois tenants na rota de plataforma e não usa rota admin de loja.
2. Teste Playwright `apps/storefront-e2e` (crie o projeto e2e se ainda não existir) que visita os dois subdomínios locais e afirma que o texto do nome e a CSS variable `--brand-primary` diferem. Se o e2e precisar dos servidores, documente o comando e faça o teste falhar com mensagem clara quando a API estiver fora, em vez de passar vazio.
3. Revise repositórios da Fase 1: todo `find` de store, branding, hours e user inclui `tenant_id` vindo do contexto, não de parâmetro público.
4. Log de acesso administrativo em nível `info` com `userId`, `tenantId`, `action`. Sem email em massa e sem senha.

## Fora de escopo

Catálogo, pedido, correção de produto. Não reescreva o login se os testes atuais passam.

## Como validar

```bash
npx nx test api --testPathPattern=phase1-acceptance
npx nx e2e storefront-e2e
```

Se o alvo e2e tiver outro nome, rode o alvo que o teste de cores realmente executa.

## Critério de conclusão

A suite de aceite passa com duas empresas simultâneas, dados separados e cores diferentes. Esse é o critério da Fase 1 da especificação.
