"""A/B route acceptance: screenshot coordinates, eligible matching, clipping and failure state."""
from browser_preferences import use_vietnamese
from gis_browser_actions import map_tool
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

def run(url,chrome,captures=None):
    points=[('route-a','A trong ảnh',21.74276,104.05581),('route-b','B trong ảnh',21.72291,104.08018),('route-far','Điểm ngoài mạng đường',22.4,104.8)]
    records=[{'id':id,'name':name,'role':'reference','visible':True,'source':{'name':'Kiểm thử tuyến','format':'coordinate','importedAt':'2026-10-13T00:00:00Z'},'feature':{'type':'Feature','properties':{},'geometry':{'type':'Point','coordinates':[lon,lat]}}} for id,name,lat,lon in points]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=chrome)
        context=use_vietnamese(browser.new_context(viewport={'width':1440,'height':960},reduced_motion='reduce'))
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url+'/') else r.abort())
        context.add_init_script("if(!localStorage.getItem('dear.geodata.v1'))localStorage.setItem('dear.geodata.v1',"+json.dumps(json.dumps(records,ensure_ascii=False))+');')
        page=use_vietnamese(context.new_page());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url+'/?offline=1&map=2d&demoRole=manager')
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=30000)
        map_tool(page, 'Tìm đường giữa hai điểm').click()
        panel=page.get_by_role('region',name='Tìm đường giữa hai điểm',exact=True)
        start=panel.get_by_label('Điểm xuất phát',exact=True);end=panel.get_by_label('Điểm đến',exact=True)
        start.select_option('gis:route-a');end.select_option('gis:route-b')
        expect(panel.get_by_label('Tránh đoạn bị chặn')).to_be_checked()
        expect(panel.locator('.journey-result')).to_be_visible()
        expect(panel.locator('.journey-status')).to_contain_text('cần xác minh')
        expect(panel).to_contain_text('Độ dài đoạn theo đường');expect(panel).to_contain_text('A tới đường (đường thẳng)')
        expect(page.locator('.map-road-route-line')).to_have_count(3)
        expect(page.locator('.map-road-route-line[stroke="#ef4444"]')).to_have_count(0)
        expect(page.locator('.map-road-target[data-route-segment^="E13:part:"]')).to_have_count(1)
        expect(panel.get_by_role('alert')).to_have_count(0)
        panel.get_by_role('button',name='Xem điểm xuất phát, điểm đến và tuyến',exact=True).click()
        page.wait_for_timeout(150)
        if captures:
            captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/'journey-screenshot-case.png'),animations='disabled')
        panel.locator('.journey-pick').first.click()
        page.locator('.overview-toggle').click()
        expect(start).to_have_value('gis:route-a')
        expect(panel.locator('.journey-pick').first).to_have_attribute('aria-pressed','true')
        page.keyboard.press('Escape')
        expect(panel.locator('.journey-pick').first).to_have_attribute('aria-pressed','false')
        page.locator('.overview-toggle').click()
        panel.locator('.journey-pick').first.click()
        map_tool(page, 'Tìm đường giữa hai điểm').click()
        expect(panel).to_have_count(0)
        map_tool(page, 'Tìm đường giữa hai điểm').click()
        expect(panel.locator('.journey-pick').first).to_have_attribute('aria-pressed','false')
        expect(start).to_have_value('gis:route-a')
        expect(panel.locator('.journey-result')).to_be_visible()
        pins=page.locator('.journey-map-pin').evaluate_all('nodes=>nodes.map(n=>({class:n.className,x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y}))')
        panel.get_by_label('Tránh đoạn bị chặn').uncheck()
        expect(panel.locator('.journey-status')).to_contain_text('bị chặn')
        expect(page.locator('.map-road-route-line[stroke="#ef4444"]')).to_have_count(1)
        current=page.locator('.journey-map-pin').evaluate_all('nodes=>nodes.map(n=>({class:n.className,x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y}))')
        assert pins==current,(pins,current)
        panel.get_by_label('Tránh đoạn bị chặn').check()
        panel.get_by_role('button',name='Đổi điểm xuất phát và điểm đến',exact=True).click()
        expect(start).to_have_value('gis:route-b');expect(end).to_have_value('gis:route-a')
        expect(panel.locator('.journey-result')).to_be_visible()
        end.select_option('gis:route-far')
        expect(end).to_have_value('gis:route-far');expect(panel.locator('.journey-result')).to_have_count(0)
        expect(panel.get_by_role('alert')).to_contain_text('5 km');expect(page.locator('.map-road-route-line')).to_have_count(0)
        end.select_option('gis:route-b')
        expect(panel.locator('[data-reason="same-location"]')).to_have_count(1)
        start.select_option('gis:route-a')
        expect(panel.locator('.journey-result')).to_be_visible()
        for width in [390,320]:
            page.set_viewport_size({'width':width,'height':960})
            bounds=panel.bounding_box();assert bounds['x']>=0 and bounds['x']+bounds['width']<=width+1,bounds
            assert panel.evaluate('n=>n.scrollWidth<=n.clientWidth')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            if captures:page.screenshot(path=str(captures/f'journey-{width}.png'),animations='disabled')
            panel.get_by_role('button',name='Xem điểm xuất phát, điểm đến và tuyến',exact=True).click()
            expect(panel.locator('.road-journey-content')).to_be_hidden()
            expect(page.locator('.map-road-route-line')).to_have_count(3)
            if captures:page.screenshot(path=str(captures/f'journey-map-{width}.png'),animations='disabled')
            panel.get_by_role('button',name='Mở chi tiết tuyến đường',exact=True).click()
            expect(panel.locator('.road-journey-content')).to_be_visible()
        assert not errors,errors;browser.close()
    print('Route logic passed: exact A/B case, avoidance/toggle/swap, clipped map geometry, retained failed point, responsive layout.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',default='http://127.0.0.1:5222');parser.add_argument('--chrome',default=None);parser.add_argument('--captures',type=Path)
    args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.captures)
