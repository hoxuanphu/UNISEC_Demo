"""Live device symbols, road association, role distinction and offline 2D/3D continuity."""
import argparse,re
from pathlib import Path
from playwright.sync_api import expect,sync_playwright
from browser_preferences import use_vietnamese

def run(url,chrome=None,captures=None):
    if captures:captures.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=chrome)
        context=use_vietnamese(browser.new_context(viewport={'width':1440,'height':960}))
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url+'/') else r.abort())
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url+'/?offline=1&map=2d&demoRole=manager',wait_until='domcontentloaded')
        devices=page.locator('.tracked-device');expect(devices).to_have_count(8,timeout=30000)
        expect(devices.locator('svg')).to_have_count(8)
        expect(page.locator('.tracked-device[data-device-role="resident"]')).to_have_count(6)
        expect(page.locator('.tracked-device[data-device-role="rescue"]')).to_have_count(2)
        expect(page.locator('.tracked-device[data-device-role="resident"][data-closure-road]:not([data-closure-road=""])')).to_have_count(2)
        before=devices.evaluate_all('nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.deviceId,[n.dataset.worldX,n.dataset.worldY,n.dataset.signal]]))')
        page.wait_for_function("""before=>Array.from(document.querySelectorAll('.tracked-device')).some(n=>n.dataset.worldX!==before[n.dataset.deviceId][0]||n.dataset.worldY!==before[n.dataset.deviceId][1])""",arg=before)
        warnings=page.locator('.road-closure-sign').count()
        def open_device(selector):
            marker=page.locator(selector+':visible').first
            expect(marker).to_be_visible();box=marker.bounding_box();
            assert marker.evaluate('(n)=>{const b=n.getBoundingClientRect();return n.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))}'), marker.evaluate('(n)=>{const b=n.getBoundingClientRect();return {device:n.dataset.deviceId,rect:{x:b.x,y:b.y,width:b.width,height:b.height},hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest("button")?.outerHTML.slice(0,1200)}}')
            page.mouse.click(box['x']+box['width']/2,box['y']+box['height']/2)
            card=page.locator('.tracked-device-card');expect(card).to_be_visible();return card
        # Fit the local network to expose its road devices independently of the initial selection.
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        page.get_by_role('button',name='Xem đường trong xã Chế Tạo',exact=True).click()
        close=page.get_by_role('button',name='Đóng lớp bản đồ',exact=True)
        if close.is_visible():close.click()
        page.wait_for_timeout(500)
        card=open_device('.tracked-device[data-device-role="resident"][data-closure-road]:not([data-closure-road=""])')
        expect(card).to_contain_text(re.compile('chặn|cứu hộ|điểm tập kết'))
        expect(card).to_contain_text('Tín hiệu lúc')
        expect(card).not_to_contain_text(re.compile('giả lập|mô phỏng|simulat|demo',re.I))
        expect(card.locator('small')).to_contain_text('ND-')
        if captures:page.screenshot(path=str(captures/'live-devices-blocked-2d.png'))
        page.keyboard.press('Escape');expect(card).to_be_hidden()
        card=open_device('.tracked-device[data-device-role="rescue"]')
        expect(card).to_contain_text('Đội cứu hộ');expect(card.locator('small')).to_contain_text('CH-')
        civilian=page.locator('.tracked-device[data-device-role="resident"]').first
        rescue=page.locator('.tracked-device[data-device-role="rescue"]').first
        assert civilian.evaluate('n=>getComputedStyle(n).backgroundColor')!=rescue.evaluate('n=>getComputedStyle(n).backgroundColor')
        assert civilian.evaluate('n=>getComputedStyle(n).borderRadius')!=rescue.evaluate('n=>getComputedStyle(n).borderRadius')
        page.keyboard.press('Escape')
        # Hiding just this layer preserves roads and warnings. The same IDs return afterwards.
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        choice=page.get_by_label('Thiết bị định vị',exact=True);choice.uncheck();expect(devices).to_have_count(0)
        expect(page.locator('.map-road-target').first).to_be_attached()
        choice.check();expect(devices).to_have_count(8)
        page.get_by_role('button',name='Đóng lớp bản đồ',exact=True).click()
        assert page.locator('.road-closure-sign').count()==warnings
        signal=int(devices.first.get_attribute('data-signal'))
        page.get_by_role('button',name='Chuyển sang 3D',exact=True).click()
        canvas=page.locator('canvas.terrain-canvas');expect(canvas).to_be_visible(timeout=60000)
        expect(page.locator('.terrain-loading')).to_have_count(0,timeout=60000);page.wait_for_timeout(500)
        expect(devices).to_have_count(8)
        assert int(devices.first.get_attribute('data-signal'))>=signal
        canvas.evaluate('n=>n.dataset.deviceRenderer="retained"')
        at=devices.evaluate_all('nodes=>nodes.map(n=>n.dataset.worldX+","+n.dataset.worldY).join("|")')
        page.wait_for_function("""at=>Array.from(document.querySelectorAll('.tracked-device')).map(n=>n.dataset.worldX+','+n.dataset.worldY).join('|')!==at""",arg=at)
        expect(canvas).to_have_attribute('data-device-renderer','retained')
        card=open_device('.tracked-device[data-device-role="rescue"]');expect(card).to_contain_text('Đội cứu hộ')
        if captures:page.screenshot(path=str(captures/'live-devices-rescue-3d.png'))
        card.get_by_role('button',name='Đóng thiết bị',exact=True).click()
        for width in [390,320]:
            page.set_viewport_size({'width':width,'height':844})
            switch=page.locator('.mobile-view-switch').get_by_role('button',name='Bản đồ',exact=True)
            if switch.is_visible():switch.click()
            expect(devices).to_have_count(8)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            if captures:page.screenshot(path=str(captures/f'live-devices-{width}.png'))
        page.set_viewport_size({'width':1440,'height':960})
        page.get_by_role('button',name='Chuyển sang 2D',exact=True).click();expect(devices).to_have_count(8)
        card=open_device('.tracked-device[data-device-road^="local-"]')
        card.get_by_role('button',name='Xem đoạn đường',exact=True).click()
        expect(page.locator('.local-road-card')).to_be_visible()
        expect(card).to_be_hidden()
        assert not errors,errors
        browser.close()
    print('Live devices passed: residents/rescue, blocked approaches, distinct symbols, changing signals/positions, layer visibility, retained 2D/3D renderer, road inspection and mobile offline layout.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',default='http://127.0.0.1:5213');parser.add_argument('--chrome');parser.add_argument('--captures',type=Path)
    a=parser.parse_args();run(a.url.rstrip('/'),a.chrome,a.captures)
