#!/usr/bin/env bash
# Start both backend and frontend for the Dealership CRM.
# Usage: ./start.sh   (Ctrl+C stops both)

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

SERVER_PORT="${SERVER_PORT:-3000}"
CLIENT_PORT="${CLIENT_PORT:-5173}"

# Refuse to start if the ports are already taken.
port_busy() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -i:"$1" >/dev/null 2>&1
  else
    ss -ltn 2>/dev/null | grep -q ":$1 "
  fi
}

if port_busy "$SERVER_PORT"; then
  echo "ERROR: port $SERVER_PORT is already in use." >&2
  exit 1
fi
if port_busy "$CLIENT_PORT"; then
  echo "ERROR: port $CLIENT_PORT is already in use." >&2
  exit 1
fi

echo "Starting backend (:$SERVER_PORT) and frontend (:$CLIENT_PORT)..."

cd "$ROOT/server"
npm run dev &
SERVER_PID=$!

cd "$ROOT/client"
npm run dev &
CLIENT_PID=$!

# Stop both when this script is interrupted, and if either process dies.
trap "echo ''; echo 'Stopping...'; kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit 0" INT TERM

# Wait for either process to exit; when one dies, tear down the other too.
wait -n "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || wait "$SERVER_PID"
echo "One of the processes exited; stopping the rest..."
kill $SERVER_PID $CLIENT_PID 2>/dev/null || true
wait 2>/dev/null || true
