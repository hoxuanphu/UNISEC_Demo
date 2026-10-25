"""Rescue overview in the default 3D view, 2D, small windows and both languages."""
import argparse
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


def run(url, chrome=None, captures=None):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, **({'executable_path': chrome} if chrome else {}))
        context = browser.new_context(viewport={'width': 1440, 'height': 960})
        context.add_init_script('Object.defineProperty(navigator,"onLine",{configurable:true,get:()=>false})')
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith((url + '/', 'data:', 'blob:')) else r.abort())
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            page.goto(url + '/?offline=1&map=3d&demoRole=manager&lang=en')
            expect(page.locator('canvas.terrain-canvas')).to_be_visible(timeout=60000)
            overview = page.locator('.map-overview[data-coverage]')
            expect(overview).to_be_visible(timeout=30000)
            expect(overview.locator('.overview-toggle')).to_have_attribute('aria-expanded', 'true')
            expect(overview.locator('canvas.coverage-fog')).to_be_visible(timeout=30000)
            expect(overview.locator('.overview-meaning')).to_contain_text('Team coverage')
            expect(overview.locator('.overview-extent')).to_be_attached()
            before_view=overview.locator('.overview-extent').get_attribute('d')
            page.get_by_role('button',name='Zoom in',exact=True).click()
            expect(overview.locator('.overview-extent')).not_to_have_attribute('d',before_view)
            page.get_by_role('button',name='Layers',exact=True).click()
            panel=page.locator('.layers-panel');group=panel.locator('[data-layer-stack="rescue"]')
            expect(group.get_by_role('checkbox')).to_have_count(6)
            group.get_by_role('checkbox',name='Coverage on main map',exact=True).check()
            expect(page.locator('.rescue-coverage-mask')).to_be_attached()
            group.get_by_role('checkbox',name='Coverage on main map',exact=True).uncheck()
            page.keyboard.press('Escape')
            expect(page.locator('.rescue-coverage-mask')).to_have_count(0)
            def signature():
                return overview.locator('canvas').evaluate('n=>{const a=n.getContext("2d").getImageData(0,0,n.width,n.height).data;let s=0;for(let i=3;i<a.length;i+=4)s+=a[i];return s;}')
            before = signature()
            page.get_by_role('button',name='Layers',exact=True).click()
            page.locator('.layers-panel').get_by_role('checkbox',name='Not reached',exact=True).uncheck()
            page.keyboard.press('Escape')
            page.wait_for_timeout(100)
            assert signature() < before, 'Unreached mask did not switch off'
            page.get_by_role('button',name='Layers',exact=True).click()
            page.locator('.layers-panel').get_by_role('checkbox',name='Not reached',exact=True).check()
            page.keyboard.press('Escape')
            overview.locator('.map-overview-surface').click(position={'x': 100, 'y': 80})
            expect(page.get_by_role('button', name='Switch to 3D', exact=True)).to_have_attribute('aria-pressed', 'true')
            overview_left=overview.bounding_box()['x']
            page.locator('.incident-household-row').first.click()
            expect(page.locator('.household-card')).to_be_visible()
            expect(page.locator('.household-card').get_by_role('button',name='Dispatch team',exact=True)).to_be_visible()
            expect(overview.locator('.overview-selected')).to_be_visible()
            assert abs(overview.bounding_box()['x']-overview_left)<2, 'Overview moved after opening a case'
            case=page.locator('.household-card');a,b=overview.bounding_box(),case.bounding_box()
            assert a['x']+a['width']<=b['x'] or b['x']+b['width']<=a['x'] or a['y']+a['height']<=b['y'] or b['y']+b['height']<=a['y'], 'Overview overlaps the selected case'
            def drag(handle,dx,dy):
                r=handle.bounding_box();x,y=r['x']+12,r['y']+12
                page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y+dy,steps=8);page.mouse.up()
            before_case=case.bounding_box();drag(case.locator('header'),-60,30)
            assert abs(case.bounding_box()['x']-before_case['x'])>30, 'Case did not move'
            drag(overview.locator('.overview-title'),100,-30)
            assert abs(overview.bounding_box()['x']-overview_left)>50, 'Overview did not move'
            overview.locator('.overview-head').dblclick(position={'x':12,'y':12})

            expect(page.get_by_role('button', name='Switch to 3D', exact=True)).to_have_attribute('aria-pressed', 'true')
            page.keyboard.press('Escape')
            expect(page.locator('.household-card')).to_have_count(0)
            overview.get_by_role('button', name='Larger', exact=True).click()
            expect(page.locator('.map-bottom-bar')).to_be_hidden()
            if captures:
                captures.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(captures / 'overview-3d.png'))
            overview.get_by_role('button', name='Smaller', exact=True).click()
            for width in [1200, 900, 390, 320]:
                page.set_viewport_size({'width': width, 'height': 844})
                switch = page.locator('.mobile-view-switch')
                if switch.is_visible():
                    switch.get_by_role('button', name='Map', exact=True).click()
                expect(overview).to_be_visible()
                if overview.locator('.overview-toggle').get_attribute('aria-expanded') != 'true':
                    overview.locator('.overview-toggle').click()
                expect(overview.locator('canvas')).to_be_visible()
                assert overview.evaluate('n=>{const r=n.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}'), width
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), width
                overview.locator('.overview-toggle').click()
                expect(overview.locator('canvas')).to_have_count(0)
            page.set_viewport_size({'width': 1440, 'height': 960})
            page.get_by_role('button', name='Switch to 2D', exact=True).click()
            expect(page.locator('.map-2d-surface')).to_be_visible()
            expect(overview.locator('canvas')).to_be_visible(timeout=30000)
            page.goto(url + '/?offline=1&map=3d&demoRole=manager&lang=vi')
            expect(overview.locator('canvas')).to_be_visible(timeout=60000)
            expect(overview.locator('.overview-key')).to_contain_text('Đã cứu')
            expect(overview.locator('.overview-key')).to_contain_text('Đội chưa tới')
            assert not errors, errors
            print('Rescue overview passed: default 3D, 2D, independent layers, EN/VI, retained 3D inspection and 320–1440 px.')
        finally:
            browser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5220')
    parser.add_argument('--chrome')
    parser.add_argument('--captures', type=Path)
    args = parser.parse_args()
    run(args.url.rstrip('/'), args.chrome, args.captures)
