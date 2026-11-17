#!/usr/bin/env bash
# Dev launcher: starts the CRM server + a Cloudflare quick tunnel, keeps both
# alive, and prints the public URL. Ctrl+C stops everything.
#
#   ./tunnel.sh              # build if needed, serve dist, expose publicly
#   SERVER_PORT=3000 ./tunnel.sh
#
# The quick-tunnel URL changes on every restart. The public host is written to
# /tmp/cf_crm_url.txt and echoed here once it is known.

set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVER_PORT="${SERVER_PORT:-3000}"
SERVER_LOG="/tmp/crm-server.log"
TUNNEL_LOG="/tmp/cf_crm_tunnel.log"
URL_FILE="/tmp/cf_crm_url.txt"
: > "$TUNNEL_LOG"
: > "$URL_FILE"

cleanup() {
  echo ""
  echo "Stopping..."
  [ -n "${CF_PID:-}" ] && kill "$CF_PID" 2>/dev/null
  [ -n "${SRV_PID:-}" ] && kill "$SRV_PID" 2>/dev/null
  exit 0
}
trap cleanup INT TERM

# 1) Server ---------------------------------------------------------------
if [ ! -f "$ROOT/server/dist/index.js" ]; then
  echo "Building server..."
  (cd "$ROOT/server" && npm run build)
fi

echo "Starting CRM server on :$SERVER_PORT ..."
(cd "$ROOT/server" && node dist/index.js > "$SERVER_LOG" 2>&1) &
SRV_PID=$!

# Wait for the server to answer /api/health.
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$SERVER_PORT/api/health" >/dev/null 2>&1; then
    echo "  server is up (pid $SRV_PID)"
    break
  fi
  sleep 1
done

if ! curl -sf "http://localhost:$SERVER_PORT/api/health" >/dev/null 2>&1; then
  echo "ERROR: server did not start. See $SERVER_LOG" >&2
  cleanup
fi

# 2) Cloudflare quick tunnel ---------------------------------------------
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "WARNING: cloudflared not found — server is local-only."
  echo "  Local: http://localhost:$SERVER_PORT"
  wait "$SRV_PID"
  exit 0
fi

echo "Opening Cloudflare tunnel to http://localhost:$SERVER_PORT ..."
cloudflared tunnel --url "http://localhost:$SERVER_PORT" > "$TUNNEL_LOG" 2>&1 &
CF_PID=$!

# Extract the public URL once cloudflared prints it.
PUBLIC_URL=""
for i in $(seq 1 45); do
  PUBLIC_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)"
  [ -n "$PUBLIC_URL" ] && break
  sleep 1
done

if [ -n "$PUBLIC_URL" ]; then
  echo "$PUBLIC_URL" > "$URL_FILE"
  echo ""
  echo "  Public URL: $PUBLIC_URL"
  echo ""
  echo "  IMPORTANT: add this host to server/.env as CORS_ORIGINS and restart,"
  echo "             otherwise browser logins are rejected (403 CSRF_ORIGIN_REJECTED)."
  echo "             Current CORS_ORIGINS: $(grep -oE 'CORS_ORIGINS=.*' "$ROOT/server/.env" 2>/dev/null || echo '(unset)')"
  echo ""
else
  echo "WARNING: could not read the tunnel URL. See $TUNNEL_LOG" >&2
fi

echo "Logs: server=$SERVER_LOG  tunnel=$TUNNEL_LOG"
echo "Press Ctrl+C to stop."
wait "$SRV_PID"
cleanup
