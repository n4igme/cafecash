#!/bin/bash
# CafeCash deployment script
# Usage:
#   ./deploy.sh          — build + deploy everything (admin + APK)
#   ./deploy.sh admin    — admin Docker only
#   ./deploy.sh apk      — tablet APK only
#   ./deploy.sh apk debug — debug APK (default: release)

set -e
cd "$(dirname "$0")"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

log()   { echo -e "${BLUE}[deploy]${NC} $1"; }
ok()    { echo -e "${GREEN}✅${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠️ ${NC} $1"; }
fail()  { echo -e "${RED}❌${NC} $1"; exit 1; }
header(){ echo -e "\n${BOLD}── $1 ──${NC}"; }

TARGET="${1:-all}"
APK_TYPE="${2:-release}"

# ── Verify environment ───────────────────────────────────────────────────────
header "Pre-flight checks"

# Check Docker
docker info &>/dev/null || fail "Docker is not running"
ok "Docker running"

# Check PocketBase
curl -sf http://127.0.0.1:8091/api/health &>/dev/null || fail "PocketBase not running (check: docker ps)"
ok "PocketBase healthy"

# Check Tailscale IP in .env files
TABLET_IP=$(grep EXPO_PUBLIC_API_URL apps/tablet/.env 2>/dev/null | cut -d'/' -f3 | cut -d':' -f1)
ADMIN_IP=$(grep NEXT_PUBLIC_API_URL apps/admin/.env.local 2>/dev/null | cut -d'/' -f3 | cut -d':' -f1)
log "Tablet API URL: http://${TABLET_IP}:8091"
log "Admin API URL:  http://${ADMIN_IP}:8091"

if [[ -z "$TABLET_IP" || -z "$ADMIN_IP" ]]; then
    fail "Could not read API URLs from .env files"
fi

# ── Admin Docker deployment ──────────────────────────────────────────────────
deploy_admin() {
    header "Admin Docker deployment"

    # Sync IP from .env.local → docker-compose.yml + Dockerfile.admin
    CURRENT_COMPOSE_IP=$(grep "NEXT_PUBLIC_API_URL" docker-compose.yml | head -1 | cut -d'/' -f3 | cut -d':' -f1)
    if [[ "$CURRENT_COMPOSE_IP" != "$ADMIN_IP" ]]; then
        log "Syncing IP: $CURRENT_COMPOSE_IP → $ADMIN_IP in docker-compose.yml + Dockerfile.admin"
        sed -i '' "s/${CURRENT_COMPOSE_IP}/${ADMIN_IP}/g" docker-compose.yml Dockerfile.admin
        ok "IP updated in docker-compose.yml + Dockerfile.admin"
    else
        ok "IPs already in sync ($ADMIN_IP)"
    fi

    log "Building admin image..."
    docker compose build admin 2>&1 | grep -E "Built|Step|ERROR" | head -20
    ok "Admin image built"

    log "Restarting admin container..."
    docker stop cafecash-admin 2>/dev/null && docker rm cafecash-admin 2>/dev/null || true
    docker compose create admin
    docker compose start admin

    log "Waiting for admin to be ready..."
    for i in $(seq 1 15); do
        CODE=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3001/ 2>/dev/null || echo "000")
        if [[ "$CODE" == "307" || "$CODE" == "200" ]]; then
            ok "Admin is up → http://${ADMIN_IP}:3001"
            break
        fi
        sleep 1
        if [[ $i == 15 ]]; then
            warn "Admin health check timed out — check: docker logs cafecash-admin"
        fi
    done

    log "Last 3 admin log lines:"
    docker logs cafecash-admin 2>&1 | tail -3
}

# ── Tablet APK build ─────────────────────────────────────────────────────────
deploy_apk() {
    header "Tablet APK build (${APK_TYPE})"

    # Check ADB device
    DEVICE=$(adb devices | grep -v "List of" | grep "device" | awk '{print $1}' | head -1)
    if [[ -z "$DEVICE" ]]; then
        warn "No ADB device found — APK will be built but not installed"
        INSTALL=false
    else
        ok "ADB device: $DEVICE"
        INSTALL=true
    fi

    log "Building ${APK_TYPE} APK..."
    START=$(date +%s)
    cd apps/tablet
    bash scripts/build-debug.sh "$APK_TYPE" 2>&1 | grep -E "BUILD|✅|❌|Error|error:" | head -20
    END=$(date +%s)
    cd ../..

    APK_PATH="apps/tablet/android/app/build/outputs/apk/${APK_TYPE}/app-${APK_TYPE}.apk"
    if [[ ! -f "$APK_PATH" ]]; then
        fail "APK not found at $APK_PATH"
    fi

    SIZE=$(du -sh "$APK_PATH" | cut -f1)
    ok "APK built in $((END-START))s — $APK_PATH ($SIZE)"

    if [[ "$INSTALL" == true ]]; then
        log "Installing on device $DEVICE..."
        adb -s "$DEVICE" install -r "$APK_PATH" && ok "APK installed on $DEVICE" || warn "Install failed — install manually"
    else
        log "APK ready at: $(pwd)/$APK_PATH"
    fi
}

# ── Run tasks ────────────────────────────────────────────────────────────────
START_TOTAL=$(date +%s)

case "$TARGET" in
    admin)
        deploy_admin
        ;;
    apk)
        deploy_apk
        ;;
    all)
        deploy_admin
        deploy_apk
        ;;
    *)
        echo "Usage: ./deploy.sh [all|admin|apk] [debug|release]"
        exit 1
        ;;
esac

END_TOTAL=$(date +%s)
header "Done in $((END_TOTAL-START_TOTAL))s"
echo ""
echo -e "  ${GREEN}Admin:${NC}  http://${ADMIN_IP}:3001"
echo -e "  ${GREEN}PB:${NC}     http://${ADMIN_IP}:8091"
if [[ "$TARGET" == "all" || "$TARGET" == "apk" ]]; then
    echo -e "  ${GREEN}APK:${NC}    apps/tablet/android/app/build/outputs/apk/${APK_TYPE}/app-${APK_TYPE}.apk"
fi
echo ""
