# 01-04 — Whitelabel no frontend e subdomínio

> Implemente somente esta tarefa. Leia as convenções. A 01-03 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 1 — Multi-tenancy, autenticação e whitelabel |
| Depende de | 01-03 |
| Desbloqueia | 01-05 |
| Critério da fase que esta tarefa avança | Identidade visual distinta por estabelecimento |

## Objetivo

Fazer a landing, o cardápio público e o painel carregarem a marca do tenant certo, com login funcional no painel.

## Fora de escopo

Cardápio, carrinho, pedidos, PWA do entregador além de uma tela de login vazia. Domínio próprio já funciona na API; a UI de cadastrá-lo pode ser um campo no formulário de branding.

## Storefront

- Na subida, `GET /api/v1/public/store` com o host da página.
- Aplique no `documentElement`:

```css
:root {
  --brand-primary: #c0392b;
  --brand-secondary: #ffffff;
  --brand-accent: #111111;
}
```

Os valores vêm da API. Não deixe cor de um tenant anterior em navegação interna.

- Título da aba e favicon vêm do branding. Meta description usa `seo_description`.
- Mostre nome, banner (se houver URL), telefone, endereço e um aviso “Loja fechada” quando `isOpen` for falso. Sem produtos ainda.
- Host desconhecido ou tenant suspenso: página própria, sem dados de outra loja.
- Em local, documente no README o uso de `pizzariadoze.localhost` e `burgercentral.localhost`. O Angular dev server precisa aceitar esses hosts.

## Admin

- Login em `/login` com email e senha. Guarde o access token em memória (serviço), não em `localStorage`. O refresh usa o cookie.
- Interceptor renova o access token uma vez em 401 e repete a requisição. Se o refresh falhar, volte ao login.
- Depois do login, `OWNER` cai em `/configuracoes`. A página edita dados da loja, cores (com pré-visualização usando as CSS variables) e os sete horários. Botão salvar mostra sucesso ou o `error.code`.
- `ATTENDANT` não vê o formulário de configuração (a API já responde 403; a UI também esconde).
- Layout simples, mobile-first, textos em português. Confirme antes de descartar alterações sujas ao sair da rota.

## Landing

Página institucional estática em português, sem tenant:

- proposta de valor alinhada à especificação: canal próprio, sem comissão por pedido;
- benefícios, recursos, um passo a passo do pedido, FAQ curto, CTA para um formulário de contato;
- o formulário `POST` ainda não existe: grave o interesse em `POST /api/v1/public/leads` com nome, email, telefone e nome do estabelecimento. Tabela `leads` sem `tenant_id` (é da plataforma). Rate limit 5 por hora por IP. Não liste leads em endpoint público.
- links para páginas simples de privacidade e termos, texto próprio e curto, sem copiar política de terceiros.
- Não prometa resultado financeiro nem cite marketplace com comparação jurídica arriscada. Diga apenas que o estabelecimento fala direto com o cliente.

## Courier

Tela de login reutilizando o mesmo contrato de auth, sem painel de entregas. Quem não for `COURIER` vê “Acesso do entregador”. Não implemente entrega aqui.

## Testes

- Componente do storefront: dado um branding, as CSS variables no elemento raiz mudam.
- Componente ou teste de serviço: host A e host B produzem cores diferentes quando o cliente HTTP é falso.
- Landing: formulário vazio não envia; lead válido chama o endpoint.

## Como validar

```bash
npx nx test storefront
npx nx test admin
npx nx test landing
npx nx lint storefront
```

Abra o storefront em dois hosts de demonstração e confirme cores diferentes. Faça login do owner no admin e salve uma cor nova; recarregue o storefront e veja a cor nova.

## Critério de conclusão

Duas lojas abertas no navegador mostram nome e cor diferentes, e o owner altera a própria marca pelo painel sem afetar a outra.
