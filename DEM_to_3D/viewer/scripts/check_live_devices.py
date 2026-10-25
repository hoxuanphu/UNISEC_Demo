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
        devices=page.locator('.tracked-device');expect(devices).to_have_count(9,timeout=30000)
        expect(devices.locator('svg')).to_have_count(0)
        expect(devices.locator('.tracked-device-dot')).to_have_count(9)
        expect(page.locator('.tracked-device[data-device-role="resident"]')).to_have_count(5)
        expect(page.locator('.tracked-device[data-device-role="rescue"]')).to_have_count(4)
        expect(page.locator('.tracked-device[data-device-role="resident"][data-closure-road]:not([data-closure-road=""])')).to_have_count(3)
        before=devices.evaluate_all('nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.deviceId,[n.dataset.worldX,n.dataset.worldY,n.dataset.signal]]))')
        page.wait_for_function("""before=>Array.from(document.querySelectorAll('.tracked-device')).some(n=>n.dataset.worldX!==before[n.dataset.deviceId][0]||n.dataset.worldY!==before[n.dataset.deviceId][1])""",arg=before)
        warnings=page.locator('.road-closure-sign').count()
        def fit_network():
            page.bring_to_front()
            page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
            page.get_by_role('button',name='Xem đường trong xã Chế Tạo',exact=True).click()
            close=page.get_by_role('button',name='Đóng lớp bản đồ',exact=True)
            if close.is_visible():close.click()
            page.wait_for_timeout(500)
        def open_device(selector):
            fit_network()
            target=page.locator(selector).first
            target_id=target.get_attribute('data-device-id')
            # Movement can change the leader between reads: locate its current visible group.
            marker=page.locator(f'.tracked-device:not([hidden])[data-members*=\'"{target_id}"\']')
            # At overview scale a dot yields to a coincident closure/household alert.
            # Zoom at the actual coordinate until the symbols separate; never force a hidden click.
            for _ in range(3):
                if marker.is_visible():break
                box=marker.evaluate('n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}')
                assert box['width']>0, 'Device group has no projected hit target'
                page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
                page.mouse.wheel(0,-500);page.wait_for_timeout(700)
            if not marker.is_visible():
                # A closure keeps visual priority at overview scale. The operational list
                # selects the exact device and raises its dot without geographic displacement.
                if target.get_attribute('data-device-role')=='resident':
                    page.locator('.workspace-nav').get_by_role('button',name='Sự kiện',exact=True).click()
                    row=page.locator(f'[data-resident-device="{target_id}"]')
                else:
                    page.locator('.workspace-nav').get_by_role('button',name='Cứu hộ',exact=True).click()
                    name=target.get_attribute('aria-label').split(',')[0]
                    row=page.locator('.rescue-team-row').filter(has_text=name)
                expect(row).to_be_visible();row.click()
                card=page.locator('#response-details');expect(card).to_be_visible()
                expect(card.locator('[data-tracked-device]')).to_have_attribute('data-tracked-device',target_id)
                return card
            expect(marker).to_be_visible();box=marker.bounding_box();
            hit=marker.evaluate('(n)=>{const b=n.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {own:n.contains(hit),warning:!!hit?.closest(".road-condition-sign,.map-pin")}}')
            if hit['own']:page.mouse.click(box['x']+box['width']/2,box['y']+box['height']/2)
            else:
                # Geographic coincidence preserves priority of the warning/place; every device stays keyboard selectable.
                assert hit['warning'],hit
                marker.press('Enter')
            chooser=page.locator('.tracked-device-card')
            peer=chooser.locator(f'[data-device-peer="{target_id}"]')
            if peer.is_visible():peer.click()
            card=page.locator('#response-details');expect(card).to_be_visible()
            expect(card.locator('[data-tracked-device]')).to_have_attribute('data-tracked-device',target_id)
            return card
        card=open_device('.tracked-device[data-device-role="resident"][data-closure-road]:not([data-closure-road=""])')
        expect(card).to_contain_text(re.compile('chặn|cứu hộ|điểm tập kết'))
        expect(card).to_contain_text('Cập nhật')
        expect(card).not_to_contain_text(re.compile('giả lập|mô phỏng|simulat|demo',re.I))
        expect(card.locator('[data-tracked-device]')).to_have_attribute('data-tracked-device',re.compile('ND-'))
        if captures:page.screenshot(path=str(captures/'live-devices-blocked-2d.png'))
        page.keyboard.press('Escape');expect(card).to_be_hidden()
        card=open_device('.tracked-device[data-device-role="rescue"]')
        expect(card).to_contain_text('Đội cứu hộ');expect(card.locator('[data-tracked-device]')).to_have_attribute('data-tracked-device',re.compile('CH-'))
        civilian=page.locator('.tracked-device[data-device-role="resident"]').first
        rescue=page.locator('.tracked-device[data-device-role="rescue"]').first
        assert civilian.locator('.tracked-device-dot').evaluate('n=>getComputedStyle(n).backgroundColor')=='rgb(49, 134, 230)'
        assert rescue.locator('.tracked-device-dot').evaluate('n=>getComputedStyle(n).backgroundColor')=='rgb(38, 166, 91)'
        assert devices.locator('.tracked-device-dot').evaluate_all('nodes=>nodes.every(n=>n.getBoundingClientRect().width<=14)')
        assert devices.locator('.tracked-device-dot').evaluate_all('nodes=>nodes.every(n=>getComputedStyle(n).backgroundImage==="none")'), 'Role colours must remain solid even in mixed groups'
        def anchored_symbols():
            expect(page.locator('.tracked-devices')).not_to_have_class(re.compile(r'\bis-zooming\b'),timeout=10000)
            assert page.locator('.tracked-devices svg,.tracked-device-leaders').count()==0
            assert devices.evaluate_all('''nodes=>nodes.filter(n=>!n.hidden).every(n=>{
                const b=n.getBoundingClientRect(),host=n.parentElement.getBoundingClientRect();
                return Math.abs(b.x+b.width/2-host.x-Number(n.dataset.screenX))<.8&&Math.abs(b.y+b.height/2-host.y-Number(n.dataset.screenY))<.8;
            })'''), 'A visible dot has been displaced from its projection'
        anchored_symbols()
        page.keyboard.press('Escape')
        # Hiding just this layer preserves roads and warnings. The same IDs return afterwards.
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        choice=page.get_by_label('Thiết bị định vị',exact=True);choice.uncheck();expect(devices).to_have_count(0)
        expect(page.locator('.map-road-target').first).to_be_attached()
        choice.check();expect(devices).to_have_count(9)
        page.get_by_role('button',name='Đóng lớp bản đồ',exact=True).click()
        assert page.locator('.road-closure-sign').count()==warnings
        for name in ['Phóng to','Phóng to','Thu nhỏ','Thu nhỏ']:
            page.get_by_role('button',name=name,exact=True).click();page.wait_for_timeout(400);anchored_symbols()
        pulse=devices.locator('.location-signal-dot').first
        assert pulse.evaluate('n=>getComputedStyle(n,"::after").animationName')=='location-signal'
        assert .93<=float(pulse.evaluate('n=>getComputedStyle(n).opacity'))<=1
        page.emulate_media(reduced_motion='reduce')
        assert pulse.evaluate('n=>getComputedStyle(n,"::after").animationName')=='none'
        assert pulse.evaluate('n=>getComputedStyle(n).animationName')=='none'
        page.emulate_media(reduced_motion='no-preference')
        signal=int(devices.first.get_attribute('data-signal'))
        page.get_by_role('button',name='Chuyển sang 3D',exact=True).click()
        canvas=page.locator('canvas.terrain-canvas');expect(canvas).to_be_visible(timeout=60000)
        expect(page.locator('.terrain-loading')).to_have_count(0,timeout=60000);page.wait_for_timeout(500)
        expect(devices).to_have_count(9)
        assert int(devices.first.get_attribute('data-signal'))>=signal
        canvas.evaluate('n=>n.dataset.deviceRenderer="retained"')
        at=devices.evaluate_all('nodes=>nodes.map(n=>n.dataset.worldX+","+n.dataset.worldY).join("|")')
        page.wait_for_function("""at=>Array.from(document.querySelectorAll('.tracked-device')).map(n=>n.dataset.worldX+','+n.dataset.worldY).join('|')!==at""",arg=at)
        expect(canvas).to_have_attribute('data-device-renderer','retained')
        anchored_symbols()
        for name in ['Phóng to','Thu nhỏ']:
            page.get_by_role('button',name=name,exact=True).click();page.wait_for_timeout(400);anchored_symbols()
        card=open_device('.tracked-device[data-device-role="rescue"]');expect(card).to_contain_text('Đội cứu hộ')
        if captures:page.screenshot(path=str(captures/'live-devices-rescue-3d.png'))
        card.locator('button.panel-close').click()
        for width in [390,320]:
            page.set_viewport_size({'width':width,'height':844})
            switch=page.locator('.mobile-view-switch').get_by_role('button',name='Bản đồ',exact=True)
            if switch.is_visible():switch.click()
            expect(devices).to_have_count(9)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            if captures:page.screenshot(path=str(captures/f'live-devices-{width}.png'))
        page.set_viewport_size({'width':1440,'height':960})
        page.get_by_role('button',name='Chuyển sang 2D',exact=True).click();expect(devices).to_have_count(9)
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
