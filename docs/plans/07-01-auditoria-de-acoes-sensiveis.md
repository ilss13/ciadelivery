# 07-01 — Auditoria de ações sensíveis

> Implemente somente esta tarefa. Leia as convenções. A 06-04 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 7 — Administração, auditoria e relatórios |
| Depende de | 06-04 |
| Desbloqueia | 07-02, 07-03 |
| Critério da fase que esta tarefa avança | A operação diária deixa rastro de quem mudou o quê |

## Objetivo

Persistir auditoria das ações sensíveis da especificação (seção 30), consultável pelo owner.

## Modelo `audit_logs`

| Coluna | Regra |
|---|---|
| id | UUID |
| tenant_id | null só para ação de plataforma |
| actor_id | null se sistema |
| actor_type | `USER`, `SYSTEM`, `SUPER_ADMIN` |
| action | varchar, por exemplo `order.cancelled` |
| entity_type, entity_id | |
| before | JSON null |
| changes | JSON do que mudou, não o registro inteiro com segredo |
| ip, user_agent | |
| created_at | |

Índice `(tenant_id, created_at)`, `(tenant_id, entity_type, entity_id)`.

Não grave senha, access token, refresh, credencial de WhatsApp, tracking token nem corpo de cartão (não existe cartão). Em `before` de usuário, omita `password_hash`.

## Onde instrumentar

Escreva na mesma transação da mudança, não em fila que possa perder o fato. A fila `audit-processing` não é necessária para o caminho feliz; não a use para o registro primário.

Ações mínimas:

- login administrativo bem-sucedido e login recusado (sem a senha; email pode entrar mascarado);
- alteração de preço, nome ou disponibilidade de produto;
- cancelamento e mudança de status de pedido;
- alteração de branding, horários, entrega e formas de pagamento;
- criação e edição de usuário e de overrides de permissão;
- conexão e desconexão de WhatsApp (sem o token);
- atribuição de entregador.

## API

```text
GET /api/v1/admin/audit-logs
```

`audit.read` (owner). Filtros: `action`, `entityType`, `from`, `to`. Paginado. Outro tenant não aparece. Manager recebe 403.

UI: tela “Auditoria” com tabela simples, data em horário de São Paulo, detalhe do JSON de `changes` formatado. Vazio útil.

## Testes

- Cancelar pedido grava `actor_id` do attendant e o status anterior.
- Trocar preço grava `before` e `changes` com centavos.
- Log de connect não contém a string do token de teste.
- Owner B não lista log de A.

## Como validar

```bash
npm run migration:run
npx nx test api
npx nx test admin
```

## Critério de conclusão

As ações listadas geram trilha com autor, tenant e diff, e só o owner daquele tenant lê.
