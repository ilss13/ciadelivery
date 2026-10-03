# 05-03 — Entregadores, atribuição e painel PWA

> Implemente somente esta tarefa. Leia as convenções. A 05-02 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 5 — Delivery e entregadores |
| Depende de | 05-02 |
| Desbloqueia | 05-04 |
| Critério da fase que esta tarefa avança | Há entregador, atribuição manual e painel para concluir a entrega |

## Objetivo

Cadastrar entregadores, atribuir um pedido pronto e dar a essa pessoa um PWA para ver só as próprias entregas.

## Modelo

### `couriers`

`id`, `tenant_id`, `store_id`, `user_id` único, `name`, `phone`, `status` (`AVAILABLE`, `UNAVAILABLE`), `active` bool, `vehicle_type` null, `notes` null, timestamps.

Criar entregador cria `users.role=COURIER` no mesmo tenant ou vincula usuário já `COURIER` desse tenant. Senha inicial definida pelo owner (política já existente) e `must_change_password` não é obrigatório no MVP: entregue a senha uma vez na resposta de criação e não a guarde em claro.

### `delivery_assignments`

`id`, `tenant_id`, `order_id` único (um assignment ativo), `courier_id`, `status` (`ASSIGNED`, `OUT`, `DELIVERED`, `CANCELLED`), `assigned_by`, `assigned_at`, `out_at` null, `delivered_at` null.

Índice `(tenant_id, courier_id, status)`.

## API admin

```text
GET/POST   /api/v1/admin/couriers                 couriers.manage
PATCH      /api/v1/admin/couriers/:id             couriers.manage
POST       /api/v1/admin/orders/:id/assign-courier orders.assign_courier
```

Body de assign: `{ "courierId" }`. Só pedido `DELIVERY` em `READY`. Caso contrário `409`. Entregador inativo ou de outro tenant: `404`.

Assign, na mesma transação: cria assignment `ASSIGNED`, histórico não muda o status do pedido ainda (continua `READY`), outbox `order.courier_assigned`.

```text
POST /api/v1/admin/orders/:id/dispatch    orders.assign_courier
POST /api/v1/admin/orders/:id/deliver     orders.deliver
```

`dispatch` exige assignment e status `READY`, vai para `OUT_FOR_DELIVERY`, assignment `OUT`. Sem assignment: `409` `COURIER_REQUIRED`.

`deliver` em pedido delivery exige status `OUT_FOR_DELIVERY`. Vai para `DELIVERED`.

O entregador usa rotas próprias, não as admin:

```text
GET  /api/v1/courier/orders
GET  /api/v1/courier/orders/:id
POST /api/v1/courier/orders/:id/start      -> OUT_FOR_DELIVERY
POST /api/v1/courier/orders/:id/complete   -> DELIVERED
GET  /api/v1/courier/deliveries            histórico recente, 30 dias, paginado
```

Somente papel `COURIER` e assignment daquele `user`. Pedido de outro entregador: `404`. O detalhe mostra endereço, número do pedido, total e telefone do cliente. Telefone só porque a permissão de entregador atribuído inclui o contato necessário para a entrega. Não mostre lista de clientes.

Evento de socket `order.courier_assigned` e `order.out_for_delivery` também na sala `courier:{userId}` (o user id do entregador). O gateway da 04-02 passa a autorizar essa sala só para o próprio courier.

## PWA `apps/courier`

- Manifest, ícone simples gerado no projeto (SVG/PNG próprio), `display: standalone`, nome “Entregas”.
- Login.
- Lista de atribuídos e em rota.
- Detalhe com endereço e telefone (link `tel:`).
- Botões “Sair para entrega” e “Entrega concluída”.
- Histórico recente.
- Service worker do Angular (`ngsw`) cacheia o shell. A lista de pedidos **não** é cache offline como verdade: se estiver offline, mostre o aviso e não marque entrega. Não implemente fila offline.
- Tempo real: o card novo entra quando chega `order.courier_assigned`.

## Admin UI

Na coluna Prontos de um pedido delivery: escolher entregador e atribuir. Na coluna em rota: o admin com permissão também pode despachar e concluir, para o caso de o entregador não usar o celular.

## Testes

- Integração: atribuir, start pelo courier, complete; outro courier recebe 404; pedido fora de `READY` não atribui; pickup não atribui.
- Componente do courier: só renderiza os pedidos devolvidos pela API falsa.

## Como validar

```bash
npm run migration:run
npx nx test api
npx nx test courier
```

## Critério de conclusão

Um operador atribui um pedido pronto a uma pessoa, e essa pessoa vê só esse pedido no PWA.
