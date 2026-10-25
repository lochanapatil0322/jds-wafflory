"""
Security checks for JD's Wafflory.
Only run this against YOUR OWN server. Start the backend first, then run:
    python security_test.py
"""
import base64
import hashlib
import hmac
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:8000"
FAR_FUTURE = 4102444800  # the year 2100

lines = []
counts = {"PASS": 0, "FAIL": 0, "WARN": 0, "SKIP": 0}


def say(text=""):
    print(text.encode("ascii", "replace").decode())
    lines.append(text)


def record(kind, name, detail=""):
    counts[kind] += 1
    say(f"[{kind}] {name}" + (f"  ({detail})" if detail else ""))


def check(name, ok, detail="", warn=False):
    record("PASS" if ok else ("WARN" if warn else "FAIL"), name, detail)


def call(method, path, body=None, form=None, raw=None, headers=None):
    hdrs = dict(headers or {})
    data = None
    if raw is not None:
        data = raw
    elif body is not None:
        data = json.dumps(body).encode()
        hdrs["Content-Type"] = "application/json"
    elif form is not None:
        data = urllib.parse.urlencode(form).encode()
        hdrs["Content-Type"] = "application/x-www-form-urlencoded"
    request = urllib.request.Request(BASE + path, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status, dict(response.headers), response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as err:
        return err.code, dict(err.headers), err.read().decode("utf-8", "replace")


def header(headers, name):
    for key, value in headers.items():
        if key.lower() == name:
            return value
    return None


def b64(obj):
    return base64.urlsafe_b64encode(json.dumps(obj, separators=(",", ":")).encode()).rstrip(b"=").decode()


def sign(secret, claims):
    head = b64({"alg": "HS256", "typ": "JWT"})
    body = b64(claims)
    sig = hmac.new(secret.encode(), f"{head}.{body}".encode(), hashlib.sha256).digest()
    return f"{head}.{body}." + base64.urlsafe_b64encode(sig).rstrip(b"=").decode()


try:
    call("GET", "/")
except Exception:
    print(f"Cannot reach the backend at {BASE}. Start it first, then run this again.")
    sys.exit(1)

# ------------------------------------------------------------------
say("== 1. Admin routes without a login ==")
protected = [
    ("GET", "/auth/me"),
    ("GET", "/admin/orders"),
    ("GET", "/admin/menu"),
    ("GET", "/admin/reports/daily"),
    ("PATCH", "/admin/orders/1/status"),
    ("PATCH", "/admin/orders/1/paid"),
    ("PATCH", "/admin/availability"),
    ("PATCH", "/admin/variants/1/price"),
    ("POST", "/admin/items"),
    ("PATCH", "/admin/items/1"),
]
for method, path in protected:
    status, _, _ = call(method, path, body=None if method == "GET" else {})
    check(f"{method} {path} without a token is refused", status == 401, f"status {status}")

# ------------------------------------------------------------------
say("\n== 2. Fake login tokens ==")
claims = {"sub": "1", "role": "owner", "exp": FAR_FUTURE}
tokens = {
    "random text": "not-a-real-token",
    "three random parts": "aaa.bbb.ccc",
    "unsigned token (alg none)": f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64(claims)}.",
}
for weak in ["secret", "changeme", "your-secret-key"]:
    tokens[f"signed with the guessable secret '{weak}'"] = sign(weak, claims)
for label, token in tokens.items():
    status, _, _ = call("GET", "/admin/orders", headers={"Authorization": f"Bearer {token}"})
    check(f"Token: {label} is refused", status == 401, f"status {status}")

# ------------------------------------------------------------------
say("\n== 3. CORS and response headers ==")
_, hdrs, _ = call("GET", "/menu?branch_id=1", headers={"Origin": "https://evil.example"})
allowed = header(hdrs, "access-control-allow-origin")
check("A foreign website is not allowed to read the API (CORS)",
      allowed not in ("*", "https://evil.example"), f"allow-origin: {allowed}")
