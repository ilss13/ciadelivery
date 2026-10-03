# 09-02 — Ferramentas de catálogo, carrinho e quote

> Implemente somente esta tarefa. Leia as convenções. A 09-01 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 9 — IA no WhatsApp |
| Depende de | 09-01 |
| Desbloqueia | 09-03 |
| Critério da fase que esta tarefa avança | A conversa monta um carrinho com dados calculados pelo backend |

## Objetivo

Expor ferramentas que o modelo pode chamar. Quem calcula preço, disponibilidade e taxa é o código já existente, não o texto da IA.

## Ferramentas

Registro no domínio `whatsapp` ou `orders`. Cada ferramenta recebe `tenantId` e `storeId` do contexto da conversa, nunca argumentos da IA.

| Ferramenta | Entrada da IA | Saída |
|---|---|---|
| `search_catalog` | `query` string até 80 | até 8 produtos active com id, nome, preço em centavos, grupos obrigatórios |
| `get_product` | `productId` | produto e opções available. Id de outro tenant: erro de ferramenta `NOT_FOUND` |
| `resolve_options` | `productId`, `optionIds` | validação do grupo, igual ao carrinho |
| `quote_delivery` | endereço estruturado | o mesmo resultado de `POST /public/delivery/quote` |
| `preview_order` | itens, fulfillment, endereço opcional, telefone e nome | **não grava pedido**. Devolve totais do servidor e um `previewToken` |

`preview_order`:

- reutiliza o validador de carrinho, a loja aberta, o mínimo, o pagamento ainda não entra;
- gera `preview_token` opaco, guarda hash, `tenant_id`, `conversation_id`, payload canônico com preços do servidor, `expires_at` now+15 min, tabela `order_previews`;
- a resposta à IA inclui `subtotalCents`, `deliveryFeeCents`, `totalCents`, nomes e o token;
- se a IA devolver na mensagem um total diferente do `totalCents`, bloqueie como na 09-01 e não envie.

O `ScriptedLlmProvider` deve poder emitir `toolCalls`. O orquestrador:

1. chama o modelo;
2. executa no máximo 4 rodadas de ferramentas;
3. chama o modelo de novo com os resultados JSON;
4. na quinta rodada sem mensagem final, handoff.

Estoure o orçamento: handoff `TOOL_LOOP`.

Não há `create_order` nesta tarefa. Se o modelo pedir essa ferramenta, ignore e handoff `UNKNOWN_TOOL`.

## Mensagem ao cliente

O texto final do bot, quando o preview existe, é montado pelo backend a partir do preview, não colado do modelo:

```text
{nome}, ficou {qtd} {produto} ({opções}).
Subtotal {subtotal}
Taxa {taxa}
Total {total}
Responda SIM para confirmar ou NÃO para cancelar.
```

O modelo pode ter interpretado a frase; quem escreve números é esse template. Envie pelo `WhatsAppProvider` como texto de sessão em não-production e como template `order_preview` se você adicionar a chave. No driver log, texto basta.

Carrinho da conversa fica no `order_previews` e numa tabela `conversation_carts` se precisar editar antes do preview. Pode ser só o último preview da conversa. Novo `preview_order` invalida o token anterior da mesma conversa.

## Testes

- “2 x-bacon” no provider scripted chama `search_catalog` e `preview_order`. O total da mensagem é o do banco (preço do produto de teste × 2), mesmo que o scripted tente dizer outro valor no `assistantMessage` (esse texto é ignorado quando há preview).
- Produto de outro tenant não entra na busca.
- Produto `available=false` não entra no preview; a ferramenta devolve `PRODUCT_UNAVAILABLE`.
- Quote fora da área não gera token.

Use o seed ou fixtures da pizzaria/burger no teste, com um produto cujo nome seja buscável.

## Como validar

```bash
npm run migration:run
npx nx test api
npx nx test worker
```

## Critério de conclusão

Uma frase de pedido vira preview com preço, opções e taxa calculados pelo backend, e o número que o cliente vê sai desse cálculo.
