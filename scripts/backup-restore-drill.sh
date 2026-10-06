#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${NODE_ENV:-local}" == "production" ]]; then
  echo "Erro: o drill de restore não pode ser executado em production." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Erro: Docker não encontrado." >&2
  exit 1
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."

dump_file="$(mktemp "${TMPDIR:-/tmp}/ciadelivery-drill.XXXXXX.sql")"
drill_created=false

mysql_root() {
  docker compose exec -T mysql sh -c \
    'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$@"' sh "$@"
}

cleanup() {
  if [[ "$drill_created" == true ]]; then
    mysql_root -e 'DROP DATABASE IF EXISTS `ciadelivery_drill`' >/dev/null || true
  fi
  rm -f "$dump_file"
}
trap cleanup EXIT

docker compose up -d mysql

ready=false
for _ in {1..60}; do
  if docker compose exec -T mysql sh -c \
    'mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent' \
    >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
if [[ "$ready" != true ]]; then
  echo "Erro: MySQL local não ficou disponível." >&2
  exit 1
fi

mysql_root -e \
  'DROP DATABASE IF EXISTS `ciadelivery_drill`; CREATE DATABASE `ciadelivery_drill` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
drill_created=true

docker compose exec -T mysql sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers ciadelivery' \
  >"$dump_file"

mysql_root ciadelivery_drill <"$dump_file"

tenant_table_count="$(
  mysql_root -N -B -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'ciadelivery_drill' AND table_name = 'tenants'"
)"
if [[ "$tenant_table_count" != "1" ]]; then
  echo "Erro: a tabela tenants não foi encontrada após o restore." >&2
  exit 1
fi

echo "Drill concluído: dump restaurado e tabela tenants verificada."
