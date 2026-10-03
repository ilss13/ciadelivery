# 08-01 — Onboarding assistido e checklist

> Implemente somente esta tarefa. Leia as convenções. A 07-04 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 8 — Piloto comercial |
| Depende de | 07-04 |
| Desbloqueia | 08-02 |
| Critério da fase que esta tarefa avança | Um estabelecimento novo pode ser implantado com roteiro, não com improviso |

## Objetivo

Guiar o super admin e o owner pelo checklist de implantação da seção 54, com estado persistido.

## Modelo `onboarding_steps`

`id`, `tenant_id`, `code`, `status` (`PENDING`, `DONE`, `SKIPPED`), `done_at` null, `done_by` null, `note` null.

Códigos, nesta ordem:

```text
create_tenant
create_store
configure_branding
configure_domain
configure_address
configure_hours
configure_delivery
create_owner
import_catalog
connect_whatsapp
create_couriers
place_test_order
validate_notifications
train_team
publish_store
```

`create_tenant` e `create_store` nascem `DONE` quando o tenant é criado (a loja nasce junto). Os demais nascem `PENDING`.

`import_catalog` e `place_test_order` serão marcados pelas tarefas 08-02; deixe o botão manual “marcar como feito” só para `train_team` e `validate_notifications`, que são atos humanos. Não marque `validate_notifications` sozinho.

`publish_store`: coluna `stores.published` default false. Enquanto false, `GET /public/store` responde `403` `STORE_UNPUBLISHED` com o nome da loja apenas se você precisar… não: responda 403 sem cardápio. O owner publica no último passo, e só se branding, horários, endereço e pelo menos um produto ativo existirem. Senão `409` `ONBOARDING_INCOMPLETE` listando os codes pendentes obrigatórios. WhatsApp e entregador não bloqueiam publicar (a loja pode operar sem eles). Treinamento não bloqueia.

## API

```text
GET  /api/v1/admin/onboarding          qualquer usuário do tenant
POST /api/v1/admin/onboarding/:code/complete
POST /api/v1/admin/onboarding/:code/skip
POST /api/v1/admin/store/publish       store.configure
POST /api/v1/admin/store/unpublish     store.configure
```

`complete` automático acontece dentro dos casos de uso já existentes (salvar branding marca `configure_branding`, etc.). Não confie só no botão.

Super admin, ao criar tenant, vê o checklist em `GET /api/v1/platform/tenants/:id/onboarding`.

## UI

No admin, banner enquanto `published=false` com a próxima etapa e link. Página “Implantação” com a lista e o que falta. Landing não muda.

## Testes

- Tenant novo não está publicado; público toma 403.
- Salvar horários marca o passo.
- Publicar sem produto ativo falha.
- Com os obrigatórios feitos, publicar libera o `GET /public/store`.

## Como validar

```bash
npm run migration:run
npx nx test api
npx nx test admin
```

## Critério de conclusão

O checklist da especificação existe no produto, avança quando a configuração é salva, e a loja só fica pública com o mínimo pronto.
