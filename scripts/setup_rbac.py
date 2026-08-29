"""
Add role field to users collection + assign roles + update PB rules for RBAC.
Roles: admin (full), staff (operational), maid (POS only)
"""
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

def ok(label):  print(f"  ✅ {label}")
def fail(label, detail=""): print(f"  ❌ {label}{' — '+str(detail) if detail else ''}")
def section(t): print(f"\n{'─'*55}\n  {t}\n{'─'*55}")

# ── Auth ──────────────────────────────────────────────────────────────────────
section("1. Auth")
r, code = req("POST", "/api/collections/_superusers/auth-with-password",
    {"identity": "admin@luna.pos", "password": "Admin@2026!"})
token = r["token"]; ok("Superuser auth")

# ── Add role field to users collection ───────────────────────────────────────
section("2. Add role field to users collection")
users_col, _ = req("GET", "/api/collections/users", token=token)
col_id = users_col["id"]

# Check if role field already exists
existing_fields = [f["name"] for f in users_col.get("fields", [])]
if "role" in existing_fields:
    ok("role field already exists")
else:
    # Add role field as select
    new_fields = users_col.get("fields", []) + [{
        "name": "role",
        "type": "select",
        "required": True,
        "options": {
            "maxSelect": 1,
            "values": ["admin", "staff", "maid"]
        }
    }]
    r, code = req("PATCH", f"/api/collections/{col_id}", {"fields": new_fields}, token=token)
    if code == 200:
        ok("role field added (select: admin/staff/maid)")
    else:
        fail("Add role field", r.get("message","?"))

# ── Assign roles to existing users ───────────────────────────────────────────
section("3. Assign roles to existing users")
users, _ = req("GET", "/api/collections/users/records?perPage=100", token=token)

ROLE_MAP = {
    "admin@cafecash.pos":  "admin",
    "admin@luna.pos":      "admin",
    "staff@cafecash.pos":  "staff",
    "staff@luna.pos":      "staff",
    "tablet@cafecash.pos": "maid",   # will be deleted next, but assign first
}

for u in users.get("items", []):
    email = u["email"]
    role  = ROLE_MAP.get(email)
    if not role:
        role = "staff"  # default for unknown users
        print(f"  ⚠️  Unknown user {email} → defaulting to staff")
    if u.get("role") == role:
        ok(f"{email:35s} → {role} (already set)")
        continue
    r, code = req("PATCH", f"/api/collections/users/records/{u['id']}",
        {"role": role}, token=token)
    if code == 200:
        ok(f"{email:35s} → {role}")
    else:
        fail(f"{email}", r.get("message","?"))

# ── Delete tablet service account ────────────────────────────────────────────
section("4. Delete tablet service account")
tablet = next((u for u in users.get("items", []) if u["email"] == "tablet@cafecash.pos"), None)
if tablet:
    r, code = req("DELETE", f"/api/collections/users/records/{tablet['id']}", token=token)
    ok("Deleted tablet@cafecash.pos") if code == 204 else fail("Delete tablet", r.get("message","?"))
else:
    ok("tablet@cafecash.pos already gone")

# ── Update PocketBase collection rules ───────────────────────────────────────
section("5. Update collection rules with role-based access")

cols, _ = req("GET", "/api/collections?perPage=100", token=token)
col_map  = {c["name"]: c["id"] for c in cols.get("items", [])}

ADMIN_OR_STAFF = "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'staff')"
ADMIN_ONLY     = "@request.auth.id != '' && @request.auth.role = 'admin'"
AUTH_ANY       = "@request.auth.id != ''"
OPEN           = ""

RULES = {
    "products": {
        "listRule":   OPEN,              # tablet reads menu
        "viewRule":   OPEN,
        "createRule": ADMIN_OR_STAFF,    # admin + staff can create
        "updateRule": ADMIN_OR_STAFF,    # admin + staff can update
        "deleteRule": ADMIN_ONLY,        # admin only can delete
    },
    "orders": {
        "listRule":   AUTH_ANY,          # maid + admin + staff can list
        "viewRule":   AUTH_ANY,
        "createRule": AUTH_ANY,          # maid creates orders
        "updateRule": AUTH_ANY,          # maid updates orders
        "deleteRule": ADMIN_ONLY,        # admin only
    },
    "order_items": {
        "listRule":   AUTH_ANY,
        "viewRule":   AUTH_ANY,
        "createRule": AUTH_ANY,          # maid creates items
        "updateRule": AUTH_ANY,
        "deleteRule": AUTH_ANY,          # maid deletes items (edit order)
    },
    "settings": {
        "listRule":   OPEN,              # tablet reads store name + QRIS
        "viewRule":   OPEN,
        "createRule": ADMIN_ONLY,
        "updateRule": ADMIN_ONLY,
        "deleteRule": ADMIN_ONLY,
    },
    "ingredients": {
        "listRule":   ADMIN_OR_STAFF,
        "viewRule":   ADMIN_OR_STAFF,
        "createRule": ADMIN_OR_STAFF,
        "updateRule": AUTH_ANY,          # maid updates stock_qty
        "deleteRule": ADMIN_ONLY,
    },
    "recipes": {
        "listRule":   OPEN,              # tablet reads recipes for stock deduction
        "viewRule":   OPEN,
        "createRule": ADMIN_OR_STAFF,
        "updateRule": ADMIN_OR_STAFF,
        "deleteRule": ADMIN_ONLY,
    },
    "stock_purchases": {
        "listRule":   ADMIN_OR_STAFF,
        "viewRule":   ADMIN_OR_STAFF,
        "createRule": ADMIN_OR_STAFF,
        "updateRule": ADMIN_OR_STAFF,
        "deleteRule": ADMIN_ONLY,
    },
    "stock_adjustments": {
        "listRule":   ADMIN_OR_STAFF,
        "viewRule":   ADMIN_OR_STAFF,
        "createRule": AUTH_ANY,          # maid creates adjustment logs
        "updateRule": ADMIN_OR_STAFF,
        "deleteRule": ADMIN_ONLY,
    },
}

for col_name, rules in RULES.items():
    col_id = col_map.get(col_name)
    if not col_id:
        print(f"  ⚠️  {col_name} not found"); continue
    r, code = req("PATCH", f"/api/collections/{col_id}", rules, token=token)
    ok(f"{col_name:25s} rules updated") if code == 200 else fail(col_name, r.get("message","?"))

print(f"\n{'═'*55}")
print(f"  RBAC schema done. Next: update app code.")
print(f"{'═'*55}\n")
