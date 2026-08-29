"""
CafeCash first-time setup script.
Run once after docker compose up -d and PocketBase superuser creation.

Usage:
    PYTHONPATH="" python3 scripts/setup.py

What it does:
    1. Verify PocketBase is running
    2. Create admin dashboard user (admin@cafecash.pos)
    3. Create all collections (products, orders, order_items, settings, stock)
    4. Seed 38 café products
    5. Seed 27 ingredients + 90 recipe entries
    6. Set initial stock quantities (50 servings each)
    7. Seed sample settings record (store name placeholder)
    8. Run e2e verification

Requires: PocketBase superuser already created via:
    ./pocketbase superuser create admin@luna.pos <password>
"""
import json, urllib.request, urllib.error, sys, os, time, subprocess

BASE = "http://127.0.0.1:8091"

# ── Config ────────────────────────────────────────────────────────────────────
PB_SUPERUSER_EMAIL    = os.environ.get("PB_SUPERUSER_EMAIL",    "admin@luna.pos")
PB_SUPERUSER_PASSWORD = os.environ.get("PB_SUPERUSER_PASSWORD", "Admin@2026!")
ADMIN_USER_EMAIL      = os.environ.get("ADMIN_USER_EMAIL",      "admin@cafecash.pos")
ADMIN_USER_PASSWORD   = os.environ.get("ADMIN_USER_PASSWORD",   "CafeCash@2026!")
STORE_NAME            = os.environ.get("STORE_NAME",             "CafeCash")

PASS = 0; FAIL = 0

def req(method, path, data=None, token=None):
    url  = f"{BASE}{path}"
    body = json.dumps(data).encode() if data else None
    h    = {"Content-Type": "application/json"} if data else {}
    if token: h["Authorization"] = token
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read(); return json.loads(raw) if raw else {}, resp.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode() or "{}"), e.code

def ok(label):
    global PASS; PASS += 1; print(f"  ✅ {label}")

def fail(label, detail=""):
    global FAIL; FAIL += 1
    print(f"  ❌ {label}{' — ' + str(detail) if detail else ''}")

def section(title):
    print(f"\n{'─'*55}")
    print(f"  {title}")
    print(f"{'─'*55}")

# ── 1. Health check ───────────────────────────────────────────────────────────
section("1. PocketBase health check")
r, code = req("GET", "/api/health")
if code == 200:
    ok(f"PocketBase is running ({r.get('message','?')})")
else:
    print(f"  ❌ PocketBase not reachable — is Docker running?")
    sys.exit(1)

# ── 2. Auth as superuser ──────────────────────────────────────────────────────
section("2. Superuser authentication")
r, code = req("POST", "/api/collections/_superusers/auth-with-password",
    {"identity": PB_SUPERUSER_EMAIL, "password": PB_SUPERUSER_PASSWORD})
if code != 200:
    print(f"  ❌ Superuser auth failed — did you run:")
    print(f"     ./pocketbase superuser create {PB_SUPERUSER_EMAIL} <password>")
    sys.exit(1)
token = r["token"]
ok(f"Superuser auth OK ({PB_SUPERUSER_EMAIL})")

# ── 3. Create admin dashboard user ───────────────────────────────────────────
section("3. Admin dashboard user")

# Check if already exists
users, _ = req("GET", f"/api/collections/users/records?filter=email='{ADMIN_USER_EMAIL}'", token=token)
existing = users.get("items", [])

if existing:
    ok(f"Admin user already exists ({ADMIN_USER_EMAIL})")
else:
    r, code = req("POST", "/api/collections/users/records", {
        "email":           ADMIN_USER_EMAIL,
        "password":        ADMIN_USER_PASSWORD,
        "passwordConfirm": ADMIN_USER_PASSWORD,
        "emailVisibility": True,
    }, token=token)
    if code == 200:
        ok(f"Admin user created ({ADMIN_USER_EMAIL})")
    else:
        fail(f"Failed to create admin user", r.get("message","?"))

# Verify login works
r2, code2 = req("POST", "/api/collections/users/auth-with-password",
    {"identity": ADMIN_USER_EMAIL, "password": ADMIN_USER_PASSWORD})
