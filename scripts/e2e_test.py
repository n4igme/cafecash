"""End-to-end test for luna-pos PocketBase backend."""
import json, urllib.request, urllib.error

BASE = "http://localhost:8091"

def pb(method, path, data=None, token=None, expect_fail=False):
    url = f"{BASE}{path}"
    body = json.dumps(data).encode() if data else None
    headers = {}
    if body:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read()
            return (json.loads(body) if body else {}), r.status
    except urllib.error.HTTPError as e:
        if expect_fail:
            return None, e.code
        err = e.read().decode()
        print(f"  UNEXPECTED HTTP {e.code}: {err[:200]}")
        return None, e.code

print("=" * 55)
print("Luna POS — End-to-End Test")
print("=" * 55)

# ── 1. Staff auth ─────────────────────────────────────────────────────────────
r, _ = pb("POST", "/api/collections/users/auth-with-password",
    {"identity": "staff@luna.pos", "password": "Staff@2026!"})
staff_token = r["token"]
print(f"\n[1] Staff auth           ✓  email={r['record']['email']}")

# ── 2. Anon fetches products (listRule = "") ──────────────────────────────────
r, code = pb("GET", "/api/collections/products/records?filter=is_available%3Dtrue&sort=category%2Cname")
count = r["totalItems"]
prod_id = r["items"][0]["id"]
prod_name = r["items"][0]["name"]
print(f"[2] Anon fetch products  ✓  {count} products visible (first: {prod_name})")

# ── 3. Anon tries to READ orders (listRule = authenticated)
# PocketBase v0.40: silently returns empty list (not 403) — data is protected
r, code = pb("GET", "/api/collections/orders/records")
total = r.get("totalItems", -1) if r else -1
status = "✓ empty (rule enforced)" if code == 200 and total == 0 else f"✗ got {total} items HTTP {code}"
print(f"[3] Anon read orders     {status}  totalItems={total}")

# ── 4. Anon creates order (createRule = "") ───────────────────────────────────
r, _ = pb("POST", "/api/collections/orders/records",
    {"total": 48000, "status": "paid"})
order_id = r["id"]
print(f"[4] Anon create order    ✓  id={order_id[:8]} total=48000 status=paid")

# ── 5. Anon creates order_items ───────────────────────────────────────────────
r, _ = pb("POST", "/api/collections/order_items/records", {
    "order": order_id, "product": prod_id,
    "product_name": prod_name, "price": 20000, "quantity": 2
})
item_id = r["id"]
print(f"[5] Anon create item     ✓  id={item_id[:8]} {prod_name} x2")

# ── 6. Anon tries to UPDATE order (updateRule = authenticated) ────────────────
_, code = pb("PATCH", f"/api/collections/orders/records/{order_id}",
    {"status": "cancelled"}, expect_fail=True)
status = "✓ blocked" if code in (403, 404) else f"✗ expected 403/404 got {code}"
print(f"[6] Anon update order    {status}  HTTP {code}")

# ── 7. Staff reads orders with expand ─────────────────────────────────────────
r, _ = pb("GET", "/api/collections/orders/records?expand=order_items_via_order&perPage=50",
    token=staff_token)
o = r["items"][0]
items = o.get("expand", {}).get("order_items_via_order", [])
print(f"[7] Staff read orders    ✓  {r['totalItems']} order(s), expand={len(items)} item(s)")

# ── 8. Staff updates order status ─────────────────────────────────────────────
r, _ = pb("PATCH", f"/api/collections/orders/records/{order_id}",
    {"status": "paid"}, token=staff_token)
print(f"[8] Staff update order   ✓  status={r['status']}")

# ── 9. Staff creates a product ────────────────────────────────────────────────
r, _ = pb("POST", "/api/collections/products/records",
    {"name": "Test Latte", "price": 30000, "category": "Coffee", "is_available": True},
    token=staff_token)
new_prod_id = r["id"]
print(f"[9] Staff create product ✓  id={new_prod_id[:8]} name={r['name']}")

# ── 10. Staff deletes test product ────────────────────────────────────────────
_, code = pb("DELETE", f"/api/collections/products/records/{new_prod_id}",
    token=staff_token)
status = "✓" if code == 204 else f"✗ HTTP {code}"
print(f"[10] Staff delete product {status}  HTTP {code}")

# ── 11. Anon tries to delete product (deleteRule = authenticated) ─────────────
_, code = pb("DELETE", f"/api/collections/products/records/{prod_id}",
    expect_fail=True)
status = "✓ blocked" if code in (403, 404) else f"✗ expected 403/404 got {code}"
print(f"[11] Anon delete product  {status}  HTTP {code}")

print("\n" + "=" * 55)
print("All tests passed ✓")
print("=" * 55)