_, hdrs, _ = call("GET", "/menu?branch_id=1", headers={"Origin": "http://localhost:5173"})
check("Our own website is allowed", header(hdrs, "access-control-allow-origin") == "http://localhost:5173")

_, hdrs, _ = call("GET", "/")
check("Header X-Content-Type-Options is nosniff", header(hdrs, "x-content-type-options") == "nosniff")
check("Header X-Frame-Options stops other sites framing us",
      header(hdrs, "x-frame-options") in ("DENY", "SAMEORIGIN"))
_, hdrs, _ = call("GET", "/auth/me")
check("Private answers are not cached (Cache-Control: no-store)",
      "no-store" in (header(hdrs, "cache-control") or ""))

# ------------------------------------------------------------------
say("\n== 4. Bad input is refused ==")
good_line = {"item_id": 1, "variant_id": 1, "quantity": 1}
base = {
    "branch_id": 1,
    "customer_name": "Test",
    "customer_phone": "9000000002",
    "order_type": "dine_in",
    "pickup_in_minutes": 15,
    "items": [good_line],
}


def with_changes(**changes):
    return {**base, **changes}


cases = [
    ("quantity 500", with_changes(items=[{**good_line, "quantity": 500}])),
    ("quantity 0", with_changes(items=[{**good_line, "quantity": 0}])),
    ("an empty cart", with_changes(items=[])),
    ("100 lines in the cart", with_changes(items=[good_line] * 100)),
    ("a phone number that is too short", with_changes(customer_phone="12345")),
    ("letters in the phone number", with_changes(customer_phone="98765abcde")),
    ("a 10000 character name", with_changes(customer_name="A" * 10000)),
    ("a pickup time of 7 minutes", with_changes(pickup_in_minutes=7)),
    ("the order type 'delivery'", with_changes(order_type="delivery")),
    ("a branch id that is text", with_changes(branch_id="abc")),
]
for label, payload in cases:
    status, _, _ = call("POST", "/orders", body=payload)
    check(f"Order with {label} is refused", status == 422, f"status {status}")

status, _, text = call("POST", "/orders", raw=b"{this is not json", headers={"Content-Type": "application/json"})
check("Broken JSON is refused without leaking code details",
      status == 422 and "Traceback" not in text and "site-packages" not in text, f"status {status}")

for label, branch in [("a branch that does not exist", 99999), ("a negative branch id", -1)]:
    status, _, _ = call("POST", "/orders", body=with_changes(branch_id=branch))
    check(f"Order for {label} gives 404", status == 404, f"status {status}")

say("\n-- No server errors on strange values --")
strange = [
    ("GET", "/menu?branch_id=99999999999999999999", None),
    ("GET", "/menu?branch_id=-5", None),
    ("GET", "/menu?branch_id=1%27%20OR%20%271%27=%271", None),
    ("GET", "/orders/99999999999999999999?phone=9876543210", None),
    ("POST", "/orders", with_changes(branch_id=10 ** 30)),
]
for method, path, payload in strange:
    status, _, _ = call(method, path, body=payload)
    check(f"{method} {path[:45]} causes no server error", status < 500, f"status {status}")

# ------------------------------------------------------------------
say("\n== 5. Orders and tracking (needs the shop to be 'open') ==")
placed = None
status, _, text = call("GET", "/menu?branch_id=1")
menu = json.loads(text) if status == 200 else None
if not menu:
    record("SKIP", "Order tests", "could not load the menu")
elif not menu["is_open"]:
    record("SKIP", "Order tests", "the shop is closed; run  python set_hours.py test  first")
