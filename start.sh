#!/bin/bash
# Luna POS — start everything in one shot
# Usage: ./start.sh
# Requires: Tailscale running, node, npm

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🌙 Luna POS starting..."

# 1. PocketBase (keeps MacBook awake with caffeinate)
echo "▶ Starting PocketBase on :8090..."
caffeinate -i "$ROOT/pocketbase" serve --http=0.0.0.0:8091 &
PB_PID=$!

# Wait for PocketBase to be ready
echo -n "  waiting for PocketBase..."
for i in {1..20}; do
  if curl -sf http://localhost:8091/api/health > /dev/null 2>&1; then
    echo " ready ✓"
    break
  fi
  sleep 0.5
done

# 2. Admin Next.js
echo "▶ Starting Admin dashboard on :3000..."
cd "$ROOT/apps/admin"
npm run dev &
ADMIN_PID=$!

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  PocketBase   → http://localhost:8091    ║"
echo "║  PB Admin UI  → http://localhost:8091/_/ ║"
echo "║  Admin Web    → http://localhost:3000    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Tablet .env: EXPO_PUBLIC_API_URL=http://$(tailscale ip -4 2>/dev/null || echo '100.x.x.x'):8090"
echo ""
echo "Press Ctrl+C to stop all services."

# Trap Ctrl+C — kill both processes cleanly
trap "echo ''; echo 'Stopping...'; kill $PB_PID $ADMIN_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
