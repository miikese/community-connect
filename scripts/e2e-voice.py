"""Uses only synthetic accounts in the isolated social QA database."""
import sqlite3,os
from playwright.sync_api import sync_playwright
base=os.getenv('APP_URL','http://127.0.0.1:3105');db=sqlite3.connect('/tmp/community-social-qa/data.sqlite');emails=[r[0] for r in db.execute('SELECT email FROM credentials ORDER BY rowid DESC LIMIT 2')]
assert len(emails)==2
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']);pages=[];contexts=[]
 try:
  for email in emails:
   c=b.new_context(permissions=['microphone','camera']);contexts.append(c);assert c.request.post(base+'/api/auth/login',data={'email':email,'password':'Synthetic-QA-password-2026'}).status==200
   c.add_init_script('''window.__qaStreams=[];const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{const s=await get(c);window.__qaStreams.push(s);return s}''')
   pg=c.new_page();pg.set_default_timeout(60000);pg.goto(base+'/?section=social');pg.locator('.chat-person').first.click();pages.append(pg)
  a,z=pages;a.get_by_role('button',name='Voice call',exact=False).click();z.get_by_role('button',name='Accept',exact=True).click()
  for pg in pages:
   pg.locator('.call-panel[data-connection-state="connected"]').wait_for(timeout=90000);pg.wait_for_function("document.querySelector('video.voice-media')?.srcObject?.getAudioTracks().length>0",timeout=30000);assert pg.locator('video[aria-label="Your camera preview"]').count()==0;assert pg.evaluate('window.__qaStreams.at(-1).getVideoTracks().length===0')
  a.get_by_role('button',name='Mute microphone',exact=True).click();assert a.evaluate('window.__qaStreams.at(-1).getAudioTracks().every(t=>!t.enabled)')
  z.get_by_role('button',name='End call',exact=True).click();a.locator('.call-panel').wait_for(state='hidden')
  for pg in pages:assert pg.evaluate('window.__qaStreams.every(s=>s.getTracks().every(t=>t.readyState==="ended"))')
 finally:b.close()
print('PASS: actual connected voice call, remote audio tracks, microphone mute, no camera capture, and device release at hangup.')
