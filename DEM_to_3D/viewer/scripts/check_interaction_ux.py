"""Check stable map hover, modal entry and GIS/response edit continuity."""
from browser_preferences import use_vietnamese
from network_browser_fixture import install_network_fixture
from gis_browser_actions import map_tool
from gis_browser_actions import gis_task, clear_prepared_survey, select_scenario_community
import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect


def run(url, chrome, captures=None):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=chrome)
        context = use_vietnamese(browser.new_context(viewport={'width': 1440, 'height': 960}))
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(url + '/') else route.abort())
        install_network_fixture(context,url)
        page = use_vietnamese(context.new_page()); errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url + '/?map=2d&offline=1&demoRole=manager')
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=30000)
        baseline=clear_prepared_survey(page)
        page.wait_for_timeout(300)
        def fixed_hover(marker):
            before = marker.bounding_box()
            marker.hover()
            page.wait_for_timeout(160)
            after = marker.bounding_box()
            assert max(abs(before[key]-after[key]) for key in ['x','y','width','height']) < .5, (before,after)
            page.mouse.move(2,2)
        markers = page.locator('.map-pin:not(.is-selected):visible')
        for identity in markers.evaluate_all('nodes=>nodes.slice(0,5).map(n=>n.dataset.mapObject)'):
            fixed_hover(page.locator(f'[data-map-object="{identity}"]:visible'))
        search = page.get_by_role('combobox', name='Tìm trên bản đồ', exact=True)
        search.fill('Nậm')
        results = page.get_by_role('listbox', name='Kết quả tìm kiếm')
        options = results.get_by_role('option'); expect(options.first).to_be_visible()
        options.nth(1).hover()
        expect(results.locator('[aria-selected="true"]')).to_have_count(1)
        expect(options.nth(1)).to_have_attribute('aria-selected','true')
        search.press('Escape')
        map_tool(page, 'Dữ liệu GIS').click()
        gis_task(page)
        for width in [1440,390,320]:
            page.set_viewport_size({'width':width,'height':960})
            trigger = page.get_by_role('button',name='Thêm điểm tọa độ',exact=True)
            trigger.click()
            dialog = page.get_by_role('dialog',name='Thêm điểm tọa độ',exact=True)
            expect(dialog).to_be_visible()
            box = dialog.bounding_box()
            assert box['x']>=0 and box['x']+box['width']<=width+1
            assert dialog.evaluate('node=>node.scrollWidth<=node.clientWidth')
            if captures:
                captures.mkdir(parents=True,exist_ok=True)
                page.screenshot(path=str(captures/f'point-dialog-{width}.png'),animations='disabled')
            page.keyboard.press('Escape'); expect(trigger).to_be_focused()
            expect(page.locator('.geodata-workspace')).to_be_visible()
        page.set_viewport_size({'width':1440,'height':960})
        page.get_by_role('button',name='Thêm điểm tọa độ',exact=True).click()
        dialog = page.get_by_role('dialog',name='Thêm điểm tọa độ',exact=True)
        dialog.get_by_label('Tên điểm',exact=True).fill('Điểm khảo sát liên kết')
        dialog.get_by_label('Vĩ độ (°)',exact=True).fill('21.78')
        dialog.get_by_label('Kinh độ (°)',exact=True).fill('104.05')
        dialog.get_by_role('button',name='Đánh dấu điểm',exact=True).click()
        expect(dialog).to_have_count(0)
        inspector = page.locator('.geodata-detail')
        inspector.get_by_label('Tên đối tượng',exact=True).fill('Điểm đã đổi tên')
        inspector.get_by_role('button',name='Lưu tên',exact=True).click()
        inspector.get_by_role('button',name='Sửa tọa độ',exact=True).click()
        coordinates = page.get_by_role('dialog',name='Sửa tọa độ',exact=True)
        coordinates.get_by_label('Vĩ độ (°)',exact=True).fill('21.781')
        coordinates.get_by_label('Kinh độ (°)',exact=True).fill('104.051')
        coordinates.get_by_role('button',name='Lưu tọa độ',exact=True).click()
        expect(inspector.locator('.geodata-coordinate').first).to_have_text('21.781000°')
        assert page.evaluate("localStorage.getItem('dear.gis.v2')") == baseline
        page.get_by_role('button', name='Áp dụng thay đổi', exact=True).click()
        page.get_by_role('dialog', name='Áp dụng thay đổi GIS?', exact=True).get_by_role('button', name='Áp dụng', exact=True).click()
        records = json.loads(page.evaluate("localStorage.getItem('dear.gis.v2')"))['records']
        record = next(item for item in records if item['name']=='Điểm đã đổi tên')
        assert record['feature']['geometry']['coordinates']==[104.051,21.781]
        assert record['feature']['properties']['editMethod']=='manual-coordinates-v1'
        assert record['source']['format']=='coordinate'
        page.get_by_role('button',name='Đóng hồ sơ đối tượng',exact=True).click()
        for _ in range(5):
            page.get_by_role('button',name='Thu nhỏ GIS',exact=True).click()
            page.wait_for_timeout(280)
        surface=page.locator('.geodata-map .leaflet-container').bounding_box()
        for marker in page.locator('.geodata-map .map-pin:visible').all():
            box=marker.bounding_box()
            if box and box['x']>surface['x']+28 and box['y']>surface['y']+28 and box['x']+box['width']<surface['x']+surface['width']-28 and box['y']+box['height']<surface['y']+surface['height']-28: fixed_hover(marker)
        select_scenario_community(page,'Khau Mang')
        card = page.locator('.scenario-card')
        expect(card).to_be_visible(timeout=5000)
        card.get_by_role('button',name='Đổi tên',exact=True).click(timeout=5000)
        card.get_by_label('Tên',exact=True).fill('Tên nháp')
        page.keyboard.press('Escape')
        expect(page.locator('.geodata-workspace')).to_be_visible()
        expect(card.get_by_role('heading',level=2)).to_have_text('Khau Mang')
        expect(card.get_by_role('button',name='Đổi tên',exact=True)).to_be_focused()
        card.get_by_role('button',name='Đổi tên',exact=True).click()
        card.get_by_label('Tên',exact=True).fill('Khau Mang kiểm tra')
        card.get_by_role('button',name='Lưu',exact=True).click()
        expect(card.get_by_role('heading',level=2)).to_have_text('Khau Mang kiểm tra')
        page.get_by_role('button', name='Áp dụng thay đổi', exact=True).click()
        page.get_by_role('dialog', name='Áp dụng thay đổi GIS?', exact=True).get_by_role('button', name='Áp dụng', exact=True).click()
        card.get_by_role('button',name='Đóng',exact=True).click()
        page.locator('.geodata-feature').filter(has_text='Điểm đã đổi tên').click()
        page.get_by_role('button',name='Về bản đồ ứng phó',exact=True).click()
        expect(page.locator('.map-marker-layer')).to_contain_text('Khau Mang kiểm tra')
        expect(page.locator('.field-map-card')).to_contain_text('Điểm đã đổi tên')
        expect(page.locator('.leaflet-dear-selection-pane .map-selected-reference').first).to_be_visible()
        if captures:
            captures.mkdir(parents=True,exist_ok=True)
            page.screenshot(path=str(captures/'gis-response-reference.png'),animations='disabled')
        page.reload()
        expect(page.locator('.map-marker-layer')).to_contain_text('Khau Mang kiểm tra',timeout=30000)
        assert not errors, errors
        browser.close()
    print('Interaction UX passed: fixed hover, one search highlight, modal input/focus, point-coordinate persistence, GIS/response shared names and reference selection.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:5211');parser.add_argument('--chrome',default=None);parser.add_argument('--captures',type=Path)
    args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.captures)
