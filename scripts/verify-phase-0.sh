#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

started=0

cleanup() {
  if [[ "$started" -eq 1 ]]; then
    docker compose down
  fi
}
trap cleanup EXIT

wait_for_health() {
  local attempt
  for attempt in $(seq 1 60); do
    local status
    status="$(docker compose ps --format '{{.Service}} {{.Health}}')"
    if [[ -n "$status" ]] && ! grep -v ' healthy$' <<<"$status" | grep -q .; then
      return 0
    fi
    sleep 5
  done
  docker compose ps
  echo "healthchecks did not become healthy" >&2
  exit 1
}

if [[ -n "$(docker compose ps -aq)" ]]; then
  echo "Compose already has containers; running curls only"
else
  started=1
  docker compose up --build -d
  wait_for_health
fi

for port in 3000 3001 4200 4201 4202 4203; do
  url="http://127.0.0.1:${port}/"
  ok=0
  for _ in $(seq 1 20); do
    if curl -fsS --max-time 5 "$url" >/dev/null; then
      echo "ok ${url}"
      ok=1
      break
    fi
    sleep 3
  done
  if [[ "$ok" -ne 1 ]]; then
    echo "failed ${url}" >&2
    exit 1
  fi
done

docker compose --env-file .env.example -f docker-compose.staging.yml config --format json \
  | python3 -c '
import json, sys
doc = json.load(sys.stdin)
forbidden = {3306, 6379}
for name, service in doc.get("services", {}).items():
    ports = service.get("ports") or []
    if name in ("mysql", "redis") and ports:
        print(f"{name} publishes ports", file=sys.stderr)
        sys.exit(1)
    for port in ports:
        published = port.get("published")
        if published is None:
            continue
        host_port = int(str(published).split("/")[0].split("-")[0])
        if host_port in forbidden:
            print(f"{name} publishes {host_port}", file=sys.stderr)
            sys.exit(1)
print("staging config does not publish 3306 or 6379")
'
