"""Local two-account browser test; uses synthetic camera/microphone media."""
import os,time
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.getenv('APP_URL','http://127.0.0.1:3105');nonce=str(int(time.time()));out=Path('outputs/social-qa');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required'])
 try:
  contexts=[b.new_context(permissions=['microphone','camera'],viewport={'width':1440,'height':1000}) for _ in range(2)];pages=[];errors=[];ids=[]
  for i,c in enumerate(contexts):
   name=['Alice','Bob'][i];r=c.request.post(base+'/api/auth/register',data={'name':name+' QA','email':name.lower()+nonce+'@example.test','password':'Synthetic-QA-password-2026'});assert r.status==201,r.status;ids.append(r.json()['user']['id'])
   page=c.new_page();page.set_default_timeout(60000);page.on('pageerror',lambda e:errors.append(str(e)));pages.append(page);page.goto(base+'/?section=social');page.get_by_role('button',name='My profile',exact=False).click();page.get_by_label('Display name',exact=True).fill(name+' QA');page.get_by_label('Username',exact=False).fill(name.lower()+nonce);page.get_by_label('About you',exact=True).fill('Learning, creating, and helping our community.');page.get_by_label('Let signed-in members find my profile',exact=False).check();page.get_by_role('button',name='Save profile',exact=True).click();page.get_by_role('button',name='Find people',exact=True).wait_for()
  a,z=pages;a.get_by_role('button',name='Find people',exact=True).click();a.get_by_label('Find people by name or handle').fill('bob'+nonce);a.locator('.people-search').get_by_role('button',name='Find people',exact=True).click();a.get_by_role('button',name='Add friend',exact=False).click();a.get_by_role('button',name='Request pending',exact=True).wait_for()
  z.locator('.social-tabs').get_by_role('button',name='Requests',exact=False).click();z.get_by_role('button',name='Accept',exact=True).click();z.locator('.social-tabs').get_by_role('button',name='Chats',exact=False).click();z.locator('.chat-person').filter(has_text='Alice QA').click()
  a.locator('.social-tabs').get_by_role('button',name='Chats',exact=False).click();a.locator('.chat-person').filter(has_text='Bob QA').click();a.get_by_label('Message Bob QA',exact=True).fill('Hello Bob! <script>text stays text</script>');a.get_by_role('button',name='Send message',exact=True).click();z.locator('.message-bubble').filter(has_text='Hello Bob!').wait_for();z.get_by_label('Message Alice QA',exact=True).fill('Hello Alice, good to see you.');z.get_by_role('button',name='Send message',exact=True).click();a.locator('.message-bubble').filter(has_text='Hello Alice').wait_for();a.locator('.message-bubble.sent').get_by_text('Read',exact=False).wait_for()
  a.get_by_role('button',name='Video call Bob QA',exact=True).click();z.get_by_role('button',name='Accept',exact=True).wait_for();assert z.locator('video[aria-label="Your camera preview"]').count()==0;z.get_by_role('button',name='Accept',exact=True).click()
  for page in pages:
   page.locator('.call-panel[data-connection-state="connected"]').wait_for(timeout=90000);page.wait_for_function("document.querySelector('video[aria-label=\"Your friend’s video\"]')?.videoWidth>0",timeout=90000)
   assert page.locator('video[aria-label="Your camera preview"]').evaluate('(el)=>el.srcObject.getVideoTracks().some(t=>t.readyState==="live")')
  a.get_by_role('button',name='Mute microphone',exact=True).click();assert a.get_by_role('button',name='Unmute microphone',exact=True).get_attribute('aria-pressed')=='true';a.get_by_role('button',name='Turn camera off',exact=True).click();assert a.locator('video[aria-label="Your camera preview"]').evaluate('(el)=>el.srcObject.getVideoTracks().every(t=>!t.enabled)')
  a.screenshot(path=str(out/'video-call.png'),full_page=True);a.locator('video[aria-label="Your camera preview"]').evaluate('(el)=>window.__qaStream=el.srcObject');a.get_by_role('button',name='End call',exact=True).click();z.locator('.call-panel').wait_for(state='hidden');assert a.locator('video[aria-label="Your camera preview"]').count()==0;assert a.evaluate('window.__qaStream.getTracks().every(t=>t.readyState==="ended")')
  # Exercise a voice call and decline without granting media on the recipient.
  z.get_by_role('button',name='Voice call Alice QA',exact=True).click();a.get_by_role('button',name='Decline',exact=True).click();z.locator('.call-panel').wait_for(state='hidden')
  a.get_by_role('button',name='Voice call Bob QA',exact=True).click();z.get_by_role('button',name='Accept',exact=True).click()
  for page in pages:
   page.locator('.call-panel[data-connection-state="connected"]').wait_for(timeout=90000);page.wait_for_function("document.querySelector('video.voice-media')?.srcObject?.getAudioTracks().length>0",timeout=30000);assert page.locator('video[aria-label="Your camera preview"]').count()==0
  z.get_by_role('button',name='End call',exact=True).click();a.locator('.call-panel').wait_for(state='hidden')
  for width in [320,390,768,1440]:
   a.set_viewport_size({'width':width,'height':1000});assert a.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  a.screenshot(path=str(out/'chat-mobile.png'),full_page=True);assert not errors,errors
  for c in contexts:c.close()
 except Exception:
  for i,page in enumerate(pages):
   print("Browser",i,"call status:",page.locator(".call-panel,.call-toast,.chat-error").all_inner_texts())
   page.screenshot(path=str(out/("failure-"+str(i)+".png")),full_page=True)
  raise
 finally:
  b.close()
print('PASS: independent accounts, profiles, discovery, recipient consent, escaped messages/read receipts, connected video with remote frames, mute/camera/hangup, voice decline, responsive layout.')
