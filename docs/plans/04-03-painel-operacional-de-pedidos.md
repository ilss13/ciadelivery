# 04-03 — Painel operacional de pedidos

> Implemente somente esta tarefa. Leia as convenções. A 04-02 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 4 — Operação em tempo real |
| Depende de | 04-02 |
| Desbloqueia | 04-04 |
| Critério da fase que esta tarefa avança | O estabelecimento opera o pedido sem recarregar a página |

## Objetivo

Transformar a lista somente leitura de pedidos num painel rápido de operação.

## API que o painel precisa

```text
GET /api/v1/admin/orders
GET /api/v1/admin/orders/:id
```

`orders.read`. Paginação. Filtros: `status`, `from`, `to`. Ordem padrão `created_at` descendente.

O GET de detalhe inclui itens snapshot, histórico, cliente, pagamento e totais. Não inclui tracking token em claro.

As ações HTTP já existem na 04-01. O painel as consome.

## UI

Rota `/pedidos` no admin. Colunas ou seções:

```text
Novos | Aceitos | Em preparo | Prontos | Saiu para entrega | Finalizados
```

“Saiu para entrega” pode ficar vazia até a Fase 5. Finalizados reúnem `DELIVERED`, `REJECTED` e `CANCELLED` do dia, com o status visível.

Cada card mostra número, há quantos minutos foi criado (atualize o texto a cada 30 s), total em BRL, tipo entrega/retirada, primeiro nome do cliente.

Ações conforme permissão e estado:

- Novo: Aceitar e Recusar (recusa pede nota);
- Aceito: Iniciar preparo;
- Em preparo: Marcar pronto;
- Pronto e retirada: Marcar retirado;
- Cancelar, com confirmação e nota, nos estados em que a máquina permite.

`KITCHEN` vê pedidos e o botão de preparo/pronto, sem aceitar nem cancelar.

Tempo real:

- ao conectar, carregue a lista por HTTP (o banco é a verdade);
- `order.created` insere o card sem refetch completo e dispara alerta visual (destaque de alguns segundos);
- preferência “alerta sonoro” em `localStorage`, desligada por padrão. Se ligada, toque um beep curto gerado por código (sem arquivo de áudio de terceiros). O navegador pode bloquear autoplay: o primeiro clique na página libera o áudio e a UI avisa isso;
- eventos seguintes movem o card de coluna. Se o evento chegar de um pedido fora da lista, faça GET daquele id.

Estados de loading, vazio (“nenhum pedido novo”) e erro com tentar de novo. Atalho: foco no primeiro pedido novo. Botões grandes o bastante para toque.

Não implemente Kanban drag-and-drop.

## Testes

- Componente com store falsa: evento `order.created` adiciona o card; `order.accepted` muda o card de coluna.
- Permissão de cozinha não renderiza aceitar.

## Como validar

```bash
npx nx test admin
```

No navegador, crie um pedido no storefront com o painel aberto e veja o card aparecer sem F5. Aceite e veja a coluna mudar.

## Critério de conclusão

O pedido novo aparece no painel sem refresh, com alerta visual, e aceite, recusa, preparo, pronto e cancelamento funcionam pelos botões.
