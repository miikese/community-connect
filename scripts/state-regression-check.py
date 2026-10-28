"""Browser regression for stale listing history, using intercepted API fixtures.

No database records are created, modified, or deleted. Run against APP_URL
(default port 3103) after building the local preview.
"""
import os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

expect.set_options(timeout=20000)

base = os.environ.get("APP_URL", "http://127.0.0.1:3103")
def record(key, title):
    return {"id": key, "kind": "issue", "status": "verified", "data": {"title": title, "description": "A browser-only fixture for checking independent listing history.", "category": "Road", "lga": "Otukpo", "area": "Public QA area", "lat": 7.19, "lng": 8.13}, "created": "2026-01-01", "updated": "2026-01-01"}
first, second = record("qa-a", "First QA listing"), record("qa-b", "Second QA listing")
opportunity = {**record("qa-opportunity", "QA volunteer opportunity"), "kind": "opportunity", "status": "approved"}
opportunity["data"]["category"] = "Volunteer"
skill = {**record("qa-skill", "QA programming skill"), "kind": "skill", "status": "approved"}
skill["data"]["category"] = "Programming"
with sync_playwright() as p:
    executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
    browser = p.chromium.launch(**({"executable_path": executable} if executable else {}), args=["--no-sandbox", "--disable-gpu"])
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, service_workers="block")
    errors, pending = [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    def route_api(route):
        path = urlparse(route.request.url).path
        if path == "/api/records/qa-a":
            pending.append(route)
            return
        if path == "/api/records/qa-b":
            data = {"record": second, "history": [{"status": "verified", "created": "2026-01-01", "note": "Second listing history only"}]}
        elif path == "/api/records":
            data = {"records": [] if "mine=1" in route.request.url else [first, second, opportunity, skill]}
        elif path == "/api/me":
            data = {"user": None, "notifications": []}
        elif path == "/api/actions":
            data = {"actions": []}
        elif "community" in path:
            data = {"communities": [], "posts": [], "workspaces": [], "updates": []}
        else:
            data = {}
        route.fulfill(json=data)
    page.route("**/api/**", route_api)
    page.goto(base)
    page.get_by_role("button", name="First QA listing", exact=False).click()
    expect(page.get_by_text("Loading this listing’s history…", exact=True)).to_be_visible()
    page.get_by_role("button", name="Close listing details", exact=True).click()
    page.get_by_role("button", name="Second QA listing", exact=False).click()
    expect(page.get_by_text("Second listing history only", exact=True)).to_be_visible()
    assert pending, "First listing history request was not intercepted"
    pending[0].fulfill(json={"record": first, "history": [{"status": "verified", "created": "2026-01-01", "note": "Outdated first listing history"}]})
    page.wait_for_timeout(150)
    expect(page.get_by_role("heading", name="Second QA listing", exact=True)).to_be_visible()
    expect(page.get_by_text("Second listing history only", exact=True)).to_be_visible()
    expect(page.get_by_text("Outdated first listing history", exact=True)).to_have_count(0)
    page.get_by_role("button", name="Close listing details", exact=True).click()
    # Issue-only statuses must not silently filter opportunity or skill lists.
    page.get_by_label("Filter by status", exact=True).select_option("resolved")
    page.get_by_role("button", name="Have time to give?", exact=False).click()
    expect(page.get_by_role("button", name="QA volunteer opportunity", exact=False)).to_be_visible()
    page.get_by_role("button", name="Action board", exact=True).click()
    page.get_by_label("Filter by status", exact=True).select_option("resolved")
    page.get_by_role("button", name="Have a skill to share?", exact=False).click()
    expect(page.get_by_role("button", name="QA programming skill", exact=False)).to_be_visible()
    assert not errors, errors
    browser.close()
print("PASS: switching listings ignores delayed history; issue status filters do not hide opportunities or skills.")
