"""Emergency reports, grouped points and road cards share one response inspector."""
import argparse
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


def run(url, chrome=None, captures=None):
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,**({'executable_path':chrome} if chrome else {}))
  context=browser.new_context(viewport={'width':1440,'height':960})
  context.add_init_script('Object.defineProperty(navigator,"onLine",{configurable:true,get:()=>false})')
  context.route('**/*',lambda r:r.continue_() if r.request.url.startswith((url+'/','data:','blob:')) else r.abort())
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(e.stack))
  try:
   page.goto(url+'/?offline=1&map=2d&demoRole=manager&lang=en')
   expect(page.locator('.incident-household-row').first).to_be_visible(timeout=45000)
   page.wait_for_function('JSON.parse(localStorage.getItem("dear.gis.v2")||"{}").records?.length>0')
   page.evaluate("""async()=>{
    const network=await(await fetch('/scenarios/che-tao/local-network.json')).json();
    const coordinates=network.sourceRoads[0].coordinates[Math.floor(network.sourceRoads[0].coordinates.length/2)];
    const data=JSON.parse(localStorage.getItem('dear.gis.v2')),at=new Date().toISOString();
    for(let i=0;i<2;i++)data.records.push({id:'surface-help-'+i,name:'Needs rescue GN-'+i,role:'reference',visible:true,source:{name:'Resident app',format:'coordinate',importedAt:at},feature:{type:'Feature',geometry:{type:'Point',coordinates},properties:{dearObservation:{schema:'field-observation/v1',kind:'help',note:'',observedAt:at,observer:'Resident '+i,accuracyM:null,status:'unreviewed',updatedAt:at,photos:[]},dearSubmission:{schema:'field-submission/v1',authorId:'surface-person-'+i,authorName:'Resident '+i,role:'resident',homeCommunityId:null,submittedAt:at,locationSource:'map',review:{status:'pending',note:'',reviewer:'',reviewedAt:''}}}}});
    localStorage.setItem('dear.gis.v2',JSON.stringify(data));
   }""")
   page.goto(url+'/?offline=1&map=2d&demoRole=manager&lang=en&gisPoint=surface-help-0')
   detail=page.locator('#response-details');expect(detail.get_by_role('heading',name='Resident 0',exact=True)).to_be_visible(timeout=30000)
   expect(detail.get_by_role('button',name='Dispatch team',exact=True)).to_be_visible()
   assert 'GIS' not in detail.inner_text()
   cluster=page.locator('.map-point-cluster[aria-label^="Resident 0"]').first
   expect(cluster).to_be_visible();cluster.click()
   group=page.locator('.point-group-card');expect(group).to_be_visible();expect(detail).to_be_hidden()
   # Fire the same DOM event emitted by the mapped road hit target, checking selection ownership.
   page.locator('path.map-road-target[data-road-id^="local-"]').first.dispatch_event('click')
   expect(page.locator('.local-road-card')).to_be_visible();expect(group).to_have_count(0);expect(detail).to_be_hidden()
   expect(page.locator('.local-area-card,.household-card')).to_have_count(0)
   page.get_by_role('button',name='Close road section',exact=True).click()
   page.get_by_role('button',name='Incident notifications',exact=True).click()
   expect(page.locator('.notification-rescue-row').filter(has_text='Resident 0')).to_be_visible()
   if captures:
    captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/'response-notifications.png'))
   assert not errors,errors
   print('Response surfaces passed: operational rescue action, human names, one group/road/detail inspector and uniform notifications.')
  finally:browser.close()


if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',default='http://127.0.0.1:5220');parser.add_argument('--chrome');parser.add_argument('--captures',type=Path)
 a=parser.parse_args();run(a.url.rstrip('/'),a.chrome,a.captures)
