"""Dragged map cards yield the overview; residents can always return to assigned guidance."""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright,expect


def run(url,chrome=None,captures=None):
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,**({'executable_path':chrome} if chrome else {}))
  context=browser.new_context(viewport={'width':1440,'height':960})
  context.add_init_script('Object.defineProperty(navigator,"onLine",{get:()=>false})')
  context.route('**/*',lambda r:r.continue_() if r.request.url.startswith((url+'/','data:','blob:')) else r.abort())
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(e.stack))
  try:
   for mode in ['3d','2d']:
    print('Checking overlay mode',mode,flush=True)
    page.goto(url+'/?offline=1&demoRole=manager&map='+mode+'&lang=en')
    overview=page.locator('.map-overview');expect(overview.locator('.map-overview-surface')).to_be_visible(timeout=45000)
    target=overview.bounding_box()
    page.locator('.incident-household-row').first.click();case=page.locator('.household-card');expect(case).to_be_visible()
    handle=case.locator('header').bounding_box();x,y=handle['x']+20,handle['y']+20
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(target['x']+40,target['y']-20,steps=10);page.mouse.up()
    expect(overview).to_have_attribute('data-auto-compact','true')
    expect(overview.locator('.overview-toggle')).to_have_attribute('aria-expanded','false')
    a,b=overview.bounding_box(),case.bounding_box()
    assert a['x']+a['width']<=b['x'] or b['x']+b['width']<=a['x'] or a['y']+a['height']<=b['y'] or b['y']+b['height']<=a['y'],'Compact overview still overlaps a case'
    overview.get_by_role('button',name='Show overview map',exact=True).click()
    expect(case).to_have_count(0);expect(overview.locator('.map-overview-surface')).to_be_visible()
    page.locator('.incident-household-row').first.click();expect(case).to_be_visible()
    page.get_by_role('button',name='Layers',exact=True).click();expect(page.locator('.layers-panel')).to_be_visible();expect(case).to_have_count(0)
    page.keyboard.press('Escape');expect(case).to_be_visible();page.keyboard.press('Escape');expect(case).to_have_count(0)
    expect(overview.locator('.map-overview-surface')).to_be_visible()
   mobile=context.new_page()
   mobile.set_viewport_size({'width':390,'height':844});mobile.on('pageerror',lambda e:errors.append(e.stack));mobile.goto(url+'/?offline=1&map=2d&lang=en')
   mobile.get_by_role('button',name='Enter app',exact=True).click()
   official=mobile.locator('.citizen-official-guidance');expect(official).to_be_visible(timeout=30000)
   official.get_by_role('button',name='Suggest another route',exact=True).click()
   back=mobile.get_by_role('button',name='Back to assigned route',exact=True);expect(back).to_be_visible();back.click()
   expect(official).to_be_visible();expect(mobile.locator('.map-road-route-line').first).to_be_visible();expect(back).to_have_count(0)
   official.get_by_role('button',name='Report situation',exact=True).click();expect(back).to_be_visible();back.click();expect(official).to_be_visible()
   own=mobile.locator('.tracked-device[data-device-id="GPS-AP01"]');assert own.get_attribute('data-motion')!='moving','Returning to guidance started travel without consent'
   if captures:
    captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/'coordinated-overlays.png'));mobile.screenshot(path=str(captures/'return-to-guidance.png'))
   assert not errors,errors
   print('Overlay coordination passed: 2D/3D dragged case collision, automatic compaction/restoration, explicit overview ownership, Layers suspension and mobile return without automatic travel.')
  finally:browser.close()


if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--url',default='http://127.0.0.1:5220');p.add_argument('--chrome');p.add_argument('--captures',type=Path);a=p.parse_args();run(a.url.rstrip('/'),a.chrome,a.captures)
