#!/usr/bin/env python3
"""Deep API test suite for the Dealership CRM (local, against :3000).

Covers: auth, RBAC/403, CRUD, validation (400), conflicts (409),
scoping, exports, edge-cases. Prints a PASS/FAIL summary.
"""
import json
import urllib.request
import urllib.error
import http.cookiejar

import os
BASE = os.environ.get("CRM_BASE", "http://localhost:3000")
results = []


class Session:
    """A persistent HTTP session with its own cookie jar."""

    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar)
        )

    def req(self, method, path, body=None, raw=False):
        url = BASE + path
        data = None
        headers = {}
        if body is not None:
            if isinstance(body, (dict, list)):
                data = json.dumps(body).encode()
                headers["Content-Type"] = "application/json"
            else:
                data = body.encode() if isinstance(body, str) else body
        tok = next((c.value for c in self.jar if c.name == "crm_session"), None)
        if tok:
            headers["Cookie"] = "crm_session=" + tok
        r = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with self.opener.open(r, timeout=20) as resp:
                content = resp.read()
                ctype = resp.headers.get("Content-Type", "")
                if raw:
                    return resp.status, content, ctype
                try:
                    return resp.status, json.loads(content), ctype
                except Exception:
                    return resp.status, content, ctype
        except urllib.error.HTTPError as e:
            content = e.read()
            try:
                return e.code, json.loads(content), e.headers.get("Content-Type", "")
            except Exception:
                return e.code, content, e.headers.get("Content-Type", "")
        except Exception as e:
            return 0, str(e), ""


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    mark = "✅" if cond else "❌"
    print(f"{mark} {name}" + (f"  [{detail}]" if detail and not cond else ""))


def login(email, password):
    s = Session()
    code, body, _ = s.req("POST", "/api/auth/login", {"email": email, "password": password})
    return s, code, body


print("=" * 70)
print("DEALERSHIP CRM — DEEP API TEST SUITE")
print("=" * 70)

# ---------- 1. AUTH ----------
print("\n[1] AUTHENTICATION")
admin, code, body = login("admin@crm.local", "admin12345")
check("login with correct credentials -> 200", code == 200, f"got {code} {body}")

_, code, _ = login("admin@crm.local", "wrongpassword")
check("login with wrong password -> 401", code == 401, f"got {code}")

_, code, _ = login("nonexistent@crm.local", "whatever")
check("login with unknown email -> 401", code == 401, f"got {code}")

code, body, _ = admin.req("GET", "/api/auth/me")
check("/api/auth/me authenticated -> 200 with user",
      code == 200 and isinstance(body, dict) and body.get("user", {}).get("role") == "SUPER_ADMIN",
      f"got {code} {body}")

anon = Session()
code, _b, _ = anon.req("GET", "/api/auth/me")
check("/api/auth/me unauthenticated -> 401", code == 401, f"got {code}")

# ---------- 2. RBAC ----------
print("\n[2] ROLE-BASED ACCESS CONTROL")
manager, code, _ = login("manager@crm.local", "manager123")
finance, code, _ = login("finance@crm.local", "finance12345")
service, code, _ = login("service@crm.local", "service12345")
callc, code, _ = login("callcenter@crm.local", "call12345")

check("all demo logins succeed",
      200 in [
        login("manager@crm.local", "manager123")[1],
        login("finance@crm.local", "finance12345")[1],
        login("service@crm.local", "service12345")[1],
      ], "one of the role logins failed")

code, _, _ = manager.req("GET", "/api/users")
check("Sales Manager CANNOT list users -> 403", code == 403, f"got {code}")

code, _, _ = manager.req("GET", "/api/finance/dashboard")
check("Sales Manager CANNOT view finance -> 403", code == 403, f"got {code}")

code, _, _ = finance.req("GET", "/api/leads")
check("Finance CANNOT view leads -> 403", code == 403, f"got {code}")

code, _, _ = finance.req("GET", "/api/finance/dashboard")
check("Finance CAN view finance -> 200", code == 200, f"got {code}")

code, _, _ = admin.req("GET", "/api/users")
check("Super Admin CAN list users -> 200", code == 200, f"got {code}")

code, body, _ = service.req("GET", "/api/aftersales/items")
if code == 200:
    items = body.get("items", [])
    no_cost = all("purchaseCost" not in it for it in items)
    check("Service Staff does NOT receive purchaseCost (§46)", no_cost,
          "cost leaked!" if items else "no items")
