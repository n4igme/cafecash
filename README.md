# CafeCash

Self-hosted POS system for cafés — Android tablet cashier + Next.js web admin + PocketBase backend.

## Stack

| Layer | Tech |
|---|---|
| Backend | PocketBase v0.40.1 (single Go binary, SQLite) |
| Tablet POS | Expo 52 + React Native 0.76 + expo-router |
| Admin Web | Next.js 15 + Tailwind CSS |
| Network | Tailscale VPN |
| Deployment | Docker Compose |
| State (tablet) | Zustand |

## Project Structure

```
cafecash/
├── apps/
│   ├── tablet/          # Expo Android APK (com.cafecash.pos)
│   │   ├── app/         # expo-router screens (pos, checkout)
│   │   ├── lib/         # pocketbase client, format utils
│   │   ├── store/       # Zustand cart store
│   │   ├── assets/      # Icons, splash, QRIS placeholder
│   │   ├── android/     # Native Android project (prebuild output)
│   │   └── scripts/     # build-debug.sh (debug + release APK)
│   └── admin/           # Next.js admin dashboard
│       ├── app/         # Pages: dashboard, products, orders, users, settings
│       ├── lib/         # PocketBase client
│       └── middleware.ts
├── packages/
│   └── types/           # Shared TypeScript types
├── scripts/
│   ├── create_collections.py   # One-shot PocketBase schema setup
│   ├── add_autodate_fields.py  # Add created/updated to collections
│   ├── add_product_image.py    # Add image field to products
│   └── e2e_test.py             # End-to-end API test (11 tests)
├── launchd/             # macOS launchd plists (bare-metal alternative to Docker)
├── Dockerfile.pocketbase
├── Dockerfile.admin
├── docker-compose.yml
└── start.sh             # Dev: start PocketBase + admin without Docker
```

## Quick Start (Docker — recommended)

### 1. Prerequisites
- Docker Desktop running
- Tailscale installed and connected on Mac + Android tablet

### 2. Configure environment

```bash
cp apps/admin/.env.example apps/admin/.env.local
# Edit: NEXT_PUBLIC_API_URL=http://<tailscale-ip>:8091

cp apps/tablet/.env.example apps/tablet/.env
# Edit: EXPO_PUBLIC_API_URL=http://<tailscale-ip>:8091
```

Get your Tailscale IP:
```bash
tailscale ip -4
```

### 3. Start services

```bash
docker compose up -d
```

| Service | URL |
|---|---|
| PocketBase API | `http://localhost:8091` |
| PocketBase Admin UI | `http://localhost:8091/_/` |
| Admin Dashboard | `http://localhost:3001` |

### 4. First-time setup

```bash
# Create PocketBase superuser
./pocketbase superuser create admin@yourdomain.com yourpassword

# Create collections + seed products
PYTHONPATH="" python3 scripts/create_collections.py

# Add autodate fields (created/updated)
PYTHONPATH="" python3 scripts/add_autodate_fields.py

# Add product image field
PYTHONPATH="" python3 scripts/add_product_image.py
```

Then open `http://localhost:3001` → sign in → go to Settings → set store name, logo, upload QRIS.

### 5. Build + install tablet APK

```bash
# Release build (standalone, no Metro needed)
bash apps/tablet/scripts/build-debug.sh release

# Debug build (requires Metro running)
bash apps/tablet/scripts/build-debug.sh
```

## Admin Dashboard

| Page | Features |
|---|---|
| 📊 Dashboard | Revenue/orders stats, period filter, 7-day chart, monthly trend, product sales, recent orders |
| 🛍️ Products | Add/edit/delete, image upload, toggle availability |
| 📋 Orders | Full history, cancel, mark paid |
| 👤 Users | Add/edit/delete admin users |
| ⚙️ Settings | Store name, logo emoji, QRIS image upload |

## Tablet POS

| Feature | Detail |
|---|---|
| Product grid | 3-column, category filters |
| Realtime | Products update live via SSE |
| Cart | Add/increment/decrement |
| Checkout | QRIS from settings (no rebuild to change) |
| Payment | "Payment Received" → saves to DB → returns to POS |

## RBAC

| | Tablet (anon) | Admin (authenticated) |
|---|---|---|
| products | read | full CRUD |
| orders | create | full CRUD |
| order_items | create | full CRUD |
| settings | read | full CRUD |

## Bare-metal (without Docker)

```bash
./start.sh  # starts PocketBase :8091 + Next.js admin :3000

# Or install as macOS launchd services (auto-start on reboot)
./install-services.sh
./install-services.sh status
./install-services.sh stop
```

## Credentials

| Role | Email | Password |
|---|---|---|
| PB Superuser | `admin@luna.pos` | `Admin@2026!` |
| Admin user | `admin@cafecash.pos` | `CafeCash@2026!` |
| Staff user | `staff@cafecash.pos` | `Staff@2026!` |

> ⚠️ Change these before any public deployment.
