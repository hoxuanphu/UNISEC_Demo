"""Resident request -> coordinator dispatch -> road approach -> recall, without Internet."""
import argparse,re
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


def run(url, chrome=None, captures=None):
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, **({'executable_path':chrome} if chrome else {}))
        context=browser.new_context(viewport={'width':1440,'height':960})
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith((url+'/','data:','blob:')) else r.abort())
        context.add_init_script('Object.defineProperty(navigator,"onLine",{configurable:true,get:()=>false});const real=Date.now;window.testOffset=0;Date.now=()=>real()+window.testOffset;')
        admin=context.new_page();mobile=context.new_page();errors=[]
        for page in [admin,mobile]:page.on('pageerror',lambda error:errors.append(error.stack))
        try:
            admin.goto(url+'/?offline=1&map=3d&demoRole=manager&lang=en')
            expect(admin.locator('.incident-household-row').first).to_be_visible(timeout=45000)
            mobile.set_viewport_size({'width':390,'height':844})
            mobile.goto(url+'/?offline=1&map=2d&lang=en')
            mobile.get_by_label('Your name',exact=True).fill('A Phủ')
            mobile.get_by_role('button',name='Enter app',exact=True).click()
            own=mobile.locator('.tracked-device[data-device-id="GPS-AP01"]')
            expect(own).to_have_attribute('data-motion','waiting',timeout=30000)
            mobile.get_by_role('button',name='Ask for rescue',exact=True).click()
            expect(mobile.locator('.citizen-help-sent')).to_be_visible(timeout=10000)
            admin.bring_to_front();admin.locator('[data-resident-device="GPS-AP01"]').click()
            detail=admin.locator('#response-details')
            expect(detail.locator('article[data-kind="help"]')).to_have_count(1)
            expect(admin.locator('.map-north')).to_be_hidden()
            expect(detail.locator('a[href^="tel:"]')).to_be_visible()
            detail.get_by_role('button',name='Dispatch team',exact=True).click()
            expect(detail.get_by_role('heading',name='Assigned team',exact=True)).to_be_visible()
            team=admin.locator('.tracked-device[data-device-id="CH-05"]')
            expect(team).to_be_attached()
            start=team.get_attribute('data-world-x');admin.wait_for_timeout(3000)
            assert team.get_attribute('data-world-x')!=start, 'Dispatched team did not move'
            mobile.bring_to_front()
            expect(mobile.locator('.citizen-official-guidance')).to_contain_text('Await the assigned team')
            expect(mobile.locator('.citizen-team')).to_contain_text('Rescue team 05')
            for page in [mobile,admin]:page.evaluate('window.testOffset=1000000')
            mobile.wait_for_timeout(500)
            expect(mobile.locator('.citizen-team')).to_contain_text('km')
            expect(admin.locator('.tracked-device[data-device-id="CH-05"]')).to_have_attribute('data-motion', re.compile('waiting|assisting'))
            assert own.get_attribute('data-motion')=='waiting', 'Arrival incorrectly evacuated the resident'
            admin.bring_to_front()
            detail.get_by_role('button').filter(has_text='Rescue team 05').click()
            expect(admin.locator('.rescue-team-detail')).to_be_visible()
            if captures:
                captures.mkdir(parents=True,exist_ok=True)
                admin.screenshot(path=str(captures/'dispatch-admin.png'));mobile.screenshot(path=str(captures/'dispatch-mobile.png'))
            admin.get_by_role('button',name='Recall team',exact=True).click()
            for page in [mobile,admin]:page.evaluate('window.testOffset=2000000')
            expect(admin.locator('#response-details')).to_contain_text('At the assembly point',timeout=10000)
            assert not errors, errors
            print('Rescue dispatch passed: request/contact, one shared assignment, road movement, safe hold, mobile status and recall offline.')
        finally:browser.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',default='http://127.0.0.1:5220');parser.add_argument('--chrome');parser.add_argument('--captures',type=Path)
    args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.captures)
