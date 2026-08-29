"""
CafeCash End-to-End Test — realistic café workflow
Tests: auth, products, stock deduction, order lifecycle, cancel/restore
"""
import json, urllib.request, urllib.error, sys

BASE  = "http://127.0.0.1:8091"
PASS  = 0
FAIL  = 0

def req(method, path, data=None, token=None):
    url  = f"{BASE}{path}"
    body = json.dumps(data).encode() if data else None
    h    = {"Content-Type": "application/json"} if data else {}
    if token: h["Authorization"] = token
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}, resp.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode() or "{}"), e.code

def ok(label, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ✅ {label}")
    else:
        FAIL += 1
        print(f"  ❌ {label}{' — ' + str(detail) if detail else ''}")

def section(title):
    print(f"\n{'─'*50}")
    print(f"  {title}")
    print(f"{'─'*50}")

# ── 1. Auth ───────────────────────────────────────────────────────────────────
section("1. Authentication")
r, code = req("POST", "/api/collections/_superusers/auth-with-password",
    {"identity": "admin@luna.pos", "password": "Admin@2026!"})
token = r.get("token")
ok("Superuser auth", code == 200 and token, f"code={code}")

r2, code2 = req("POST", "/api/collections/users/auth-with-password",
    {"identity": "admin@cafecash.pos", "password": "CafeCash@2026!"})
staff_token = r2.get("token")
ok("Staff auth", code2 == 200 and staff_token, f"code={code2}")

# Maid token — for order creation (maid role required)
r3, code3 = req("POST", "/api/collections/users/auth-with-password",
    {"identity": "kasir1@cafecash.pos", "password": "Kasir@2026!"})
maid_token = r3.get("token")
ok("Maid auth", code3 == 200 and maid_token, f"code={code3}")

# ── 2. Products ───────────────────────────────────────────────────────────────
section("2. Products")
r, _ = req("GET", "/api/collections/products/records?perPage=100", token=token)
products = r.get("items", [])
ok(f"Products loaded ({len(products)})", len(products) >= 38)

# Find specific products for testing
americano    = next((p for p in products if p["name"] == "Americano"), None)
cappuccino   = next((p for p in products if p["name"] == "Cappuccino"), None)
matcha       = next((p for p in products if p["name"] == "Matcha Latte"), None)
ok("Americano exists",   americano is not None)
ok("Cappuccino exists",  cappuccino is not None)
ok("Matcha Latte exists",matcha is not None)

# ── 3. Ingredients (initial stock) ───────────────────────────────────────────
section("3. Ingredients & Stock")
r, _ = req("GET", "/api/collections/ingredients/records?perPage=100", token=token)
ingredients = r.get("items", [])
ok(f"Ingredients loaded ({len(ingredients)})", len(ingredients) >= 27)

espresso = next((i for i in ingredients if i["name"] == "Espresso Shot"), None)
milk     = next((i for i in ingredients if i["name"] == "Whole Milk"), None)
ok("Espresso Shot exists", espresso is not None, ingredients)
ok("Whole Milk exists",    milk is not None)

stock_before = {i["id"]: i["stock_qty"] for i in ingredients}
print(f"     Espresso Shot stock: {espresso['stock_qty'] if espresso else '?'} ml")
print(f"     Whole Milk stock:    {milk['stock_qty'] if milk else '?'} ml")

# ── 4. Create new order ───────────────────────────────────────────────────────
section("4. Create Open Order")
r, code = req("POST", "/api/collections/orders/records",
    {"customer_name": "Budi (Test)", "status": "open", "total": 0}, token=maid_token)
ok("Create open order", code == 200, r.get("message"))
order_id = r.get("id")
print(f"     Order ID: {order_id}")

# ── 5. Add order items ────────────────────────────────────────────────────────
section("5. Add Order Items")
items_to_add = [
    {"product": americano["id"],  "product_name": "Americano",   "price": americano["price"],  "quantity": 2},
    {"product": cappuccino["id"], "product_name": "Cappuccino",  "price": cappuccino["price"], "quantity": 1},
]
item_ids = []
for item in items_to_add:
    r, code = req("POST", "/api/collections/order_items/records",
        {**item, "order": order_id}, token=maid_token)
    ok(f"Add {item['quantity']}x {item['product_name']}", code == 200, r.get("message"))
    if code == 200: item_ids.append(r["id"])

total = sum(i["price"] * i["quantity"] for i in items_to_add)
req("PATCH", f"/api/collections/orders/records/{order_id}", {"total": total}, token=token)
print(f"     Order total: Rp {total:,}")

# ── 6. Simulate stock deduction (what tablet does on Save Order) ──────────────
section("6. Stock Deduction (simulate Save Order)")
r, _ = req("GET", "/api/collections/recipes/records?perPage=200", token=token)
recipes = r.get("items", [])

def deduct_stock(order_items_list, direction=1):
    """direction: +1 = deduct, -1 = restore"""
    for item in order_items_list:
        prod_recipes = [rec for rec in recipes if rec["product"] == item["product"]]
        for rec in prod_recipes:
            ingr_r, _ = req("GET", f"/api/collections/ingredients/records/{rec['ingredient']}", token=token)
            new_qty = ingr_r["stock_qty"] - (direction * rec["qty_needed"] * item["quantity"])
            new_qty = max(0, new_qty)
            req("PATCH", f"/api/collections/ingredients/records/{rec['ingredient']}",
                {"stock_qty": new_qty}, token=token)

deduct_stock(items_to_add, direction=1)

# Verify deduction
r, _ = req("GET", "/api/collections/ingredients/records?perPage=100", token=token)
ingredients_after = r.get("items", [])
stock_after = {i["id"]: i["stock_qty"] for i in ingredients_after}

espresso_after = next((i for i in ingredients_after if i["name"] == "Espresso Shot"), None)
milk_after     = next((i for i in ingredients_after if i["name"] == "Whole Milk"), None)

# Americano: 36ml espresso x2 = 72ml; Cappuccino: 36ml espresso x1 = 36ml → total 108ml
expected_espresso = stock_before.get(espresso["id"], 0) - 108 if espresso else 0
# Cappuccino: 120ml milk x1; no milk for Americano → total 120ml
expected_milk = stock_before.get(milk["id"], 0) - 120 if milk else 0

ok(f"Espresso deducted correctly (expected {expected_espresso}ml, got {espresso_after['stock_qty'] if espresso_after else '?'}ml)",
   espresso_after and espresso_after["stock_qty"] == expected_espresso)
ok(f"Whole Milk deducted correctly (expected {expected_milk}ml, got {milk_after['stock_qty'] if milk_after else '?'}ml)",
   milk_after and milk_after["stock_qty"] == expected_milk)

# ── 7. Edit order (add 1 Matcha Latte) ───────────────────────────────────────
section("7. Edit Order (add 1x Matcha Latte)")
print("     Simulating: restore old items → add new items")

# Restore old
deduct_stock(items_to_add, direction=-1)

# New items = old + matcha
new_items = items_to_add + [
    {"product": matcha["id"], "product_name": "Matcha Latte", "price": matcha["price"], "quantity": 1}
]

# Add new item to DB
r, code = req("POST", "/api/collections/order_items/records",
    {"order": order_id, "product": matcha["id"], "product_name": "Matcha Latte",
     "price": matcha["price"], "quantity": 1}, token=maid_token)
ok("Add 1x Matcha Latte to order", code == 200)

# Deduct new
deduct_stock(new_items, direction=1)

new_total = sum(i["price"] * i["quantity"] for i in new_items)
req("PATCH", f"/api/collections/orders/records/{order_id}", {"total": new_total}, token=token)
print(f"     Updated order total: Rp {new_total:,}")

# Verify matcha deduction
r, _ = req("GET", "/api/collections/ingredients/records?perPage=100", token=token)
matcha_powder = next((i for i in r["items"] if i["name"] == "Matcha Powder"), None)
ok("Matcha Powder deducted", matcha_powder and matcha_powder["stock_qty"] < stock_before.get(
    matcha_powder["id"], 9999) if matcha_powder else False,
   f"stock={matcha_powder['stock_qty'] if matcha_powder else '?'}")

# ── 8. Pay the order ──────────────────────────────────────────────────────────
section("8. Pay Order")
r, code = req("PATCH", f"/api/collections/orders/records/{order_id}",
    {"status": "paid", "payment_method": "cash"}, token=token)
ok("Order marked as paid", code == 200 and r.get("status") == "paid")

# Stock should NOT change on payment (deduction already happened on save)
r2, _ = req("GET", f"/api/collections/ingredients/records/{espresso['id']}", token=token)
ok("Stock unchanged after payment (deducted at save, not pay)",
   r2["stock_qty"] == stock_after.get(espresso["id"], -1) + (108) - 108,  # net same
   f"espresso={r2['stock_qty']}")

# ── 9. Create & cancel order (verify stock restore) ───────────────────────────
section("9. Cancel Order → Stock Restore")
r, code = req("POST", "/api/collections/orders/records",
    {"customer_name": "Siti (Cancel Test)", "status": "open", "total": 0}, token=maid_token)
cancel_order_id = r.get("id")
ok("Create order to cancel", code == 200)

cancel_items = [
    {"product": americano["id"], "product_name": "Americano", "price": americano["price"], "quantity": 1}
]
req("POST", "/api/collections/order_items/records",
    {"order": cancel_order_id, "product": americano["id"],
     "product_name": "Americano", "price": americano["price"], "quantity": 1}, token=maid_token)
deduct_stock(cancel_items, direction=1)

r_before, _ = req("GET", f"/api/collections/ingredients/records/{espresso['id']}", token=token)
espresso_before_cancel = r_before["stock_qty"]

# Cancel → restore
deduct_stock(cancel_items, direction=-1)
req("PATCH", f"/api/collections/orders/records/{cancel_order_id}",
    {"status": "cancelled"}, token=token)

r_after, _ = req("GET", f"/api/collections/ingredients/records/{espresso['id']}", token=token)
espresso_after_cancel = r_after["stock_qty"]
ok(f"Stock restored after cancel (+36ml, {espresso_before_cancel}→{espresso_after_cancel})",
   espresso_after_cancel == espresso_before_cancel + 36)

# ── 10. Verify final state ────────────────────────────────────────────────────
section("10. Final State Verification")
r, _ = req("GET", "/api/collections/orders/records?perPage=100", token=token)
all_orders = r.get("items", [])
paid_orders     = [o for o in all_orders if o["status"] == "paid"]
cancelled_orders= [o for o in all_orders if o["status"] == "cancelled"]
open_orders     = [o for o in all_orders if o["status"] == "open"]

ok(f"Paid orders exist ({len(paid_orders)})",     len(paid_orders) >= 1)
ok(f"Cancelled order exists ({len(cancelled_orders)})", len(cancelled_orders) >= 1)

r, _ = req("GET", "/api/collections/ingredients/records?perPage=100", token=token)
final_ingredients = r.get("items", [])
low_stock = [i for i in final_ingredients if i["stock_qty"] <= i["alert_qty"] and i["alert_qty"] > 0]
print(f"\n     Low stock ingredients: {len(low_stock)}")
for i in low_stock[:5]:
    print(f"       ⚠️  {i['name']}: {i['stock_qty']} {i['unit']} (alert: {i['alert_qty']})")

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'═'*50}")
print(f"  RESULTS: {PASS} passed, {FAIL} failed")
print(f"{'═'*50}")
if FAIL > 0:
    sys.exit(1)
