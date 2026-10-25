"""Resident layers do not cover route actions or inherit line styling on point symbols."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright,expect

def run(url,chrome=None,captures=None):
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,**({'executable_path':chrome} if chrome else {}))
  context=browser.new_context(viewport={'width':390,'height':844});context.add_init_script('Object.defineProperty(navigator,"onLine",{get:()=>false})')
  context.route('**/*',lambda r:r.continue_() if r.request.url.startswith((url+'/','data:','blob:')) else r.abort())
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   page.goto(url+'/?offline=1&map=2d&lang=en');page.get_by_role('button',name='Enter app',exact=True).click()
   card=page.locator('.citizen-official-guidance');expect(card).to_be_visible(timeout=30000)
   start=card.get_by_role('button',name='Start',exact=True)
   for theme in ['light','dark']:
    page.evaluate('theme=>document.documentElement.dataset.theme=theme',theme);page.wait_for_timeout(160)
    for button in [start,card.get_by_role('button',name='Ask for rescue',exact=True)]:
     before=button.evaluate('n=>[getComputedStyle(n).backgroundColor,getComputedStyle(n).color]')
     button.hover();page.wait_for_timeout(160)
     assert button.evaluate('n=>[getComputedStyle(n).backgroundColor,getComputedStyle(n).color]')==before,'Filled action loses contrast on hover'
     page.mouse.down();page.wait_for_timeout(160)
     assert button.evaluate('n=>[getComputedStyle(n).backgroundColor,getComputedStyle(n).color]')==before,'Filled action loses contrast while pressed'
     page.mouse.move(1,1);page.mouse.up()
   page.evaluate('document.documentElement.dataset.theme="light"')
   # Reframing after live navigation must not leave screen dots frozen in zoom mode.
   start.click();expect(page.locator('.citizen-nav-banner')).to_be_visible();page.wait_for_timeout(700)
   page.get_by_role('button',name='Report',exact=True).click()
   page.get_by_role('button',name='Back to assigned route',exact=True).click()
   expect(card).to_be_visible();page.wait_for_timeout(700)
   expect(page.locator('.tracked-devices')).not_to_have_class(re.compile(r'.*is-zooming.*'))
   sample='''()=>{const dot=document.querySelector('.tracked-device.is-self').getBoundingClientRect(),pane=document.querySelector('.leaflet-map-pane').getBoundingClientRect();return {x:dot.x,y:dot.y,px:pane.x,py:pane.y};}'''
   before=page.evaluate(sample);page.mouse.move(130,330);page.mouse.down();page.mouse.move(215,375,steps=12)
   after=page.evaluate(sample);page.mouse.up()
   assert abs(after['px']-before['px'])>50,'Test did not pan the map'
   assert abs((after['x']-before['x'])-(after['px']-before['px']))<8,(before,after)
   assert abs((after['y']-before['y'])-(after['py']-before['py']))<8,(before,after)

   for width,height in [(390,844),(320,700)]:
    page.set_viewport_size({'width':width,'height':height});page.get_by_label('Map display',exact=True).click()
    expect(card).to_be_hidden();expect(page.locator('.citizen-map-layers fieldset')).to_be_visible()
    assert page.locator('.citizen-map-legend .legend-symbol').first.evaluate('n=>getComputedStyle(n).borderTopWidth')=='0px'
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    if captures:
     captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/f'mobile-layers-{width}.png'),animations='disabled')
    page.get_by_label('Map display',exact=True).click();expect(card).to_be_visible()
   assert not errors,errors
   print('Mobile surface layout passed: 320/390 px, light/dark action contrast, assigned-route return, pan-anchored location and exclusive layers.')
  finally:browser.close()
