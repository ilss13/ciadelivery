# Backup e recuperação

## Política

O backup oficial da aplicação é o banco MySQL. Em instalação própria, gere-o
com `mysqldump`; em banco gerenciado, use também snapshots consistentes do
provedor.

Retenção sugerida:

- 7 backups diários;
- 4 backups semanais;
- ao menos uma cópia fora da máquina que executa a aplicação.

O dump do MySQL não contém os objetos do storage S3 compatível. Quando
`STORAGE_DRIVER=s3`, habilite versionamento ou uma rotina separada de backup do
bucket e teste também a recuperação desses objetos.

Backups devem ser criptografados, ter acesso restrito e ser monitorados. Uma
cópia só deve ser considerada válida depois de um restore testado.

## Drill local automatizado

O script abaixo sobe somente o MySQL do Compose caso necessário, gera um dump
de `ciadelivery`, restaura em `ciadelivery_drill`, verifica a tabela `tenants` e
remove apenas o database de drill:

```bash
./scripts/backup-restore-drill.sh
```

O script recusa `NODE_ENV=production`. Ele nunca remove o database
`ciadelivery`. Se a porta 3306 já estiver ocupada por outro serviço local, use,
por exemplo, `MYSQL_HOST_PORT=3308 ./scripts/backup-restore-drill.sh`.

## Restore local manual

1. Suba e aguarde o MySQL local:

   ```bash
   docker compose up -d mysql
   docker compose ps mysql
   ```

2. Gere um dump:

   ```bash
   docker compose exec -T mysql sh -c \
     'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers ciadelivery' \
     > ciadelivery.sql
   ```

3. Crie um database isolado para validar o restore:

   ```bash
   docker compose exec -T mysql sh -c \
     'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS ciadelivery_drill; CREATE DATABASE ciadelivery_drill CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"'
   ```

4. Restaure e confira a tabela principal:

   ```bash
   docker compose exec -T mysql sh -c \
     'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" ciadelivery_drill' \
     < ciadelivery.sql

   docker compose exec -T mysql sh -c \
     'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '\''ciadelivery_drill'\'' AND table_name = '\''tenants'\''"'
   ```

5. Apague somente o database temporário:

   ```bash
   docker compose exec -T mysql sh -c \
     'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE ciadelivery_drill"'
   ```

Para uma recuperação real, preserve o banco original até a validação do
restore, confirme migrations, contagens críticas e acesso da API antes de
trocar o tráfego.
