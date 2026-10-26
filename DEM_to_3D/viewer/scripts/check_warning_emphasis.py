"""Urgent household pulses and warning road strokes retain readable, stable geometry."""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright,expect


def run(url,chrome=None,captures=None):
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,**({'executable_path':chrome} if chrome else {}))
  context=browser.new_context(viewport={'width':1440,'height':960})
  context.add_init_script('Object.defineProperty(navigator,"onLine",{get:()=>false})')
  context.add_init_script("""(()=>{
   window.redRoadDraws=[];
   for(const name of ['WebGLRenderingContext','WebGL2RenderingContext']){
    const proto=globalThis[name]?.prototype;if(!proto)continue;
    const locations=new WeakMap(),programs=new WeakMap();
    const get=proto.getUniformLocation,one=proto.uniform1f,three=proto.uniform3f;
    proto.getUniformLocation=function(program,name){const loc=get.call(this,program,name);if(loc){let state=programs.get(program);if(!state){state={};programs.set(program,state);}locations.set(loc,{name,state});}return loc;};
    proto.uniform3f=function(loc,r,g,b){const info=loc&&locations.get(loc);if(info?.name==='diffuse')info.state.color=[r,g,b];return three.call(this,loc,r,g,b);};
    proto.uniform1f=function(loc,value){const info=loc&&locations.get(loc);if(info){const s=info.state;if(info.name==='opacity')s.opacity=value;if(info.name==='linewidth'&&s.color&&s.color[0]>.3&&s.color[1]<.3&&s.color[2]<.2&&value>=4.19&&value<6&&window.redRoadDraws.length<12000)window.redRoadDraws.push({t:performance.now(),width:value,opacity:s.opacity});}return one.call(this,loc,value);};
   }
  })()""")
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
     page.wait_for_function("()=>{const n=document.querySelector('path[data-road-condition=blocked]');return n&&parseFloat(getComputedStyle(n).strokeWidth)>=4.19&&parseFloat(getComputedStyle(n).strokeWidth)<=5.21;}")
     expect(blocked).to_have_css('animation-name','blocked-road-breathe')
    label=page.locator('.map-pin-label:visible').first
    if label.count():expect(label).to_have_css('font-size','14px')
    expect(page.locator('.household-overlay .household-alert').first if mode=='3d' else page.locator('.household-alert').first).to_have_css('width','26px')
    sign=page.locator('.road-closure-sign:visible').first
    expect(sign).to_be_visible()
    assert sign.evaluate("n=>getComputedStyle(n,'::after').animationName")=='closure-sign-breathe'
    page.wait_for_timeout(600)
    if mode=='3d':
     page.evaluate('window.redRoadDraws=[]')
     page.wait_for_timeout(2800)
     values=page.evaluate('window.redRoadDraws');assert values,'No blocked red road drawn on GPU'
     assert max(v['width'] for v in values)-min(v['width'] for v in values)>.65,values[-8:]
     assert max(v['opacity'] for v in values)-min(v['opacity'] for v in values)>.25,values[-8:]
     if captures:
      captures.mkdir(parents=True,exist_ok=True)
      for phase,condition in [('thin','v.width<4.35'),('bright','v.width>5.05')]:
       page.wait_for_function('()=>{const v=window.redRoadDraws.at(-1);return v&&'+condition+';}')
       page.screenshot(path=str(captures/f'red-road-{phase}.png'))
     print('Blocked road GPU breath: linewidth %.2f–%.2f px, opacity %.2f–%.2f'%(min(v['width'] for v in values),max(v['width'] for v in values),min(v['opacity'] for v in values),max(v['opacity'] for v in values)),flush=True)
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
