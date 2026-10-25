"""Resident layers do not cover route actions or inherit line styling on point symbols."""
from pathlib import Path
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
   before=start.evaluate('n=>[getComputedStyle(n).backgroundColor,getComputedStyle(n).color]');start.hover();page.wait_for_timeout(160)
   assert start.evaluate('n=>[getComputedStyle(n).backgroundColor,getComputedStyle(n).color]')==before,'Primary button loses contrast on hover'
   page.mouse.move(1,1)

   for width,height in [(390,844),(320,700)]:
    page.set_viewport_size({'width':width,'height':height});page.get_by_label('Map display',exact=True).click()
    expect(card).to_be_hidden();expect(page.locator('.citizen-map-layers fieldset')).to_be_visible()
    assert page.locator('.citizen-map-legend .legend-symbol').first.evaluate('n=>getComputedStyle(n).borderTopWidth')=='0px'
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    if captures:
     captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/f'mobile-layers-{width}.png'),animations='disabled')
    page.get_by_label('Map display',exact=True).click();expect(card).to_be_visible()
   assert not errors,errors
   print('Mobile surface layout passed: 320/390 px, exclusive layer picker, restored route actions and clean point-symbol samples.')
  finally:browser.close()
