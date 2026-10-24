"""Exercise the selected-point inspector and linked manual extents in the real Demo UI."""
from browser_preferences import use_vietnamese
from gis_browser_actions import clear_prepared_survey
from gis_browser_actions import map_tool, open_header_help
from gis_browser_actions import gis_task, apply_boundary, download_geometry
import argparse, json, tempfile, uuid
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from map_wait import settled_box

def run(url, chrome, captures):
    pid, aid = str(uuid.uuid4()), str(uuid.uuid4())
    source = {"name": "survey.kml", "format": "KML", "importedAt": "2026-10-12T00:00:00Z"}
    point = {"id": pid, "name": "Điểm thực địa A", "role": "reference", "visible": True, "source": source,
        "feature": {"type": "Feature", "properties": {"name": "Điểm thực địa A", "timestamp": "2026-09-29T08:30:15+07:00"}, "geometry": {"type": "Point", "coordinates": [104.05,21.78]}}}
    aoi = {"id": aid, "name": "AOI phân tích", "role": "aoi", "visible": True, "source": source,
        "feature": {"type": "Feature", "properties": {"name": "AOI phân tích"}, "geometry": {"type": "Polygon", "coordinates": [[[104.045,21.775],[104.055,21.775],[104.055,21.785],[104.045,21.785],[104.045,21.775]]]}}}
    with tempfile.TemporaryDirectory() as temp, sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=chrome)
        context = use_vietnamese(browser.new_context(viewport={"width":1440,"height":960}, timezone_id="Asia/Bangkok"))
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(url + '/') else route.abort())
        page = use_vietnamese(context.new_page()); errors=[]; page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(url + '/?map=2d&offline=1&demoRole=manager')
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=30000)
        clear_prepared_survey(page)
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=25000)
        page.evaluate('''records=>{
            const data=JSON.parse(localStorage.getItem('dear.gis.v2'));
            data.records=records;
            localStorage.setItem('dear.gis.v2',JSON.stringify(data));
        }''',[point,aoi]);page.reload()
        map_tool(page, 'Dữ liệu GIS').click()
        gis_task(page)
        page.locator(f'[data-geodata-id="{pid}"] .geodata-feature').click()
        expect(page.locator('.geodata-inspector')).to_be_visible()
        assert page.locator('.geodata-sidebar .geodata-detail').count()==0
        inspector=page.locator('.geodata-inspector')
        inspector.get_by_role('button',name='Thêm ghi nhận thực địa',exact=True).click()
        expect(inspector.locator('input[type=datetime-local]')).to_have_value('2026-09-29T08:30:15')
        inspector.locator('.field-observation details.field-extra').evaluate('(el)=>el.open=true')
        inspector.get_by_label('Ghi chú hiện trường',exact=True).fill('Vết trượt ghi nhận khi khảo sát')
        inspector.get_by_role('button',name='Lưu ghi nhận',exact=True).click()
        def records():
            # Draft edits are intentionally not published to localStorage yet.
            with page.expect_download() as draft_download:
                download_geometry(page, 'GeoJSON')
            exported=json.loads(Path(draft_download.value.path()).read_text(encoding='utf-8'))
            return [{'id': f['id'], 'role': f['properties']['geometryRole'], 'feature':f} for f in exported['features']]
        assert records()[0]['feature']['properties']['dearObservation']['observedAt']=='2026-09-29T01:30:15.000Z'
        def draw(offset=0):
            inspector.get_by_role('button',name='Vẽ vùng nghi ảnh hưởng',exact=True).click()
            expect(inspector).to_be_hidden()
            expect(page.locator('.geodata-drawing-bar')).to_contain_text('Vùng nghi ảnh hưởng')
            box=page.locator('.geodata-map-surface').bounding_box()
            for x,y in [(0.35+offset,0.35),(0.45+offset,0.35),(0.46+offset,0.48),(0.34+offset,0.48)]:page.mouse.click(box['x']+box['width']*x,box['y']+box['height']*y)
            apply_boundary(page)
            expect(inspector).to_be_visible()
        draw();draw(0.12)
        expect(inspector.locator('[data-field-area-id]')).to_have_count(2)
        areas=[r for r in records() if 'dearFieldArea' in r['feature']['properties']]
        assert len(areas)==2 and all(r['feature']['properties']['dearFieldArea']['observationId']==pid and r['role']=='reference' for r in areas)
        saved_aoi=next(r for r in records() if r['id']==aid)
        assert saved_aoi['role']=='aoi' and saved_aoi['feature']['geometry']==aoi['feature']['geometry']
        # Cancel a new region and cancel vertex edits both preserve stored extents.
        inspector.get_by_role('button',name='Sửa ghi nhận',exact=True).click()
        inspector.locator('.field-observation details.field-extra').evaluate('(el)=>el.open=true')
        inspector.get_by_label('Ghi chú hiện trường',exact=True).fill('Bản nháp phải còn sau khi vẽ')
        inspector.get_by_role('button',name='Vẽ vùng nghi ảnh hưởng',exact=True).click()
        page.get_by_role('button',name='Hủy',exact=True).click()
        expect(inspector.get_by_label('Ghi chú hiện trường',exact=True)).to_have_value('Bản nháp phải còn sau khi vẽ')
        inspector.locator('.field-observation').get_by_role('button',name='Hủy',exact=True).click()
        expect(inspector.locator('[data-field-area-id]')).to_have_count(2)
        inspector.get_by_role('button',name='Sửa Vùng nghi ảnh hưởng 1',exact=True).click()
        expect(page.locator('.geodata-vertex').first).to_be_visible()
        v=settled_box(page,'.geodata-vertex');page.mouse.move(v['x']+v['width']/2,v['y']+v['height']/2);page.mouse.down();page.mouse.move(v['x']+20,v['y']+20,steps=8);page.mouse.up()
        apply_boundary(page)
        expect(inspector).to_be_visible()
        changed=next(r for r in records() if r['id']==areas[0]['id'])
        assert changed['feature']['geometry']!=areas[0]['feature']['geometry']
        # Area removal and undo do not remove the observation or AOI.
        inspector.get_by_role('button',name='Xóa Vùng nghi ảnh hưởng 2',exact=True).click()
        page.get_by_role('dialog',name='Xóa đối tượng?',exact=True).get_by_role('button',name='Xóa đối tượng',exact=True).click()
        expect(inspector.locator('[data-field-area-id]')).to_have_count(1)
        page.get_by_role('button',name='Hoàn tác GIS',exact=True).click()
        expect(inspector.locator('[data-field-area-id]')).to_have_count(2)
        if captures: captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/'gis-inspector-areas.png'))
        # KML round trip remaps point IDs and keeps AOI independent.
        with page.expect_download() as download:download_geometry(page, 'KML')
        imported=Path(temp)/'roundtrip.kml';imported.write_bytes(Path(download.value.path()).read_bytes())
        if page.locator('.geodata-import > button').get_attribute('aria-expanded') != 'true': page.locator('.geodata-import > button').click()
        page.locator('.geodata-import input[type=file]').set_input_files(str(imported))
        expect(page.locator('.geodata-layers h2')).to_contain_text('4')
        restored=records();imported_point=next(r for r in restored if r['id']!=pid and r['feature']['geometry']['type']=='Point')
        assert sum(r['feature']['properties'].get('dearFieldArea',{}).get('observationId')==imported_point['id'] for r in restored)==2
        page.get_by_role('button',name='Đóng hồ sơ đối tượng',exact=True).click()
        page.locator(f'[data-geodata-id="{pid}"] .geodata-feature').click()
        inspector.get_by_role('button',name='Xóa Điểm thực địa A',exact=True).click()
        page.get_by_role('dialog',name='Xóa đối tượng?',exact=True).get_by_role('button',name='Xóa đối tượng',exact=True).click()
        assert not any(r['id']==pid or r['feature']['properties'].get('dearFieldArea',{}).get('observationId')==pid for r in records())
        page.get_by_role('button',name='Hoàn tác GIS',exact=True).click()
        page.locator(f'[data-geodata-id="{pid}"] .geodata-feature').click()
        # Responsive record layout and help close/focus behavior.
        for width in [1440,1024,390,320]:
            page.set_viewport_size({'width':width,'height':900})
            for theme in ['light','dark']:
                page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme);page.wait_for_timeout(120)
                expect(inspector).to_be_visible()
                assert inspector.evaluate('n=>n.scrollWidth<=n.clientWidth'),(width,theme)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme)
            if width<=760:
                page.get_by_role('button',name='Đóng hồ sơ đối tượng',exact=True).click()
                expect(page.locator('.geodata-layers')).to_be_visible()
                page.locator(f'[data-geodata-id="{pid}"] .geodata-feature').click()
        page.set_viewport_size({'width':1440,'height':960})
        inspector.get_by_role('button',name='Xem trên bản đồ ứng phó',exact=True).click()
        publication=page.get_by_role('dialog',name='Áp dụng thay đổi GIS?',exact=True)
        if not publication.count():
            exit_review=page.get_by_role('dialog',name='Còn thay đổi chưa áp dụng',exact=True)
            expect(exit_review).to_be_visible()
            exit_review.get_by_role('button',name='Áp dụng và đóng',exact=True).click()
        else:
            publication.get_by_role('button',name='Áp dụng',exact=True).click()
        expect(page.locator('.field-map-card')).to_contain_text('Vết trượt')
        assert page.locator('.map-road-target').count()>0
        open_header_help(page)
        guide=page.get_by_role('dialog',name='Hướng dẫn sử dụng',exact=True)
        expect(guide).to_be_visible();guide.get_by_role('button',name='Dữ liệu GIS và ảnh',exact=False).click()
        expect(guide).to_contain_text('vẽ vùng nghi ảnh hưởng')
        page.keyboard.press('Escape');expect(guide).to_have_count(0)
        expect(page.get_by_role('button',name='Cài đặt',exact=True)).to_be_focused()
        assert not errors,errors
        browser.close()
    print('Field areas: selected-record layout, file time, draw/edit/cancel/undo, AOI isolation, KML associations, responsive themes and guide passed.')
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:5174');parser.add_argument('--chrome',default=None);parser.add_argument('--captures',type=Path)
    a=parser.parse_args();run(a.url.rstrip('/'),a.chrome,a.captures)
