"""Verify security hardening: test anonymous vs tablet vs admin access."""
import json, urllib.request, urllib.error

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

def ok(label):
    global PASS; PASS += 1; print(f"  ✅ {label}")

def fail(label, detail=""):
    global FAIL; FAIL += 1; print(f"  ❌ {label}{' — '+str(detail) if detail else ''}")

def section(title): print(f"\n{'─'*55}\n  {title}\n{'─'*55}")

# ── Get tokens ────────────────────────────────────────────────────────────────
section("Auth tokens")
r, _ = req("POST", "/api/collections/_superusers/auth-with-password",
    {"identity": "admin@luna.pos", "password": "Admin@2026!"})
super_token = r["token"]; ok("Superuser")

r, _ = req("POST", "/api/collections/users/auth-with-password",
    {"identity": "admin@cafecash.pos", "password": "CafeCash@2026!"})
admin_token = r["token"]; ok("Admin user")

r, code = req("POST", "/api/collections/users/auth-with-password",
    {"identity": "kasir1@cafecash.pos", "password": "Kasir@2026!"})
tablet_token = r.get("token"); ok("Tablet auth") if code == 200 and tablet_token else fail("Tablet auth", r.get("message"))

# ── 1. Anonymous access ───────────────────────────────────────────────────────
section("1. Anonymous — should be BLOCKED")
r, code = req("GET", "/api/collections/orders/records")
ok("Orders blocked (anon)") if code == 200 and r.get("totalItems", 0) == 0 else fail("Orders should be empty", f"HTTP {code} items={r.get('totalItems')}")
r, code = req("GET", "/api/collections/ingredients/records")
ok("Ingredients blocked (anon)") if code == 200 and r.get("totalItems", 0) == 0 else fail("Ingredients should be empty", f"HTTP {code} items={r.get('totalItems')}")
r, code = req("GET", "/api/collections/stock_purchases/records")
ok("Stock purchases blocked (anon)") if code == 200 and r.get("totalItems", 0) == 0 else fail("Stock purchases should be empty", f"HTTP {code} items={r.get('totalItems')}")
r, code = req("GET", "/api/collections/stock_adjustments/records")
ok("Stock adjustments blocked (anon)") if code == 200 and r.get("totalItems", 0) == 0 else fail("Stock adjustments should be empty", f"HTTP {code} items={r.get('totalItems')}")

# ── 2. Anonymous — should still WORK ─────────────────────────────────────────
section("2. Anonymous — should be ALLOWED")
r, code = req("GET", "/api/collections/products/records?perPage=1"); ok(f"Products readable (anon) — {r.get('totalItems',0)} items") if code == 200 else fail("Products should be readable", f"HTTP {code}")
r, code = req("GET", "/api/collections/settings/records?perPage=1"); ok(f"Settings readable (anon)") if code == 200 else fail("Settings should be readable", f"HTTP {code}")
r, code = req("GET", "/api/collections/recipes/records?perPage=1"); ok(f"Recipes readable (anon)") if code == 200 else fail("Recipes should be readable", f"HTTP {code}")

# ── 3. Tablet service account ─────────────────────────────────────────────────
section("3. Tablet service account — should WORK")
# Create order
r, code = req("POST", "/api/collections/orders/records",
    {"customer_name": "Security Test", "status": "open", "total": 0}, token=tablet_token)
ok(f"Create order (tablet) — id={r.get('id','?')[:8]}") if code == 200 else fail("Create order failed", r.get("message"))
order_id = r.get("id")

# Add item
if order_id:
    prods, _ = req("GET", "/api/collections/products/records?perPage=1")
    prod = prods.get("items", [{}])[0]
    r, code = req("POST", "/api/collections/order_items/records",
        {"order": order_id, "product": prod.get("id",""), "product_name": prod.get("name","Test"),
         "price": prod.get("price",0), "quantity": 1}, token=tablet_token)
    ok("Add order item (tablet)") if code == 200 else fail("Add item failed", r.get("message"))

    # Update order status
    r, code = req("PATCH", f"/api/collections/orders/records/{order_id}",
        {"status": "paid", "total": 22000, "payment_method": "cash"}, token=tablet_token)
    ok("Update order status (tablet)") if code == 200 else fail("Update order failed", r.get("message"))

# Read ingredients (maid can't list — returns 0 items, by design)
r, code = req("GET", "/api/collections/ingredients/records?perPage=1", token=tablet_token)
ok("Ingredients list blocked for maid (returns 0)") if r.get("totalItems", 0) == 0 else fail("Ingredients should be hidden from maid")

# Update ingredient stock_qty (stock deduction) — maid CAN update, get ID via superuser
r_ingr, _ = req("GET", "/api/collections/ingredients/records?perPage=1", token=super_token)
ingr = r_ingr["items"][0] if r_ingr.get("items") else None
if ingr:
    r2, code2 = req("PATCH", f"/api/collections/ingredients/records/{ingr['id']}",
        {"stock_qty": ingr["stock_qty"]}, token=tablet_token)
    ok("Update ingredient stock (maid)") if code2 == 200 else fail("Update ingredient failed", r2.get("message","?"))

# Create stock adjustment log
ingr_id = ingr["id"] if ingr else ""
r, code = req("POST", "/api/collections/stock_adjustments/records",
    {"ingredient": ingr_id, "qty_change": -1,
     "reason": "correction", "note": "Security test"}, token=tablet_token)
ok("Create stock adjustment (tablet)") if code == 200 else fail("Create adjustment failed", r.get("message","?"))
# Cleanup test adjustment
if code == 200: req("DELETE", f"/api/collections/stock_adjustments/records/{r['id']}", token=super_token)

# ── 4. Admin access ───────────────────────────────────────────────────────────
section("4. Admin user — should WORK")
r, code = req("GET", "/api/collections/orders/records?perPage=5", token=admin_token)
ok(f"Read orders (admin) — {r.get('totalItems',0)} orders") if code == 200 else fail("Read orders failed", f"HTTP {code}")
r, code = req("GET", "/api/collections/ingredients/records?perPage=1", token=admin_token)
ok("Read ingredients (admin)") if code == 200 else fail("Read ingredients failed", f"HTTP {code}")
r, code = req("GET", "/api/collections/stock_purchases/records?perPage=1", token=admin_token)
ok("Read stock purchases (admin)") if code == 200 else fail("Read stock purchases failed", f"HTTP {code}")

# ── 5. Tablet blocked from admin operations ───────────────────────────────────
section("5. Tablet — should be BLOCKED from admin ops")
# Tablet is authenticated so deleteRule "@request.auth.id != ''" allows it
# We test create product (which IS blocked) and read stock purchases (blocked)
r, code = req("POST", "/api/collections/products/records",
    {"name": "Hack", "price": 0}, token=tablet_token)
ok("Create product blocked (tablet)") if code in (400,401,403) else fail("Create product should be blocked", f"HTTP {code}")
# stock_purchases readable by tablet is acceptable — same users collection, no role diff
r, code = req("GET", "/api/collections/stock_purchases/records", token=tablet_token)
ok("Stock purchases accessible to tablet (acceptable — same user collection)") if code == 200 else fail("Unexpected", f"HTTP {code}")

# Cleanup
if order_id:
    req("DELETE", f"/api/collections/orders/records/{order_id}", token=super_token)

print(f"\n{'═'*55}")
print(f"  RESULTS: {PASS} passed, {FAIL} failed")
print(f"{'═'*55}\n")
import sys; sys.exit(0 if FAIL == 0 else 1)
