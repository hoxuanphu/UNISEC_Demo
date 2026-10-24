"""Map stacks and named directions remain usable offline in both renderers."""
import argparse
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
from browser_preferences import use_vietnamese

def run(url, chrome=None, captures=None):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=chrome)
        context = use_vietnamese(browser.new_context(viewport={"width":1440,"height":960}))
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url+'/') else r.abort())
        page = context.new_page(); errors=[]
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url+'/?offline=1&map=2d&demoRole=manager',wait_until='domcontentloaded')
        expect(page.locator('.map-road-target').first).to_be_attached(timeout=30000)
        def layers():
            page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
            panel=page.locator('.layers-panel')
            panel.locator('.layer-order > summary').click()
            return panel
        panel=layers()
        panel.get_by_role('button',name='Đưa xuống: Mạng đường',exact=True).click()
        panel.get_by_role('button',name='Đưa xuống: Mạng đường',exact=True).click()
        def order(): return page.locator('[data-drawing-layer]').evaluate_all('nodes=>nodes.map(n=>n.dataset.drawingLayer)')
        assert order()==['reference','landslides','roads','boundary'],order()
        def ranks():
            return page.evaluate("""()=>Object.fromEntries(['reference','landslides','roads','boundary','route','roadStatus'].map(id=>[id,Number(getComputedStyle(document.querySelector('.leaflet-dear-'+id+'-pane')).zIndex)]))""")
        rank=ranks(); assert rank['reference']>rank['landslides']>rank['roads']>rank['boundary']
        assert rank['roadStatus']>rank['route']>rank['reference']
        page.reload(wait_until='domcontentloaded')
        expect(page.locator('.map-road-target').first).to_be_attached(timeout=30000)
        panel=layers();assert order()==['reference','landslides','roads','boundary']
        if captures:
            captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/'drawing-order.png'))
        panel.get_by_role('button',name='Đóng lớp bản đồ',exact=True).click()
        page.get_by_role('button',name='Tìm đường giữa hai điểm',exact=True).click()
        directions=page.locator('.road-journey-panel')
        start=directions.get_by_label('Điểm xuất phát',exact=True)
        end=directions.get_by_label('Điểm đến',exact=True)
        start.select_option('local:place-22');end.select_option('local:place-23')
        expect(directions.locator('.journey-result')).to_contain_text('864 m')
        directions.get_by_label('Cách đi',exact=True).select_option('distance')
        expect(directions.locator('.journey-result-heading')).to_contain_text('Đường ngắn nhất')
        expect(directions.locator('.journey-access')).to_contain_text('chưa xác nhận')
        # Deliberate road hits retain the clicked identity instead of moving to a neighbour.
        directions.locator('.journey-pick').first.click()
        hit=page.wait_for_function("""()=>{
          for(const node of document.querySelectorAll('.map-road-target[data-road-id^="local-"]')){
            const m=node.getScreenCTM();if(!m)continue;
            for(const t of [.25,.5,.75]){const p=node.getPointAtLength(node.getTotalLength()*t).matrixTransform(m);
              if(p.x<30||p.y<140||p.x>innerWidth-420||p.y>innerHeight-80)continue;
              if(document.elementFromPoint(p.x,p.y)===node)return {x:p.x,y:p.y,id:node.dataset.roadId};}
          }return null;
        }""",timeout=10000).json_value()
        page.mouse.click(hit['x'],hit['y'])
        expect(start).to_have_value('map')
        # All offsets are shown as offsets; no surveyed connection is fabricated.
        expect(directions.locator('.journey-pick').first).to_have_attribute('aria-pressed','false')
        start.select_option('local:place-22');end.select_option('local:place-23')
        if captures:page.screenshot(path=str(captures/'named-directions-2d.png'))
        page.get_by_role('button',name='Chuyển sang 3D',exact=True).click()
        canvas=page.locator('canvas.terrain-canvas')
        expect(canvas).to_be_visible(timeout=60000)
        expect(page.locator('.terrain-route-endpoint')).to_have_count(2)
        canvas.evaluate('n=>n.dataset.retainedRenderer="yes"')
        panel=layers()
        assert order()==['reference','landslides','roads','boundary']
        panel.get_by_role('button',name='Đưa lên: Mạng đường',exact=True).click()
        expect(canvas).to_have_attribute('data-retained-renderer','yes')
        panel.get_by_role('button',name='Đóng lớp bản đồ',exact=True).click()
        directions.get_by_role('button',name='Đóng bảng tìm đường',exact=True).click()
        page.get_by_role('button',name='Tìm đường giữa hai điểm',exact=True).click()
        expect(canvas).to_be_visible()
        expect(page.locator('.map-2d-surface')).to_have_count(0)
        directions.locator('.journey-pick').first.click()
        # Ground selection in the 3D route tool, with the terrain renderer retained.
        page.wait_for_timeout(800)
        for x,y in [(.35,.55),(.45,.65),(.5,.5)]:
            if directions.locator('.journey-pick').first.get_attribute('aria-pressed')=='false': break
            box=canvas.bounding_box();page.mouse.click(box['x']+box['width']*x,box['y']+box['height']*y)
        expect(start).to_have_value('map')
        expect(directions.locator('.journey-pick').first).to_have_attribute('aria-pressed','false')
        start.select_option('local:place-22');end.select_option('local:place-23')
        expect(directions.locator('.journey-result')).to_contain_text('864 m')
        for width in [1440,390,320]:
            page.set_viewport_size({'width':width,'height':960})
            if width<760:
                switch=page.locator('.mobile-view-switch').get_by_role('button',name='Bản đồ',exact=True)
                if switch.is_visible():switch.click()
            expect(directions).to_be_visible()
            assert directions.evaluate('n=>n.scrollWidth<=n.clientWidth')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            if captures:page.screenshot(path=str(captures/f'named-directions-3d-{width}.png'))
        assert not errors,errors
        browser.close()
    print('Drawing order and directions passed: persisted stack, protected warnings, named endpoints, road picks, retained 3D, offline and responsive layout.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:5213');parser.add_argument('--chrome');parser.add_argument('--captures',type=Path)
    a=parser.parse_args();run(a.url.rstrip('/'),a.chrome,a.captures)
