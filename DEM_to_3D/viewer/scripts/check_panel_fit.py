"""Inspectors fit their content; map references do not drift or oscillate around them."""
import argparse
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


def run(url,chrome=None,captures=None,map_mode='2d'):
    if captures:captures.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,**({'executable_path':chrome} if chrome else {}))
        context=browser.new_context(viewport={'width':1440,'height':960})
        context.add_init_script('Object.defineProperty(navigator,"onLine",{get:()=>false})')
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith((url+'/','data:','blob:')) else r.abort())
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        try:
            page.goto(url+'/?offline=1&map='+map_mode+'&demoRole=manager&lang=en')
            if map_mode=='3d':expect(page.locator('canvas.terrain-canvas')).to_be_visible(timeout=60000)
            row=page.locator('.resident-device-row[data-resident-device="GPS-AP01"]')
            expect(row).to_be_visible(timeout=45000)
            expect(page.locator('.map-overview')).to_be_visible(timeout=45000)
            refs=page.locator('.map-attribution,.map-overview')
            before=refs.evaluate_all('nodes=>nodes.map(n=>({name:n.className,right:n.getBoundingClientRect().right}))')
            row.click()
            detail=page.locator('#response-details');expect(detail).to_be_visible()
            expect(detail.locator('[data-tracked-device="GPS-AP01"]')).to_be_visible()
            expect(page.locator('.map-north')).to_be_hidden()
            page.wait_for_timeout(350)
            after=refs.evaluate_all('nodes=>nodes.map(n=>({name:n.className,right:n.getBoundingClientRect().right}))')
            assert len(before)==len(after),(before,after)
            assert all(abs(a['right']-b['right'])<1 for a,b in zip(before,after)),('References moved sideways',before,after)
            for width,height in [(1440,960),(1440,600),(1280,720),(1024,700),(390,844),(320,700)]:
                page.set_viewport_size({'width':width,'height':height})
                info=page.locator('.mobile-view-switch').get_by_role('button',name='Information',exact=True)
                if info.is_visible():info.click()
                expect(detail).to_be_visible()
                page.wait_for_timeout(300)
                assert detail.evaluate('n=>n.scrollWidth<=n.clientWidth+1')
                if page.locator('.workspace').get_attribute('data-response-layout')=='dock':
                    area=page.locator('.map-area').bounding_box();box=detail.bounding_box()
                    assert box['height']<=601,(width,height,box)
                    assert box['y']+box['height']<=area['y']+area['height']-88,(width,height,box,area)
                    title=detail.locator('h1');expect(title).to_be_in_viewport()
                    north=page.locator('.map-north').bounding_box()
                    if north:assert north['y']+north['height']+8<=box['y'],('Inspector covers compass',north,box)
                    readings=page.evaluate('''async()=>{
                      const nodes=[document.querySelector('#response-details'),...document.querySelectorAll('.map-overview,.map-attribution')];
                      const sample=()=>nodes.map(n=>{const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height]});
                      const initial=sample();let drift=0;
                      for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,40));sample().forEach((r,j)=>r.forEach((v,k)=>drift=Math.max(drift,Math.abs(v-initial[j][k]))));}
                      return drift;
                    }''')
                    assert readings<1,('Stationary panels oscillate',width,height,readings)
                    overview=page.locator('.map-overview');expect(overview).to_be_visible()
                    a,b=overview.bounding_box(),detail.bounding_box()
                    assert a['y']>=b['y']+b['height']+8 or a['x']+a['width']+8<=b['x'],(a,b)
                device=detail.get_by_text('GPS-AP01',exact=True)
                device.scroll_into_view_if_needed();expect(device).to_be_in_viewport()
                if captures:page.screenshot(path=str(captures/f'panel-fit-{width}-{height}.png'),animations='disabled')
            page.set_viewport_size({'width':1440,'height':960})
            detail.get_by_role('button',name='Inspect road section',exact=True).click()
            road=page.locator('.local-road-card');expect(road).to_be_visible()
            assert road.bounding_box()['height']<400,'Short road details stretched to full height'
            page.get_by_role('button',name='Close road section',exact=True).click()
            overview=page.locator('.map-overview')
            overview.get_by_role('button',name='Show overview map',exact=True).click()
            expect(overview.locator('.map-overview-surface')).to_be_visible()
            # A household case shares the fixed-heading rules for dragged windows.
            page.locator('.incident-household-row').first.click()
            case=page.locator('.household-card');expect(case).to_be_visible()
            handle=case.locator('header');at=handle.bounding_box()
            page.mouse.move(at['x']+20,at['y']+20);page.mouse.down();page.mouse.move(at['x']+100,at['y']-100,steps=8);page.mouse.up()
            expect(case).to_be_visible();expect(handle).to_be_in_viewport()
            assert case.evaluate('n=>{const a=n.getBoundingClientRect(),b=n.closest(".map-area").getBoundingClientRect();return a.top>=b.top && a.bottom<=b.bottom-32;}')
            case.locator('header .icon-button').click()
            if overview.get_by_role('button',name='Show overview map',exact=True).is_visible():
                overview.get_by_role('button',name='Show overview map',exact=True).click()
            heading=overview.locator('.overview-title');at=heading.bounding_box()
            page.mouse.move(at['x']+12,at['y']+12);page.mouse.down();page.mouse.move(at['x']-108,at['y']-68,steps=8);page.mouse.up()
            fixed=overview.locator('.overview-head').bounding_box()
            overview.get_by_role('button',name='Larger',exact=True).click()
            page.wait_for_timeout(250)
            grown=overview.locator('.overview-head').bounding_box()
            assert abs(grown['x']-fixed['x'])<1 and abs(grown['y']-fixed['y'])<1,('Growing overview moved its heading',fixed,grown)
            expect(overview.locator('.map-overview-surface')).to_be_visible()
            page.set_viewport_size({'width':390,'height':844})
            switch=page.locator('.mobile-view-switch').get_by_role('button',name='Map',exact=True)
            if switch.is_visible():switch.click()
            expect(overview.locator('.map-overview-surface')).to_be_visible()
            assert overview.evaluate('n=>{const a=n.getBoundingClientRect();return a.left>=0&&a.right<=innerWidth+1;}')
            if map_mode=='2d':
                page.set_viewport_size({'width':1440,'height':960})
                record=page.evaluate('JSON.parse(localStorage.getItem("dear.gis.v2")).records.find(r=>r.feature.properties.sourceName==="Talus 3").id')
                page.goto(url+'/?offline=1&map=2d&demoRole=manager&lang=en&gisPoint='+record)
                expect(detail.locator('.field-map-card.is-docked')).to_be_visible(timeout=30000)
                body=detail.locator('.field-map-card-body');expect(body).to_be_visible()
                assert body.evaluate('n=>n.clientHeight>=100 && n.scrollHeight>=n.clientHeight'), 'Imported record has no usable scroll body'
                assert detail.bounding_box()['height']<=601
                if captures:page.screenshot(path=str(captures/'panel-fit-imported-record.png'),animations='disabled')
            assert not errors,errors
            print('Panel fit passed ('+map_mode+'): GPS-AP01, content height, stable corners, no idle oscillation, 320–1440 px, dragged case and overview resizing.')
        finally:browser.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:5173');parser.add_argument('--chrome');parser.add_argument('--captures',type=Path)
    parser.add_argument('--map-mode',choices=['2d','3d'],default='2d')
    args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.captures,args.map_mode)