else:
    options = [
        (item, variant)
        for category in menu["categories"]
        for item in category["items"]
        if item["is_available"]
        for variant in item["variants"]
    ]
    (item_a, var_a), (item_b, var_b) = options[0], options[-1]

    evil_name = "x'); DROP TABLE orders; --"
    payload = with_changes(
        customer_name=evil_name,
        pickup_in_minutes=10,
        items=[{"item_id": item_a["id"], "variant_id": var_a["id"], "quantity": 1, "price": 1}],
        total=1,
    )
    status, _, text = call("POST", "/orders", body=payload)
    if status == 201:
        placed = json.loads(text)
        check("A price sent by the browser is ignored",
              placed["total"] == var_a["price"],
              f"total {placed['total']}, real price {var_a['price']}")
        check("SQL text in the name is stored as plain text", placed["customer_name"] == evil_name)
        status2, _, _ = call("GET", "/menu?branch_id=1")
        check("The database still works after the SQL text", status2 == 200)
    else:
        record("FAIL", "The order with extra fields and SQL text was not accepted", f"status {status}: {text[:100]}")

    mismatch = with_changes(items=[{"item_id": item_a["id"], "variant_id": var_b["id"], "quantity": 1}])
    status, _, _ = call("POST", "/orders", body=mismatch)
    check("An item mixed with another item's price is refused", status == 400, f"status {status}")

if placed:
    order_id = placed["id"]
    status, _, _ = call("GET", f"/orders/{order_id}?phone=9000000002")
    check("Tracking with the right phone number works", status == 200, f"status {status}")
    wrong_status, _, wrong_text = call("GET", f"/orders/{order_id}?phone=9111111111")
    none_status, _, none_text = call("GET", "/orders/999999?phone=9111111111")
    check("Tracking with the wrong phone number is refused", wrong_status == 404, f"status {wrong_status}")
    check("A wrong phone and a missing order give the same answer",
          wrong_status == none_status and wrong_text == none_text)
    sweep = [call("GET", f"/orders/{i}?phone=9111111111")[0] for i in range(1, 6)]
    check("Reading other people's orders by counting numbers fails",
          all(code == 404 for code in sweep), f"statuses {sweep}")

# ------------------------------------------------------------------
say("\n== 6. Login ==")
status, _, _ = call("POST", "/auth/login", form={"username": "' OR '1'='1' --", "password": "x"})
check("SQL text in the login is refused", status == 401, f"status {status}")
status, _, text = call("POST", "/auth/login", form={"username": "9000000008", "password": "wrong"})
check("An unknown phone number gets the plain message",
      status == 401 and "Wrong phone number or password" in text, f"status {status}")
status, _, _ = call("POST", "/auth/login", form={"username": "9000000008", "password": "A" * 10000})
check("A 10000 character password causes no server error", status < 500, f"status {status}")
codes = [call("POST", "/auth/login", form={"username": "9000000009", "password": "wrong"})[0] for _ in range(6)]
check("Five wrong passwords lock that phone number", codes[:5] == [401] * 5 and codes[5] == 429, f"statuses {codes}")

# ------------------------------------------------------------------
say("\n== 7. Flooding ==")
codes = [call("POST", "/orders", body={})[0] for _ in range(40)]
check("Too many orders from one connection are slowed down (429)", 429 in codes)
codes = [call("GET", "/orders/1?phone=9222222222")[0] for _ in range(15)]
check("Too many wrong tracking tries are blocked (429)", 429 in codes)
codes = [
    call("POST", "/auth/login", form={"username": str(9000001000 + i), "password": "wrong"})[0]
    for i in range(30)
]
check("Too many wrong logins from one connection are blocked (429)", 429 in codes)

# ------------------------------------------------------------------
say("\n== 8. Deployment checks (a WARN is normal on your own computer) ==")
status, _, _ = call("GET", "/docs")
check("The API documentation page is hidden (/docs)", status == 404, f"status {status}", warn=True)
status, _, _ = call("GET", "/openapi.json")
check("The API description is hidden (/openapi.json)", status == 404, f"status {status}", warn=True)

say("\n" + "-" * 50)
say(f"PASS {counts['PASS']}   FAIL {counts['FAIL']}   WARN {counts['WARN']}   SKIP {counts['SKIP']}")
with open("security_results.txt", "w", encoding="utf-8") as saved:
    saved.write("\n".join(lines))
say("Saved to security_results.txt")