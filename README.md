# CafeCash

Self-hosted POS system for cafés — Android tablet cashier app + Next.js web admin + PocketBase backend, all connected over Tailscale VPN.

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
│   │   ├── app/                    # Screens: active-orders, pos, checkout
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
│   ├── create_collections.py       # One-shot PocketBase schema setup
│   ├── create_stock_collections.py # Stock management collections setup
│   ├── seed_coffeeshop.py          # Seed 38 realistic café products
│   ├── seed_recipes.py             # Seed ingredients + 90 recipe entries
│   ├── set_stock.py                # Set initial stock (50 servings each)
│   ├── upload_photos.py            # Upload product photos
│   └── e2e_test.py                 # End-to-end API test (22 tests)
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
# e.g. 100.89.64.105
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
# 1. Create PocketBase superuser
./pocketbase superuser create admin@yourdomain.com <strong-password>

# 2. Create all collections (products, orders, order_items, settings, stock)
PYTHONPATH="" python3 scripts/create_collections.py
PYTHONPATH="" python3 scripts/create_stock_collections.py

# 3. Seed products, ingredients, recipes
PYTHONPATH="" python3 scripts/seed_coffeeshop.py
PYTHONPATH="" python3 scripts/seed_recipes.py

# 4. Set initial stock quantities (50 servings each)
PYTHONPATH="" python3 scripts/set_stock.py

# 5. Create first admin user
# Open http://localhost:8091/_/ → Collections → users → + New record
```

Then open `http://localhost:3001` → sign in → **Settings** → set store name, upload logo and QRIS image.

### 7. Build + install tablet APK

```bash
cd apps/tablet
bash scripts/build-debug.sh release   # standalone release APK
bash scripts/build-debug.sh           # debug APK (needs Metro)
```

> APK build requires Java 21 and Android SDK. The script handles all Gradle fixes automatically.

## Deployment

Use `deploy.sh` (macOS/Linux) or `deploy.ps1` (Windows) for one-command deployment:

```bash
# macOS/Linux
./deploy.sh            # build + deploy admin Docker + tablet APK
./deploy.sh admin      # admin Docker only
./deploy.sh apk        # release APK only
./deploy.sh apk debug  # debug APK

# Windows (PowerShell)
.\deploy.ps1
.\deploy.ps1 admin
.\deploy.ps1 apk
```

**When Tailscale IP changes:**
```bash
sed -i '' 's/OLD_IP/NEW_IP/g' apps/tablet/.env apps/admin/.env.local
./deploy.sh
```

## Admin Dashboard

| Page | Features |
|---|---|
| 📊 Dashboard | Revenue, orders, avg order value, period filter (Today/Week/Month/Year/All), 7-day chart, monthly trend, sales by product, **HPP + margin per product**, gross profit, low stock alert |
| 🛍️ Products | CRUD, image upload, availability toggle, search, category filter, sortable columns, **stock badge (Out of stock / Low)** |
| 📋 Orders | Full history, search, sort, status filter, cancel, refund, payment slip preview |
| 👤 Users | Add/edit/delete admin users, change passwords |
| ⚙️ Settings | Store name, logo upload, QRIS image upload |
| 🧪 Ingredients | Raw materials CRUD, stock levels, alert thresholds, cost per unit |
| 📋 Recipes | Map products → ingredients + qty per serving (drives auto stock deduction) |
| 📦 Stock In | Record purchases, auto-updates ingredient stock, purchase history |
| ⚡ Adjustments | Record waste, spoilage, manual corrections |

**Language toggle:** 🇮🇩 ID / 🇬🇧 EN button in sidebar footer. Default: Indonesian.

## Tablet POS

| Feature | Detail |
|---|---|
| Active orders | Home screen lists all open orders — tap to reopen and edit |
| Product grid | 3-column, category filters, **grey out when ingredient stock = 0** |
| Order flow | New Order → name/table → add items → Save Order → Proceed to Payment |
| Order editing | Reopen saved order — add/remove items (stock restored → re-deducted) |
| Stock deduction | Auto-deducts ingredients on Save Order via recipes |
| Cancel order | Restores all ingredient stock automatically |
| Payment methods | QRIS (photo required), Cash (no photo), Split Cash+QRIS (photo + note) |
| Payment slip | Camera or gallery photo upload, stored in PocketBase, visible in admin |

## Order Lifecycle

```
New Order (open)
    ↓ add/edit items (stock deducted on each save)
Save Order (open, stock deducted)
    ↓
Proceed to Payment
    ↓
Paid ✓ (stock unchanged — already deducted at save)
    or
Cancelled (stock restored automatically)
    or
Refunded (admin only, from Orders page)
```

## Stock Management

```
Stock In (purchases)  → adds stock
Recipes               → defines what gets consumed per order item
Save Order            → auto-deducts ingredients per recipe
Cancel Order          → auto-restores ingredients per recipe
Adjustments           → manual waste / spoilage / correction
```

HPP (Harga Pokok Penjualan) per product is calculated from `cost_per_unit` in Ingredients × qty per recipe. Update ingredient costs to keep HPP accurate.

## RBAC

| | Tablet (anonymous) | Admin (authenticated) |
|---|---|---|
| `products` | Read | Full CRUD |
| `orders` | Create, Read, Update | Full CRUD |
| `order_items` | Create, Read, Delete | Full CRUD |
| `settings` | Read | Full CRUD |
| `ingredients` | — | Full CRUD |
| `recipes` | Read | Full CRUD |
| `stock_purchases` | — | Full CRUD |
| `stock_adjustments` | — | Full CRUD |

Tailscale VPN is the network security boundary — only Tailscale devices can reach the backend.

## Bare-metal (without Docker)

```bash
./start.sh              # starts PocketBase :8091 + Next.js admin :3001

# Install as macOS launchd services (auto-start on reboot)
./install-services.sh
./install-services.sh status
./install-services.sh stop
```

## Testing

```bash
# Run full end-to-end test (22 tests)
PYTHONPATH="" python3 scripts/e2e_test.py
```

Covers: auth, products, ingredients, order create/edit/pay/cancel, stock deduction/restore.

## Credentials

> ⚠️ **Never commit real credentials to version control.**

After setup, store credentials in `.credentials` (gitignored):

```bash
cp .credentials.example .credentials
# Fill in your actual passwords
```

| Role | Access |
|---|---|
| PB Superuser | PocketBase `/_/` — schema, users, system config |
| Admin user | Full access to admin dashboard |
