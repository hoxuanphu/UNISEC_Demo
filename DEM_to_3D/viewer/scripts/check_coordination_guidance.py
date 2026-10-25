"""Emergency notification, controlled travel guidance and resident route proposals."""
import argparse
import math
import re
from pathlib import Path
from playwright.sync_api import expect,sync_playwright


def run(url,chrome=None,captures=None):
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,**({'executable_path':chrome} if chrome else {}))
  context=browser.new_context(viewport={'width':1440,'height':960})
  context.add_init_script('Object.defineProperty(navigator,"onLine",{configurable:true,get:()=>false})')
  context.route('**/*',lambda r:r.continue_() if r.request.url.startswith((url+'/','data:','blob:')) else r.abort())
  admin=context.new_page();mobile=context.new_page();errors=[]
  for page in [admin,mobile]:page.on('pageerror',lambda e:errors.append(e.stack))
  try:
   admin.goto(url+'/?offline=1&map=3d&demoRole=manager&lang=en')
   expect(admin.locator('.incident-household-row').first).to_be_visible(timeout=45000)
   title=admin.locator('.incident-household-row .incident-landslide-copy strong').first
   assert title.bounding_box()['height']<25
   admin.get_by_role('button',name='Layers',exact=True).click()
   panel=admin.locator('.layers-panel');expect(panel).to_be_visible()
   symbols=panel.locator('.device-layer-sample .tracked-device-symbol')
   expect(symbols).to_have_count(2);a,b=symbols.nth(0).bounding_box(),symbols.nth(1).bounding_box();assert abs(a['y']-b['y'])<3
   assert panel.locator('[data-layer-stack="rescue"]').get_attribute('open') is not None
   assert panel.locator('.layers-content > :first-child').get_attribute('data-layer-stack')=='rescue'
   panel.get_by_role('checkbox',name='Not reached',exact=True).uncheck(timeout=5000)
   expect(panel.get_by_role('checkbox',name='Not reached',exact=True)).not_to_be_checked()
   panel.get_by_role('checkbox',name='Not reached',exact=True).check(timeout=5000)
   if captures:captures.mkdir(parents=True,exist_ok=True);admin.screenshot(path=str(captures/'layers-clear.png'))
   admin.keyboard.press('Escape')
   mobile.set_viewport_size({'width':390,'height':844});mobile.goto(url+'/?offline=1&map=2d&lang=en')
   mobile.get_by_label('Your name',exact=True).fill('A Phủ');mobile.get_by_role('button',name='Enter app',exact=True).click()
   expect(mobile.locator('.tracked-device[data-device-id="GPS-AP01"]')).to_have_attribute('data-motion','waiting',timeout=30000)
   expect(mobile.locator('.citizen-official-guidance')).to_be_visible()
   expect(mobile.locator('.map-road-route-line').first).to_be_attached()
   own=mobile.locator('.tracked-device[data-device-id="GPS-AP01"]')
   tracked=admin.locator('.tracked-device[data-device-id="GPS-AP01"]')
   def point(marker):return tuple(float(marker.get_attribute('data-world-'+axis)) for axis in ['x','y'])
   origin=point(own)
   def verify_shared_movement():
    expect(own).to_have_attribute('data-motion','moving',timeout=10000)
    admin.bring_to_front();expect(tracked).to_have_attribute('data-motion','moving',timeout=10000)
    row=admin.locator('[data-resident-device="GPS-AP01"]');expect(row.locator('.incident-status')).to_have_text('Moving')
    assert math.dist(point(own),point(tracked))<20,'Resident and coordinator positions diverged'
    for view in [admin,mobile]:assert not re.search(r'\b(?:demo|simulated|simulation)\b|mô phỏng|giả lập',view.locator('body').inner_text(),re.I)
    if captures:
     captures.mkdir(parents=True,exist_ok=True);admin.screenshot(path=str(captures/'resident-moving-admin.png'));mobile.screenshot(path=str(captures/'resident-moving-mobile.png'))
   mobile.locator('.citizen-official-guidance').get_by_role('button',name='Start',exact=True).click()
   verify_shared_movement()
   admin.reload();verify_shared_movement()  # Opening coordination cannot rewind the resident.
   # Reopening the resident screen prepares the same assigned route at its origin.
   mobile.bring_to_front();mobile.reload();expect(mobile.locator('.citizen-official-guidance')).to_be_visible(timeout=30000)
   expect(own).not_to_have_attribute('data-motion','moving');assert math.dist(origin,point(own))<1
   admin.bring_to_front();expect(tracked).not_to_have_attribute('data-motion','moving');assert math.dist(origin,point(tracked))<1
   mobile.bring_to_front();mobile.locator('.citizen-official-guidance').get_by_role('button',name='Start',exact=True).click()
   # Advance the current instruction's clock to exercise arrival without a long wait.
   mobile.evaluate('''()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('dear.resident-guidance.v1:'));const entries=JSON.parse(localStorage.getItem(key));for(const entry of entries)if(entry.recipientId==='GPS-AP01'){entry.startedAt=Date.now()-86400000;delete entry.pausedAt;}localStorage.setItem(key,JSON.stringify(entries));window.dispatchEvent(new Event('dear:guidance-changed'));}''')
   expect(own).to_have_attribute('data-motion','arrived');admin.bring_to_front();expect(tracked).to_have_attribute('data-motion','arrived')
   mobile.bring_to_front();mobile.get_by_role('button',name='My location',exact=True).click()
   expect(mobile.locator('.citizen-official-guidance')).to_be_visible();expect(own).not_to_have_attribute('data-motion','moving')
   assert math.dist(origin,point(own))<1
   admin.bring_to_front();expect(tracked).not_to_have_attribute('data-motion','arrived');assert math.dist(origin,point(tracked))<1
   mobile.bring_to_front()
   mobile.get_by_role('button',name='Ask for rescue',exact=True).click();expect(mobile.locator('.citizen-help-sent')).to_be_visible()
   admin.bring_to_front();admin.get_by_role('button',name='Incident notifications',exact=True).click()
   alert=admin.locator('.notification-rescue-row').filter(has_text='Rescue request');expect(alert).to_contain_text('A Phủ');alert.click()
   detail=admin.locator('#response-details');expect(detail).to_contain_text('GPS-AP01')
   detail.get_by_role('button',name='Travel guidance',exact=True).click()
   dialog=admin.get_by_role('dialog',name='Travel guidance',exact=True)
   dialog.get_by_role('button',name='Send guidance',exact=True).click()
   mobile.bring_to_front();official=mobile.locator('.citizen-official-guidance');expect(official).to_contain_text('Wait at a safe location')
   admin.bring_to_front();detail.get_by_role('button',name='Travel guidance',exact=True).click()
   choices=dialog.locator('select option').evaluate_all('ns=>ns.map(n=>({value:n.value,label:n.textContent}))');chosen=None
   for option in choices:
    if option['value']=='hold':continue
    dialog.locator('select').select_option(option['value'])
    if dialog.get_by_role('button',name='Send guidance',exact=True).is_enabled():chosen=option;break
   assert chosen,'Shipped resident has no approvable connected route'
   dialog.get_by_role('button',name='Send guidance',exact=True).click()
   mobile.bring_to_front();expect(official).to_contain_text(chosen['label']);expect(mobile.locator('.map-road-route-line').first).to_be_attached()
   before_move=mobile.locator('.tracked-device[data-device-id="GPS-AP01"]').get_attribute('data-world-x');official.get_by_role('button',name='Start',exact=True).click();expect(mobile.locator('.citizen-nav-banner')).to_be_visible();mobile.wait_for_timeout(700);assert mobile.locator('.tracked-device[data-device-id="GPS-AP01"]').get_attribute('data-world-x')!=before_move
   verify_shared_movement();expect(detail.locator('.detail-meta')).to_have_text('Moving')
   expect(detail.get_by_role('button',name='Dispatch team',exact=True)).to_be_visible();mobile.bring_to_front()
   mobile.get_by_role('button',name='Exit',exact=True).click();expect(official).to_be_visible()
   if captures:mobile.screenshot(path=str(captures/'assigned-route-mobile.png'))
   official.get_by_role('button',name='Suggest another route',exact=True).click()
   selects=mobile.locator('.citizen-directions select');selects.nth(0).select_option('device');selects.nth(1).select_option('site:'+chosen['value'])
   mobile.get_by_role('button',name='View on map',exact=True).click()
   proposal=mobile.locator('.citizen-proposal-bar');expect(proposal).to_be_visible();proposal.get_by_role('button',name='Send proposal',exact=True).click();expect(proposal).to_contain_text('Proposal sent')
   admin.bring_to_front();admin.get_by_role('button',name='Incident notifications',exact=True).click();expect(admin.locator('.notification-rescue-row').filter(has_text='Route proposal')).to_be_visible()
   admin.locator('.notification-rescue-row').filter(has_text='Route proposal').click()
   detail.get_by_role('button',name='Review proposed route',exact=True).click()
   expect(dialog.get_by_role('button',name='Approve route',exact=True)).to_be_enabled();dialog.get_by_role('button',name='Approve route',exact=True).click()
   mobile.bring_to_front();expect(official).to_contain_text(chosen['label'])
   admin.bring_to_front();detail.get_by_role('button',name='Travel guidance',exact=True).click();dialog.get_by_role('button',name='Send guidance',exact=True).click()
   mobile.bring_to_front();expect(official).to_contain_text('Wait at a safe location');expect(mobile.locator('.map-road-route-line')).to_have_count(0)
   assert not errors,errors
   print('Coordination guidance passed: shared mobile/coordinator movement, reopen/arrival restart, emergency alert, hold/approved route, navigation, proposal and withdrawal offline.')
  finally:browser.close()


if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--url',default='http://127.0.0.1:5220');p.add_argument('--chrome');p.add_argument('--captures',type=Path);a=p.parse_args();run(a.url.rstrip('/'),a.chrome,a.captures)
