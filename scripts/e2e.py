"""UI reporting, moderation, volunteer and community board journeys."""
import os,time,json
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
base=os.environ.get("APP_URL","http://127.0.0.1:3103")
for _ in range(60):
 try:
  if urlopen(base+"/api/health",timeout=2).status==200:break
 except Exception:time.sleep(1)
else:raise RuntimeError("Local app did not start")
with sync_playwright()as p:
 executable=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
 browser=p.chromium.launch(**({"executable_path":executable}if executable else{}),headless=True,args=["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"])
 page=browser.new_page(viewport={"width":1440,"height":1000})
 errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto(base+"/signin-with-chatgpt?return_to=/")
 for old in page.request.get(base+"/api/records?mine=1").json()["records"]:
  if str(old["data"].get("title","")).startswith("Browser QA"):page.request.delete(base+"/api/records/"+old["id"])
 page.get_by_role("button",name="Report a concern",exact=False).click()
 def fill(title):
  page.get_by_label("Title",exact=True).fill(title)
  page.get_by_label("General area / public landmark").fill("Test public area")
  page.get_by_label("Approximate latitude").fill("7.192563")
  page.get_by_label("Approximate longitude").fill("8.132858")
  page.get_by_label("Submission description").fill("Temporary automated test submission. Removed after testing.")
 def submit():
  page.get_by_role("button",name="Submit for review",exact=True).click()
  page.get_by_text("Thank you. Your",exact=False).wait_for()
 def mine(title):
  return next(r for r in page.request.get(base+"/api/records?mine=1").json()["records"]if r["data"].get("title")==title)
 def moderate(title,target):
  page.get_by_role("button",name="Review submissions",exact=True).click()
  page.get_by_label("Review note / supporting evidence").fill("Automated browser test evidence; this is not a real public listing.")
  card=page.locator("article.card").filter(has=page.get_by_role("heading",name=title,exact=True))
  card.get_by_role("button",name=target,exact=True).click()
  card.locator(".pill").filter(has_text=target).wait_for()
 fill("Browser QA public issue");submit()
 issue=mine("Browser QA public issue");assert issue["status"]=="submitted"
 assert issue["data"]["lat"]==7.19 and issue["data"]["lng"]==8.13
 assert not any(r["id"]==issue["id"]for r in page.request.get(base+"/api/records").json()["records"])
 moderate("Browser QA public issue","awaiting-review");moderate("Browser QA public issue","verified")
 page.goto(base+"/?record="+issue["id"])
 page.get_by_role("heading",name="Browser QA public issue",exact=True).wait_for()
 page.get_by_role("button",name="Follow issue",exact=True).click()
 page.get_by_text("Saved.",exact=False).wait_for()
 page.get_by_role("button",name="Close listing details",exact=True).click()
 for state in ["acknowledged","in-progress","resolved","closed"]:moderate("Browser QA public issue",state)
 assert len(page.request.get(base+"/api/records/"+issue["id"]).json()["history"])==7
 page.get_by_role("button",name="Organization hub",exact=True).click()
 page.get_by_role("button",name="Register organization",exact=True).click()
 fill("Browser QA organization");submit();org=mine("Browser QA organization")
 moderate("Browser QA organization","approved")
 page.get_by_role("button",name="Organization hub",exact=True).click()
 page.get_by_role("button",name="Create opportunity",exact=True).click()
 fill("Browser QA volunteer opportunity")
 page.get_by_label("Approved organization",exact=True).select_option(org["id"])
 page.get_by_label("Application / participation instructions").fill("Join this temporary test activity.")
 submit();opportunity=mine("Browser QA volunteer opportunity")
 moderate("Browser QA volunteer opportunity","approved")
 page.goto(base+"/?record="+opportunity["id"])
 page.get_by_role("heading",name="Browser QA volunteer opportunity",exact=True).wait_for()
 page.get_by_role("button",name="Join activity",exact=True).click()
 page.get_by_text("Saved.",exact=False).wait_for()
 assert any(a["type"]=="join"and a["record"]==opportunity["id"]for a in page.request.get(base+"/api/actions").json()["actions"])
 page.get_by_role("button",name="Close listing details",exact=True).click()
 page.get_by_role("button",name="Organization hub",exact=True).click()
 page.get_by_role("heading",name="Volunteer registrations",exact=True).wait_for()
 assert page.request.get(base+"/api/participants").json()["participants"]
 # Skills, notices, lost/found and assistance forms all submit real moderated records.
 for tab,category,title in [("Skills network","Programming","Browser QA skill"),("Community notices","Meeting","Browser QA notice"),("Lost & found","Found","Browser QA belonging"),("Support requests","Education","Browser QA support")]:
  page.get_by_role("button",name=tab,exact=True).click()
  page.get_by_role("button",name="Create a listing",exact=False).first.click()
  fill(title);page.get_by_label("Category",exact=True).select_option(label=category)
  submit();assert mine(title)["status"]=="pending"
 # Remove every browser fixture and participation before capture.
 for r in page.request.get(base+"/api/records?mine=1").json()["records"]:
  if str(r["data"].get("title","")).startswith("Browser QA"):assert page.request.delete(base+"/api/records/"+r["id"]).status==200
 page.goto(base+"/signout-with-chatgpt?return_to=/")
 page.get_by_role("heading",name="Good things happen when we come together.",exact=True).wait_for()
 page.screenshot(path="docs/screenshots/desktop.png",full_page=True)
 page.set_viewport_size({"width":390,"height":844});page.reload()
 page.get_by_role("heading",name="Good things happen when we come together.",exact=True).wait_for()
 assert page.evaluate("document.documentElement.scrollWidth<=window.innerWidth"),"Mobile overflow"
 page.get_by_role("button",name="Open navigation",exact=True).click()
 page.get_by_role("button",name="Opportunities",exact=True).click()
 page.get_by_role("heading",name="Find your next chance to contribute.",exact=True).wait_for()
 page.goto(base);page.get_by_role("heading",name="Good things happen when we come together.",exact=True).wait_for()
 page.screenshot(path="docs/screenshots/mobile.png",full_page=True)
 # Exercise compact phones, tablets and desktop after the complete feature journey.
 for width in [320,390,768,1440]:
  page.set_viewport_size({"width":width,"height":844});page.goto(base)
  assert page.evaluate("document.documentElement.scrollWidth<=window.innerWidth"),("Horizontal overflow",width)
 assert not errors,errors
 browser.close()
print("PASS: private reporting; rounded coordinates; complete moderation lifecycle; follow; reviewed organization; volunteer opportunity and join; skills/notices/lost/support submissions; cleanup; desktop/mobile. No browser errors.")
