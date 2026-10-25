"""Shared device movement, inspector ownership and profile separation, with remote requests blocked."""
import argparse, re
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
from browser_preferences import use_vietnamese

def run(url,chrome=None,captures=None):
    if captures:captures.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=chrome)
        context=use_vietnamese(browser.new_context(viewport={'width':1440,'height':960}))
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url+'/') else r.abort())
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url+'/?offline=1&map=2d&demoRole=manager',wait_until='domcontentloaded')
        expect(page.locator('.map-road-target').first).to_be_attached(timeout=30000)
        page.get_by_role('button',name='Tìm đường giữa hai điểm',exact=True).click()
        panel=page.locator('.road-journey-panel')
        start=panel.get_by_label('Điểm xuất phát',exact=True);end=panel.get_by_label('Điểm đến',exact=True)
        start.select_option('local:place-22');end.select_option('local:place-23')
        # Coordinator movement is the shared device feed, with no duplicate playback person.
        marker=page.locator('.simulated-resident')
        expect(panel.locator('.route-simulation-control')).to_have_count(0)
        expect(marker).to_have_count(0)
        expect(page.locator('.tracked-device')).to_have_count(11,timeout=30000)
        expect(page.locator('.resident-route-arrow')).to_have_count(0)
        before=page.locator('.tracked-device').evaluate_all('nodes=>nodes.map(n=>n.dataset.worldX+","+n.dataset.worldY).join("|")')
        page.wait_for_function("before=>[...document.querySelectorAll('.tracked-device')].map(n=>n.dataset.worldX+','+n.dataset.worldY).join('|')!==before",arg=before)
        # Profile opens without floating controls covering the graph or its controls.
        panel.get_by_role('button',name='Mặt cắt địa hình',exact=True).click()
        profile=page.locator('.profile-panel');expect(profile).to_be_visible()
        expect(panel.locator('.road-journey-content')).to_be_hidden()
        def separated():
            assert panel.evaluate("n=>n.getBoundingClientRect().bottom<=document.querySelector('.profile-panel').getBoundingClientRect().top"),'Directions overlap the profile'
        separated()
        panel.get_by_role('button',name='Mở chi tiết tuyến đường',exact=True).click();separated()
        if captures:page.screenshot(path=str(captures/'directions-profile-open.png'))
        profile.get_by_role('button',name=re.compile('Đóng')).click()
        # Switching renderers retains the shared device clock and the terrain renderer.
        signal=int(page.locator('.tracked-device').first.get_attribute('data-signal'))
        page.get_by_role('button',name='Chuyển sang 3D',exact=True).click()
        canvas=page.locator('canvas.terrain-canvas');expect(canvas).to_be_visible(timeout=60000)
        expect(page.locator('.terrain-loading')).to_have_count(0,timeout=60000)
        expect(marker).to_have_count(0)
        expect(page.locator('.tracked-device')).to_have_count(11)
        assert int(page.locator('.tracked-device').first.get_attribute('data-signal'))>=signal
        canvas.evaluate('n=>n.dataset.retained="yes"')
        end.select_option('local:place-25');expect(canvas).to_have_attribute('data-retained','yes')
        for width in [390,320]:
            page.set_viewport_size({'width':width,'height':844})
            switch=page.locator('.mobile-view-switch').get_by_role('button',name='Bản đồ',exact=True)
            if switch.is_visible():switch.click()
            expect(page.locator('.tracked-device')).to_have_count(11)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            panel.get_by_role('button',name='Mặt cắt địa hình',exact=True).click();expect(profile).to_be_visible();separated()
            if captures:page.screenshot(path=str(captures/f'profile-person-{width}.png'))
            profile.get_by_role('button',name=re.compile('Đóng')).click()
            panel.get_by_role('button',name='Mở chi tiết tuyến đường',exact=True).click()
        page.set_viewport_size({'width':1440,'height':960})
        page.get_by_role('button',name='Chuyển sang 2D',exact=True).click()
        expect(page.locator('.map-context-landslide').first).to_be_attached()
        # Selecting an extent temporarily owns the inspector; the chosen route stays on the map.
        page.locator('.map-context-landslide').first.dispatch_event('click')
        card=page.locator('.local-area-card');expect(card).to_be_visible();expect(panel).to_have_count(0)
        expect(marker).to_have_count(0)
        expect(page.locator('.map-road-route-line').first).to_be_attached()
        photo=card.get_by_role('button',name='Xem ảnh minh họa',exact=True)
        expect(photo).to_be_enabled(timeout=15000);photo.click()
        dialog=page.locator('dialog.local-area-photo-dialog');expect(dialog).to_be_visible()
        expect(dialog.locator('img')).to_be_visible();page.keyboard.press('Escape')
        expect(dialog).to_have_count(0);expect(photo).to_be_focused()
        assert card.evaluate('n=>{const r=n.getBoundingClientRect();return r.top>=document.querySelector(".map-toolbar").getBoundingClientRect().bottom&&r.bottom<=innerHeight;}')
        if captures:page.screenshot(path=str(captures/'extent-photo-inspector.png'))
        card.get_by_role('button',name='Đóng vùng sạt',exact=True).click();expect(panel).to_be_visible()
        # Route edits preserve real device identities instead of spawning another person.
        expect(panel.locator('.route-simulation-control')).to_have_count(0)
        ids=page.locator('.tracked-device').evaluate_all('nodes=>nodes.map(n=>n.dataset.deviceId).sort()')
        panel.get_by_role('button',name='Đổi điểm xuất phát và điểm đến',exact=True).click()
        expect(marker).to_have_count(0)
        panel.get_by_role('button',name='Đóng bảng tìm đường',exact=True).click()
        assert page.locator('.tracked-device').evaluate_all('nodes=>nodes.map(n=>n.dataset.deviceId).sort()')==ids
        assert not errors,errors
        browser.close()
    print('Route inspection passed: shared device continuity, no duplicate person, retained 2D/3D, profile separation, inspector ownership, photo enlargement and mobile layout.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:5213');parser.add_argument('--chrome');parser.add_argument('--captures',type=Path)
    a=parser.parse_args();run(a.url.rstrip('/'),a.chrome,a.captures)
