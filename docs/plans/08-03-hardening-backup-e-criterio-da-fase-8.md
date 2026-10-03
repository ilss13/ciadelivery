# 08-03 — Hardening, backup e critério da Fase 8

> Implemente somente esta tarefa. Leia as convenções. A 08-02 precisa estar concluída. Não faça commit. Não invente que uma loja real já operou.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 8 — Piloto comercial |
| Depende de | 08-02 |
| Desbloqueia | 09-01 |
| Critério da fase | Ao menos um estabelecimento opera pedidos reais durante um período acordado sem falhas bloqueadoras |

## Objetivo

Deixar o piloto executável e honesto. A parte que a IA conclui é o kit técnico. A parte “loja real operou” fica registrada como pendência humana e **não** pode ser marcada como feita no código.

## Hardening

Confira e complete o que faltar da seção 28:

- headers do Helmet já ativos;
- CORS ainda é lista, não `*`, em staging e production (teste de configuração);
- rate limit nas rotas públicas de pedido e de lead;
- webhook continua exigindo assinatura;
- segredos só por env;
- tracking token só como hash no banco;
- erro 404 uniforme para recurso de outro tenant;
- `STORE_UNPUBLISHED` e tenant suspenso.

Corrija o que estiver objetivamente faltando. Não reescreva módulos que já cumprem a regra.

Script `scripts/smoke-business-day.sh` (ou teste `phase8-acceptance.spec.ts` se o script ficar frágil) que, contra a API local:

1. Cria tenant pela rota de plataforma com super admin de seed.
2. Completa branding, horário, endereço, entrega.
3. Importa o CSV modelo.
4. Publica.
5. Faz pedido público.
6. Aceita, prepara, marca pronto.
7. Atribui entregador criado na API, despacha e conclui **ou** conclui retirada se não houver courier — prefira o ciclo de retirada neste smoke para não depender de geocoding, e um segundo caso curto de quote fora da área.
8. Lê dashboard e relatório.
9. Falha o script se qualquer passo não retornar o status esperado.

## Backup

`docs/ops/recuperacao.md` em português:

- o backup oficial é do MySQL (mysqldump ou snapshot do gerenciado);
- retenção sugerida 7 dias diários e 4 semanais;
- cópia fora da máquina da aplicação;
- passo a passo de restore **local** usando `docker compose`;
- o que não está no dump: objetos do storage S3, que precisam de backup do bucket.

Script `scripts/backup-restore-drill.sh` que:

1. sobe MySQL do compose se não estiver no ar;
2. cria um schema de drill ou usa database `ciadelivery_drill`;
3. gera um dump do banco `ciadelivery`;
4. restaura no database de drill;
5. confere que a tabela `tenants` existe;
6. apaga só o database de drill.

Não apague `ciadelivery`. Não rode isso em host que não seja local: se `NODE_ENV=production`, o script sai com erro.

## Telemetria do piloto

`GET /api/v1/platform/pilot-status` para `SUPER_ADMIN`: por tenant, `published`, passos pendentes, pedidos `STOREFRONT` nos últimos 7 dias, mensagens WhatsApp falhas. Sem corpo de mensagem.

Campo humano, fora do código: em `docs/ops/piloto.md`, checklist com data, nome do estabelecimento, responsável e “sem falha bloqueadora”. Deixe as linhas em branco. Não preencha com loja fictícia marcada como sucesso.

## Critério de conclusão

- O smoke do dia de negócio passa.
- O drill de restore local passa e o README ou `docs/ops/recuperacao.md` explica como rodá-lo.
- `docs/ops/piloto.md` existe com o critério comercial **em aberto**.

A Fase 8 da especificação só estará comercialmente aceita quando uma pessoa registrar no checklist que um estabelecimento real operou. Esta tarefa não substitui esse fato.
