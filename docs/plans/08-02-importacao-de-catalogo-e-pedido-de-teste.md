# 08-02 — Importação de catálogo e pedido de teste

> Implemente somente esta tarefa. Leia as convenções. A 08-01 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 8 — Piloto comercial |
| Depende de | 08-01 |
| Desbloqueia | 08-03 |
| Critério da fase que esta tarefa avança | A implantação não depende de cadastrar item por item nem de um pedido manual frágil |

## Objetivo

Importar o cardápio inicial por CSV e disparar um pedido de teste reconhecível.

## CSV

```text
POST /api/v1/admin/catalog/import     catalog.manage     multipart campo file
```

Cabeçalho obrigatório:

```text
category,product,description,price,sku,option_group,option_name,option_price,option_min,option_max
```

- `price` e `option_price` em reais com ponto ou vírgula (`49,90`). Grave centavos.
- Linhas com o mesmo `category` reutilizam a categoria.
- Mesmo `product` dentro da categoria reutiliza o produto e acrescenta opção.
- Grupo vazio significa produto sem opção.
- Máximo 500 linhas. Acima: `400`.
- Tudo ou nada: se uma linha falha, nenhuma grava, e a resposta `422` lista `{ line, code, message }`.
- Arquivo não é planilha binária. Só CSV UTF-8. Recuse `.xlsx` com `400` `CSV_REQUIRED`.
- Ao sucesso, marque `import_catalog` como `DONE`.

Modelo de arquivo para download:

```text
GET /api/v1/admin/catalog/import-template
```

devolve um CSV de exemplo com a Calabresa, tamanho e adicional.

UI: enviar arquivo, ver erros por linha, ver resumo “12 produtos”.

## Pedido de teste

```text
POST /api/v1/admin/orders/test     orders.accept
```

Cria um pedido `PICKUP`, pagamento `CASH`, cliente “Pedido de teste” com telefone interno `5500000000000` **único por tenant** (se já existir, reutilize), um item do primeiro produto ativo com as opções mínimas obrigatórias, `notes` = `TEST_ORDER`, status `NEW`. Idempotente por dia: se já houver pedido de teste `NEW` hoje, devolva o mesmo.

Marca `place_test_order` como `DONE`.

O painel mostra um selo “Teste” quando `notes` é `TEST_ORDER` ou `source` = `TEST`. Use `source=TEST`. Relatórios da 07-02 **excluem** `source=TEST` do faturamento. Ajuste o relatório e o teste da 07-02 se ele passar a falhar: o overview ganha o filtro e o teste antigo continua com `STOREFRONT`.

Não chame WhatsApp para `source=TEST`.

## Testes

- CSV válido cria categoria, produto e opção com preço em centavos.
- Linha com preço vazio não persiste as linhas anteriores.
- CSV de outro conteúdo não vaza tenant (import usa o contexto).
- Pedido de teste não entra no faturamento e não gera mensagem WhatsApp.
- O passo de onboarding correspondente fica `DONE`.

## Como validar

```bash
npx nx test api
npx nx test admin
```

## Critério de conclusão

Um CSV de exemplo importa o cardápio da loja e um pedido de teste aparece no painel sem contar como venda e sem disparar WhatsApp.
