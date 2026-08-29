"""Set realistic stock quantities: 50 servings worth per ingredient based on recipes."""
import json, urllib.request, urllib.error

BASE = "http://127.0.0.1:8091"

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

# Auth
token = req("POST", "/api/collections/_superusers/auth-with-password",
    {"identity": "admin@luna.pos", "password": "Admin@2026!"})[0]["token"]

# Fetch
ingredients = req("GET", "/api/collections/ingredients/records?perPage=200", token=token)[0]["items"]
recipes     = req("GET", "/api/collections/recipes/records?perPage=500",     token=token)[0]["items"]

ingr_map = {i["id"]: i for i in ingredients}

# For each ingredient compute max qty_needed across all recipes × 50 servings
qty_map = {}  # ingr_id → max_qty_needed
for rec in recipes:
    iid = rec["ingredient"]
    qty_map[iid] = max(qty_map.get(iid, 0), rec["qty_needed"])

updated = 0
for ingr in ingredients:
    max_q = qty_map.get(ingr["id"], 0)
    # 50 servings minimum; for pre-made food items (pcs) use 20
    if ingr["unit"] == "pcs":
        new_stock = 20
    elif max_q > 0:
        new_stock = max_q * 50
    else:
        new_stock = ingr["stock_qty"]  # keep if no recipe

    # Also update alert_qty = 10 servings worth
    if ingr["unit"] == "pcs":
        new_alert = 5
    elif max_q > 0:
        new_alert = max_q * 10
    else:
        new_alert = ingr["alert_qty"]

    r, code = req("PATCH", f"/api/collections/ingredients/records/{ingr['id']}",
        {"stock_qty": new_stock, "alert_qty": new_alert}, token=token)
    if code == 200:
        updated += 1
        print(f"  ✅ {ingr['name']:25s} → stock: {new_stock:6} {ingr['unit']:5}  alert: {new_alert} {ingr['unit']}")
    else:
        print(f"  ❌ {ingr['name']}: {r.get('message','?')}")

print(f"\n✓ Updated {updated}/{len(ingredients)} ingredients")
