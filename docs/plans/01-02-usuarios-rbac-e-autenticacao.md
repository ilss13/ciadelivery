# 01-02 — Usuários, RBAC e autenticação

> Implemente somente esta tarefa. Leia as convenções. A 01-01 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 1 — Multi-tenancy, autenticação e whitelabel |
| Depende de | 01-01 |
| Desbloqueia | 01-03, 01-04, 01-05 |
| Critério da fase que esta tarefa avança | Login, refresh e papéis com isolamento |

## Objetivo

Autenticar pessoas da plataforma e do estabelecimento, com senha forte, refresh rotativo e permissões granulares.

## Fora de escopo

Tela pronta de whitelabel, catálogo, recuperação visual além dos endpoints. OTP de cliente final não entra.

## Modelo

### `users`

| Coluna | Regra |
|---|---|
| id | UUID |
| tenant_id | nulo somente para `SUPER_ADMIN` |
| store_id | nulo para `SUPER_ADMIN`; obrigatório nos demais |
| name, email | email único global, normalizado em minúsculas |
| password_hash | Argon2id. Nunca devolver em JSON |
| role | um dos papéis das convenções |
| status | `ACTIVE` ou `DISABLED` |
| created_at / updated_at | |

### `user_permission_overrides`

`user_id`, `permission`, `granted` (1 concede, 0 revoga). Chave única `(user_id, permission)`.

### `refresh_tokens`

`id`, `user_id`, `token_hash` (SHA-256 do segredo opaco), `family_id`, `expires_at`, `revoked_at`, `replaced_by_id`, `created_at`.

### `login_attempts`

`email`, `ip`, `succeeded`, `created_at`. Índice por email + data.

Papéis e permissões efetivas seguem a tabela das convenções. Override muda o padrão do papel.

## API

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/auth/me
```

Login recebe email e senha. Resposta: `accessToken` (JWT 15 min) com `sub`, `role`, `tenantId` (ou null), `storeId`, `permissions[]`. Refresh token opaco de 32 bytes vai em cookie `HttpOnly`, `SameSite=Lax`, `Secure` fora de `local`, path `/api/v1/auth`, validade 7 dias.

Refresh rotaciona: o token usado é revogado e outro da mesma `family_id` é emitido. Reuso de token já rotacionado revoga a família inteira e responde `401` `REFRESH_REUSED`.

Logout revoga o refresh atual.

Forgot-password sempre responde `202` com corpo vazio, exista o email ou não. Grava token de uso único com hash, validade 30 minutos. Em `local` e `development`, o log pode incluir o token **só** se `LOG_PASSWORD_RESET=true`. Em staging e production, envie por porta `MailProvider`. Implemente `LoggingMailProvider` agora. Não integre SMTP real.

Reset troca a senha e revoga todos os refresh da pessoa.

`/auth/me` exige Bearer.

Política de senha: mínimo 10, uma letra e um número. Code `WEAK_PASSWORD`.

Bloqueio: 5 falhas em 15 minutos para o mesmo email retornam `429` `LOGIN_LOCKED` por 15 minutos. A resposta de senha errada e de email inexistente é a mesma: `401` `INVALID_CREDENTIALS`.

Rate limit no login: 10 requisições por minuto por IP, via Redis. Excedeu: `429` `RATE_LIMITED`.

### Usuários do tenant

Substitua o header `X-Platform-Token` da 01-01 por JWT de `SUPER_ADMIN`. Remova o bootstrap token quando o seed do super admin existir.

```text
GET    /api/v1/admin/users
POST   /api/v1/admin/users
PATCH  /api/v1/admin/users/:id
```

Exige `users.manage`. O `tenant_id` do novo usuário é o do contexto autenticado, nunca o body. Não é permitido criar `SUPER_ADMIN` por essa rota. Não é permitido atribuir permissão que o ator não tem, exceto `OWNER` no próprio tenant.

```text
POST /api/v1/platform/tenants/:id/owner
```

Somente `SUPER_ADMIN`. Cria o primeiro `OWNER` daquele tenant.

Seed: se `SEED_PLATFORM_ADMIN=true`, crie um `SUPER_ADMIN` com `PLATFORM_ADMIN_EMAIL` e `PLATFORM_ADMIN_PASSWORD`. Recuse subir em production com essa flag. Não hardcode senha.

## JWT e guards

- Access token assinado com `JWT_ACCESS_SECRET` (mínimo 32 caracteres; a app não sobe sem ele).
- Guard de autenticação + guard de permissão `@RequirePermissions('users.manage')`.
- Usuário `DISABLED` recebe `403` `USER_DISABLED`.
- Tenant `SUSPENDED` bloqueia login dos usuários daquele tenant com `403` `TENANT_SUSPENDED`. `SUPER_ADMIN` continua entrando.

## Testes

- Unitário: permissão efetiva com override; política de senha; rotação e reuso de refresh.
- Integração: login, refresh, logout, bloqueio na 5ª falha, forgot não revela email, owner de A não lista usuários de B (`404` `USER_NOT_FOUND` ao buscar id de B, não 403 que confirme existência), attendant sem `users.manage` recebe 403.
- Senha não aparece em resposta nem em log de teste.

## Como validar

```bash
npm run migration:run
npx nx test api
npm run openapi:generate
```

## Critério de conclusão

Uma pessoa entra com email e senha, renova a sessão, perde o acesso ao desabilitar a conta, e não lê usuários de outro tenant. O token de bootstrap da 01-01 não autentica mais.
