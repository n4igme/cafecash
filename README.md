# cafecash

The cashier app for the coffee shop — self-hosted POS system built with PocketBase, Expo/React Native, and Next.js.

## Stack

| Layer | Tech |
|---|---|
| Backend | PocketBase v0.40.1 (single binary, SQLite) |
| Tablet POS | Expo 52 + React Native 0.76 + expo-router |
| Admin Web | Next.js 15 + Tailwind CSS |
| Network | Tailscale VPN mesh |
| State (tablet) | Zustand |

## Structure

```
cafecash/
├── apps/
│   ├── tablet/          # Expo Android APK (com.luna.pos)
│   └── admin/           # Next.js admin dashboard
├── packages/
│   └── types/           # Shared TypeScript types
├── scripts/
│   ├── create_collections.py   # One-shot PocketBase schema setup
│   ├── e2e_test.py             # End-to-end API test (11 tests)
│   ├── backup.sh               # Daily pb_data backup
│   └── debug_dashboard.py      # Dev debug helper
├── launchd/             # macOS launchd plists (auto-start on reboot)
├── pb_collections.json  # PocketBase schema reference
├── start.sh             # Dev: start PocketBase + admin together
└── install-services.sh  # Prod: install launchd services
```

## Quick Start (Development)

### 1. Download PocketBase

```bash
# macOS arm64
curl -L -o pocketbase.zip https://github.com/pocketbase/pocketbase/releases/download/v0.40.1/pocketbase_0.40.1_darwin_arm64.zip
unzip pocketbase.zip && chmod +x pocketbase
```

### 2. Set env vars

```bash
# Admin web
cp apps/admin/.env.example apps/admin/.env.local
# Set: NEXT_PUBLIC_API_URL=http://127.0.0.1:8091

# Tablet
cp apps/tablet/.env.example apps/tablet/.env
# Set: EXPO_PUBLIC_API_URL=http://<tailscale-ip>:8091
```

### 3. Install deps

```bash
npm install
```

### 4. Start everything

```bash
./start.sh
```

Opens:
- PocketBase API → `http://localhost:8091`
- PocketBase Admin UI → `http://localhost:8091/_/`
- Admin Dashboard → `http://localhost:3000`

### 5. First-time setup

```bash
# Create superuser
./pocketbase superuser create admin@yourdomain.com yourpassword

# Create collections + seed products
PYTHONPATH="" python3 scripts/create_collections.py

# Create a staff user via PocketBase Admin UI at /_/
# or via API (see scripts/create_collections.py)
```

## Production (macOS launchd)

```bash
# Build admin + install all 3 services (PocketBase, admin, daily backup)
./install-services.sh

# Check status
./install-services.sh status

# Stop all
./install-services.sh stop
```

Services installed:
- `com.luna.pocketbase` — PocketBase with caffeinate (prevents sleep)
- `com.luna.admin` — Next.js admin in production mode
- `com.luna.backup` — Daily 03:00 backup of `pb_data/` → `backups/`

## RBAC

| Collection | Tablet (anon) | Admin (authenticated) |
|---|---|---|
| `products` | list, view | full CRUD |
| `orders` | create only | list, view, update, delete |
| `order_items` | create only | list, view, update, delete |
| `settings` | list, view | full CRUD |

Tailscale is the network security boundary — only Tailscale nodes can reach the backend.

## Build Tablet APK

```bash
cd apps/tablet
npx eas build --platform android --profile preview
```

## Backup

```bash
# Manual backup
./scripts/backup.sh

# Backups stored at: ./backups/<timestamp>/pb_data/
# Auto-pruned to last 7 backups
```
