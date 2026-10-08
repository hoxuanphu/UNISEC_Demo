"""Exercise local vector import, AOI coverage, drawing, persistence and GIS export."""
import argparse
import json
import tempfile
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


STRIPS = '''Strix-2: POLYGON((103.91837379806059 21.985881028259936, 104.02711922657171 21.548588075305332, 104.18745542653372 21.579715641421235, 104.07870999802259 22.01971591617764, 103.91837379806059 21.985881028259936))
Strix-3: POLYGON((104.08803268362155 21.546969559434526, 103.92647890571061 21.5756741383793, 104.01794387749813 22.01908263773835, 104.179496765540907 21.990378058793063, 104.08803268362155 21.546969559434526))
POLYGON((104.29260436799521 21.69973602498226, 104.148903579990803 21.580771700729777, 103.8135305697942 21.865206634560078, 103.91709913788138 21.984170958812562, 104.29260436799521 21.69973602498226))'''
KML = '''<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder><name>Survey</name>
<Placemark><name>Survey &amp; reference</name><description><![CDATA[<img src=x onerror="alert(1)">]]></description><MultiGeometry>
<Point><coordinates>104.053554,21.782919,20</coordinates></Point>
<LineString><coordinates>104,21.7 104.1,21.8</coordinates></LineString>
<Polygon><outerBoundaryIs><LinearRing><coordinates>104,21 106,21 106,22 104,22 104,21</coordinates></LinearRing></outerBoundaryIs>
<innerBoundaryIs><LinearRing><coordinates>104.2,21.2 104.3,21.2 104.3,21.3 104.2,21.3 104.2,21.2</coordinates></LinearRing></innerBoundaryIs></Polygon>
</MultiGeometry></Placemark></Folder></Document></kml>'''


def check_controls(page, theme):
    """Check the reported flush disclosure and consistent standalone/embedded form paint."""
    toggle = page.locator('.geodata-section-toggle')
    before = toggle.bounding_box()
    toggle.hover()
    assert toggle.bounding_box() == before, 'Disclosure shifted on hover'
    metrics = toggle.evaluate('''node => {
      const style = getComputedStyle(node), row = node.getBoundingClientRect();
      const label = node.querySelector('span').getBoundingClientRect();
      const icon = node.querySelector('svg').getBoundingClientRect();
      return {height: row.height, left: label.left - row.left, right: row.right - icon.right};
    }''')
    assert metrics['height'] >= 36 and metrics['left'] >= 9 and metrics['right'] >= 9, metrics
    toggle.focus()
    page.keyboard.press('Tab'); page.keyboard.press('Shift+Tab')
    assert toggle.evaluate("node => node.matches(':focus-visible') && getComputedStyle(node).outlineWidth === '2px'")
    assert page.locator('.geodata-workspace select').first.evaluate('''node => {
      const style = getComputedStyle(node);
      return style.appearance === 'none' && parseFloat(style.paddingRight) >= 30 && style.backgroundImage.includes('svg');
    }''')
    checkbox = page.locator('.geodata-workspace input[type=checkbox]:checked').first
    if checkbox.count():
        paint = checkbox.evaluate("node => ({appearance: getComputedStyle(node).appearance, image: getComputedStyle(node).backgroundImage})")
        assert paint['appearance'] == 'none', paint
        assert ('13201e' if theme == 'dark' else 'white') in paint['image'], paint


def paste(page, text, role='reference'):
    page.get_by_role('tab', name='Lớp', exact=True).click()
    panel = page.locator('.geodata-import')
    toggle = panel.get_by_role('button', name='Nhập dữ liệu', exact=True)
    if toggle.get_attribute('aria-expanded') == 'false':
        toggle.click()
    panel.locator('select').select_option(role)
    if not panel.locator('textarea').count():
        panel.get_by_role('button', name='Dán tọa độ / WKT', exact=True).click()
    panel.locator('textarea').fill(text)
    panel.get_by_role('button', name='Nhập', exact=True).click()


