"""Verify one GIS detail surface, replacement/close transitions and stable map points."""
from browser_preferences import use_vietnamese
from network_browser_fixture import install_network_fixture
from gis_browser_actions import map_tool
from gis_browser_actions import gis_task, clear_prepared_survey, select_scenario_community
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

DETAILS = '.geodata-inspector:visible, .geodata-scene-detail:visible, .geodata-map .field-map-card:visible'
POINT_NAMES = ['081026.kml 1', '081026.kml 2', '081026.kml 3']


def run(url, chrome, captures=None):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=chrome)
        context = use_vietnamese(browser.new_context(viewport={'width': 1440, 'height': 960}))
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(url + '/') else route.abort())
        install_network_fixture(context,url)
        page = use_vietnamese(context.new_page())
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url + '/?map=2d&offline=1&demoRole=manager')
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=30000)
        baseline=clear_prepared_survey(page)
        map_tool(page, 'Dữ liệu GIS').click()
        gis_task(page)
        workspace = page.locator('.geodata-workspace')
        details = workspace.locator(DETAILS)
        inspector = workspace.locator('.geodata-inspector')
        scenario = workspace.locator('.scenario-card')
        group = workspace.locator('.point-group-card')
        scene = workspace.locator('.geodata-scene-detail')

        def one(panel):
            expect(panel).to_be_visible()
            expect(details).to_have_count(1)

        def layer(name):
            return workspace.locator('.geodata-feature').filter(has_text=name)

        def import_file(name, text, role='auto'):
            page.get_by_role('button', name='Nhập dữ liệu', exact=True).click()
            dialog = page.get_by_role('dialog', name='Nhập dữ liệu', exact=True)
            dialog.get_by_role('combobox').select_option(role)
            dialog.locator('input[type=file]').set_input_files({'name': name, 'mimeType': 'application/octet-stream', 'buffer': text.encode('utf-8')})
            expect(dialog).to_have_count(0)

        def open_scenario():
            select_scenario_community(page,'Khau Mang')
            one(scenario)

        def open_group():
            cluster=workspace.locator('.map-point-cluster:visible').first
            cluster.focus();cluster.press('Enter')
            one(group)

        kml = '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>' + ''.join(
            f'<Placemark><name>{name}</name><Point><coordinates>{104.05+i/1000000},21.78</coordinates></Point></Placemark>'
            for i, name in enumerate(POINT_NAMES)
        ) + '</Document></kml>'
        import_file('081026.kml', kml)
        expect(workspace.locator('.geodata-feature')).to_have_count(3)
        assert page.evaluate("localStorage.getItem('dear.gis.v2')") == baseline
        for _ in range(5):
            page.get_by_role('button', name='Thu nhỏ GIS', exact=True).click()
            page.wait_for_timeout(280)

        # The original defect: scenario card remains behind an inspector opened from Layers.
        open_scenario()
        layer(POINT_NAMES[0]).click()
        one(inspector)
        expect(scenario).to_have_count(0)
        if captures:
            captures.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(captures / 'gis-one-point-detail.png'))
        page.get_by_role('button', name='Đóng hồ sơ đối tượng', exact=True).click()
        expect(details).to_have_count(0)

        # Selecting a scenario while the inspector is open replaces it too.
        layer(POINT_NAMES[0]).click()
        open_scenario()
        expect(inspector).to_have_count(0)
        scenario.get_by_role('button', name='Di chuyển trên bản đồ', exact=True).click()
        layer(POINT_NAMES[0]).click()
        one(inspector)
        open_scenario()
        expect(scenario.get_by_role('button', name='Di chuyển trên bản đồ', exact=True)).to_be_visible()
        scenario.get_by_role('button', name='Đổi tên', exact=True).click()
        scenario.get_by_label('Tên', exact=True).fill('Tên nháp')
        page.keyboard.press('Escape')
        one(scenario)
        expect(scenario.get_by_role('heading', level=2)).to_have_text('Khau Mang')
        workspace.get_by_label('Lớp tình huống', exact=True).uncheck()
        expect(details).to_have_count(0)
        workspace.get_by_label('Lớp tình huống', exact=True).check()
        expect(details).to_have_count(0)

        # Groups replace scenario/feature details, including the currently selected member.
        open_scenario()
        open_group()
        expect(scenario).to_have_count(0)
        group.get_by_role('button', name=POINT_NAMES[0], exact=True).click()
        one(inspector)
        expect(group).to_have_count(0)
        open_group()
        layer(POINT_NAMES[0]).click()
        one(inspector)
        expect(group).to_have_count(0)
        inspector.get_by_role('button', name='Sửa tọa độ', exact=True).click()
        expect(page.get_by_role('dialog', name='Sửa tọa độ', exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        one(inspector)
        page.keyboard.press('Escape')
        expect(details).to_have_count(0)
        expect(workspace).to_be_visible()
        open_group()
        page.get_by_role('combobox', name='Hiển thị điểm', exact=True).select_option('individual')
        expect(details).to_have_count(0)
        paths = workspace.locator('.leaflet-points-pane :is(path.map-reference-point,.geodata-selected-point)')
        expect(paths).to_have_count(3)
        paths.last.click()
        one(inspector)
        page.keyboard.press('Escape')
        expect(details).to_have_count(0)
        page.get_by_role('combobox', name='Hiển thị điểm', exact=True).select_option('group')
        expect(workspace.locator('.geodata-feature')).to_have_count(3)
        assert page.evaluate("localStorage.getItem('dear.gis.v2')") == baseline

        # Cursor updates must not recreate GIS points or restart their interactions.
        page.wait_for_timeout(500)
        page.evaluate("""() => {
            window.pointChanges = 0;
            window.pointObserver = new MutationObserver(rows => window.pointChanges += rows.length);
            window.pointObserver.observe(document.querySelector('.leaflet-points-pane'), {childList:true, subtree:true});
        }""")
        surface = workspace.locator('.geodata-map-surface').bounding_box()
        for i in range(18):
            page.mouse.move(surface['x'] + 50 + i*3, surface['y'] + 100)
            page.wait_for_timeout(20)
        assert page.evaluate('window.pointChanges') == 0
        page.evaluate('window.pointObserver.disconnect()')

        # Scene metadata uses the same ownership rule in both selection directions.
        polygon = {'type': 'Feature', 'properties': {'name': 'AOI kiểm tra'}, 'geometry': {'type': 'Polygon', 'coordinates': [[[103.98,21.70],[104.12,21.70],[104.12,21.86],[103.98,21.86],[103.98,21.70]]]}}
        import_file('aoi.geojson', json.dumps(polygon), role='aoi')
        page.get_by_role('tab', name='Ảnh vệ tinh', exact=True).click()
        page.get_by_role('button', name='Tìm ảnh', exact=True).click()
        metadata = page.get_by_role('button', name='Thông tin ảnh ', exact=False)
        expect(metadata.first).to_be_visible()
        def open_scene():
            page.get_by_role('tab',name='Ảnh vệ tinh',exact=True).click()
            if not metadata.first.is_visible():page.get_by_role('button',name='Tìm ảnh',exact=True).click()
            metadata.first.click()
            one(scene)
        open_scenario()
        open_scene()
        expect(scenario).to_have_count(0)
        open_scenario()
        expect(scene).to_have_count(0)
        open_scene()
        page.keyboard.press('Escape')
        expect(details).to_have_count(0)
        expect(workspace).to_be_visible()

        # Inspector fits compact/mobile layouts and never reveals the old panel on close.
        page.get_by_role('tab', name='Lớp', exact=True).click()
        for width in [1440, 1024, 390, 320]:
            page.set_viewport_size({'width': width, 'height': 960})
            layer(POINT_NAMES[0]).click()
            one(inspector)
            box = inspector.bounding_box()
            assert box['x'] >= 0 and box['x'] + box['width'] <= width + 1, box
            page.keyboard.press('Escape')
            expect(details).to_have_count(0)
            expect(workspace).to_be_visible()
        page.keyboard.press('Escape')
        page.get_by_role('dialog', name='Còn thay đổi chưa áp dụng', exact=True).get_by_role('button', name='Bỏ bản nháp và đóng', exact=True).click()
        expect(workspace).to_have_count(0)
        assert not errors, errors
        browser.close()
    print('GIS details passed: one panel, feature/scenario/group/scene replacement, nested Escape, move cancellation, original coordinates, stable points and responsive widths.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5321')
    parser.add_argument('--chrome', default=None)
    parser.add_argument('--captures', type=Path)
    args = parser.parse_args()
    run(args.url.rstrip('/'), args.chrome, args.captures)
