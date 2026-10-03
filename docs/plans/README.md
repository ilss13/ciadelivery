# Planos executáveis — Plataforma Whitelabel de Delivery

Cada arquivo desta pasta é uma tarefa para **uma sessão de IA**. Execute **um arquivo por sessão**, na ordem do nome. Não implemente tarefas futuras “de passagem”.

Fonte de verdade do produto: [`docs/especificacao_tecnica_delivery_whitelabel.md`](../especificacao_tecnica_delivery_whitelabel.md).  
Diagrama: [`docs/Arquitetura Técnica da Plataforma Delivery.png`](../Arquitetura%20Técnica%20da%20Plataforma%20Delivery.png).  
Regras que valem para todas as tarefas: [`00-00-convencoes-para-agentes.md`](00-00-convencoes-para-agentes.md).

## Como executar

1. Leia `00-00-convencoes-para-agentes.md` e o arquivo da tarefa.
2. Implemente só o que a tarefa pede. Se uma dependência anterior não existir, pare e informe qual tarefa falta.
3. Rode os comandos da seção **Como validar**. A tarefa só termina quando o **critério de conclusão** é verdadeiro.
4. Não faça commit, a menos que a pessoa peça.
5. Não altere a especificação para enfraquecer uma regra. Se a especificação e este plano divergirem em detalhe de implementação, siga este plano. Se divergirem em regra de negócio, siga a especificação e registre a diferença no final da sua resposta.

## Ordem e critério de cada fase

| Ordem | Tarefa | Critério da fase que ela sustenta |
|---|---|---|
| 0 | [00-01](00-01-monorepo-e-aplicacoes-base.md) | Apps existem e compilam |
| 0 | [00-02](00-02-docker-mysql-redis-e-ambientes.md) | Sobe localmente com MySQL e Redis |
| 0 | [00-03](00-03-fundacao-nestjs-observabilidade-e-swagger.md) | Health, logs, erros, Swagger, migrations |
| 0 | [00-04](00-04-ci-cd-e-criterio-da-fase-0.md) | **Fase 0:** todas as aplicações sobem localmente e em staging com pipeline automatizado |
| 1 | [01-01](01-01-tenant-store-e-resolucao-de-contexto.md) | Tenant e loja isolados por contexto |
| 1 | [01-02](01-02-usuarios-rbac-e-autenticacao.md) | Login, refresh e papéis |
| 1 | [01-03](01-03-branding-horarios-e-configuracao-da-loja.md) | Marca, horários e configuração |
| 1 | [01-04](01-04-whitelabel-frontend-e-subdominio.md) | Identidade visual por subdomínio |
| 1 | [01-05](01-05-isolamento-e-criterio-da-fase-1.md) | **Fase 1:** duas empresas operam ao mesmo tempo sem ver dados uma da outra e com identidade visual distinta |
| 2 | [02-01](02-01-catalogo-categorias-produtos-e-opcoes.md) | Cardápio administrável |
| 2 | [02-02](02-02-armazenamento-de-imagens.md) | Imagens de produto, logo e banner |
| 2 | [02-03](02-03-storefront-cardapio-e-carrinho.md) | Cardápio público e carrinho |
| 2 | [02-04](02-04-loja-fechada-pedido-minimo-e-criterio-da-fase-2.md) | **Fase 2:** consumidor monta um carrinho válido com produtos e adicionais de uma loja |
| 3 | [03-01](03-01-clientes-enderecos-consentimento-e-pagamento-offline.md) | Cliente por telefone, endereço e pagamento offline |
| 3 | [03-02](03-02-pedido-snapshot-state-machine-e-historico.md) | Pedido com snapshot, estados e histórico |
| 3 | [03-03](03-03-checkout-acompanhamento-e-criterio-da-fase-3.md) | **Fase 3:** consumidor faz um pedido completo sem cadastro obrigatório e consulta depois |
| 4 | [04-01](04-01-outbox-bullmq-e-worker-de-eventos.md) | Outbox, fila e retry |
| 4 | [04-02](04-02-websocket-autorizacao-e-rooms.md) | Tempo real autorizado |
| 4 | [04-03](04-03-painel-operacional-de-pedidos.md) | Operação de aceite, preparo e recusa |
| 4 | [04-04](04-04-timeline-tempo-real-e-criterio-da-fase-4.md) | **Fase 4:** pedido aparece no painel sem refresh e cada mudança de status chega ao consumidor em tempo real |
| 5 | [05-01](05-01-configuracao-de-entrega-zonas-e-haversine.md) | Raio, taxa fixa e taxa por faixa |
| 5 | [05-02](05-02-geocodificacao-e-quote-no-checkout.md) | Endereço validado e fora da área bloqueado |
| 5 | [05-03](05-03-entregadores-atribuicao-e-painel-pwa.md) | Atribuição manual e painel do entregador |
| 5 | [05-04](05-04-ciclo-de-entrega-e-criterio-da-fase-5.md) | **Fase 5:** bloqueia fora da área e conclui o ciclo até a entrega |
| 6 | [06-01](06-01-conexao-whatsapp-oficial-e-webhook.md) | Número próprio por estabelecimento |
| 6 | [06-02](06-02-notificacoes-de-status-do-pedido.md) | Cliente recebe notificações de status |
| 6 | [06-03](06-03-conversas-e-atendimento-manual.md) | Conversas visíveis e respondíveis |
| 6 | [06-04](06-04-retries-logs-e-criterio-da-fase-6.md) | **Fase 6:** notificações definidas chegam e o estabelecimento vê e responde conversas |
| 7 | [07-01](07-01-auditoria-de-acoes-sensiveis.md) | Trilha de auditoria |
| 7 | [07-02](07-02-relatorios-basicos.md) | Relatórios do dia a dia |
| 7 | [07-03](07-03-dashboard-usuarios-e-configuracoes.md) | Dashboard, equipe e configurações |
| 7 | [07-04](07-04-metricas-alertas-lgpd-e-criterio-da-fase-7.md) | **Fase 7:** a empresa opera o dia sem acesso técnico ao sistema |
| 8 | [08-01](08-01-onboarding-assistido-e-checklist.md) | Implantação de um estabelecimento |
| 8 | [08-02](08-02-importacao-de-catalogo-e-pedido-de-teste.md) | Catálogo inicial e pedido de teste |
| 8 | [08-03](08-03-hardening-backup-e-criterio-da-fase-8.md) | **Fase 8:** kit de piloto pronto; o critério comercial (loja real) é humano e não pode ser simulado |
| 9 | [09-01](09-01-provedor-de-ia-modos-e-guardrails.md) | IA sem autoridade comercial |
| 9 | [09-02](09-02-ferramentas-de-catalogo-carrinho-e-quote.md) | Montagem de carrinho por ferramentas |
| 9 | [09-03](09-03-confirmacao-pedido-handoff-e-criterio-da-fase-9.md) | **Fase 9:** pedido simples nasce da conversa e preço, disponibilidade e criação são validados pelo backend |

## Fora destes planos

A Fase 10 da especificação (pagamentos online, Flutter, fiscal, PDV, marketplace, roteirização, franquias) **não tem tarefa**. Não implemente esses itens.
