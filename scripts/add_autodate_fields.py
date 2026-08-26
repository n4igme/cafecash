"""Add created/updated autodate fields to all collections."""
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

# Superuser auth
token = req("POST", "/api/collections/_superusers/auth-with-password",
    {"identity": "admin@luna.pos", "password": "Admin@2026!"})[0]["token"]
print("✓ superuser auth")

AUTODATE_FIELDS = [
    {"name": "created", "type": "autodate", "onCreate": True,  "onUpdate": False},
    {"name": "updated", "type": "autodate", "onCreate": True,  "onUpdate": True},
]

COLLECTIONS = ["products", "orders", "order_items", "settings"]

for col in COLLECTIONS:
    # Get current schema
    d, code = req("GET", f"/api/collections/{col}", token=token)
    if code != 200:
        print(f"✗ {col}: GET failed {code}")
        continue

    existing_names = [f["name"] for f in d.get("fields", [])]
    fields_to_add = [f for f in AUTODATE_FIELDS if f["name"] not in existing_names]

    if not fields_to_add:
        print(f"  {col}: autodate fields already present")
        continue

    new_fields = d["fields"] + fields_to_add
    r, code = req("PATCH", f"/api/collections/{col}", {"fields": new_fields}, token=token)
    if code == 200:
        added = [f["name"] for f in fields_to_add]
        print(f"✓ {col}: added {added}")
    else:
        print(f"✗ {col}: PATCH failed {code} — {r}")

print("\n✓ done")
