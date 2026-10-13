"""Translator and community-language review browser checks (local runner)."""
import os,uuid
from playwright.sync_api import sync_playwright
base=os.environ.get("APP_URL","http://127.0.0.1:3103")
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE"),args=["--no-sandbox"])
 page=browser.new_page(viewport={"width":1440,"height":1000});errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto(base+"/signin-with-chatgpt?return_to=/")
 page.get_by_role("button",name="Translator",exact=True).click()
 page.get_by_label("Your text").fill("QA source phrase "+uuid.uuid4().hex[:8])
 page.get_by_label("Target language",exact=True).select_option("idu")
 page.get_by_role("checkbox").check();page.get_by_role("button",name="Translate text",exact=True).click()
 page.get_by_text("A reviewed translation is not available yet.",exact=False).wait_for()
 page.get_by_role("button",name="Contribute a translation",exact=True).click()
 page.get_by_label("Your translation",exact=True).fill("QA reviewer fixture — workflow test, not a real Idoma translation")
 page.get_by_role("button",name="Submit for review",exact=True).click()
 page.get_by_text("Translation submitted for language review.",exact=False).wait_for()
 records=page.request.get(base+"/api/records?mine=1").json()["records"]
 record=next(r for r in records if r["kind"]=="translation" and r["data"]["original"].startswith("QA source phrase"))
 assert record["status"]=="pending"
 try:
  assert not any(r["id"]==record["id"] for r in page.request.get(base+"/api/records").json()["records"])
  res=page.request.patch(base+"/api/records/"+record["id"],data={"status":"approved","note":"Automated workflow fixture. Not a real language translation."});assert res.status==200,res.text()
  page.get_by_role("button",name="Translate text",exact=True).click();page.get_by_text("Community reviewed · Reviewed translation",exact=True).wait_for()
  page.get_by_label("Preferred language").select_option("ig");assert page.get_by_role("button",name="Bọọdụ ọrụ",exact=True).count()
  page.reload();assert page.get_by_label("Preferred language").input_value()=="ig"
  page.set_viewport_size({"width":390,"height":844});assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
  assert not errors,errors;print("PASS: Idoma unavailable state, private contribution, review, approved lookup, Igbo navigation persistence, mobile and zero browser errors")
 finally:page.request.delete(base+"/api/records/"+record["id"])
 browser.close()
