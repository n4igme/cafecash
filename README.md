# CafeCash

Self-hosted POS system for cafés — Android tablet cashier app + Next.js web admin + PocketBase backend, connected over Tailscale VPN.

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
│   ├── tablet/                     # Expo Android APK (com.cafecash.pos)
│   │   ├── app/                    # Screens: login, active-orders, pos, checkout
│   │   ├── lib/                    # PocketBase client, stock utils, format
│   │   ├── store/                  # Zustand cart store
│   │   ├── assets/                 # Icons, splash, QRIS placeholder
│   │   ├── android/                # Native Android project (prebuild output)
│   │   └── scripts/build-debug.sh # Debug + release APK builder
│   └── admin/                      # Next.js admin dashboard
│       ├── app/                    # 9 pages + components
│       ├── lib/                    # PocketBase client, i18n
│       └── middleware.ts           # Auth guard
├── packages/
│   └── types/                      # Shared TypeScript types
├── scripts/
│   ├── setup.py                    # Full first-time setup (run once)
│   ├── setup_rbac.py               # Apply RBAC collection rules
│   ├── seed_coffeeshop.py          # Seed 38 café products
│   ├── seed_recipes.py             # Seed ingredients + 90 recipe entries
│   ├── set_stock.py                # Set initial stock quantities
│   ├── e2e_test.py                 # End-to-end API test (23 tests)
│   ├── verify_security.py          # Security rules test (21 tests)
│   └── verify_rbac.py             # RBAC roles test (23 tests)
├── launchd/                        # macOS launchd plists (bare-metal alternative)
├── deploy.sh                       # One-command deploy (macOS/Linux)
├── deploy.ps1                      # One-command deploy (Windows PowerShell)
├── Dockerfile.pocketbase
├── Dockerfile.admin
├── docker-compose.yml
└── start.sh                        # Dev: start without Docker
```

## Prerequisites

- **Docker Desktop** running
- **Node.js** 20+
- **Tailscale** installed and connected on both Mac and Android tablet
- **macOS firewall stealth mode OFF** — required for tablet to reach Mac:
  ```bash
  sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode off
  ```
- **Java 21** (for APK builds):
  ```bash
  brew install openjdk@21
  ```
- **Android SDK** with `platform-tools` in PATH

## Quick Start

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

### 6. Create PocketBase superuser (once)

```bash
./pocketbase superuser create admin@luna.pos Admin@2026!
```

### 7. First-time setup (run once)

```bash
PYTHONPATH="" python3 scripts/setup.py
```

Creates all users, collections, seeds products/ingredients/recipes, sets stock, applies RBAC rules.

Configurable via environment variables:
```bash
PB_SUPERUSER_EMAIL=admin@yourdomain.com \
PB_SUPERUSER_PASSWORD=yourpassword \
ADMIN_USER_EMAIL=admin@cafecash.pos \
ADMIN_USER_PASSWORD=yourpassword \
STAFF_USER_EMAIL=staff@cafecash.pos \
STAFF_USER_PASSWORD=yourpassword \
MAID_USER_EMAIL=kasir1@cafecash.pos \
MAID_USER_PASSWORD=yourpassword \
STORE_NAME="Your Café" \
PYTHONPATH="" python3 scripts/setup.py
```

### 8. Build + install tablet APK

```bash
cd apps/tablet
bash scripts/build-debug.sh release   # standalone release APK
bash scripts/build-debug.sh           # debug APK (needs Metro)
```

> APK build requires Java 21 and Android SDK. The script handles all Gradle fixes automatically.

## Deployment

```bash
# macOS/Linux
./deploy.sh            # build + deploy admin Docker + tablet APK
./deploy.sh admin      # admin Docker only
./deploy.sh apk        # release APK only

# Windows (PowerShell)
.\deploy.ps1
.\deploy.ps1 admin
.\deploy.ps1 apk
```

**When Tailscale IP changes:**
```bash
NEW_IP=$(tailscale ip -4)
sed -i '' "s/100\.[0-9]*\.[0-9]*\.[0-9]*/$NEW_IP/g" \
  apps/tablet/.env apps/admin/.env.local
