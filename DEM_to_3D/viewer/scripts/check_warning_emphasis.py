"""Urgent household pulses and warning road strokes retain readable, stable geometry."""
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
   for mode in ['2d','3d']:
    page.goto(url+'/?offline=1&demoRole=manager&lang=en&map='+mode)
    icon=page.locator('.incident-household-icon[data-status="cut-off"]').first;expect(icon).to_be_visible(timeout=45000)
    expect(icon).to_have_css('animation-name','household-icon-pulse')
    row=page.locator('.incident-household-row').filter(has_text='Terrace huts east of Village B');row.click()
    expect(page.locator('.household-card')).to_be_visible()
    ring=page.locator('.household-alert.is-cut-off .household-alert-ring').first;expect(ring).to_be_attached()
    expect(ring).to_have_css('animation-name','household-ring')
    if mode=='2d':
     blocked=page.locator('path[data-road-condition="blocked"]').first;expect(blocked).to_be_attached()
     expect(blocked).to_have_css('stroke-width','4.2px')
     expect(blocked).to_have_css('animation-name','road-warning-breathe')
    label=page.locator('.map-pin-label:visible').first
    if label.count():expect(label).to_have_css('font-size','14px')
    expect(page.locator('.household-overlay .household-alert').first if mode=='3d' else page.locator('.household-alert').first).to_have_css('width','26px')
    page.wait_for_timeout(600)
    if captures:
     captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/f'warning-emphasis-{mode}.png'))
    page.emulate_media(reduced_motion='reduce')
    expect(icon).to_have_css('animation-name','none')
    expect(ring).to_have_css('animation-name','none')
    if mode=='2d':expect(blocked).to_have_css('animation-name','none')
    page.emulate_media(reduced_motion='no-preference')
    page.keyboard.press('Escape')
    page.get_by_role('button',name='Legend',exact=True).click()
    expect(page.locator('.map-legend')).to_be_visible()
    expect(page.locator('.map-legend')).to_have_css('font-size','13px')
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    if captures:page.screenshot(path=str(captures/f'presentation-legend-{mode}.png'))
   assert not errors,errors
   print('Warning emphasis passed: list/map pulses, wider blocked roads, 2D/3D inspection and reduced motion.')
  finally:browser.close()

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--url',default='http://127.0.0.1:5220');p.add_argument('--chrome');p.add_argument('--captures',type=Path);a=p.parse_args();run(a.url.rstrip('/'),a.chrome,a.captures)
