"""Local roads on the coordinator map: quiet hierarchy, filtering, inspection and routing."""
import argparse
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
from browser_preferences import use_vietnamese


def run(url, chrome, captures):
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=chrome)
        context=use_vietnamese(browser.new_context(viewport={'width':1440,'height':900}))
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url+'/') else r.abort())
        page=context.new_page();errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(url+'/?map=2d&offline=1&demoRole=manager',wait_until='domcontentloaded',timeout=60000)
        roads=page.locator('.map-context-road')
        expect(roads.first).to_be_attached(timeout=30000)
        count=roads.count()
        assert count>=42,count
        expect(page.locator('.map-network-launcher')).to_have_count(0)
        def fit_local_roads():
            page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
            page.get_by_role('button',name='Xem đường trong xã Chế Tạo',exact=True).click()
            close=page.get_by_role('button',name='Đóng lớp bản đồ',exact=True)
            if close.is_visible():close.click()
        fit_local_roads()
        expect(page.locator('.road-closure-sign').first).to_be_attached()
        assert page.locator('.road-closure-sign svg').evaluate_all('nodes=>nodes.every(svg=>!!svg.querySelector("rect"))')
        warning_ids=page.locator('.road-condition-sign').evaluate_all('nodes=>nodes.map(n=>[n.dataset.roadId,n.dataset.roadCondition]).sort()')
        page.wait_for_timeout(700)
        assert 'workspace=routes' not in page.url
        assert roads.evaluate_all('nodes=>nodes.every(n=>parseFloat(n.getAttribute("stroke-width"))<=(n.dataset.roadCondition==="open"?1.8:2.4))'), 'Ordinary context stays thin, warnings stay readable below route emphasis'
        if captures:
            captures.mkdir(parents=True,exist_ok=True)
            page.screenshot(path=str(captures/'main-local-roads-light.png'))
        # The fit button works in this map, and a local line opens its own card.
        def click_visible_local_road():
            hit=page.wait_for_function('''()=>{
                const nodes=document.querySelectorAll('.map-road-target[data-road-id^="local-"]');
                for(const node of nodes){const matrix=node.getScreenCTM();if(!matrix)continue;
                    for(const t of [.2,.4,.6,.8]){const p=node.getPointAtLength(node.getTotalLength()*t).matrixTransform(matrix);
                        if(p.x<10||p.y<110||p.x>innerWidth-10||p.y>innerHeight-60)continue;
                        if(document.elementFromPoint(p.x,p.y)?.closest('[data-road-id]')?.dataset.roadId===node.dataset.roadId)return {x:p.x,y:p.y};}}
                return null;
            }''',timeout=10000).json_value()
            assert hit,'No local road can be selected through the actual map hit targets'
            page.mouse.click(hit['x'],hit['y'])
        click_visible_local_road()
        card=page.locator('.local-road-card')
        expect(card).to_contain_text('Đường trong xã Chế Tạo')
        expect(card).to_contain_text('Chiều dài đoạn')
        card.get_by_role('button',name='Đóng đoạn đường',exact=True).click()
        expect(card).to_have_count(0)
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        layers=page.locator('.layers-panel')
        layers.get_by_label('Đường trong xã Chế Tạo',exact=True).uncheck()
        expect(roads).to_have_count(0)
        expect(page.locator('.map-road-target:not([data-road-id^="local-"])').first).to_be_attached()
        layers.get_by_label('Đường trong xã Chế Tạo',exact=True).check()
        expect(roads).to_have_count(count)
        layers.get_by_label('Tình trạng đường',exact=True).uncheck()
        assert roads.evaluate_all('nodes=>nodes.every(n=>n.getAttribute("stroke")!=="#d96552")')
        layers.get_by_label('Tình trạng đường',exact=True).check()
        assert roads.evaluate_all('nodes=>nodes.filter(n=>n.dataset.roadCondition==="blocked").every(n=>n.getAttribute("stroke")==="#d96552")')
        layers.get_by_role('button',name='Đóng lớp bản đồ',exact=True).click()
        # Both villages connect through the actual local graph, not an invented
        # straight line or an incident road elsewhere in the commune.
        page.locator('.map-road-target[data-road-id^="local-"]').first.dispatch_event('click')
        card.get_by_role('button',name='Tìm đường trong xã',exact=True).click()
        panel=page.locator('.road-journey-panel')
        panel.get_by_label('Điểm xuất phát',exact=True).select_option('local:place-23')
        panel.get_by_label('Điểm đến',exact=True).select_option('local:place-25')
        expect(panel.locator('.journey-result')).to_be_visible()
        expect(panel.locator('.journey-result')).to_contain_text('Có nguy cơ sạt lở')
        page.wait_for_timeout(700)
        for endpoint in page.locator('.resident-route-endpoint').all():
            assert endpoint.evaluate('''pin=>{
                const a=pin.getBoundingClientRect(),b=document.querySelector('.road-journey-panel').getBoundingClientRect();
                return a.left>=0&&a.top>=0&&a.right<=innerWidth&&a.bottom<=innerHeight&&
                    !(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top);
            }'''),'Route endpoint is hidden by directions'
        expect(page.locator('.map-road-target[data-route-segment]').first).to_be_attached()
        assert page.locator('.map-road-target[data-route-segment]').evaluate_all('nodes=>nodes.every(n=>n.dataset.roadId.startsWith("local-"))')
        assert page.locator('.map-road-route-line').evaluate_all('nodes=>nodes.every(n=>n.dataset.roadStatus!=="blocked")')
        assert page.locator('.map-road-route-line').evaluate_all('''nodes=>nodes.length>0&&nodes.every(n=>
            n.getAttribute('stroke')===(n.dataset.roadCondition==='open'?'#2f80ed':'#d7a34c')&&!n.getAttribute('stroke-dasharray'))''')
        assert page.locator('.map-road-route-line[data-road-condition="risk"]').count()>0
        if captures:page.screenshot(path=str(captures/'main-local-journey.png'))
        alternatives=panel.locator('.journey-alternatives')
        if alternatives.count():
            alternatives.locator('summary').click()
            alternatives.locator('.journey-alternative').first.click()
            expect(panel.locator('.journey-result-heading')).to_contain_text('Đường bạn chọn')
            alternatives.locator('.journey-alternative').first.click()
            expect(panel.locator('.journey-result-heading')).to_contain_text('Đường nên đi')
        panel.get_by_role('combobox',name='Cách đi',exact=True).select_option('rescue-foot')
        expect(panel.locator('.journey-result-heading')).to_contain_text('Phương án tiếp cận')
        expect(panel.get_by_role('checkbox',name='Tránh đoạn bị chặn',exact=True)).to_have_count(0)
        expect(panel.locator('.journey-note').first).to_contain_text('người địa phương')
        assert page.locator('.map-road-route-line').evaluate_all('nodes=>nodes.every(n=>n.dataset.roadStatus!=="blocked")')
        if captures:page.screenshot(path=str(captures/'main-rescue-foot.png'))
        # Helipad is 24 m from the unrelated corridor, 27 m from its local road.
        # Named local places must retain source ownership in the combined map.
        panel.get_by_label('Điểm xuất phát',exact=True).select_option('local:place-22')
        panel.get_by_label('Điểm đến',exact=True).select_option('local:place-23')
        expect(panel.locator('.journey-result')).to_be_visible()
        expect(panel.locator('.journey-route-distance')).to_have_text('864 m')
        expect(panel.locator('.journey-message[data-reason="disconnected"]')).to_have_count(0)
        assert page.locator('.map-road-target[data-route-segment]').evaluate_all('nodes=>nodes.length>0&&nodes.every(n=>n.dataset.roadId.startsWith("local-"))')
        if captures:page.screenshot(path=str(captures/'main-helipad-village-a.png'))
        panel.get_by_role('button',name='Đổi điểm xuất phát và điểm đến',exact=True).click()
        expect(panel.locator('.journey-route-distance')).to_have_text('864 m')
        panel.get_by_label('Điểm xuất phát',exact=True).select_option('local:place-23')
        panel.get_by_label('Điểm đến',exact=True).select_option('local:place-25')
        panel.get_by_role('combobox',name='Cách đi',exact=True).select_option('conditions')
        for width in [390,320]:
            page.set_viewport_size({'width':width,'height':844})
            page.locator('.mobile-view-switch').get_by_role('button',name='Bản đồ',exact=True).click()
            expect(panel).to_be_visible()
            page.wait_for_timeout(700)
            if captures:page.screenshot(path=str(captures/f'main-directions-{width}.png'))
            for endpoint in page.locator('.resident-route-endpoint').all():
                assert endpoint.evaluate('''pin=>{
                    const a=pin.getBoundingClientRect(),b=document.querySelector('.road-journey-panel').getBoundingClientRect();
                    return a.left>=0&&a.top>=0&&a.right<=innerWidth&&a.bottom<=b.top;
                }'''),f'Endpoint covered on mobile at {width}px: '+str(endpoint.bounding_box())+'; sheet: '+str(panel.bounding_box())
        page.set_viewport_size({'width':1440,'height':900})
        panel.get_by_role('button',name='Đóng bảng tìm đường',exact=True).click()
        fit_local_roads()
        for theme in ['light','dark']:
            page.evaluate('t=>document.documentElement.dataset.theme=t',theme)
            page.wait_for_timeout(300)
            if captures:page.screenshot(path=str(captures/f'main-local-roads-{theme}.png'))
        for width in [390,320]:
            page.set_viewport_size({'width':width,'height':844})
            page.locator('.mobile-view-switch').get_by_role('button',name='Bản đồ',exact=True).click()
            fit_local_roads()
            page.wait_for_timeout(700)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            click_visible_local_road()
            expect(card).to_be_visible()
            assert card.evaluate('n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}')
            if captures:page.screenshot(path=str(captures/f'main-local-card-{width}.png'))
            card.get_by_role('button',name='Đóng đoạn đường',exact=True).click()
        page.set_viewport_size({'width':1440,'height':900})
        page.get_by_role('button',name='Chuyển sang 3D',exact=True).click()
        expect(page.locator('canvas.terrain-canvas')).to_be_visible(timeout=60000)
        fit_local_roads()
        page.wait_for_timeout(1200)
        assert page.locator('.road-condition-sign').evaluate_all('nodes=>nodes.map(n=>[n.dataset.roadId,n.dataset.roadCondition]).sort()') == warning_ids, '2D and 3D must use the same road warnings'
        assert page.locator('.road-closure-sign svg').evaluate_all('nodes=>nodes.every(svg=>!!svg.querySelector("rect"))')
        sign=page.locator('.road-closure-sign.is-landslide:visible').first
        expect(sign).to_be_visible()
        sign.click()
        expect(card).to_be_visible()
        card.get_by_role('button',name='Đóng đoạn đường',exact=True).click()
        if captures:page.screenshot(path=str(captures/'main-local-roads-3d.png'))
        page.get_by_role('button',name='Chuyển sang 2D',exact=True).click()
        expect(roads.first).to_be_attached()
        assert not errors,errors
        browser.close()
    print('Main local roads passed: full graph, restrained widths, local toggle, road conditions, inspection, A-C route and source-scoped helipad routing.')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--url',default='http://127.0.0.1:5347');parser.add_argument('--chrome');parser.add_argument('--captures',type=Path)
    args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.captures)
