#!/usr/bin/env bash
# Start both backend and frontend for the Dealership CRM.
# Usage: ./start.sh   (Ctrl+C stops both)

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting backend (:3000) and frontend (:5173)..."

cd "$ROOT/server"
npm run dev &
SERVER_PID=$!

cd "$ROOT/client"
npm run dev &
CLIENT_PID=$!

# Stop both when this script is interrupted.
trap "echo ''; echo 'Stopping...'; kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit 0" INT TERM
wait
