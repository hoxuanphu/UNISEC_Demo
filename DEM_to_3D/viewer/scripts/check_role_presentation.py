"""Verify role changes use desktop/fullscreen coordination and a working mobile resident view."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect


def run(base,chrome=None,captures=None):
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,**({'executable_path':chrome} if chrome else {}))
        context=browser.new_context(viewport={'width':1440,'height':960})
        context.add_init_script('Object.defineProperty(navigator,"onLine",{configurable:true,get:()=>false})')
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base+'/') else r.abort())
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(base+'/?map=2d&lang=en')
        expect(page.get_by_label('Your name',exact=True)).to_have_value('A Phủ',timeout=30000)
        page.get_by_role('radio',name='Response coordinator',exact=False).check()
        page.get_by_role('button',name='Enter app',exact=True).click()
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=30000)
        if page.evaluate('document.fullscreenEnabled'):
            page.wait_for_function('document.fullscreenElement === document.documentElement')
        switch=page.locator('.app-header').get_by_role('button',name='Switch role',exact=True)
        expect(switch).to_have_count(0)
        page.get_by_role('button',name='Account',exact=True).click()
        expect(switch).to_be_visible()
        assert page.locator('.workspace').bounding_box()['width']==page.viewport_size['width']
        switch.click()
        page.wait_for_function('!document.fullscreenElement')
        name=page.get_by_label('Your name',exact=True)
        expect(name).to_have_value('A Phủ')
        name.fill('A Phủ demo')
        page.get_by_role('button',name='Enter app',exact=True).click()
        expect(page.locator('.citizen-workspace')).to_be_visible()
        assert json.loads(page.evaluate('localStorage.getItem("dear.demo-session.v1")'))['name']=='A Phủ demo'
        nav=page.locator('.citizen-mobile-switch')
        expect(page.locator('.citizen-map')).to_be_visible()
        for width,height in [(1440,960),(390,844),(320,640),(1440,650)]:
            page.set_viewport_size({'width':width,'height':height})
            for theme in ['light','dark']:
                page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
                frame=page.locator('.citizen-workspace').bounding_box()
                assert frame['width']<=430 and frame['width']<=width,frame
                assert frame['height']<=height and frame['y']>=0,frame
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                for control in page.locator('.citizen-header button').all():
                    box=control.bounding_box()
                    assert box and box['x']>=frame['x'] and box['x']+box['width']<=frame['x']+frame['width']+1,box
                nav.get_by_role('button',name='Map',exact=True).click()
                expect(page.locator('.citizen-map')).to_be_visible()
                expect(page.locator('.citizen-map .leaflet-container')).to_be_visible()
                nav.get_by_role('button',name='Road information',exact=True).click()
                expect(page.locator('.citizen-panel')).to_be_visible()
                expect(page.locator('.citizen-map')).not_to_be_visible()
                page.get_by_role('button',name='Report an observation',exact=True).click()
                expect(page.locator('.citizen-report-form textarea')).to_be_visible()
                if captures:
                    captures.mkdir(parents=True,exist_ok=True)
                    page.screenshot(path=str(captures/f'resident-{width}-{height}-{theme}.png'))
        page.reload()
        expect(page.locator('.citizen-workspace')).to_be_visible()
        account=page.get_by_role('button',name='Account',exact=True)
        expect(account).to_have_attribute('title','A Phủ demo')
        account.click()
        page.get_by_role('button',name='Switch role',exact=True).click()
        expect(page.get_by_label('Your name',exact=True)).to_have_value('A Phủ')
        page.get_by_role('radio',name='Response coordinator',exact=False).check()
        page.get_by_role('button',name='Enter app',exact=True).click()
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=30000)
        expect(page.locator('.citizen-stage')).to_have_count(0)
        assert page.locator('.workspace').bounding_box()['width']==page.viewport_size['width']
        assert not errors,errors
        browser.close()
    print('Role presentation passed: editable resident default, visible role switch, coordinator fullscreen, mobile layout/map/form at 320–1440px, persistence and return to coordination.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',required=True);parser.add_argument('--chrome');parser.add_argument('--captures',type=Path)
    args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.captures)
