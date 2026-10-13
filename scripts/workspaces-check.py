"""Native signup, school registration, delegated posting and shared-feed browser journey."""
import os,subprocess,uuid,json
from playwright.sync_api import sync_playwright
base=os.environ.get('APP_URL','http://127.0.0.1:3103');marker=uuid.uuid4().hex[:8];password='workspace-browser-check-password'
node=os.environ.get('NODE_BINARY','node')
admin_email=f'workspace-qa-admin-{marker}@example.test'
result=subprocess.run([node,'scripts/create-super-admin.mjs','--email',admin_email,'--name','Workspace QA super admin '+marker],input=password+'\n',text=True,capture_output=True);assert result.returncode==0,result.stderr
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'),args=['--no-sandbox']);pages=[];errors=[];workspace=None
 def account(kind):
  page=browser.new_page(viewport={'width':1440,'height':1000});pages.append(page);page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'/?section=account')
  if kind!='admin':page.get_by_role('button',name='Create account',exact=True).click();page.get_by_label('Display name',exact=True).fill('Workspace QA '+kind+' '+marker)
  email=admin_email if kind=='admin' else f'workspace-qa-{kind}-{marker}@example.test'
  page.get_by_label('Email',exact=True).fill(email);page.get_by_label('Password',exact=True).fill(password)
  page.locator('.account-form').get_by_role('button',name='Sign in to your account' if kind=='admin' else 'Create my account',exact=True).click();page.get_by_role('heading',name='A place for your school. A voice for your street.',exact=True).wait_for();page.locator('.avatar').wait_for();return page,email
 owner,owner_email=account('owner');delegate,delegate_email=account('delegate');admin,_=account('admin')
 try:
  owner.get_by_role('button',name='Register a workspace',exact=True).click();owner.get_by_label('Workspace name',exact=True).fill('Workspace QA school '+marker);owner.locator('[name=type]').select_option('school');owner.get_by_label('General area',exact=True).fill('QA public area');owner.get_by_label('About your school or community',exact=True).fill('Temporary school registration for an automated browser check.');owner.get_by_role('button',name='Submit registration for review',exact=True).click();owner.get_by_text('Your registration is awaiting platform review.',exact=False).wait_for();workspace=owner.url.split('community=')[1]
  admin.get_by_role('button',name='Platform admin',exact=True).click();admin.get_by_label('Workspace review note',exact=True).fill('Reviewed browser fixture. This is not a real registered school.');card=admin.locator('article.card').filter(has=admin.get_by_role('heading',name='Workspace QA school '+marker,exact=True));card.get_by_role('button',name='Approve workspace',exact=True).click();card.wait_for(state='detached')
  owner.reload();owner.get_by_role('button',name='Publish an update',exact=True).wait_for();owner.get_by_label('Add an admin by registered email',exact=True).fill(delegate_email);owner.get_by_role('button',name='Add posting admin',exact=True).click();owner.get_by_text('Workspace admin added.',exact=False).wait_for()
  delegate.goto(base+'/?section=communities&community='+workspace);delegate.get_by_role('button',name='Publish an update',exact=True).click();delegate.get_by_label('Post title',exact=True).fill('Workspace QA shared update '+marker);delegate.get_by_label('Your update',exact=True).fill('An automated announcement to check workspace posting and the general platform feed.');delegate.get_by_role('button',name='Publish post',exact=True).click();delegate.get_by_role('heading',name='Workspace QA shared update '+marker,exact=True).wait_for()
  public=browser.new_page(viewport={'width':1440,'height':1000});pages.append(public);public.on('pageerror',lambda e:errors.append(str(e)));public.goto(base);public.get_by_role('heading',name='Workspace QA shared update '+marker,exact=True).wait_for();assert not public.get_by_text(delegate_email,exact=True).count()
  public.goto(base+'/?section=communities&community='+workspace);public.get_by_role('heading',name='Workspace QA shared update '+marker,exact=True).wait_for();assert public.get_by_role('button',name='Publish an update',exact=True).count()==0
  for page in pages:
   for width in [320,390,768]:
    page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(page.url,width)
  assert not errors,errors;print('PASS: native signup/super-admin login, private school registration, platform approval, delegate assignment, scoped publishing, public aggregate feed, public privacy and mobile layouts; zero browser errors')
 finally:
  if workspace:owner.request.delete(base+'/api/communities/'+workspace)
  for page in [owner,delegate,admin]:
   result=page.request.delete(base+'/api/account');assert result.status==200,result.text()
 browser.close()