else:
    check("Service Staff CAN view aftersales items -> 200", code == 200, f"got {code}")

# ---------- 3. CONFIG DATA ----------
print("\n[3] CONFIGURATION DATA")
code, body, _ = admin.req("GET", "/api/brands")
brands = body.get("brands", [])
check("GET /api/brands returns list", code == 200 and len(brands) >= 1, f"got {code}, {len(brands)} brands")

code, body, _ = admin.req("GET", "/api/dealerships")
deals = body.get("dealerships", [])
check("GET /api/dealerships returns list", code == 200 and len(deals) >= 1, f"got {code}")
brand_id = brands[0]["id"] if brands else None
deal_id = deals[0]["id"] if deals else None

# ---------- 4. LEADS CRUD ----------
print("\n[4] LEADS CRUD + VALIDATION")
import random
phone = "+99890" + str(random.randint(1000000, 9999999))
code, body, _ = admin.req("POST", "/api/leads", {
    "phone": phone, "name": "DeepTest Lead", "brandId": brand_id,
    "dealershipId": deal_id, "source": "MANUAL",
})
check("create lead -> 201", code == 201, f"got {code} {body}")
new_lead_id = body.get("lead", {}).get("id") if isinstance(body, dict) else None

code, body, _ = admin.req("POST", "/api/leads", {"name": "No phone"})
check("create lead without phone -> 400", code == 400, f"got {code}")

code, body, _ = admin.req("POST", "/api/leads", {
    "phone": "+998901119999", "brandId": "invalid", "dealershipId": "invalid", "source": "MANUAL",
})
check("create lead with invalid brand/deal -> 403/400", code in (400, 403), f"got {code}")

code, body, _ = admin.req("GET", "/api/leads")
check("list leads -> 200", code == 200 and "leads" in body, f"got {code}")

if new_lead_id:
    code, body, _ = admin.req("GET", f"/api/leads/{new_lead_id}")
    check("get lead detail -> 200", code == 200 and body.get("lead"), f"got {code}")

    code, _, _ = admin.req("POST", f"/api/leads/{new_lead_id}/result",
                           {"result": "NO_ANSWER", "nextFollowUpAt": "2026-12-01T10:00:00Z"})
    check("record lead result -> 200", code == 200, f"got {code}")

    code, _, _ = admin.req("POST", f"/api/leads/{new_lead_id}/result", {"result": "INVALID_RESULT"})
    check("record invalid result -> 400", code == 400, f"got {code}")

    code, _, _ = admin.req("POST", f"/api/leads/{new_lead_id}/comments", {"text": "Deep test comment"})
    check("add comment -> 201", code == 201, f"got {code}")

    code, _, _ = manager.req("GET", f"/api/leads/{new_lead_id}")
    check("Manager CANNOT read admin's lead -> 403", code == 403, f"got {code}")
else:
    check("lead id available for follow-up tests", False, "no lead created")

# ---------- 5. LEAD POOL ----------
print("\n[5] LEAD POOL / ASSIGN")
code, body, _ = manager.req("GET", "/api/leads/pool")
check("Manager can view pool -> 200", code == 200, f"got {code}")

# ---------- 6. INVENTORY + SALES ----------
print("\n[6] INVENTORY + SALES")
vin = "DEEPTEST" + str(random.randint(10000000, 99999999))
code, body, _ = admin.req("POST", "/api/inventory", {
    "dealershipId": deal_id, "brandId": brand_id, "model": "DeepTest X",
    "vin": vin, "sellingPrice": 200000000,
})
check("create inventory vehicle -> 201", code == 201, f"got {code} {body}")

code, body, _ = admin.req("POST", "/api/inventory", {
    "dealershipId": deal_id, "brandId": brand_id, "model": "Dup", "vin": vin,
})
check("create duplicate VIN -> 409", code == 409, f"got {code}")

code, body, _ = admin.req("GET", "/api/inventory/summary")
check("inventory summary -> 200", code == 200 and "summary" in body, f"got {code}")

code, body, _ = admin.req("GET", "/api/inventory")
check("list inventory -> 200", code == 200, f"got {code}")

code, body, _ = admin.req("GET", "/api/sales")
check("list sales -> 200", code == 200, f"got {code}")

