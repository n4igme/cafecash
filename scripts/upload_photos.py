"""Upload product photos — loremflickr with colored PNG fallback."""
import json, urllib.request, urllib.error, urllib.parse
import os, tempfile, time, zlib, struct, http.client

BASE = "http://127.0.0.1:8091"

def req_json(method, path, data=None, token=None):
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

def make_png(r, g, b, size=400):
    """Generate a solid-color PNG in pure Python (no PIL needed)."""
    def chunk(name, data):
        c = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)

    w = h = size
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
    raw_rows = b''
    row = b'\x00' + bytes([r, g, b] * w)  # filter byte + RGB pixels
    raw_rows = row * h
    idat = zlib.compress(raw_rows, 9)

    return (
        b'\x89PNG\r\n\x1a\n' +
        chunk(b'IHDR', ihdr) +
        chunk(b'IDAT', idat) +
        chunk(b'IEND', b'')
    )

# Category colors (warm, cafe-style)
COLORS = {
    'Coffee':     (101, 67,  33),   # dark brown
    'Non-Coffee': (72,  130, 90),   # green
    'Drinks':     (52,  120, 180),  # blue
    'Food':       (200, 140, 60),   # warm orange
}

def download_image(keyword, dest_path):
    url = f"https://loremflickr.com/400/400/{urllib.parse.quote(keyword)}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    })
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = resp.read()
            if len(data) > 5000:
                with open(dest_path, 'wb') as f: f.write(data)
                return True
    except Exception:
        pass
    return False

def upload_photo(product_id, image_path, token, is_png=False):
    boundary = "----CafeCashBoundary7x"
    mime = "image/png" if is_png else "image/jpeg"
    fname = "product.png" if is_png else "product.jpg"
    with open(image_path, 'rb') as f:
        img_data = f.read()
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="{fname}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    ).encode() + img_data + f"\r\n--{boundary}--\r\n".encode()
    conn = http.client.HTTPConnection("127.0.0.1", 8091)
    conn.request("PATCH", f"/api/collections/products/records/{product_id}",
        body, {"Content-Type": f"multipart/form-data; boundary={boundary}", "Authorization": token})
    resp = conn.getresponse()
    result = json.loads(resp.read())
    conn.close()
    return resp.status == 200, result

# Auth
token = req_json("POST", "/api/collections/_superusers/auth-with-password",
    {"identity": "admin@luna.pos", "password": "Admin@2026!"})[0]["token"]
print("✓ Auth\n")

products = req_json("GET", "/api/collections/products/records?perPage=100", token=token)[0]["items"]
print(f"✓ {len(products)} products\n")

KEYWORDS = {
    "Espresso": "espresso coffee",
    "Americano": "americano coffee",
    "Cappuccino": "cappuccino coffee",
    "Latte": "latte coffee",
    "Flat White": "flat white coffee",
    "Macchiato": "macchiato coffee",
    "Mocha": "mocha coffee",
    "V60 Pour Over": "pour over coffee",
    "Iced Americano": "iced coffee",
    "Iced Latte": "iced latte",
    "Iced Cappuccino": "iced cappuccino",
    "Iced Mocha": "iced mocha",
    "Cold Brew": "cold brew coffee",
    "Dalgona Coffee": "dalgona coffee",
    "Matcha Latte": "matcha latte",
    "Iced Matcha Latte": "matcha green tea",
    "Taro Latte": "taro drink purple",
    "Chocolate": "hot chocolate",
    "Iced Chocolate": "iced chocolate",
    "Chai Latte": "chai latte",
    "Strawberry Latte": "strawberry drink",
    "Es Teh Manis": "iced tea sweet",
    "Teh Tarik": "milk tea",
    "Jus Jeruk": "orange juice",
    "Jus Alpukat": "avocado juice",
    "Lemon Tea": "lemon tea",
    "Air Mineral": "mineral water",
    "Sparkling Water": "sparkling water",
    "Croissant": "croissant pastry",
    "Butter Toast": "butter toast",
    "Avocado Toast": "avocado toast",
    "Cheesecake": "cheesecake",
    "Tiramisu": "tiramisu",
    "Brownies": "chocolate brownies",
    "Banana Bread": "banana bread",
    "Nasi Goreng": "nasi goreng",
    "Sandwich Tuna": "tuna sandwich",
    "Pasta Carbonara": "pasta carbonara",
}

ok_count = skip = fail = 0
with tempfile.TemporaryDirectory() as tmpdir:
    for p in products:
        name = p["name"]
        if p.get("image"):
            print(f"  ⏭  {name}")
            skip += 1
            continue

        keyword  = KEYWORDS.get(name, name)
        img_path = os.path.join(tmpdir, f"{p['id']}.jpg")
        png_path = os.path.join(tmpdir, f"{p['id']}.png")
        print(f"  ⬇  {name}", end="", flush=True)

        if download_image(keyword, img_path):
            success, result = upload_photo(p["id"], img_path, token)
            if success:
                print(f" → ✅ photo")
                ok_count += 1
            else:
                print(f" → ❌ upload: {result.get('message','?')}")
                fail += 1
        else:
            # Fallback: colored PNG
            cat   = p.get("category", "Coffee")
            color = COLORS.get(cat, (100, 100, 100))
            png   = make_png(*color)
            with open(png_path, 'wb') as f: f.write(png)
            success, result = upload_photo(p["id"], png_path, token, is_png=True)
            if success:
                print(f" → 🎨 placeholder ({cat})")
                ok_count += 1
            else:
                print(f" → ❌ {result.get('message','?')}")
                fail += 1

        time.sleep(0.2)

print(f"\n{'='*50}")
print(f"  ✅ {ok_count} uploaded  ⏭  {skip} skipped  ❌ {fail} failed")
print(f"{'='*50}")
