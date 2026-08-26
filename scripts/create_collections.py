"""Create PocketBase collections for luna-pos (v0.40 flat-field schema)."""
import json, urllib.request, urllib.error

BASE = "http://localhost:8091"

def pb_request(method, path, data=None, token=None):
    url = f"{BASE}{path}"
    body = json.dumps(data).encode() if data else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  HTTP {e.code}: {err[:400]}")
        return None

# Auth
auth = pb_request("POST", "/api/collections/_superusers/auth-with-password",
    {"identity": "admin@luna.pos", "password": "Admin@2026!"})
token = auth["token"]
print("✓ superuser auth")

cols = pb_request("GET", "/api/collections?perPage=50", token=token)
existing = {c["name"]: c["id"] for c in cols.get("items", [])}
print(f"  existing: {[k for k in existing if not k.startswith('_')]}")

# ── orders ────────────────────────────────────────────────────────────────────
if "orders" not in existing:
    r = pb_request("POST", "/api/collections", {
        "name": "orders",
        "type": "base",
        "fields": [
            {"name": "total",  "type": "number", "required": True},
            # v0.40: select values are flat on the field, not nested in options
            {"name": "status", "type": "select", "required": True,
             "values": ["pending", "paid", "cancelled"], "maxSelect": 1},
            {"name": "note",   "type": "text",   "required": False},
        ],
        "listRule":   "@request.auth.id != ''",
        "viewRule":   "@request.auth.id != ''",
        "createRule": "",
        "updateRule": "@request.auth.id != ''",
        "deleteRule": "@request.auth.id != ''",
    }, token=token)
    if r:
        existing["orders"] = r["id"]
        print(f"✓ orders created: {r['id']}")
    else:
        print("✗ orders failed")
else:
    print(f"  orders already exists: {existing['orders']}")

# ── order_items ───────────────────────────────────────────────────────────────
if "order_items" not in existing:
    r = pb_request("POST", "/api/collections", {
        "name": "order_items",
        "type": "base",
        "fields": [
            # v0.40: relation options are flat too
            {"name": "order",   "type": "relation", "required": True,
             "collectionId": existing["orders"], "cascadeDelete": True, "maxSelect": 1},
            {"name": "product", "type": "relation", "required": False,
             "collectionId": existing["products"], "cascadeDelete": False, "maxSelect": 1},
            {"name": "product_name", "type": "text",   "required": True},
            {"name": "price",        "type": "number", "required": True},
            {"name": "quantity",     "type": "number", "required": True},
        ],
        "listRule":   "@request.auth.id != ''",
        "viewRule":   "@request.auth.id != ''",
        "createRule": "",
        "updateRule": "@request.auth.id != ''",
        "deleteRule": "@request.auth.id != ''",
    }, token=token)
    if r:
        existing["order_items"] = r["id"]
        print(f"✓ order_items created: {r['id']}")
    else:
        print("✗ order_items failed")
else:
    print(f"  order_items already exists: {existing['order_items']}")

# ── settings (already created, patch rules if needed) ────────────────────────
if "settings" in existing:
    print(f"  settings already exists: {existing['settings']}")
else:
    r = pb_request("POST", "/api/collections", {
        "name": "settings",
        "type": "base",
        "fields": [
            {"name": "store_name", "type": "text", "required": True},
            {"name": "qris_image", "type": "file", "required": False,
             "maxSelect": 1, "maxSize": 5242880,
             "mimeTypes": ["image/png", "image/jpeg", "image/webp"]},
        ],
        "listRule":   "",
        "viewRule":   "",
        "createRule": "@request.auth.id != ''",
        "updateRule": "@request.auth.id != ''",
        "deleteRule": "@request.auth.id != ''",
    }, token=token)
    if r:
        print(f"✓ settings created: {r['id']}")
    else:
        print("✗ settings failed")

# ── seed products ─────────────────────────────────────────────────────────────
staff_auth = pb_request("POST", "/api/collections/users/auth-with-password",
    {"identity": "staff@luna.pos", "password": "Staff@2026!"})
staff_token = staff_auth["token"]

existing_products = pb_request("GET", "/api/collections/products/records", token=staff_token)
if existing_products and existing_products.get("totalItems", 0) == 0:
    seeds = [
        {"name": "Americano",    "price": 20000, "category": "Coffee",     "is_available": True},
        {"name": "Cappuccino",   "price": 25000, "category": "Coffee",     "is_available": True},
        {"name": "Matcha Latte", "price": 28000, "category": "Non-Coffee", "is_available": True},
        {"name": "Es Teh Manis", "price":  8000, "category": "Drinks",     "is_available": True},
        {"name": "Croissant",    "price": 18000, "category": "Food",       "is_available": True},
        {"name": "Cheesecake",   "price": 22000, "category": "Food",       "is_available": True},
    ]
    for s in seeds:
        r = pb_request("POST", "/api/collections/products/records", s, token=staff_token)
        if r:
            print(f"✓ seeded: {r['name']}")
        else:
            print(f"✗ seed failed: {s['name']}")
else:
    count = existing_products.get("totalItems", 0) if existing_products else 0
    print(f"  products already seeded ({count} records)")

print("\n✓ setup complete")
