"""Check transactional geometry editing and the offline prepared imagery catalog."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from check_geodata_workspace import paste

AOI='Chế Tạo: POLYGON((103.94 21.62,104.15 21.62,104.15 21.95,103.94 21.95,103.94 21.62))'

def run(url, chrome, captures):
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, **({'executable_path':chrome} if chrome else {}))
        context=browser.new_context(viewport={'width':1440,'height':900})
        context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(url+'/') else route.abort())
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(url+'/?workspace=geodata&offline=1')
        page.get_by_role('tab',name='Cảnh ảnh',exact=True).click()
        page.get_by_role('button',name='Tìm ảnh',exact=True).click()
        expect(page.get_by_role('alert')).to_contain_text('AOI')
        paste(page,AOI,'aoi')
        before=json.loads(page.evaluate("localStorage.getItem('dear.geodata.v1')"))
        surface=page.locator('.geodata-map-surface')
        initial=surface.bounding_box()
        page.get_by_role('button',name='Vẽ hình chữ nhật',exact=True).click()
        assert surface.bounding_box() == initial, 'Starting a drawing moved the map'
        surface.click(position={'x':180,'y':140})
        surface.click(position={'x':330,'y':260})
        expect(page.locator('.geodata-drawing-bar')).not_to_be_visible()
        after=json.loads(page.evaluate("localStorage.getItem('dear.geodata.v1')"))
        assert len(after)==1 and after[0]['id']==before[0]['id'], 'Redraw must update the current AOI'
        assert after[0]['feature']['geometry']!=before[0]['feature']['geometry']
        page.get_by_role('button',name='Hoàn tác GIS',exact=True).click()
        assert json.loads(page.evaluate("localStorage.getItem('dear.geodata.v1')"))[0]['feature']['geometry']==before[0]['feature']['geometry']
        page.get_by_role('button',name='Làm lại GIS',exact=True).click()
        page.get_by_role('button',name='Hoàn tác GIS',exact=True).click()
        # Edit through precise coordinates. Invalid geometry never overwrites the saved AOI.
        page.get_by_role('tab',name='AOI',exact=True).click()
        page.get_by_role('button',name='Chỉnh đỉnh AOI',exact=True).click()
        expect(page.locator('.geodata-vertex')).to_have_count(4)
        page.get_by_role('spinbutton',name='Kinh độ',exact=True).fill('103.95')
        page.get_by_role('button',name='Cập nhật đỉnh',exact=True).click()
        assert json.loads(page.evaluate("localStorage.getItem('dear.geodata.v1')"))==before
        page.get_by_role('button',name='Hủy',exact=True).click()
        assert json.loads(page.evaluate("localStorage.getItem('dear.geodata.v1')"))==before
        page.get_by_role('button',name='Chỉnh đỉnh AOI',exact=True).click()
        page.get_by_role('spinbutton',name='Kinh độ',exact=True).fill('103.95')
        page.get_by_role('button',name='Cập nhật đỉnh',exact=True).click()
        page.get_by_role('button',name='Áp dụng',exact=True).click()
        edited=json.loads(page.evaluate("localStorage.getItem('dear.geodata.v1')"))[0]
        assert edited['feature']['geometry']['coordinates'][0][0][0]==103.95
        assert edited['feature']['geometry']['coordinates'][0][-1]==edited['feature']['geometry']['coordinates'][0][0]
        page.get_by_role('button',name='Hoàn tác GIS',exact=True).click()
        # Invalid edits must remain a draft, with the original record available after Cancel.
        page.get_by_role('button',name='Chỉnh đỉnh AOI',exact=True).click()
        page.get_by_role('spinbutton',name='Kinh độ',exact=True).fill('104.15')
        page.get_by_role('spinbutton',name='Vĩ độ',exact=True).fill('21.95')
        page.get_by_role('button',name='Cập nhật đỉnh',exact=True).click()
        page.get_by_role('button',name='Áp dụng',exact=True).click()
        expect(page.get_by_role('alert')).to_be_visible()
        assert json.loads(page.evaluate("localStorage.getItem('dear.geodata.v1')"))==before
        page.get_by_role('button',name='Hủy',exact=True).click()
        # Dragging a vertex changes only the draft; draft undo restores it.
        page.get_by_role('button',name='Chỉnh đỉnh AOI',exact=True).click()
        vertex=page.locator('.geodata-vertex').first
        box=vertex.bounding_box()
        page.mouse.move(box['x']+6,box['y']+6);page.mouse.down()
        page.mouse.move(box['x']+30,box['y']+25,steps=8);page.mouse.up()
        expect(page.get_by_role('button',name='Hoàn tác GIS',exact=True)).to_be_enabled()
        assert json.loads(page.evaluate("localStorage.getItem('dear.geodata.v1')"))==before
        page.keyboard.press('Control+z')
        expect(page.get_by_role('button',name='Làm lại GIS',exact=True)).to_be_enabled()
        page.keyboard.press('Control+Shift+z')
        expect(page.get_by_role('button',name='Làm lại GIS',exact=True)).to_be_disabled()
        page.get_by_role('button',name='Hoàn tác GIS',exact=True).click()
        page.keyboard.press('Escape')
        # Selected scenes remain selected when visibility, filters and panel widths change.
        page.get_by_role('tab',name='Cảnh ảnh',exact=True).click()
        page.get_by_role('button',name='Tìm ảnh',exact=True).click()
        expect(page.locator('.catalog-results li').first).to_be_visible()
        rows=page.locator('.catalog-results li')
        assert rows.count()>=2
        rows.nth(0).locator('input').check();rows.nth(1).locator('input').check()
        expect(page.locator('.catalog-selection h2')).to_contain_text('2')
        rows.first.locator('button').click()
        expect(page.locator('.geodata-scene-detail')).to_contain_text('Pixel spacing')
        assert 'Mây toàn cảnh' not in page.locator('.geodata-scene-detail').inner_text()
        page.get_by_role('button',name='Xem phạm vi',exact=True).click()
        page.keyboard.press('Escape')
        expect(page.locator('.geodata-scene-detail')).to_have_count(0)
        with page.expect_download() as output:
            page.get_by_role('button',name='Xuất danh sách ảnh',exact=True).click()
        selection=json.loads(Path(output.value.path()).read_text(encoding='utf-8'))
        assert len(selection['scenes'])==2 and selection['rasterLoaded'] is False
        assert selection['catalogSource']['provider']=='Copernicus Data Space Ecosystem'
        page.get_by_role('tab',name='Lớp',exact=True).click()
        page.get_by_role('checkbox',name='Phạm vi cảnh tìm được',exact=True).uncheck()
        page.get_by_role('tab',name='Cảnh ảnh',exact=True).click()
        expect(page.locator('.catalog-selection h2')).to_contain_text('2')
        page.get_by_role('button',name='Thêm phạm vi ảnh',exact=True).click()
        expect(page.locator('.geodata-layers li')).to_have_count(3)
        # A catalog footprint added to Layers can be selected and managed as a saved feature.
        page.locator('.geodata-layers li').nth(2).locator('.geodata-feature').click()
        expect(page.locator('.geodata-layers li').nth(2)).to_have_class('is-selected')
        expect(page.locator('.geodata-scene-detail')).to_have_count(0)
        page.get_by_role('tab',name='Cảnh ảnh',exact=True).click()
        page.get_by_role('button',name='Thêm phạm vi ảnh',exact=True).click()
        expect(page.locator('.geodata-layers li')).to_have_count(3)
        page.get_by_role('tab',name='Cảnh ảnh',exact=True).click()
        page.get_by_role('combobox',name='Bộ sản phẩm',exact=True).select_option('optical')
        page.get_by_role('button',name='Tìm ảnh',exact=True).click()
        page.locator('.catalog-results button').first.click()
        expect(page.locator('.geodata-scene-detail')).to_contain_text('Mây toàn cảnh')
        if captures:
            captures.mkdir(parents=True,exist_ok=True)
        for width in [1840,1440,1024,390,320]:
            page.set_viewport_size({'width':width,'height':900})
            for theme in ['light','dark']:
                page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
                page.wait_for_timeout(200)
                assert page.locator('#geo-panel-scenes input[type=date]').first.evaluate('node=>getComputedStyle(node).colorScheme') == ('dark' if theme=='dark' else 'normal')
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme)
                # Wait for theme transitions before checking paint; mixing theme frames is not a UI state.
                assert page.locator('.geodata-snap input').evaluate("node=>getComputedStyle(node).backgroundColor") == ('rgb(255, 255, 255)' if theme=='light' else 'rgb(32, 42, 37)')
                rect=page.locator('.geodata-workspace').bounding_box()
                assert rect['x']==0 and rect['width']==width
                if captures and width in [1440,320]:
                    page.screenshot(path=str(captures/f'analysis-{width}-{theme}.png'))
        page.get_by_role('button',name='Xem phạm vi',exact=True).click()
        expect(page.locator('.geodata-scene-detail')).to_have_count(0)
        expect(surface).to_be_visible()
        page.set_viewport_size({'width':1440,'height':900})
        page.get_by_role('tab',name='Cảnh ảnh',exact=True).click()
        page.locator('.catalog-results button').first.click()
        page.get_by_role('button',name='Đóng thông tin cảnh',exact=True).click()
        separator=page.get_by_role('separator')
        initial_width=separator.get_attribute('aria-valuenow')
        separator.focus();page.keyboard.press('ArrowRight')
        assert separator.get_attribute('aria-valuenow')!=initial_width
        # A failed repository can be retried; AOI and saved geometry remain intact.
        context.route('**/catalog/che-tao.json',lambda route:route.fulfill(status=503,body='Unavailable'))
        page.reload()
        page.get_by_role('tab',name='Cảnh ảnh',exact=True).click()
        expect(page.get_by_role('alert')).to_contain_text('Không tải được danh mục ảnh')
        context.unroute('**/catalog/che-tao.json')
        page.get_by_role('button',name='Thử lại',exact=True).click()
        expect(page.get_by_role('button',name='Tìm ảnh',exact=True)).to_be_visible()
        expect(page.locator('.catalog-selection h2')).to_contain_text('2')
        # KML annotations and empty altitude fields must not invalidate an otherwise valid import.
        page.get_by_role('tab',name='Lớp',exact=True).click()
        page.get_by_role('button',name='Nhập dữ liệu',exact=True).click()
        page.locator('#geodata-import-fields select').select_option('auto')
        count=page.locator('.geodata-layers li').count()
        kml='''<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
        <Placemark><name>Annotation only</name></Placemark>
        <Placemark><name>Strip</name><ExtendedData><Data name="geometryRole"><value>footprint</value></Data></ExtendedData>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>104,21, 105,21, 105,22, 104,21,</coordinates></LinearRing></outerBoundaryIs></Polygon>
        </Placemark></Document></kml>'''
        page.locator('input[type=file]').set_input_files({'name':'survey.kml','mimeType':'application/vnd.google-earth.kml+xml','buffer':kml.encode()})
        expect(page.locator('.geodata-layers li')).to_have_count(count+1)
        stored=json.loads(page.evaluate("localStorage.getItem('dear.geodata.v1')"))
        assert stored[-1]['role']=='footprint' and stored[-1]['feature']['geometry']['coordinates'][0][0]==[104,21,0]
        # Export and reimport with From file preserves roles, rather than silently treating all data as AOI.
        with page.expect_download() as output:
            page.get_by_role('button',name='GeoJSON',exact=True).click()
        exported=Path(output.value.path()).read_bytes()
        page.locator('input[type=file]').set_input_files({'name':'roundtrip.geojson','mimeType':'application/geo+json','buffer':exported})
        expect(page.locator('.geodata-layers li')).to_have_count(2*(count+1))
        stored=json.loads(page.evaluate("localStorage.getItem('dear.geodata.v1')"))
        assert sum(record['role']=='aoi' for record in stored)==1
        assert sum(record['role']=='footprint' for record in stored)==6
        # Snap uses screen pixels and also applies to dragged vertices.
        aoi_id=next(record['id'] for record in stored if record['role']=='aoi')
        paste(page,'POINT(103.96 21.64)','reference')
        page.locator(f'[data-geodata-id="{aoi_id}"] .geodata-feature').click()
        page.get_by_role('button',name='Xem trên bản đồ',exact=True).click()
        page.get_by_role('checkbox',name='Bắt đỉnh',exact=True).check()
        page.get_by_role('tab',name='AOI',exact=True).click()
        page.get_by_role('button',name='Chỉnh đỉnh AOI',exact=True).click()
        target=page.locator('.leaflet-points-pane path').bounding_box()
        box=page.locator('.geodata-vertex').first.bounding_box()
        page.mouse.move(box['x']+6,box['y']+6);page.mouse.down()
        page.mouse.move(target['x']+target['width']/2+5,target['y']+target['height']/2,steps=8)
        page.mouse.up()
        page.get_by_role('button',name='Áp dụng',exact=True).click()
        stored=json.loads(page.evaluate("localStorage.getItem('dear.geodata.v1')"))
        assert next(record for record in stored if record['role']=='aoi')['feature']['geometry']['coordinates'][0][0]==[103.96,21.64]
        assert not errors, errors
        browser.close()
    print('Analysis tools passed: stable drawing, AOI replacement, transactional vertex editing, undo/redo, real prepared catalog, metadata, selection/visibility, export, duplicate prevention, retry and responsive themes.')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--url',default='http://127.0.0.1:5213')
    parser.add_argument('--chrome',default=None)
    parser.add_argument('--captures',type=Path)
    args=parser.parse_args()
    run(args.url.rstrip('/'),args.chrome,args.captures)
