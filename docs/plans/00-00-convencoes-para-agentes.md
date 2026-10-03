# Convenções para agentes

Leia este arquivo antes de qualquer tarefa em `docs/plans`. Ele trava decisões para que sessões diferentes não reescrevam a arquitetura.

## Produto

SaaS B2B2C whitelabel de delivery. Cada empresa é um tenant com a própria marca, cardápio, equipe, clientes, pedidos e WhatsApp. Posicionamento: canal próprio, sem comissão por pedido.

Monólito modular. Sem microserviços. Sem aplicativo Flutter. Sem pagamento online, fiscal, PDV, mesas, estoque completo, marketplace ou IA autônoma sem as travas da Fase 9.

## Stack obrigatória

| Camada | Escolha |
|---|---|
| Monorepo | Nx, npm, TypeScript estrito |
| Web | Angular (standalone, rotas, CSS). Quatro apps: `landing`, `storefront`, `admin`, `courier` |
| API | NestJS em `apps/api` |
| Worker | NestJS em `apps/worker` (processo separado, mesmo código de domínio) |
| Banco | MySQL 8, TypeORM, migrations versionadas |
| Fila / cache | Redis 7 + BullMQ |
| Tempo real | Socket.IO no processo da API |
| Contrato | OpenAPI em `/api/docs` e arquivo gerado `openapi.json` |
| Testes API | Jest + Supertest. Integração contra MySQL e Redis do Compose |
| Testes web | Testes de componente Angular. E2E com Playwright a partir da Fase 2 |
| Dinheiro | Inteiro em centavos (`*_cents`). Nunca `float` para preço |
| Data | UTC no banco (`datetime(3)`). ISO-8601 na API |
| Id | `char(36)` UUID v4 gerado pela aplicação |

O diagrama mostra o painel do entregador como cliente próprio. Por isso existe `apps/courier`, mesmo a árvore da seção 6 não listar essa pasta.

## Onde o código mora

```text
apps/landing        porta 4200
apps/storefront     porta 4201
apps/admin          porta 4202
apps/courier        porta 4203
apps/api            porta 3000
apps/worker         sem HTTP público, só health interno 3001

libs/<dominio>/src/domain            entidades, máquinas de estado, portas
libs/<dominio>/src/application       casos de uso
libs/<dominio>/src/infrastructure    TypeORM, Redis, adapters externos
libs/<dominio>/src/presentation      controllers, gateways, DTOs Nest
```

Domínios: `shared`, `tenancy`, `auth`, `users`, `stores`, `branding`, `catalog`, `customers`, `orders`, `delivery`, `notifications`, `whatsapp`, `audit`.

Regras de dependência:

- `domain` não importa Nest, TypeORM, Angular nem SDK externo.
- `application` depende de portas do domínio.
- `infrastructure` implementa as portas.
- Apps só compõem módulos. Regra de negócio não fica em `apps/api/src` além do bootstrap.
- Frontends não importam libs de backend. Consomem HTTP/OpenAPI.

Crie a lib só na tarefa que introduz o domínio.

## Multi-tenancy

Toda tabela de negócio tem `tenant_id`. Entidades de uma loja também têm `store_id`. No MVP a aplicação cria exatamente uma loja por tenant e recusa a segunda.

O tenant **não** vem de `tenant_id` no body, query ou header de produção.

| Superfície | Resolução |
|---|---|
| Storefront e rotas `/api/v1/public/*` | Host: subdomínio `{slug}.localhost` / `{slug}.{PLATFORM_DOMAIN}` ou domínio próprio cadastrado |
| Admin, courier e rotas `/api/v1/admin/*` e `/api/v1/courier/*` | Tenant do usuário autenticado |
| `/api/v1/platform/*` | Somente papel `SUPER_ADMIN`, sem tenant |
| Webhook WhatsApp | Número/conta da conexão, nunca um id enviado pelo cliente |

Em desenvolvimento, `X-Tenant-Host` só é aceito quando `NODE_ENV` não é `production` nem `staging`. Fora isso, ignore o header.

Toda query de negócio filtra `tenant_id` no repositório. Não filtre só no controller. Teste de isolamento é obrigatório quando a tarefa cria leitura de dados.

## HTTP

Prefixo `/api/v1`. JSON. DTO com `class-validator`. Código HTTP correto.

Erro:

```json
{
  "error": {
    "code": "ORDER_INVALID_TRANSITION",
    "message": "The requested order transition is not allowed",
    "details": null,
    "requestId": "uuid"
  }
}
```

`code` é estável, em inglês, `SCREAMING_SNAKE`. `message` é em inglês. A UI traduz pelo `code`.

