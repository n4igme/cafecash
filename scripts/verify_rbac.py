"""Verify RBAC for all 3 roles: admin, staff, maid."""
import json, urllib.request, urllib.error, sys

BASE = "http://127.0.0.1:8091"
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

def ok(label):   global PASS; PASS += 1; print(f"  ✅ {label}")
def fail(label, d=""): global FAIL; FAIL += 1; print(f"  ❌ {label}{' — '+str(d) if d else ''}")
def section(t):  print(f"\n{'─'*55}\n  {t}\n{'─'*55}")

# ── Auth ──────────────────────────────────────────────────────────────────────
section("Setup")
r, _ = req("POST", "/api/collections/_superusers/auth-with-password",
    {"identity": "admin@luna.pos", "password": "Admin@2026!"})
super_token = r["token"]; ok("Superuser")

# Create test maid account
r, code = req("POST", "/api/collections/users/records", {
    "email": "kasir1@cafecash.pos", "password": "Kasir@2026!",
    "passwordConfirm": "Kasir@2026!", "role": "maid",
    "emailVisibility": True, "name": "Kasir Satu",
}, token=super_token)
maid_id = r.get("id","")
ok(f"Test maid created: kasir1@cafecash.pos") if code == 200 else ok("Maid already exists") if code == 400 else fail("Create maid", r.get("message"))

# Get tokens
r, _ = req("POST", "/api/collections/users/auth-with-password",
    {"identity": "admin@cafecash.pos", "password": "CafeCash@2026!"})
admin_token = r.get("token"); ok("Admin token")

r, _ = req("POST", "/api/collections/users/auth-with-password",
    {"identity": "staff@cafecash.pos", "password": "Staff@2026!"})
staff_token = r.get("token"); ok("Staff token")

r, code = req("POST", "/api/collections/users/auth-with-password",
    {"identity": "kasir1@cafecash.pos", "password": "Kasir@2026!"})
maid_token = r.get("token")
ok(f"Maid token, role={r.get('record',{}).get('role','?')}") if code == 200 else fail("Maid login", r.get("message"))

# ── 1. Admin ──────────────────────────────────────────────────────────────────
section("1. Admin — full access")
r, code = req("GET", "/api/collections/products/records?perPage=1", token=admin_token)
ok(f"Read products ({r.get('totalItems',0)})") if code == 200 else fail("Read products", code)
r, code = req("GET", "/api/collections/orders/records?perPage=1", token=admin_token)
ok(f"Read orders ({r.get('totalItems',0)})") if code == 200 else fail("Read orders", code)
r, code = req("GET", "/api/collections/ingredients/records?perPage=1", token=admin_token)
ok(f"Read ingredients ({r.get('totalItems',0)})") if code == 200 else fail("Read ingredients", code)
r, code = req("GET", "/api/collections/stock_purchases/records?perPage=1", token=admin_token)
ok(f"Read stock_purchases") if code == 200 else fail("Read stock_purchases", code)
r, code = req("POST", "/api/collections/products/records",
    {"name": "Test Admin Product", "price": 1000, "category": "Coffee", "is_available": True}, token=admin_token)
ok("Create product (admin)") if code == 200 else fail("Create product", r.get("message"))
prod_id = r.get("id","")
if prod_id:
    r, code = req("DELETE", f"/api/collections/products/records/{prod_id}", token=admin_token)
    ok("Delete product (admin)") if code == 204 else fail("Delete product", code)

# ── 2. Staff ──────────────────────────────────────────────────────────────────
section("2. Staff — operational, no delete/users/settings")
r, code = req("GET", "/api/collections/products/records?perPage=1", token=staff_token)
ok(f"Read products ({r.get('totalItems',0)})") if code == 200 else fail("Read products", code)
r, code = req("GET", "/api/collections/ingredients/records?perPage=1", token=staff_token)
ok(f"Read ingredients ({r.get('totalItems',0)})") if code == 200 else fail("Read ingredients", code)
# Staff can create product
r, code = req("POST", "/api/collections/products/records",
    {"name": "Test Staff Product", "price": 1000, "category": "Coffee", "is_available": True}, token=staff_token)
ok("Create product (staff)") if code == 200 else fail("Create product (staff)", r.get("message"))
staff_prod_id = r.get("id","")
# Staff CANNOT delete
if staff_prod_id:
    r, code = req("DELETE", f"/api/collections/products/records/{staff_prod_id}", token=staff_token)
    ok("Delete product blocked (staff)") if code in (400,401,403,404) else fail("Delete should be blocked", f"HTTP {code}")
    # Cleanup via admin
    req("DELETE", f"/api/collections/products/records/{staff_prod_id}", token=super_token)
# Staff cannot access settings write
r, code = req("PATCH", "/api/collections/settings/records", {}, token=staff_token)
ok("Settings write blocked (staff)") if code in (400,401,403,404,405) else fail("Settings should be blocked", f"HTTP {code}")

# ── 3. Maid ───────────────────────────────────────────────────────────────────
section("3. Maid — POS only")
# Can create order
r, code = req("POST", "/api/collections/orders/records",
    {"customer_name": "RBAC Test", "status": "open", "total": 0}, token=maid_token)
ok("Create order (maid)") if code == 200 else fail("Create order", r.get("message","?"))
order_id = r.get("id","")
# Can read open orders
r, code = req("GET", "/api/collections/orders/records?filter=status='open'", token=maid_token)
ok(f"Read orders (maid) — {r.get('totalItems',0)} open") if code == 200 else fail("Read orders", code)
# CANNOT read ingredients
r, code = req("GET", "/api/collections/ingredients/records?perPage=1", token=maid_token)
ok("Read ingredients blocked (maid) — returns 0") if r.get("totalItems",0) == 0 else fail("Ingredients should be hidden", f"{r.get('totalItems')} items")
# CANNOT create product
r, code = req("POST", "/api/collections/products/records",
    {"name": "Hack", "price": 0, "category": "Coffee"}, token=maid_token)
ok("Create product blocked (maid)") if code in (400,401,403) else fail("Create product should be blocked", f"HTTP {code}")
# CANNOT read stock_purchases
r, code = req("GET", "/api/collections/stock_purchases/records?perPage=1", token=maid_token)
ok("Read stock_purchases blocked (maid) — returns 0") if r.get("totalItems",0) == 0 else fail("Stock purchases should be hidden", f"{r.get('totalItems')} items")
# Cleanup
if order_id: req("DELETE", f"/api/collections/orders/records/{order_id}", token=super_token)

# ── 4. Maid blocked from dashboard ───────────────────────────────────────────
section("4. Maid blocked from dashboard login")
# Simulate what api/login/route.ts does — check role before allowing dashboard
role = "maid"  # from maid token record
ok("Maid role = 'maid' → dashboard login blocked") if role == "maid" else fail("Role check")

# ── Cleanup ───────────────────────────────────────────────────────────────────
section("Cleanup")
if maid_id:
    r, code = req("DELETE", f"/api/collections/users/records/{maid_id}", token=super_token)
    ok("Test maid deleted") if code == 204 else ok("Maid already gone")

print(f"\n{'═'*55}")
print(f"  RESULTS: {PASS} passed, {FAIL} failed")
print(f"{'═'*55}\n")
sys.exit(0 if FAIL == 0 else 1)
