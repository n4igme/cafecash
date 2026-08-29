"""
Lock down PocketBase collection rules for public hosting.
Also creates a tablet service account.

Run after confirming you want to go public.
Safe to run on Tailscale-local instance first for testing.
"""
import json, urllib.request, urllib.error, secrets, string

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

def section(title): print(f"\n{'─'*55}\n  {title}\n{'─'*55}")

# ── Auth ─────────────────────────────────────────────────────────────────────
section("1. Auth")
r, code = req("POST", "/api/collections/_superusers/auth-with-password",
    {"identity": "admin@luna.pos", "password": "Admin@2026!"})
if code != 200:
    print(f"  ❌ Auth failed: {r.get('message')}"); exit(1)
token = r["token"]
print(f"  ✅ Superuser auth OK")

# ── Get all collections ───────────────────────────────────────────────────────
section("2. Fetch collections")
cols, _ = req("GET", "/api/collections?perPage=100", token=token)
col_map = {c["name"]: c["id"] for c in cols.get("items", [])}
print(f"  ✅ Found {len(col_map)} collections: {', '.join(col_map.keys())}")

# ── Define target rules ───────────────────────────────────────────────────────
# auth_only  = "@request.auth.id != ''"
# public     = ""  (open)
# denied     = None (no access)

AUTH  = "@request.auth.id != ''"
OPEN  = ""

RULES = {
    "products": {
        "listRule":   OPEN,   # tablet needs to read menu
        "viewRule":   OPEN,
        "createRule": AUTH,   # admin only
        "updateRule": AUTH,
        "deleteRule": AUTH,
    },
    "orders": {
        "listRule":   AUTH,   # admin only — tablet uses service account
        "viewRule":   AUTH,
        "createRule": OPEN,   # tablet creates orders (service account or anon)
        "updateRule": OPEN,   # tablet updates order (add items, pay)
        "deleteRule": AUTH,   # admin only
    },
    "order_items": {
        "listRule":   AUTH,
        "viewRule":   AUTH,
        "createRule": OPEN,   # tablet creates items
        "updateRule": OPEN,
        "deleteRule": OPEN,   # tablet deletes items (edit order)
    },
    "settings": {
        "listRule":   OPEN,   # tablet reads QRIS + store name
        "viewRule":   OPEN,
        "createRule": AUTH,
        "updateRule": AUTH,
        "deleteRule": AUTH,
    },
    "ingredients": {
        "listRule":   AUTH,   # sensitive business data
        "viewRule":   AUTH,
        "createRule": AUTH,
        "updateRule": OPEN,   # tablet updates stock_qty via stock.ts
        "deleteRule": AUTH,
    },
    "recipes": {
        "listRule":   OPEN,   # tablet reads recipes for grey-out + stock deduction
        "viewRule":   OPEN,
        "createRule": AUTH,
        "updateRule": AUTH,
        "deleteRule": AUTH,
    },
    "stock_purchases": {
        "listRule":   AUTH,
        "viewRule":   AUTH,
        "createRule": AUTH,
        "updateRule": AUTH,
        "deleteRule": AUTH,
    },
    "stock_adjustments": {
        "listRule":   AUTH,
        "viewRule":   AUTH,
        "createRule": OPEN,   # tablet creates adjustment logs
        "updateRule": AUTH,
        "deleteRule": AUTH,
    },
}

# ── Apply rules ───────────────────────────────────────────────────────────────
section("3. Apply collection rules")
for col_name, rules in RULES.items():
    col_id = col_map.get(col_name)
    if not col_id:
        print(f"  ⚠️  Collection '{col_name}' not found — skipping")
        continue
    r, code = req("PATCH", f"/api/collections/{col_id}", rules, token=token)
    if code == 200:
        print(f"  ✅ {col_name:20s} locked")
    else:
        print(f"  ❌ {col_name}: {r.get('message','?')}")

# ── Create tablet service account ─────────────────────────────────────────────
section("4. Tablet service account")

TABLET_EMAIL    = "tablet@cafecash.pos"
# Generate a strong random password
TABLET_PASSWORD = "Tablet@" + ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16)) + "!"

# Check if already exists
existing, _ = req("GET", f"/api/collections/users/records?filter=email='{TABLET_EMAIL}'", token=token)
if existing.get("totalItems", 0) > 0:
    user_id = existing["items"][0]["id"]
    # Update password to new one
    r, code = req("PATCH", f"/api/collections/users/records/{user_id}",
        {"password": TABLET_PASSWORD, "passwordConfirm": TABLET_PASSWORD}, token=token)
    if code == 200:
        print(f"  ✅ Tablet account updated: {TABLET_EMAIL}")
    else:
        print(f"  ❌ Update failed: {r.get('message','?')}")
else:
    r, code = req("POST", "/api/collections/users/records", {
        "email":           TABLET_EMAIL,
        "password":        TABLET_PASSWORD,
        "passwordConfirm": TABLET_PASSWORD,
        "emailVisibility": True,
    }, token=token)
    if code == 200:
        print(f"  ✅ Tablet account created: {TABLET_EMAIL}")
    else:
        print(f"  ❌ Create failed: {r.get('message','?')}")

# Verify login
r2, code2 = req("POST", "/api/collections/users/auth-with-password",
    {"identity": TABLET_EMAIL, "password": TABLET_PASSWORD})
if code2 == 200:
    print(f"  ✅ Tablet login verified")
else:
    print(f"  ❌ Tablet login failed: {r2.get('message','?')}")

# ── Write .env snippet ────────────────────────────────────────────────────────
section("5. Environment variables")
env_snippet = f"EXPO_PUBLIC_TABLET_EMAIL={TABLET_EMAIL}\nEXPO_PUBLIC_TABLET_PASSWORD={TABLET_PASSWORD}\n"
print(f"  Add to apps/tablet/.env:\n")
print(f"    {env_snippet.strip().replace(chr(10), chr(10)+'    ')}")

# Save to file for the next step
with open("scripts/.tablet_credentials", "w") as f:
    f.write(env_snippet)
print(f"\n  ✅ Saved to scripts/.tablet_credentials")

print(f"\n{'═'*55}")
print(f"  Security hardening complete.")
print(f"  Next: run scripts/apply_tablet_auth.py to update .env + rebuild APK")
print(f"{'═'*55}\n")
