"""Create stock management collections: ingredients, recipes, stock_purchases, stock_adjustments"""
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
print("✓ superuser auth")

cols = req("GET", "/api/collections?perPage=50", token=token)[0]
existing = {c["name"] for c in cols.get("items", [])}
print("existing:", [c for c in existing if not c.startswith("_")])

# ── ingredients ───────────────────────────────────────────────────────────────
if "ingredients" not in existing:
    r, code = req("POST", "/api/collections", {
        "name": "ingredients", "type": "base",
        "fields": [
            {"name": "name",           "type": "text",   "required": True, "presentable": True},
            {"name": "unit",           "type": "select", "required": True,
             "values": ["ml", "gram", "pcs"], "maxSelect": 1},
            {"name": "stock_qty",      "type": "number", "required": False, "min": 0},
            {"name": "alert_qty",      "type": "number", "required": False, "min": 0},
            {"name": "cost_per_unit",  "type": "number", "required": False, "min": 0},
            {"name": "created", "type": "autodate", "onCreate": True,  "onUpdate": False},
            {"name": "updated", "type": "autodate", "onCreate": True,  "onUpdate": True},
        ],
        "listRule": "", "viewRule": "", "createRule": "@request.auth.id != ''",
        "updateRule": "", "deleteRule": "@request.auth.id != ''",
    }, token=token)
    print(f"✓ ingredients: {r.get('id','?')[:8] if code==200 else r}")
else:
    print("  ingredients: exists")

# ── recipes ───────────────────────────────────────────────────────────────────
ingr_id = req("GET", "/api/collections/ingredients", token=token)[0].get("id","")
prod_id = req("GET", "/api/collections/products",    token=token)[0].get("id","")

if "recipes" not in existing:
    r, code = req("POST", "/api/collections", {
        "name": "recipes", "type": "base",
        "fields": [
            {"name": "product",    "type": "relation", "required": True,
             "collectionId": prod_id, "cascadeDelete": True, "maxSelect": 1},
            {"name": "ingredient", "type": "relation", "required": True,
             "collectionId": ingr_id, "cascadeDelete": True, "maxSelect": 1},
            {"name": "qty_needed", "type": "number", "required": True, "min": 0},
            {"name": "created", "type": "autodate", "onCreate": True, "onUpdate": False},
            {"name": "updated", "type": "autodate", "onCreate": True, "onUpdate": True},
        ],
        "listRule": "", "viewRule": "", "createRule": "@request.auth.id != ''",
        "updateRule": "@request.auth.id != ''", "deleteRule": "@request.auth.id != ''",
    }, token=token)
    print(f"✓ recipes: {r.get('id','?')[:8] if code==200 else r}")
else:
    print("  recipes: exists")

# ── stock_purchases ───────────────────────────────────────────────────────────
if "stock_purchases" not in existing:
    r, code = req("POST", "/api/collections", {
        "name": "stock_purchases", "type": "base",
        "fields": [
            {"name": "ingredient",   "type": "relation", "required": True,
             "collectionId": ingr_id, "cascadeDelete": False, "maxSelect": 1},
            {"name": "qty",          "type": "number", "required": True, "min": 0},
            {"name": "price_total",  "type": "number", "required": False, "min": 0},
            {"name": "note",         "type": "text",   "required": False},
            {"name": "created", "type": "autodate", "onCreate": True, "onUpdate": False},
            {"name": "updated", "type": "autodate", "onCreate": True, "onUpdate": True},
        ],
        "listRule": "@request.auth.id != ''", "viewRule": "@request.auth.id != ''",
        "createRule": "@request.auth.id != ''",
        "updateRule": "@request.auth.id != ''", "deleteRule": "@request.auth.id != ''",
    }, token=token)
    print(f"✓ stock_purchases: {r.get('id','?')[:8] if code==200 else r}")
else:
    print("  stock_purchases: exists")

# ── stock_adjustments ─────────────────────────────────────────────────────────
if "stock_adjustments" not in existing:
    r, code = req("POST", "/api/collections", {
        "name": "stock_adjustments", "type": "base",
        "fields": [
            {"name": "ingredient",  "type": "relation", "required": True,
             "collectionId": ingr_id, "cascadeDelete": False, "maxSelect": 1},
            {"name": "qty_change",  "type": "number", "required": True},
            {"name": "reason",      "type": "select", "required": True,
             "values": ["purchase", "waste", "correction", "spoilage", "order_deduct", "order_restore"],
             "maxSelect": 1},
            {"name": "note",        "type": "text",   "required": False},
            {"name": "order",       "type": "relation", "required": False,
             "collectionId": req("GET", "/api/collections/orders", token=token)[0].get("id",""),
             "cascadeDelete": False, "maxSelect": 1},
            {"name": "created", "type": "autodate", "onCreate": True, "onUpdate": False},
            {"name": "updated", "type": "autodate", "onCreate": True, "onUpdate": True},
        ],
        "listRule": "@request.auth.id != ''", "viewRule": "@request.auth.id != ''",
        "createRule": "", "updateRule": "@request.auth.id != ''",
        "deleteRule": "@request.auth.id != ''",
    }, token=token)
    print(f"✓ stock_adjustments: {r.get('id','?')[:8] if code==200 else r}")
else:
    print("  stock_adjustments: exists")

print("\n✓ All stock collections ready")
