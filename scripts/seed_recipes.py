"""Seed all ingredients + recipes for 38 coffee shop products."""
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

token = req("POST", "/api/collections/_superusers/auth-with-password",
    {"identity": "admin@luna.pos", "password": "Admin@2026!"})[0]["token"]
print("✓ auth")

# ── Clean existing recipes + ingredients ──────────────────────────────────────
for col in ["recipes", "ingredients"]:
    items = req("GET", f"/api/collections/{col}/records?perPage=500", token=token)[0].get("items", [])
    for item in items:
        req("DELETE", f"/api/collections/{col}/records/{item['id']}", token=token)
    print(f"✓ cleared {len(items)} {col}")

# ── Create ingredients ────────────────────────────────────────────────────────
# (name, unit, stock_qty, alert_qty, cost_per_unit_IDR)
INGREDIENTS = [
    # Coffee base
    ("Espresso Shot",      "ml",   5000,  500,  150),   # ~18ml per shot, Rp 150/ml
    ("Ground Coffee",      "gram", 1000,  200,  180),   # for V60/cold brew
    # Milk
    ("Whole Milk",         "ml",  10000, 1000,    5),   # Rp 5/ml
    ("Condensed Milk",     "ml",   2000,  200,   12),
    # Powders
    ("Matcha Powder",      "gram",  500,  100,  300),   # Rp 300/gram
    ("Taro Powder",        "gram",  500,  100,  150),
    ("Chocolate Powder",   "gram", 1000,  200,   80),
    ("Chai Powder",        "gram",  500,  100,  200),
    # Syrups
    ("Strawberry Syrup",   "ml",   1000,  200,   50),
    # Sweeteners
    ("Sugar",              "gram", 2000,  300,    5),
    # Ice
    ("Ice",                "gram", 5000,  500,    2),
    # Fruits
    ("Orange",             "pcs",   30,    5,  3000),
    ("Avocado",            "gram", 2000,  300,   40),
    ("Lemon",              "pcs",   20,    5,  2000),
    # Tea
    ("Tea Bag",            "pcs",   50,   10,  1500),
    # Water
    ("Sparkling Water",    "pcs",   24,    6, 12000),
    ("Water Bottle",       "pcs",   24,    6,  3000),
    # Food — pre-made items (1 pcs = 1 serving)
    ("Croissant",          "pcs",   20,    5, 12000),
    ("Bread Slice",        "pcs",   30,   10,  3000),
    ("Butter",             "gram",  500,  100,   40),
    ("Cheesecake Slice",   "pcs",   15,    3, 15000),
    ("Tiramisu Slice",     "pcs",   12,    3, 18000),
    ("Brownies",           "pcs",   20,    5,  8000),
    ("Banana Bread Slice", "pcs",   15,    3, 10000),
    ("Nasi Goreng",        "pcs",   10,    2, 20000),
    ("Sandwich Tuna",      "pcs",   10,    2, 18000),
    ("Pasta Carbonara",    "pcs",   10,    2, 25000),
]

ingr_map = {}  # name → id
for name, unit, stock, alert, cost in INGREDIENTS:
    r, code = req("POST", "/api/collections/ingredients/records", {
        "name": name, "unit": unit,
        "stock_qty": stock, "alert_qty": alert, "cost_per_unit": cost,
    }, token=token)
    if code == 200:
        ingr_map[name] = r["id"]
    else:
        print(f"  ✗ ingredient {name}: {r.get('message','?')}")

print(f"✓ created {len(ingr_map)} ingredients")

# ── Fetch products ─────────────────────────────────────────────────────────────
products_data = req("GET", "/api/collections/products/records?perPage=100&sort=name", token=token)[0].get("items", [])
prod_map = {p["name"]: p["id"] for p in products_data}
print(f"✓ found {len(prod_map)} products")

def I(name): return ingr_map.get(name)
def P(name): return prod_map.get(name)