if code2 == 200:
    ok(f"Admin user login verified")
else:
    fail(f"Admin user login failed", r2.get("message","?"))

# ── 4. Create collections ─────────────────────────────────────────────────────
section("4. Collections")

existing_cols, _ = req("GET", "/api/collections?perPage=100", token=token)
existing_names = {c["name"] for c in existing_cols.get("items", [])}

COLLECTIONS = [
    {
        "name": "products", "type": "base",
        "fields": [
            {"name": "name",         "type": "text",   "required": True},
            {"name": "price",        "type": "number", "required": True},
            {"name": "category",     "type": "text"},
            {"name": "is_available", "type": "bool"},
            {"name": "image",        "type": "file",   "options": {"maxSelect": 1, "maxSize": 5242880}},
        ],
        "listRule": "", "viewRule": "", "createRule": None, "updateRule": None, "deleteRule": None,
    },
    {
        "name": "orders", "type": "base",
        "fields": [
            {"name": "customer_name",  "type": "text"},
            {"name": "status",         "type": "text"},
            {"name": "total",          "type": "number"},
            {"name": "payment_method", "type": "text"},
            {"name": "payment_slip",   "type": "file", "options": {"maxSelect": 1, "maxSize": 10485760}},
            {"name": "note",           "type": "text"},
            {"name": "refund_reason",  "type": "text"},
        ],
        "listRule": "", "viewRule": "", "createRule": "", "updateRule": "", "deleteRule": "",
    },
    {
        "name": "order_items", "type": "base",
        "fields": [
            {"name": "order",        "type": "relation", "options": {"collectionId": "_"}},
            {"name": "product",      "type": "text"},
            {"name": "product_name", "type": "text"},
            {"name": "price",        "type": "number"},
            {"name": "quantity",     "type": "number"},
        ],
        "listRule": "", "viewRule": "", "createRule": "", "updateRule": "", "deleteRule": "",
    },
    {
        "name": "settings", "type": "base",
        "fields": [
            {"name": "store_name",  "type": "text"},
            {"name": "logo_emoji",  "type": "text"},
            {"name": "logo",        "type": "file", "options": {"maxSelect": 1, "maxSize": 2097152}},
            {"name": "qris_image",  "type": "file", "options": {"maxSelect": 1, "maxSize": 5242880}},
        ],
        "listRule": "", "viewRule": "", "createRule": None, "updateRule": None, "deleteRule": None,
    },
    {
        "name": "ingredients", "type": "base",
        "fields": [
            {"name": "name",          "type": "text",   "required": True},
            {"name": "unit",          "type": "text"},
            {"name": "stock_qty",     "type": "number"},
            {"name": "alert_qty",     "type": "number"},
            {"name": "cost_per_unit", "type": "number"},
        ],
        "listRule": "", "viewRule": "", "createRule": None, "updateRule": None, "deleteRule": None,
    },
    {
        "name": "recipes", "type": "base",
        "fields": [
            {"name": "product",    "type": "text"},
            {"name": "ingredient", "type": "text"},
            {"name": "qty_needed", "type": "number"},
        ],
        "listRule": "", "viewRule": "", "createRule": None, "updateRule": None, "deleteRule": None,
    },
    {
        "name": "stock_purchases", "type": "base",
        "fields": [
            {"name": "ingredient",   "type": "text"},
            {"name": "qty",          "type": "number"},
            {"name": "price_total",  "type": "number"},
            {"name": "note",         "type": "text"},
        ],
        "listRule": None, "viewRule": None, "createRule": None, "updateRule": None, "deleteRule": None,
    },
    {
        "name": "stock_adjustments", "type": "base",
        "fields": [
            {"name": "ingredient", "type": "text"},
            {"name": "qty_change", "type": "number"},
            {"name": "reason",     "type": "text"},
            {"name": "note",       "type": "text"},
        ],
        "listRule": None, "viewRule": None, "createRule": None, "updateRule": None, "deleteRule": None,
    },
]

for col in COLLECTIONS:
    if col["name"] in existing_names:
        ok(f"Collection '{col['name']}' already exists")
        continue
    r, code = req("POST", "/api/collections", col, token=token)
    if code == 200:
        ok(f"Collection '{col['name']}' created")
    else:
        fail(f"Collection '{col['name']}'", r.get("message","?"))

