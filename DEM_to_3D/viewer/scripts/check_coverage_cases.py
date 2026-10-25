"""Known rescue, unreached and unverified cases stay distinct on 2D/3D coverage."""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright,expect


def run(url,chrome=None,captures=None):
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,**({'executable_path':chrome} if chrome else {}))
  context=browser.new_context(viewport={'width':1440,'height':960})
  context.add_init_script('Object.defineProperty(navigator,"onLine",{get:()=>false})')
  context.route('**/*',lambda r:r.continue_() if r.request.url.startswith((url+'/','data:','blob:')) else r.abort())
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   for mode in ['3d','2d']:
    page.goto(url+'/?offline=1&demoRole=manager&lang=en&map='+mode)
    rows=page.locator('.incident-household-row')
    expect(rows.filter(has_text='Terrace huts east of Village B')).to_contain_text('Needs rescue',timeout=45000)
    expect(rows.filter(has_text='Hillside huts north of Village B')).to_contain_text('No information')
    mask=page.locator('.rescue-coverage-mask');expect(mask).to_be_visible(timeout=30000)
    page.wait_for_timeout(1000)
    if mode=='2d':
     assert mask.evaluate("n=>n.parentElement.classList.contains('leaflet-dear-rescue-coverage-pane')")
     page.mouse.move(600,300);page.mouse.down();page.mouse.move(670,345,steps=8);page.mouse.up();page.wait_for_timeout(300)
     a,b=mask.bounding_box(),page.locator('.map-2d-surface').bounding_box()
     assert max(abs(a[k]-b[k]) for k in ['x','y','width','height'])<2,'Coverage mask drifted during map drag'
    else:
     assert page.locator('.household-overlay .household-alert').first.evaluate("n=>Number(getComputedStyle(n).zIndex)")>mask.evaluate("n=>Number(getComputedStyle(n).zIndex)")
    stats=mask.evaluate("""n=>{const d=n.getContext('2d').getImageData(0,0,n.width,n.height).data;let light=0,dark=0,total=0;for(let i=3;i<d.length;i+=160){total++;if(d[i]<20)light++;if(d[i]>50)dark++;}return {light:light/total,dark:dark/total};}""")
    assert stats['light']>.001 and stats['dark']>.05,(mode,stats)
    page.get_by_role('button',name='Layers',exact=True).click();layers=page.locator('.layers-panel')
    expect(layers.get_by_role('checkbox',name='Coverage on main map',exact=True)).to_be_checked()
    for name in ['Not reached','Unverified']:expect(layers.get_by_role('checkbox',name=name,exact=True)).to_be_checked()
    layers.get_by_role('checkbox',name='Not reached',exact=True).uncheck()
    page.wait_for_timeout(300)
    assert mask.evaluate("n=>{const d=n.getContext('2d').getImageData(0,0,n.width,n.height).data;return d.every((v,i)=>i%4!==3||v===0);}")
    layers.get_by_role('checkbox',name='Not reached',exact=True).check();page.keyboard.press('Escape')
    overview=page.locator('.map-overview');toggle=overview.locator('.overview-toggle')
    if toggle.get_attribute('aria-expanded')!='true':toggle.click()
    expect(overview.locator('.overview-coverage')).to_contain_text('awaiting access')
    expect(overview.locator('.overview-coverage')).to_contain_text('1 unverified')
    if captures:
     captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/f'coverage-cases-{mode}.png'),animations='disabled')
   assert not errors,errors
   print('Coverage cases passed: 2D/3D light/dark regions, unreached households, unverified signal, default layers and fog toggle.')
  finally:browser.close()

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--url',default='http://127.0.0.1:5220');p.add_argument('--chrome');p.add_argument('--captures',type=Path);a=p.parse_args();run(a.url.rstrip('/'),a.chrome,a.captures)
