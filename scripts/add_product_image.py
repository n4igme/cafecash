"""Add 'image' file field to products collection."""
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

# Get current products schema
col, _ = req("GET", "/api/collections/products", token=token)
fields = col.get("fields", [])
existing = [f["name"] for f in fields]
print("existing fields:", existing)

if "image" not in existing:
    fields.append({
        "name": "image",
        "type": "file",
        "required": False,
        "maxSelect": 1,
        "maxSize": 5242880,
        "mimeTypes": ["image/png", "image/jpeg", "image/webp", "image/gif"]
    })
    r, code = req("PATCH", "/api/collections/products", {"fields": fields}, token=token)
    if code == 200:
        print("✓ added 'image' file field to products")
    else:
        print(f"✗ failed: {code} — {r}")
else:
    print("  'image' field already exists")