# ── Define recipes ─────────────────────────────────────────────────────────────
# (product_name, ingredient_name, qty_needed)
RECIPES = [
    # ── Coffee Hot ────────────────────────────────────────────────────────────
    ("Espresso",       "Espresso Shot",    36),   # double shot 36ml
    ("Espresso",       "Sugar",             5),

    ("Americano",      "Espresso Shot",    36),
    ("Americano",      "Sugar",             5),

    ("Cappuccino",     "Espresso Shot",    36),
    ("Cappuccino",     "Whole Milk",      120),
    ("Cappuccino",     "Sugar",             5),

    ("Latte",          "Espresso Shot",    36),
    ("Latte",          "Whole Milk",      180),
    ("Latte",          "Sugar",             5),

    ("Flat White",     "Espresso Shot",    36),
    ("Flat White",     "Whole Milk",      150),

    ("Macchiato",      "Espresso Shot",    36),
    ("Macchiato",      "Whole Milk",       30),

    ("Mocha",          "Espresso Shot",    36),
    ("Mocha",          "Whole Milk",      150),
    ("Mocha",          "Chocolate Powder", 20),
    ("Mocha",          "Sugar",            10),

    ("V60 Pour Over",  "Ground Coffee",    15),

    # ── Coffee Iced ───────────────────────────────────────────────────────────
    ("Iced Americano", "Espresso Shot",    36),
    ("Iced Americano", "Ice",             150),
    ("Iced Americano", "Sugar",             5),

    ("Iced Latte",     "Espresso Shot",    36),
    ("Iced Latte",     "Whole Milk",      180),
    ("Iced Latte",     "Ice",             150),
    ("Iced Latte",     "Sugar",             5),

    ("Iced Cappuccino","Espresso Shot",    36),
    ("Iced Cappuccino","Whole Milk",      120),
    ("Iced Cappuccino","Ice",             150),

    ("Iced Mocha",     "Espresso Shot",    36),
    ("Iced Mocha",     "Whole Milk",      150),
    ("Iced Mocha",     "Chocolate Powder", 20),
    ("Iced Mocha",     "Ice",             150),
    ("Iced Mocha",     "Sugar",            10),

    ("Cold Brew",      "Ground Coffee",    30),
    ("Cold Brew",      "Ice",             100),

    ("Dalgona Coffee", "Espresso Shot",    36),
    ("Dalgona Coffee", "Whole Milk",      200),
    ("Dalgona Coffee", "Sugar",            15),

    # ── Non-Coffee ────────────────────────────────────────────────────────────
    ("Matcha Latte",      "Matcha Powder",   10),
    ("Matcha Latte",      "Whole Milk",      180),
    ("Matcha Latte",      "Sugar",            10),

    ("Iced Matcha Latte", "Matcha Powder",   10),
    ("Iced Matcha Latte", "Whole Milk",      180),
    ("Iced Matcha Latte", "Ice",             150),
    ("Iced Matcha Latte", "Sugar",            10),

    ("Taro Latte",        "Taro Powder",     25),
    ("Taro Latte",        "Whole Milk",      180),
    ("Taro Latte",        "Sugar",            10),

    ("Chocolate",         "Chocolate Powder",25),
    ("Chocolate",         "Whole Milk",      180),
    ("Chocolate",         "Sugar",            10),

    ("Iced Chocolate",    "Chocolate Powder",25),
    ("Iced Chocolate",    "Whole Milk",      180),
    ("Iced Chocolate",    "Ice",             150),
    ("Iced Chocolate",    "Sugar",            10),

    ("Chai Latte",        "Chai Powder",     15),
    ("Chai Latte",        "Whole Milk",      180),
    ("Chai Latte",        "Sugar",            10),

    ("Strawberry Latte",  "Strawberry Syrup",30),
    ("Strawberry Latte",  "Whole Milk",      180),
    ("Strawberry Latte",  "Ice",             150),

    # ── Drinks ────────────────────────────────────────────────────────────────
    ("Es Teh Manis",  "Tea Bag",          1),
    ("Es Teh Manis",  "Sugar",           15),
    ("Es Teh Manis",  "Ice",            150),

    ("Teh Tarik",     "Tea Bag",          1),
    ("Teh Tarik",     "Condensed Milk",  30),

    ("Jus Jeruk",     "Orange",           2),
    ("Jus Jeruk",     "Sugar",           10),

    ("Jus Alpukat",   "Avocado",        100),
    ("Jus Alpukat",   "Condensed Milk",  30),
    ("Jus Alpukat",   "Sugar",           10),

    ("Lemon Tea",     "Tea Bag",          1),
    ("Lemon Tea",     "Lemon",            1),
    ("Lemon Tea",     "Sugar",           10),
    ("Lemon Tea",     "Ice",            100),

    ("Air Mineral",       "Water Bottle",   1),
    ("Sparkling Water",   "Sparkling Water",1),

    # ── Food ─────────────────────────────────────────────────────────────────
    ("Croissant",       "Croissant",          1),
    ("Butter Toast",    "Bread Slice",        2),
    ("Butter Toast",    "Butter",            15),
    ("Avocado Toast",   "Bread Slice",        2),
    ("Avocado Toast",   "Avocado",          100),
    ("Cheesecake",      "Cheesecake Slice",   1),
    ("Tiramisu",        "Tiramisu Slice",     1),
    ("Brownies",        "Brownies",           1),
    ("Banana Bread",    "Banana Bread Slice", 1),
    ("Nasi Goreng",     "Nasi Goreng",        1),
    ("Sandwich Tuna",   "Sandwich Tuna",      1),
    ("Pasta Carbonara", "Pasta Carbonara",    1),
]

created = 0
skipped = 0
for prod_name, ingr_name, qty in RECIPES:
    pid = P(prod_name)
    iid = I(ingr_name)
    if not pid:
        print(f"  ⚠ product not found: {prod_name}")
        skipped += 1
        continue
    if not iid:
        print(f"  ⚠ ingredient not found: {ingr_name}")
        skipped += 1
        continue
    r, code = req("POST", "/api/collections/recipes/records", {
        "product": pid, "ingredient": iid, "qty_needed": qty,
    }, token=token)
    if code == 200:
        created += 1
    else:
        print(f"  ✗ recipe {prod_name}→{ingr_name}: {r.get('message','?')}")
        skipped += 1

print(f"\n✓ created {created} recipe entries")
if skipped: print(f"  ⚠ skipped {skipped}")
print(f"\n📋 Summary:")
print(f"  Ingredients: {len(ingr_map)}")
print(f"  Recipe entries: {created}")
print(f"  Products covered: {len(set(p for p,_,_ in RECIPES if P(p) and I(_)))}")