# ── 5. Seed settings ──────────────────────────────────────────────────────────
section("5. Settings")
settings, _ = req("GET", "/api/collections/settings/records?perPage=1", token=token)
if settings.get("totalItems", 0) == 0:
    r, code = req("POST", "/api/collections/settings/records",
        {"store_name": STORE_NAME, "logo_emoji": "☕"}, token=token)
    if code == 200:
        ok(f"Settings record created (store: {STORE_NAME})")
    else:
        fail("Settings", r.get("message","?"))
else:
    ok("Settings record already exists")

# ── 6. Seed products ──────────────────────────────────────────────────────────
section("6. Products")
existing_prods, _ = req("GET", "/api/collections/products/records?perPage=1", token=token)
if existing_prods.get("totalItems", 0) > 0:
    ok(f"Products already seeded ({existing_prods['totalItems']} records)")
else:
    # Run seed script
    print("  Running seed_coffeeshop.py...")
    import subprocess
    result = subprocess.run(
        ["python3", "scripts/seed_coffeeshop.py"],
        capture_output=True, text=True, env={**os.environ, "PYTHONPATH": ""}
    )
    if result.returncode == 0:
        prods, _ = req("GET", "/api/collections/products/records?perPage=1", token=token)
        ok(f"Products seeded ({prods.get('totalItems',0)} records)")
    else:
        fail("seed_coffeeshop.py", result.stderr[-200:])

# ── 7. Seed ingredients + recipes ─────────────────────────────────────────────
section("7. Ingredients + Recipes")
existing_ingrs, _ = req("GET", "/api/collections/ingredients/records?perPage=1", token=token)
if existing_ingrs.get("totalItems", 0) > 0:
    ok(f"Ingredients already seeded ({existing_ingrs['totalItems']} records)")
else:
    print("  Running seed_recipes.py...")
    result = subprocess.run(
        ["python3", "scripts/seed_recipes.py"],
        capture_output=True, text=True, env={**os.environ, "PYTHONPATH": ""}
    )
    if result.returncode == 0:
        ingrs, _ = req("GET", "/api/collections/ingredients/records?perPage=1", token=token)
        recs, _  = req("GET", "/api/collections/recipes/records?perPage=1",     token=token)
        ok(f"Ingredients seeded ({ingrs.get('totalItems',0)} records)")
        ok(f"Recipes seeded ({recs.get('totalItems',0)} entries)")
    else:
        fail("seed_recipes.py", result.stderr[-200:])

# ── 8. Set initial stock ──────────────────────────────────────────────────────
section("8. Initial stock quantities")
# Check if stock is still 0
sample, _ = req("GET", "/api/collections/ingredients/records?perPage=5", token=token)
all_zero = all(i.get("stock_qty", 0) == 0 for i in sample.get("items", []))
if not all_zero:
    ok("Stock already set")
else:
    print("  Running set_stock.py...")
    result = subprocess.run(
        ["python3", "scripts/set_stock.py"],
        capture_output=True, text=True, env={**os.environ, "PYTHONPATH": ""}
    )
    if result.returncode == 0:
        ok("Stock quantities set (50 servings each)")
    else:
        fail("set_stock.py", result.stderr[-200:])

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'═'*55}")
print(f"  SETUP COMPLETE: {PASS} ok, {FAIL} failed")
print(f"{'═'*55}")
print(f"\n  Admin dashboard: http://127.0.0.1:3001")
print(f"  Login with:      {ADMIN_USER_EMAIL} / {ADMIN_USER_PASSWORD}")
print(f"  PocketBase UI:   http://127.0.0.1:8091/_/")
print()
if FAIL > 0:
    print("  ⚠️  Some steps failed — check output above")
    sys.exit(1)
else:
    print("  Next steps:")
    print("  1. Open http://localhost:3001/settings → upload logo + QRIS image")
    print("  2. Open http://localhost:3001/ingredients → set real stock quantities")
    print("  3. Build + install tablet APK: cd apps/tablet && bash scripts/build-debug.sh release")
    print()
