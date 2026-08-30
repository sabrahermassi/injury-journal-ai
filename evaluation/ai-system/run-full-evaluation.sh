#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

set -a
source .env
set +a

EMBEDDING_URL="${EMBEDDING_API_URL:-http://127.0.0.1:8000}"
EMBEDDING_PORT="${EMBEDDING_URL##*:}"
EMBEDDING_LOG="$(mktemp)"

listening_pid() {
  netstat -ano | awk -v p=":${EMBEDDING_PORT}\$" '$2 ~ p && $4=="LISTENING" {print $NF; exit}'
}

# On Git Bash/MSYS the PID bash's `$!` reports for a Python/uvicorn child does not reliably
# match the real Windows PID that ends up listening on the port, so we can't just record `$!`
# and trust it later. Instead: refuse to start if the port is already occupied by something
# else, so whatever ends up listening on it afterward is guaranteed to be the service this
# script itself started — cleanup can then safely kill "whatever is on the port" without risk
# of taking down an unrelated pre-existing service.
EXISTING_PID="$(listening_pid)"
if [ -n "${EXISTING_PID:-}" ]; then
  echo "port $EMBEDDING_PORT is already in use (pid $EXISTING_PID) — refusing to start a competing embedding service. Stop it first, or run against it directly."
  exit 1
fi

kill_embedding_service() {
  local pid
  pid=$(listening_pid)
  if [ -n "${pid:-}" ]; then
    echo "=== stopping embedding service (pid $pid) ==="
    taskkill //PID "$pid" //F >/dev/null 2>&1 || true
  fi
}

cleanup() {
  kill_embedding_service
  rm -f "$EMBEDDING_LOG"
}
trap cleanup EXIT INT TERM

echo "=== starting embedding service on port $EMBEDDING_PORT ==="
EMBEDDING_API_KEY="$EMBEDDING_API_KEY" uvicorn src.embeddings.embedding_api:app --port "$EMBEDDING_PORT" >"$EMBEDDING_LOG" 2>&1 &

echo "=== waiting for embedding service port to open ==="
# A cheap bash-builtin TCP probe (no subprocess per attempt) — polling with a forked
# curl per second proved unreliable under Git-Bash/MSYS process-creation overhead.
PORT_OPEN=""
for i in $(seq 1 180); do
  if (exec 3<>"/dev/tcp/127.0.0.1/${EMBEDDING_PORT}") 2>/dev/null; then
    exec 3>&- 3<&- 2>/dev/null || true
    echo "port $EMBEDDING_PORT is accepting connections (took ${i}s)"
    PORT_OPEN=1
    break
  fi
  sleep 1
done

if [ -z "$PORT_OPEN" ]; then
  echo "embedding service never started listening on port $EMBEDDING_PORT within 180s — log:"
  cat "$EMBEDDING_LOG"
  exit 1
fi

echo "=== confirming the API actually responds ==="
HTTP_CODE="000"
for j in $(seq 1 10); do
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 5 \
    -X POST "$EMBEDDING_URL/embed-query" \
    -H "Authorization: Bearer $EMBEDDING_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"text":"health check"}' 2>/dev/null) || HTTP_CODE="000"
  if [ "$HTTP_CODE" = "200" ]; then
    break
  fi
  sleep 2
done

if [ "$HTTP_CODE" != "200" ]; then
  echo "embedding service did not respond successfully (last http code: $HTTP_CODE) — log:"
  cat "$EMBEDDING_LOG"
  exit 1
fi

echo "embedding service is healthy"

echo "=== seeding dev database ==="
DATABASE_ENV=development SEED_DEV_CONFIRM=true npm run seed:dev

echo "=== ingesting ==="
npm run ingest

echo "=== running full evaluation dataset once (retries automatically on Groq rate limits) ==="
npm run eval:full

echo "=== done — cleaning up ==="