Paginação de lista: `?page=1&pageSize=20` (máximo 100). Resposta:

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }
}
```

`Idempotency-Key` obrigatório em `POST /api/v1/public/orders` e no webhook de WhatsApp.

Correlation: aceite `X-Request-Id` ou gere um. Devolva o mesmo header. Coloque no log e no erro.

## Papéis e permissões

Papéis: `SUPER_ADMIN`, `OWNER`, `MANAGER`, `ATTENDANT`, `KITCHEN`, `COURIER`.

Permissões (o papel traz o padrão; um usuário pode ganhar ou perder permissão sem mudar de papel):

| Permissão | OWNER | MANAGER | ATTENDANT | KITCHEN | COURIER |
|---|---|---|---|---|---|
| `users.manage` | sim | não | não | não | não |
| `catalog.manage` | sim | sim | não | não | não |
| `orders.read` | sim | sim | sim | sim | só atribuídos |
| `orders.accept` | sim | sim | sim | não | não |
| `orders.prepare` | sim | sim | sim | sim | não |
| `orders.assign_courier` | sim | sim | sim | não | não |
| `orders.deliver` | sim | sim | sim | não | sim, na própria entrega |
| `store.configure` | sim | não | não | não | não |
| `customers.read` | sim | sim | sim | não | não |
| `couriers.manage` | sim | sim | não | não | não |
| `whatsapp.operate` | sim | sim | sim | não | não |
| `reports.read` | sim | sim | não | não | não |
| `audit.read` | sim | não | não | não | não |

`SUPER_ADMIN` acessa plataforma e não enxerga dados de tenant por rotas admin.

## Pedido

Estados: `NEW`, `ACCEPTED`, `IN_PREPARATION`, `READY`, `OUT_FOR_DELIVERY`, `DELIVERED`, `REJECTED`, `CANCELLED`.

Transições:

```text
NEW -> ACCEPTED | REJECTED | CANCELLED
ACCEPTED -> IN_PREPARATION | CANCELLED
IN_PREPARATION -> READY | CANCELLED
READY -> OUT_FOR_DELIVERY | DELIVERED
OUT_FOR_DELIVERY -> DELIVERED
```

Qualquer outra transição responde `409` com `ORDER_INVALID_TRANSITION`.

`OrderItem` guarda snapshot: `product_id`, `product_name`, `sku`, `unit_price_cents`, `quantity`, `notes`, `options_snapshot`, `subtotal_cents`. Alterar o cardápio depois não muda o pedido.

Sequência de uma mudança de status, na mesma transação MySQL:

1. Validar transição e permissão.
2. Atualizar o pedido.
3. Inserir `order_status_history`.
4. Inserir `outbox_events`.
5. Commit.
6. O worker publica o efeito (WebSocket, notificação, WhatsApp).

WebSocket não grava estado.

## Filas

`notifications`, `whatsapp-outbound`, `outbox-events`, `order-events`, `audit-processing`, `maintenance`.

Job carrega id do evento. Reprocessar o mesmo evento não duplica efeito (idempotência por `event_id`).

## Integrações externas

Sempre atrás de porta no domínio:

- `StorageProvider` — disco local em dev; S3 compatível quando `STORAGE_DRIVER=s3`.
- `GeocodingProvider` — stub determinístico em teste; HTTP configurável em produção. O domínio não cita Google, Mapbox ou OSM.
- `WhatsAppProvider` — somente API oficial (Cloud API da Meta). Proibido WhatsApp Web, Baileys ou automação de sessão.
- `LlmProvider` — só na Fase 9. A IA não decide preço, estoque, taxa, desconto, total nem status.
- `PaymentGateway` — não implementar. Não crie a interface até existir tarefa para isso.

Segredo de integração fica criptografado com AES-256-GCM e chave `CREDENTIALS_ENCRYPTION_KEY`. Não logue segredo, token, senha nem corpo completo de webhook.

## Frontend

- Organização por feature: `core`, `shared`, `features/<nome>`.
- Estado local da feature. Sem NgRx.
- Mobile-first, estado de carregamento, vazio, erro e confirmação antes de ação destrutiva.
- Whitelabel por CSS variables carregadas do tenant: `--brand-primary`, `--brand-secondary`, `--brand-accent`.
- Textos de interface em português do Brasil. Código e identificadores em inglês.
- Moeda exibida em BRL.

## Ambientes

`local`, `development`, `staging`, `production`. Arquivo `.env.example` completo. `.env` fora do Git.

Portas locais: MySQL `3306`, Redis `6379`, API `3000`, worker health `3001`, landing `4200`, storefront `4201`, admin `4202`, courier `4203`.

Banco local: `ciadelivery`. Usuário e senha só no `.env.example` como valores de desenvolvimento (`ciadelivery` / `ciadelivery`).

## Testes mínimos de uma tarefa de negócio

- Unitário da regra nova.
- Integração do endpoint novo, incluindo um caso de outro tenant quando houver leitura.
- Atualizar OpenAPI.
- Migration própria da tarefa, reversível com `down`.
- UI da tarefa responsiva quando a tarefa tiver tela.

## Definition of Done (especificação, seção 48)

Só declare a tarefa pronta se: a regra existe, a autorização existe, o tenant está isolado, o erro segue o contrato, há log sem dado sensível, os testes da tarefa passam, a migration sobe do zero, o Swagger mostra a rota, a UI nova funciona em viewport estreita, e o critério de conclusão do arquivo é verdadeiro.

Não faça deploy real. Não invente credencial de produção. Não marque piloto com loja real como concluído.
