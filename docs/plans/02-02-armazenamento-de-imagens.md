# 02-02 — Armazenamento de imagens

> Implemente somente esta tarefa. Leia as convenções. A 02-01 precisa estar concluída. Não faça commit.

## Metadados

| Campo | Valor |
|---|---|
| Fase | 2 — Catálogo e storefront |
| Depende de | 02-01 |
| Desbloqueia | 02-03 |
| Critério da fase que esta tarefa avança | Produtos e a marca exibem imagens do próprio tenant |

## Objetivo

Subir imagens de produto, logo, favicon e banner por uma porta de storage, sem o domínio conhecer disco ou S3.

## Porta

Em `libs/shared` (ou `libs/branding` se já couber melhor no shared de infraestrutura):

```typescript
interface StorageProvider {
  upload(file: FileInput): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}
```

`FileInput`: buffer, mime type, tamanho, nome original só para extensão.

Drivers:

- `local` (default): grava em `STORAGE_LOCAL_DIR`, servido por `GET /media/*` **somente** se a chave começar com o prefixo do tenant autenticado no upload. A URL pública não lista diretório.
- `s3`: quando `STORAGE_DRIVER=s3`, use endpoint, bucket, região e credenciais do env (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`). Compatível com S3 e MinIO. Não implemente se as vars faltarem no `local`; o código do adapter existe e um teste com mock do SDK cobre a chamada.

Chave: `{tenantId}/{kind}/{uuid}.{ext}`. `kind` é `products`, `logos`, `favicons` ou `banners`.

## Regras de arquivo

- MIME: `image/jpeg`, `image/png`, `image/webp`.
- Tamanho máximo 2 MB.
- Confira o tipo pelos magic bytes, não só pelo header declarado.
- Fora disso: `400` `INVALID_FILE`.
- A URL devolvida é guardada em `products.image_key` ou nos campos de branding. Apagar a imagem antiga do storage quando uma nova substitui. Falha no delete da antiga não desfaz o upload novo; logue `warn`.

## API

```text
POST /api/v1/admin/products/:id/image     catalog.manage   multipart campo file
DELETE /api/v1/admin/products/:id/image   catalog.manage
POST /api/v1/admin/branding/logo          store.configure
POST /api/v1/admin/branding/favicon       store.configure
POST /api/v1/admin/branding/banner        store.configure
```

Resposta: `{ "key": "...", "url": "..." }`.

Não aceite caminho arbitrário no body. Não sirva arquivo de outro prefixo de tenant: `404`.

## UI

No formulário de produto e de branding, input de arquivo, pré-visualização e erro em português quando o tipo ou o tamanho forem recusados.

## Testes

- Unitário do validador de magic bytes (PNG válido, texto renomeado para `.png` recusado).
- Integração: upload de PNG pequeno no produto de A; `GET` da URL funciona; a mesma chave não é aceita como se fosse de B (o prefixo não bate com o tenant de B se B tentar gravar a chave de A num produto de B via PATCH — ignore `imageKey` vindo do cliente no PATCH; só o endpoint de upload grava a chave).

## Como validar

```bash
npx nx test api
npx nx test admin
```

## Critério de conclusão

Logo e foto de produto sobem, aparecem na URL pública e um tenant não grava nem aponta arquivo no prefixo do outro.