./deploy.sh
```

## RBAC

Three roles with different access levels:

| Capability | Admin | Staff | Kasir (Maid) |
|---|---|---|---|
| Login dashboard | ✅ | ✅ | ❌ |
| View reports + HPP/margin | ✅ | ❌ | ❌ |
| Manage products | ✅ create/edit/delete | ✅ create/edit only | ❌ |
| View orders | ✅ | ✅ | ❌ (via POS only) |
| Refund orders | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| View stock/ingredients | ✅ | ✅ | ❌ |
| Manage stock | ✅ | ✅ | ❌ |
| Login tablet (POS) | ❌ | ❌ | ✅ |
| Create/manage orders | ❌ | ❌ | ✅ |

## Admin Dashboard

| Page | Features |
|---|---|
| 📊 Dashboard | Revenue, orders, period filter, charts, HPP + margin (admin only) |
| 🛍️ Products | CRUD, image upload, availability toggle, search, category filter |
| 📋 Orders | Full history, search, sort, status filter, cancel, refund |
| 👤 Users | Add/edit/delete users, role selector (admin/staff/maid) |
| ⚙️ Settings | Store name, logo upload, QRIS image |
| 🧪 Ingredients | Raw materials CRUD, stock levels, alert thresholds |
| 📋 Recipes | Map products → ingredients for stock deduction |
| 📦 Stock In | Record purchases, auto-updates stock |
| ⚡ Adjustments | Record waste, spoilage, manual corrections |

**Language toggle:** 🇮🇩 ID / 🇬🇧 EN in sidebar footer. Default: Indonesian.

## Tablet POS

| Feature | Detail |
|---|---|
| Login | Per-kasir login — each cashier uses their own maid account |
| Active orders | Home screen lists all open orders |
| Product grid | 3-column, category filters, grey out when stock = 0 |
| Order flow | Login → New Order → Add Items → Save → Pay |
| Stock deduction | Auto-deducts on Save Order via recipes |
| Cancel | Restores stock automatically |
| Payment | QRIS (photo required), Cash, Split (photo + note) |
| Logout | Button in header — returns to login screen |

## Order Lifecycle

```
Login (maid account)
    ↓
New Order → enter customer name/table
    ↓
Add items (stock deducted on Save)
    ↓
Paid ✓  or  Cancelled (stock restored)  or  Refunded (admin)
```

## Stock Management

```
Stock In       → adds stock (pembelian bahan baku)
Recipes        → defines what gets consumed per order
Save Order     → auto-deducts via recipes
Cancel Order   → auto-restores via recipes
Adjustments    → manual waste / spoilage / correction
HPP            → calculated from cost_per_unit × recipe qty
```

## Testing

```bash
# End-to-end flow (23 tests)
PYTHONPATH="" python3 scripts/e2e_test.py

# Security rules (21 tests)
PYTHONPATH="" python3 scripts/verify_security.py

# RBAC roles (23 tests)
PYTHONPATH="" python3 scripts/verify_rbac.py
```

## Credentials

> ⚠️ **Never commit real credentials to version control.**

After setup, credentials are in `.credentials` (gitignored):

```bash
cp .credentials.example .credentials
# Fill in your actual passwords
```

| Role | Email | Default Password | Access |
|---|---|---|---|
| PB Superuser | `admin@luna.pos` | set during superuser create | PocketBase `/_/` |
| Admin | `admin@cafecash.pos` | `CafeCash@2026!` | Dashboard — full |
| Staff | `staff@cafecash.pos` | `Staff@2026!` | Dashboard — operational |
| Kasir | `kasir1@cafecash.pos` | `Kasir@2026!` | Tablet POS only |

> Change default passwords after first login.

## Bare-metal (without Docker)

```bash
./start.sh              # starts PocketBase :8091 + Next.js admin :3001

# Install as macOS launchd services
./install-services.sh
```
