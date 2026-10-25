"""A Phu shares one current location across resident and coordinator roles, offline."""
import argparse, math
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

def run(url,chrome=None,captures=None):
    if captures:captures.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=chrome)
        context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        context.add_init_script('Object.defineProperty(navigator,"onLine",{configurable:true,get:()=>false})')
        context.add_init_script('window.DeviceOrientationEvent=class extends Event {static requestPermission(){if(this!==window.DeviceOrientationEvent)throw new TypeError("Unbound permission");return Promise.resolve("granted");}};window.ondeviceorientationabsolute=null;')
        external=[];errors=[]
        context.on('request',lambda request:external.append(request.url) if request.url.startswith(('http:','https:')) and not request.url.startswith(url+'/') else None)
        context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(url+'/') or route.request.url.startswith(('blob:','data:')) else route.abort())
        citizen=context.new_page();citizen.on('pageerror',lambda error:errors.append(str(error)))
        citizen.goto(url+'/?offline=1&map=2d&lang=en')
        citizen.get_by_label('Your name',exact=True).fill('A Phủ')
        citizen.get_by_role('button',name='Enter app',exact=True).click()
        own=citizen.locator('.tracked-device[data-device-id="GPS-AP01"]')
        expect(own).to_be_attached(timeout=30000)
        citizen.locator('.citizen-map-tools').get_by_role('button',name='My location',exact=True).click()
        expect(own).to_be_visible()
        expect(own).to_have_attribute('data-motion','waiting',timeout=20000)
        own.click()
        card=citizen.locator('.tracked-device-card');expect(card).to_be_visible()
        expect(card).to_contain_text('A Phủ');expect(card).to_contain_text('GPS-AP01')
        citizen_point=own.evaluate('n=>[Number(n.dataset.worldX),Number(n.dataset.worldY)]')
        blue=own.locator('.tracked-device-dot').evaluate('n=>getComputedStyle(n).backgroundColor')
        expect(own.locator('.tracked-device-name')).to_have_text('You')
        expect(citizen.locator('.citizen-map-compass .map-compass')).to_be_visible()
        expect(citizen.locator('.citizen-team')).to_be_visible()
        expect(citizen.locator('.tracked-device.is-rescue')).to_have_count(4)
        expect(citizen.locator('.tracked-device.is-resident')).to_have_count(1)
        compass=citizen.locator('.citizen-map-compass button')
        compass.click();expect(compass).to_have_attribute('aria-pressed','true')
        citizen.evaluate('''()=>{const event=new Event('deviceorientationabsolute');Object.defineProperties(event,{alpha:{value:270},absolute:{value:true}});dispatchEvent(event);}''')
        expect(own).to_have_class(__import__('re').compile(r'\bhas-heading\b'))
        assert own.evaluate('n=>n.style.getPropertyValue("--heading")')=='90deg'
        compass.click();expect(compass).to_have_attribute('aria-pressed','false')
        if captures:citizen.screenshot(path=str(captures/'resident-current-location.png'))
        admin=context.new_page();admin.on('pageerror',lambda error:errors.append(str(error)))
        admin.set_viewport_size({'width':1440,'height':960})
        admin.goto(url+'/?offline=1&map=2d&demoRole=manager&lang=en')
        marker=admin.locator('.tracked-device[data-device-id="GPS-AP01"]')
        expect(marker).to_be_attached(timeout=30000)
        expect(marker).to_have_attribute('data-motion','waiting',timeout=20000)
        point=marker.evaluate('n=>[Number(n.dataset.worldX),Number(n.dataset.worldY)]')
        assert math.dist(point,citizen_point)<.01,(point,citizen_point)
        assert marker.locator('.tracked-device-dot').evaluate('n=>getComputedStyle(n).backgroundColor')in [blue,'rgb(49, 134, 230)']
        row=admin.locator('[data-resident-device="GPS-AP01"]');expect(row).to_be_visible();row.click()
        detail=admin.locator('#response-details')
        expect(detail.get_by_role('heading',name='A Phủ',exact=True)).to_be_visible()
        expect(detail).to_contain_text('A Phủ household');expect(detail).to_contain_text('GPS-AP01')
        expect(admin.locator('.tracked-device-card')).to_be_hidden()
        expect(marker).to_have_class(__import__('re').compile(r'\bis-selected\b'))
        expect(admin.locator('.analysis-load-status')).to_have_count(0,timeout=60000)
        if captures:admin.screenshot(path=str(captures/'resident-coordinator-detail-2d.png'))
        admin.get_by_role('button',name='Switch to 3D',exact=True).click()
        expect(admin.locator('canvas.terrain-canvas')).to_be_visible(timeout=60000)
        expect(marker).to_have_count(1)
        expect(detail.get_by_role('heading',name='A Phủ',exact=True)).to_be_visible()
        after=marker.evaluate('n=>[Number(n.dataset.worldX),Number(n.dataset.worldY)]')
        assert math.dist(after,point)<.01
        expect(admin.locator('.analysis-load-status')).to_have_count(0,timeout=60000)
        if captures:admin.screenshot(path=str(captures/'resident-coordinator-detail-3d.png'))
        for width in [390,320]:
            admin.set_viewport_size({'width':width,'height':844})
            assert admin.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert detail.evaluate('n=>n.scrollWidth<=n.clientWidth')
        admin.set_viewport_size({'width':1440,'height':960})
        detail.get_by_role('button',name='Close device details',exact=True).click()
        expect(detail).to_have_count(0)
        admin.get_by_role('button',name='Switch to 2D',exact=True).click()
        row.click();expect(detail).to_be_visible()
        detail.get_by_role('button',name='Show on map',exact=True).click()
        expect(marker).to_be_visible()
        # The shared position survives a role reload and never creates a second A Phu marker.
        citizen.reload();expect(own).to_have_count(1,timeout=30000)
        expect(own).to_have_attribute('data-motion','waiting')
        assert math.dist(own.evaluate('n=>[Number(n.dataset.worldX),Number(n.dataset.worldY)]'),point)<.01
        assert not errors,errors
        assert not external,external
        browser.close()
    print('Resident locations passed: shared A Phu dot, mapped closure hold, EN household/device details, right inspector, retained 2D/3D, reload and responsive offline UI.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',default='http://127.0.0.1:5213');parser.add_argument('--chrome');parser.add_argument('--captures',type=Path)
    args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.captures)