def run(url, chrome, captures):
    with tempfile.TemporaryDirectory() as temporary, sync_playwright() as p:
        root = Path(temporary)
        browser = p.chromium.launch(headless=True, **({'executable_path': chrome} if chrome else {}))
        context = browser.new_context(viewport={'width':1366,'height':768}, permissions=['clipboard-read','clipboard-write'])
        requests, errors = [], []
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(url + '/') else route.abort())
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: requests.append(request.url))
        page.goto(url + '/?workspace=geodata&offline=1')
        expect(page.locator('.geodata-workspace')).to_be_visible()
        expect(page).to_have_title('DEAR | Dữ liệu GIS')
        paste(page, STRIPS, 'footprint')
        expect(page.locator('.geodata-layers li')).to_have_count(3)
        expect(page.locator('.geodata-layers')).to_contain_text('Strix-2')
        paste(page, '21.782919° N, 104.053554° E')
        expect(page.locator('.geodata-layers li')).to_have_count(4)
        expect(page.locator('.geodata-coordinate')).to_contain_text('21.782919°')
        expect(page.locator('.geodata-map-label').last).to_be_visible()
        # Standalone GIS has no dependency on the response scenario, API or DEM.
        assert not any('/datasets/' in request or '/assets/che_tao' in request or '/api/' in request for request in requests), requests
        if captures:
            captures.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(captures / 'gis-strips-dark.png'), animations='disabled')
        # Invalid batches are atomic and retain existing data.
        before = page.evaluate("localStorage.getItem('dear.geodata.v1')")
        paste(page, 'POLYGON((104 21,105 22,105 21,104 22,104 21))')
        expect(page.get_by_role('alert')).to_contain_text('tự cắt')
        expect(page.locator('.geodata-layers li')).to_have_count(4)
        assert page.evaluate("localStorage.getItem('dear.geodata.v1')") == before
        page.get_by_role('button', name='Đóng lỗi nhập').click()
        (root / 'local.kml').write_text(KML, encoding='utf-8')
        (root / 'network.kml').write_text('<kml><NetworkLink><Link><href>https://example.invalid/remote</href></Link></NetworkLink></kml>', encoding='utf-8')
        page.locator('input[type=file]').set_input_files([root / 'local.kml',root / 'network.kml'])
        expect(page.get_by_role('alert')).to_contain_text('NetworkLink')
        expect(page.locator('.geodata-layers li')).to_have_count(4)
        page.get_by_role('button', name='Đóng lỗi nhập').click()
        (root / 'local.kml').write_text(KML.replace('106,21 ','106,21,0 '), encoding='utf-8')
        page.locator('input[type=file]').set_input_files(root / 'local.kml')
        expect(page.locator('.geodata-layers li')).to_have_count(7)
        page.get_by_role('button', name='Nguồn và tọa độ').click()
        expect(page.locator('.geodata-metadata')).to_contain_text('<img src=x')
        assert page.locator('.geodata-metadata img').count() == 0
        expect(page.locator('.geodata-detail select')).to_be_disabled()
        # A fresh project with overlapping footprints has 100%, not 150%, coverage.
        page.evaluate("localStorage.removeItem('dear.geodata.v1')")
        page.reload()
        paste(page,'AOI: POLYGON((104 21,106 21,106 22,104 22,104 21))','aoi')
        paste(page,'Left: POLYGON((104 21,105.5 21,105.5 22,104 22,104 21))\nRight: POLYGON((104.5 21,106 21,106 22,104.5 22,104.5 21))','footprint')
        page.get_by_role('tab', name='AOI', exact=True).click()
        expect(page.locator('[data-coverage-total]')).to_have_text('100%')
        page.get_by_role('tab', name='Lớp', exact=True).click()
        page.get_by_role('checkbox', name='Hiện Left', exact=True).uncheck()
        page.get_by_role('tab', name='AOI', exact=True).click()
        expect(page.locator('[data-coverage-total]')).to_have_text('100%')
        page.get_by_role('tab', name='Lớp', exact=True).click()
        page.locator('.geodata-feature').filter(has_text='Right').click()
        page.get_by_role('textbox', name='Tên đối tượng').fill('Right renamed')
        page.get_by_role('tab', name='AOI', exact=True).click()
        expect(page.locator('.geodata-coverage table')).to_contain_text('Right renamed')
        page.get_by_role('tab', name='Lớp', exact=True).click()
        page.get_by_role('button', name='Sao chép WKT').click()
        expect(page.get_by_role('status')).to_contain_text('Đã sao chép WKT')
        assert page.evaluate('navigator.clipboard.readText()').startswith('POLYGON')
        for format in ['GeoJSON','KML']:
            with page.expect_download() as download:
                page.locator('.geodata-export').get_by_role('button', name=format, exact=True).click()
            path = root / download.value.suggested_filename
            download.value.save_as(path)
            if format == 'GeoJSON':
                exported = json.loads(path.read_text(encoding='utf-8'))
                assert len(exported['features']) == 3
                assert abs(exported['metadata']['coverage']['fraction'] - 1) < 1e-10
            else:
                assert 'Right renamed' in path.read_text(encoding='utf-8')
        page.reload()
        expect(page.locator('.geodata-layers li')).to_have_count(3)
        expect(page.get_by_role('checkbox', name='Hiện Left', exact=True)).not_to_be_checked()
        # Drawing owns map input; Enter closes a valid ring, Escape cancels only the drawing.
        page.get_by_role('button', name='Vẽ vùng quan tâm', exact=True).click()
        surface = page.locator('.geodata-map-surface')
        for x,y in [(170,130),(270,130),(270,230),(190,240)]:
            surface.click(position={'x':x,'y':y})
        expect(page.locator('.geodata-drawing-bar')).to_contain_text('4 đỉnh')
        page.locator('.geodata-map-surface').focus()
        page.keyboard.press('Backspace')
        expect(page.locator('.geodata-drawing-bar')).to_contain_text('3 đỉnh')
        page.keyboard.press('Enter')
        expect(page.locator('.geodata-drawing-bar')).not_to_be_visible()
        expect(page.locator('.geodata-layers li')).to_have_count(3)
        records = json.loads(page.evaluate("localStorage.getItem('dear.geodata.v1')"))
        assert len([r for r in records if r['role'] == 'aoi']) == 1
        drawn=next(record for record in records if record['role'] == 'aoi')
        assert drawn['feature']['geometry']['coordinates'][0][0] == drawn['feature']['geometry']['coordinates'][0][-1]
        page.get_by_role('button', name='Vẽ vùng quan tâm', exact=True).click()
        surface.click(position={'x':160,'y':130})
        page.get_by_role('button', name='Hoàn tác GIS', exact=True).focus()
        page.keyboard.press('Escape')
        expect(page.locator('.geodata-drawing-bar')).not_to_be_visible()
        expect(page.locator('.geodata-workspace')).to_be_visible()
        expect(page.locator('.geodata-layers li')).to_have_count(3)
        # Geometry and UI round trip through exported KML, including polygon holes.
        page.get_by_role('tab', name='Lớp', exact=True).click()
        page.locator('input[type=file]').set_input_files(root / 'dear-all.kml')
        expect(page.locator('.geodata-layers li')).to_have_count(6)
        for width in [1366,1024,390,320]:
            page.set_viewport_size({'width':width,'height':740})
            for theme in ['light','dark']:
                page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
                if width < 761:
                    page.locator('.geodata-mobile-tabs').get_by_role('button', name='Dữ liệu', exact=True).click()
                check_controls(page, theme)
                expect(page.locator('.geodata-header')).to_be_visible()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width,theme)
                assert page.locator('.geodata-sidebar').evaluate('node=>node.scrollWidth <= node.clientWidth'), (width,theme)
                if width < 761:
                    page.locator('.geodata-mobile-tabs').get_by_role('button', name='Bản đồ', exact=True).click()
                    expect(surface).to_be_visible()
                    surface.click(position={'x':60,'y':80})
                    page.locator('.geodata-mobile-tabs').get_by_role('button', name='Dữ liệu', exact=True).click()
                if captures and width in [1366,320]:
                    page.screenshot(path=str(captures / f'gis-{theme}-{width}.png'), animations='disabled')
        assert not errors, errors
        # The tool also opens from Layers and returns keyboard focus on close.
        page.set_viewport_size({'width':1366,'height':768})
        page.goto(url)
        expect(page.locator('.incident-priority-row').first).to_be_visible(timeout=25000)
        for iteration in range(3):
            page.get_by_role('button', name='Lớp bản đồ', exact=True).click()
            page.get_by_role('button', name='Dữ liệu GIS', exact=True).click()
            expect(page.locator('.geodata-workspace')).to_have_attribute('aria-modal','true')
            expect(page.locator('.geodata-layers li')).to_have_count(6)
            check_controls(page, page.locator('html').get_attribute('data-theme'))
            assert page.locator('.geodata-header button').count() == 1, 'Duplicate exit controls'
            if iteration == 0:
                page.get_by_role('button', name='Vẽ vùng quan tâm', exact=True).click()
                surface.click(position={'x':100,'y':100});page.keyboard.press('Escape')
                expect(page.locator('.geodata-workspace')).to_be_visible()
            page.keyboard.press('Escape')
            expect(page.locator('.geodata-workspace')).to_have_count(0)
            expect(page.get_by_role('button', name='Lớp bản đồ', exact=True)).to_be_focused()
        assert not errors, errors
        # Complete drawings by double click or by clicking their first vertex.
        drawing_context = browser.new_context(viewport={'width':1366,'height':768})
        drawing_context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(url + '/') else route.abort())
        drawing_page = drawing_context.new_page()
        drawing_page.goto(url + '/?workspace=geodata&offline=1')
        draw_surface = drawing_page.locator('.geodata-map-surface')
        for mode in ['double','first']:
            drawing_page.get_by_role('button', name='Vẽ vùng quan tâm', exact=True).click()
            for x,y in [(170,130),(270,130),(270,230)]:
                draw_surface.click(position={'x':x,'y':y})
            if mode == 'double':
                draw_surface.dblclick(position={'x':270,'y':230})
            else:
                draw_surface.click(position={'x':170,'y':130})
            expect(drawing_page.locator('.geodata-drawing-bar')).not_to_be_visible()
            assert not drawing_page.locator('[role=alert]').count()
        expect(drawing_page.locator('.geodata-layers li')).to_have_count(1)
        assert not any(record['visible'] is False for record in json.loads(drawing_page.evaluate("localStorage.getItem('dear.geodata.v1')")))
        drawing_context.close()
        context.close();browser.close()
        print('GIS data passed: screenshot WKT/point, KML MultiGeometry/holes, atomic errors, union coverage, visibility, drawing, persistence, export, modal lifecycle and responsive themes.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:5213')
    parser.add_argument('--chrome', default=None)
    parser.add_argument('--captures', type=Path)
    args = parser.parse_args()
    run(args.url.rstrip('/'),args.chrome,args.captures)
