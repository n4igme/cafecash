"""Clean up DB and seed realistic coffee shop data."""
import json, urllib.request, urllib.error

BASE = "http://127.0.0.1:8091"

def req(method, path, data=None, token=None):
    url = f"{BASE}{path}"
    body = json.dumps(data).encode() if data else None
    h = {"Content-Type": "application/json"}
    if token: h["Authorization"] = token
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            body = resp.read()
            return json.loads(body) if body else {}, resp.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode()), e.code

# Auth
token = req("POST", "/api/collections/_superusers/auth-with-password",
    {"identity": "admin@luna.pos", "password": "Admin@2026!"})[0]["token"]
staff_token = req("POST", "/api/collections/users/auth-with-password",
    {"identity": "admin@cafecash.pos", "password": "CafeCash@2026!"})[0]["token"]
print("✓ auth")

# ── Clean up orders (cascade deletes order_items) ─────────────────────────────
orders = req("GET", "/api/collections/orders/records?perPage=500", token=token)[0].get("items", [])
for o in orders:
    req("DELETE", f"/api/collections/orders/records/{o['id']}", token=token)
print(f"✓ deleted {len(orders)} orders")

# ── Clean up products ─────────────────────────────────────────────────────────
products = req("GET", "/api/collections/products/records?perPage=500", token=token)[0].get("items", [])
for p in products:
    req("DELETE", f"/api/collections/products/records/{p['id']}", token=token)
print(f"✓ deleted {len(products)} products")

# ── Seed realistic coffee shop products ───────────────────────────────────────
# Price in IDR (Rupiah)
PRODUCTS = [
    # Coffee — Hot
    {"name": "Espresso",          "price": 20000, "category": "Coffee", "is_available": True},
    {"name": "Americano",         "price": 22000, "category": "Coffee", "is_available": True},
    {"name": "Cappuccino",        "price": 28000, "category": "Coffee", "is_available": True},
    {"name": "Latte",             "price": 30000, "category": "Coffee", "is_available": True},
    {"name": "Flat White",        "price": 32000, "category": "Coffee", "is_available": True},
    {"name": "Macchiato",         "price": 28000, "category": "Coffee", "is_available": True},
    {"name": "Mocha",             "price": 33000, "category": "Coffee", "is_available": True},
    {"name": "V60 Pour Over",     "price": 35000, "category": "Coffee", "is_available": True},

    # Coffee — Iced
    {"name": "Iced Americano",    "price": 25000, "category": "Coffee", "is_available": True},
    {"name": "Iced Latte",        "price": 32000, "category": "Coffee", "is_available": True},
    {"name": "Iced Cappuccino",   "price": 30000, "category": "Coffee", "is_available": True},
    {"name": "Iced Mocha",        "price": 35000, "category": "Coffee", "is_available": True},
    {"name": "Cold Brew",         "price": 33000, "category": "Coffee", "is_available": True},
    {"name": "Dalgona Coffee",    "price": 35000, "category": "Coffee", "is_available": True},

    # Non-Coffee
    {"name": "Matcha Latte",      "price": 32000, "category": "Non-Coffee", "is_available": True},
    {"name": "Iced Matcha Latte", "price": 35000, "category": "Non-Coffee", "is_available": True},
    {"name": "Taro Latte",        "price": 33000, "category": "Non-Coffee", "is_available": True},
    {"name": "Chocolate",         "price": 28000, "category": "Non-Coffee", "is_available": True},
    {"name": "Iced Chocolate",    "price": 30000, "category": "Non-Coffee", "is_available": True},
    {"name": "Chai Latte",        "price": 30000, "category": "Non-Coffee", "is_available": True},
    {"name": "Strawberry Latte",  "price": 33000, "category": "Non-Coffee", "is_available": True},

    # Drinks
    {"name": "Es Teh Manis",      "price": 8000,  "category": "Drinks", "is_available": True},
    {"name": "Teh Tarik",         "price": 15000, "category": "Drinks", "is_available": True},
    {"name": "Jus Jeruk",         "price": 18000, "category": "Drinks", "is_available": True},
    {"name": "Jus Alpukat",       "price": 22000, "category": "Drinks", "is_available": True},
    {"name": "Lemon Tea",         "price": 18000, "category": "Drinks", "is_available": True},
    {"name": "Air Mineral",       "price": 8000,  "category": "Drinks", "is_available": True},
    {"name": "Sparkling Water",   "price": 15000, "category": "Drinks", "is_available": True},

    # Food
    {"name": "Croissant",         "price": 22000, "category": "Food", "is_available": True},
    {"name": "Butter Toast",      "price": 18000, "category": "Food", "is_available": True},
    {"name": "Avocado Toast",     "price": 35000, "category": "Food", "is_available": True},
    {"name": "Cheesecake",        "price": 28000, "category": "Food", "is_available": True},
    {"name": "Tiramisu",          "price": 32000, "category": "Food", "is_available": True},
    {"name": "Brownies",          "price": 22000, "category": "Food", "is_available": True},
    {"name": "Banana Bread",      "price": 25000, "category": "Food", "is_available": True},
    {"name": "Nasi Goreng",       "price": 35000, "category": "Food", "is_available": True},
    {"name": "Sandwich Tuna",     "price": 32000, "category": "Food", "is_available": True},
    {"name": "Pasta Carbonara",   "price": 45000, "category": "Food", "is_available": True},
]

created = 0
for p in PRODUCTS:
    r, code = req("POST", "/api/collections/products/records", p, token=staff_token)
    if code == 200:
        created += 1
    else:
        print(f"  ✗ {p['name']}: {r.get('message','?')}")

print(f"✓ created {created} products")
print(f"\nSummary:")
print(f"  Coffee:     {sum(1 for p in PRODUCTS if p['category'] == 'Coffee')} items")
print(f"  Non-Coffee: {sum(1 for p in PRODUCTS if p['category'] == 'Non-Coffee')} items")
print(f"  Drinks:     {sum(1 for p in PRODUCTS if p['category'] == 'Drinks')} items")
print(f"  Food:       {sum(1 for p in PRODUCTS if p['category'] == 'Food')} items")
