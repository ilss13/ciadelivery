# 07-03 — Dashboard, usuários e configurações

> Implemente somente esta tarefa. Leia as convenções. A 07-02 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 7 — Administração, auditoria e relatórios |
| Depende de | 07-02 |
| Desbloqueia | 07-04 |
| Critério da fase que esta tarefa avança | A equipe opera o dia pelo painel, sem ferramenta técnica |

## Objetivo

Juntar o que a operação diária precisa na entrada do painel e completar a gestão de usuários e as telas de configuração que ainda estiverem só na API.

## Dashboard

```text
GET /api/v1/admin/dashboard
```

`orders.read`. Resposta do dia corrente no fuso da loja:

- pedidos novos agora;
- em preparo;
- prontos;
- em rota;
- entregues hoje;
- faturamento do dia (`total_cents` das regras do relatório);
- loja aberta ou fechada;
- WhatsApp `CONNECTED` ou não.

UI `/` depois do login para quem opera pedido. Atalhos para pedidos, cardápio, clientes, relatórios e configurações, respeitando permissão. Quem é cozinha cai direto em `/pedidos`.

## Usuários

Tela `/equipe` para `users.manage`:

- listar nome, email, papel, status;
- criar com senha temporária mostrada uma vez;
- desabilitar com confirmação;
- editar papel;
- toggles dos overrides de permissão, com o padrão do papel visível;
- não oferece `SUPER_ADMIN`;
- não permite o owner desabilitar a si mesmo se for o único owner (`409` `LAST_OWNER`).

## Configurações

Revise o menu e garanta tela, não só endpoint, para:

- dados da loja e endereço;
- horários e fechamento manual;
- branding e cores;
- entrega, raio e faixas;
- pagamentos offline;
- WhatsApp;
- domínio próprio: campo `custom_domain` com validação de hostname e instrução de apontar o DNS. A resolução já existe desde a Fase 1; a tela entra aqui.

Textos de ajuda curtos em português. Confirmação em ação destrutiva. Layout utilizável no celular do balcão.

## Testes

- Dashboard não soma pedido de outro tenant.
- Último owner não é desabilitado.
- Attendant não abre `/equipe` (guarda de rota e API 403).

## Como validar

```bash
npx nx test api
npx nx test admin
```

Percorra no navegador, em largura de celular: entrar, ver o dashboard, abrir pedidos, abrir configurações.

## Critério de conclusão

Owner e equipe encontram dashboard, pedidos, cardápio, clientes, entrega, marca, pagamentos, WhatsApp e usuários no painel, cada um no que sua permissão permite.
