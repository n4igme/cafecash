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
│   │   ├── lib/         # PocketBase client, format utils
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
│   └── e2e_test.py             # End-to-end API test
├── launchd/             # macOS launchd plists (bare-metal alternative to Docker)
├── Dockerfile.pocketbase
├── Dockerfile.admin
├── docker-compose.yml
└── start.sh             # Dev: start PocketBase + admin without Docker
```

## Prerequisites

- **Docker Desktop** running
- **Node.js** 20+
- **Tailscale** installed and connected on both Mac and Android tablet
- **macOS firewall stealth mode OFF** — required for tablet to reach Mac over Tailscale:
  ```bash
  sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode off
  ```
- **Java 21** (for APK builds only):
  ```bash
  brew install openjdk@21
  ```
- **Android SDK** with `platform-tools` in PATH (for APK builds + `adb`)

## Quick Start (Docker — recommended)

### 1. Get your Tailscale IP

```bash
tailscale ip -4
# e.g. 100.85.162.13
```

### 2. Configure environment

```bash
cp apps/admin/.env.example apps/admin/.env.local
# Set: NEXT_PUBLIC_API_URL=http://<tailscale-ip>:8091

cp apps/tablet/.env.example apps/tablet/.env
# Set: EXPO_PUBLIC_API_URL=http://<tailscale-ip>:8091
```

### 3. Install dependencies

```bash
npm install
```

### 4. Download PocketBase binary (macOS arm64)

```bash
curl -L -o pocketbase.zip https://github.com/pocketbase/pocketbase/releases/download/v0.40.1/pocketbase_0.40.1_darwin_arm64.zip
unzip pocketbase.zip && chmod +x pocketbase && rm pocketbase.zip
```

### 5. Start services

```bash
docker compose up -d
```

| Service | URL |
|---|---|
| PocketBase API | `http://localhost:8091` |
| PocketBase Admin UI | `http://localhost:8091/_/` |
| Admin Dashboard | `http://localhost:3001` |

### 6. First-time setup (run once)

```bash
# Create PocketBase superuser
./pocketbase superuser create admin@yourdomain.com <strong-password>

# Create collections + seed products
PYTHONPATH="" python3 scripts/create_collections.py

# Add autodate fields (created/updated)
PYTHONPATH="" python3 scripts/add_autodate_fields.py

# Add product image field
PYTHONPATH="" python3 scripts/add_product_image.py

# Create first admin user
# Open http://localhost:8091/_/ → Collections → users → + New record
```

Then open `http://localhost:3001` → sign in → **Settings** → set store name, logo emoji, upload QRIS image.

### 7. Build + install tablet APK

```bash
# Release build — standalone, no Metro needed
cd apps/tablet
bash scripts/build-debug.sh release

# Debug build — requires Metro running (development only)
bash scripts/build-debug.sh
```

> **Note:** APK build requires Java 21 and Android SDK. The script handles all Gradle fixes automatically.

## Admin Dashboard

| Page | Features |
|---|---|
| 📊 Dashboard | Revenue/orders stats, period filter (Today/Week/Month/Year/All), 7-day chart, monthly trend, product sales, recent orders |
| 🛍️ Products | Add/edit/delete, image upload, toggle availability |
| 📋 Orders | Full history, cancel order, mark as paid |
| 👤 Users | Add/edit/delete admin users, change passwords |
| ⚙️ Settings | Store name, logo emoji, QRIS image upload |

## Tablet POS

| Feature | Detail |
|---|---|
| Product grid | 3-column, category filters (All/Coffee/Non-Coffee/Drinks/Food) |
| Realtime | Products update live via PocketBase SSE |
| Cart | Add/increment/decrement items |
| Checkout | Displays QRIS from settings — no APK rebuild to change |
| Payment | "Payment Received" → writes order to DB → returns to POS |

## RBAC

| | Tablet (anonymous) | Admin (authenticated) |
|---|---|---|
| `products` | Read | Full CRUD |
| `orders` | Create only | Full CRUD |
| `order_items` | Create only | Full CRUD |
| `settings` | Read | Full CRUD |

Tailscale VPN is the network security boundary — only devices on the Tailscale network can reach the backend.

## Bare-metal (without Docker)

```bash
./start.sh  # starts PocketBase :8091 + Next.js admin :3001

# Install as macOS launchd services (auto-start on reboot)
./install-services.sh
./install-services.sh status
./install-services.sh stop
```

## Credentials

> ⚠️ **Change all default credentials before use.** Do not commit real passwords to version control.

Default credentials set during first-time setup:

| Role | Description |
|---|---|
| PB Superuser | PocketBase `/_/` admin — schema, users, system config |
| Admin user | Full access to admin dashboard |

See `.env.example` files for environment variable reference.
