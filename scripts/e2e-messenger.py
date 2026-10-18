"""Local multi-account QA with synthetic browser microphone/camera streams."""
import os,time
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.getenv('APP_URL','http://127.0.0.1:3110');nonce=str(int(time.time()));out=Path('outputs/messenger-qa');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required'])
 contexts=[];pages=[];ids=[];errors=[]
 try:
  for name in ['Amina','Qasim','Zara']:
   context=browser.new_context(permissions=['microphone','camera'],viewport={'width':1440,'height':1000});contexts.append(context)
   response=context.request.post(base+'/api/auth/register',data={'name':name+' QA','email':name.lower()+nonce+'@example.test','password':'Synthetic-QA-password-2026','username':name.lower()+'_'+nonce,'discoverable':True});assert response.status==201,response.text();ids.append(response.json()['user']['id'])
  for i in [1,2]:
   assert contexts[0].request.post(base+'/api/social/friends',data={'peer':ids[i]}).status==201
   assert contexts[i].request.patch(base+'/api/social/friends',data={'peer':ids[0],'action':'accept'}).status==200
  for context in contexts:
   page=context.new_page();page.set_default_timeout(45000);page.on('pageerror',lambda error:errors.append(str(error)));page.goto(base+'/messages');page.get_by_role('button',name='Create a group',exact=True).wait_for();pages.append(page)
  a,b,c=pages
  a.get_by_role('button',name='Create a group',exact=True).click();a.get_by_label('Group name',exact=True).fill('Evening circle '+nonce)
  dialog=a.get_by_role('dialog',name='A group of your own.');dialog.locator('label').filter(has_text='Qasim QA').locator('input[type=checkbox]').check();dialog.locator('label').filter(has_text='Zara QA').locator('input[type=checkbox]').check();dialog.get_by_role('button',name='Create group',exact=True).click();dialog.wait_for(state='hidden')
  group_name='Evening circle '+nonce
  for page in [b,c]:page.locator('.chat-person').filter(has_text=group_name).click()
  for page in pages:page.get_by_label('Message '+group_name,exact=True).wait_for()
  a.get_by_label('Message '+group_name,exact=True).fill('Hello circle! <script>still text</script>');a.get_by_role('button',name='Send message',exact=True).click()
  for page in [b,c]:page.locator('.message-bubble').filter(has_text='Hello circle!').wait_for()
  a.locator('.receipt').filter(has_text='Read by all').wait_for();print('PASS group creation, membership, shared text and read-by-all receipts.',flush=True)
  b.locator('.conversation-tools details summary').click();b.get_by_role('button',name='Mark as unread',exact=True).click();b.get_by_role('group',name='Message inbox filters').get_by_role('button',name='Unread',exact=True).click();b.locator('.chat-person').filter(has_text=group_name).wait_for()
  row=b.locator('.inbox-row').filter(has=b.locator('.chat-person').filter(has_text=group_name));row.locator('summary').click();row.get_by_role('button',name='Mark as read',exact=True).click();b.get_by_text('You’re all caught up.',exact=True).wait_for()
  b.get_by_role('group',name='Message inbox filters').get_by_role('button',name='Read',exact=True).click();b.locator('.chat-person').filter(has_text=group_name).click();print('PASS unread reminders, mark-as-read and inbox filters.',flush=True)
  a.get_by_role('button',name='Record voice note',exact=True).click();a.get_by_role('button',name='Stop recording',exact=True).wait_for();a.wait_for_timeout(1700);a.get_by_role('button',name='Stop recording',exact=True).click();a.locator('.note-draft audio').wait_for();a.get_by_role('button',name='Send voice note',exact=True).click();audio=b.locator('.message-history audio').last;audio.wait_for();audio.evaluate('(el)=>el.play()');b.wait_for_function("document.querySelector('.message-history audio')?.currentTime>0.1")
  note_url=audio.get_attribute('src');response=contexts[1].request.get(base+note_url,headers={'Range':'bytes=0-15'});assert response.status==206 and len(response.body())==16
  stranger=browser.new_context();assert stranger.request.get(base+note_url).status==401;stranger.close();print('PASS real voice-note recording, private storage, playback and byte ranges.',flush=True)
  a.get_by_role('button',name='Record video note',exact=True).click();a.get_by_role('button',name='Stop recording',exact=True).wait_for();a.wait_for_timeout(1800);a.evaluate("window.__recording=document.querySelector('.note-camera-preview').srcObject");a.get_by_role('button',name='Stop recording',exact=True).click();a.get_by_role('button',name='Send video note',exact=True).wait_for();assert a.evaluate('window.__recording.getTracks().every(t=>t.readyState==="ended")');a.get_by_role('button',name='Send video note',exact=True).click();video=b.locator('.message-history .video-note video').last;video.wait_for();video.evaluate('(el)=>el.play()');b.wait_for_function("document.querySelector('.message-history .video-note video')?.videoWidth>0");print('PASS video-note recording, remote playback and camera cleanup.',flush=True)
  a.get_by_role('button',name='Group video call',exact=True).click()
  for page in [b,c]:page.locator('.group-call-invitation').get_by_role('button',name='Join call',exact=True).click()
  for page in pages:
   page.wait_for_function("document.querySelectorAll('.group-video-tile').length===3",timeout=90000)
   page.wait_for_function("Array.from(document.querySelectorAll('.group-video-tile[data-local=false] video')).filter(v=>v.srcObject&&v.videoWidth>0).length===2",timeout=120000)
  print('PASS 3-person WebRTC group video with remote frames on every participant.',flush=True)
  b.get_by_role('button',name='Mute group microphone',exact=True).click();assert b.locator('.group-video-tile[data-local=true] video').evaluate('(el)=>el.srcObject.getAudioTracks().every(t=>!t.enabled)')
  c.get_by_role('button',name='Turn group camera off',exact=True).click();assert c.locator('.group-video-tile[data-local=true] video').evaluate('(el)=>el.srcObject.getVideoTracks().every(t=>!t.enabled)')
  a.screenshot(path=str(out/'group-video-desktop.png'),full_page=True)
  b.evaluate("window.__callStream=document.querySelector('.group-video-tile[data-local=true] video').srcObject");b.get_by_role('button',name='Leave call',exact=True).click();b.locator('.group-call-panel').wait_for(state='hidden');assert b.evaluate('window.__callStream.getTracks().every(t=>t.readyState==="ended")');a.wait_for_function("document.querySelectorAll('.group-video-tile').length===2")
  a.get_by_role('button',name='End for everyone',exact=True).click();c.locator('.group-call-panel').wait_for(state='hidden');print('PASS group mute, camera toggle, leaving, host end and device cleanup.',flush=True)
  a.get_by_role('button',name='Group voice call',exact=True).click();c.locator('.group-call-invitation').get_by_role('button',name='Join call',exact=True).click()
  for page in [a,c]:
   page.wait_for_function("Array.from(document.querySelectorAll('.group-video-tile[data-local=false] video')).some(v=>v.srcObject?.getAudioTracks().length>0)",timeout=90000)
   assert page.locator('.group-video-tile[data-local=true] video').evaluate('(el)=>el.srcObject.getVideoTracks().length===0')
  a.get_by_role('button',name='End for everyone',exact=True).click();c.locator('.group-call-panel').wait_for(state='hidden');print('PASS voice group call without camera acquisition.',flush=True)
  for width in [320,390,768,1440]:
   a.set_viewport_size({'width':width,'height':1000});a.wait_for_timeout(200);assert a.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  a.screenshot(path=str(out/'messenger-desktop.png'),full_page=True);a.set_viewport_size({'width':390,'height':844});a.wait_for_timeout(500);a.screenshot(path=str(out/'messenger-mobile.png'),full_page=True)
  assert not errors,errors
 except Exception:
  for index,page in enumerate(pages):
   print('Browser',index,'status:',page.locator('.chat-error,.call-toast,.group-call-panel>header,.group-tile-label').all_inner_texts(),flush=True)
   page.screenshot(path=str(out/('failure-'+str(index)+'.png')),full_page=True)
  raise
 finally:
  for context in contexts:context.close()
  browser.close()
print('PASS all messenger browser checks.',flush=True)