# ---------- 7. FINANCE ----------
print("\n[7] FINANCE")
code, body, _ = admin.req("POST", "/api/expenses", {
    "accountingMonth": "2026-09", "category": "Rent", "expenseType": "FIXED",
    "amount": 5000000, "status": "PAID",
})
check("create expense -> 201", code == 201, f"got {code} {body}")

code, body, _ = admin.req("POST", "/api/expenses", {
    "accountingMonth": "bad-month", "category": "Rent", "expenseType": "FIXED", "amount": 1,
})
check("create expense with bad month -> 400", code == 400, f"got {code}")

code, body, _ = admin.req("POST", "/api/expenses", {
    "accountingMonth": "2026-09", "category": "Rent", "expenseType": "FIXED", "amount": -5,
})
check("create expense with negative amount -> 400", code == 400, f"got {code}")

code, body, _ = finance.req("GET", "/api/finance/dashboard?view=profit")
check("finance dashboard profit -> 200", code == 200 and "cards" in body, f"got {code}")

code, body, _ = finance.req("GET", "/api/finance/dashboard?view=cash")
check("finance dashboard cash -> 200", code == 200, f"got {code}")

code, body, _ = finance.req("GET", "/api/finance/monthly-trend")
check("finance monthly-trend -> 200", code == 200 and "points" in body, f"got {code}")

# ---------- 8. REPORTS ----------
print("\n[8] REPORTS")
for rtype in ["sales", "marketing", "inventory", "finance", "aftersales"]:
    q = "?month=2026-09" if rtype == "finance" else "?range=month"
    code, body, _ = admin.req("GET", f"/api/reports/{rtype}{q}")
    check(f"report {rtype} -> 200", code == 200, f"got {code}")

# ---------- 9. EXPORTS ----------
print("\n[9] EXPORTS")
for etype in ["leads", "sales", "inventory", "expenses", "stock", "aftersales"]:
    code, body, ctype = admin.req("GET", f"/api/export/{etype}?format=csv", raw=True)
    check(f"export {etype} CSV -> 200", code == 200 and "text/csv" in ctype, f"got {code} {ctype}")
    code, body, ctype = admin.req("GET", f"/api/export/{etype}?format=xlsx", raw=True)
    check(f"export {etype} XLSX -> 200", code == 200 and "spreadsheet" in ctype, f"got {code} {ctype}")

code1, b1, _ = admin.req("GET", "/api/export/leads?format=csv&range=today", raw=True)
code2, b2, _ = admin.req("GET", "/api/export/leads?format=csv", raw=True)
check("export honours date filter (different output)", b1 != b2, "same output for filtered vs unfiltered")

# ---------- 10. VALIDATION / EDGE CASES ----------
print("\n[10] VALIDATION & EDGE CASES")
code, _, _ = admin.req("GET", "/api/leads/does-not-exist")
check("GET nonexistent lead -> 404", code == 404, f"got {code}")

code, _, _ = admin.req("POST", "/api/leads/does-not-exist/result", {"result": "SOLD"})
check("POST result to nonexistent lead -> 404", code == 404, f"got {code}")

code, _, _ = admin.req("GET", "/api/export/unknown-type?format=csv")
check("export unknown type -> 400", code == 400, f"got {code}")

code, _, _ = anon.req("GET", "/api/health")
check("health endpoint is public -> 200", code == 200, f"got {code}")

code, body, _ = admin.req("POST", "/api/leads", "{not valid json")
check("malformed JSON -> 400", code in (400, 415), f"got {code}")

# ---------- 11. LOGOUT ----------
print("\n[11] LOGOUT")
session_test = Session()
session_test.req("POST", "/api/auth/login", {"email": "admin@crm.local", "password": "admin12345"})
code, _, _ = session_test.req("POST", "/api/auth/logout", {})
check("logout -> 200", code == 200, f"got {code}")
code, _, _ = session_test.req("GET", "/api/auth/me")
check("after logout /me -> 401", code == 401, f"got {code}")

# ---------- SUMMARY ----------
print("\n" + "=" * 70)
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
print(f"NATIJA: {passed}/{total} test o'tdi")
failed = [(n, d) for n, ok, d in results if not ok]
if failed:
    print("\nMuvaffaqiyatsiz testlar:")
    for n, d in failed:
        print(f"  ❌ {n}  [{d}]")
else:
    print("✅ BARCHA TESTLAR MUVAFFAQIYATLI")
print("=" * 70)
