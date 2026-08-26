#!/bin/bash
# Luna POS — install/uninstall launchd services
# Usage:
#   ./install-services.sh          install + start all services
#   ./install-services.sh stop     stop + unload all services
#   ./install-services.sh status   show service status

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
LAUNCHD_DIR="$HOME/Library/LaunchAgents"
PLISTS=(
  com.luna.pocketbase
  com.luna.admin
  com.luna.backup
)

# ── helpers ──────────────────────────────────────────────────────────────────

stamp_plist() {
  local src="$ROOT/launchd/${1}.plist"
  local dst="$LAUNCHD_DIR/${1}.plist"
  # Replace placeholder with real absolute path
  sed "s|LUNA_POS_ROOT|$ROOT|g" "$src" > "$dst"
  echo "  written: $dst"
}

# ── commands ─────────────────────────────────────────────────────────────────

install_all() {
  echo "🌙 Installing Luna POS services..."
  mkdir -p "$LAUNCHD_DIR" "$ROOT/logs" "$ROOT/backups"

  # Build admin for production first
  echo "▶ Building admin (Next.js)..."
  cd "$ROOT/apps/admin" && npm run build
  cd "$ROOT"

  for plist in "${PLISTS[@]}"; do
    stamp_plist "$plist"
    launchctl unload "$LAUNCHD_DIR/${plist}.plist" 2>/dev/null || true
    launchctl load   "$LAUNCHD_DIR/${plist}.plist"
    echo "  loaded:  $plist"
  done

  echo ""
  echo "✅ Services installed and running."
  echo ""
  echo "  PocketBase  → http://localhost:8090"
  echo "  PB Admin UI → http://localhost:8090/_/"
  echo "  Admin Web   → http://localhost:3000"
  echo "  Tailscale   → http://$(tailscale ip -4 2>/dev/null || echo '100.x.x.x'):8090"
  echo ""
  echo "  Logs: $ROOT/logs/"
  echo "  Backup runs daily at 03:00 → $ROOT/backups/"
}

stop_all() {
  echo "🛑 Stopping Luna POS services..."
  for plist in "${PLISTS[@]}"; do
    launchctl unload "$LAUNCHD_DIR/${plist}.plist" 2>/dev/null && echo "  unloaded: $plist" || echo "  not loaded: $plist"
  done
}

status_all() {
  echo "📋 Luna POS service status:"
  for plist in "${PLISTS[@]}"; do
    local info
    info=$(launchctl list "$plist" 2>/dev/null || echo "NOT LOADED")
    if echo "$info" | grep -q "NOT LOADED"; then
      echo "  ✗ $plist — not loaded"
    else
      local pid
      pid=$(echo "$info" | grep '"PID"' | awk '{print $3}' | tr -d ',')
      if [ -n "$pid" ]; then
        echo "  ✓ $plist — running (PID $pid)"
      else
        echo "  ⚠ $plist — loaded but not running (crashed?)"
      fi
    fi
  done
}

# ── dispatch ─────────────────────────────────────────────────────────────────

case "${1:-install}" in
  install) install_all ;;
  stop)    stop_all    ;;
  status)  status_all  ;;
  *)
    echo "Usage: $0 [install|stop|status]"
    exit 1
    ;;
esac
