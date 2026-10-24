"""Verify local field photos, source integrity and GIS-to-response point mapping."""
from browser_preferences import use_vietnamese
from gis_browser_actions import map_tool
from gis_browser_actions import gis_task, download_geometry, published_records, reviewed_records_json, clear_prepared_survey
import argparse, base64, hashlib, json, struct, tempfile
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

# Local Windows convenience only; CI (Linux) uses the Playwright-managed Chromium.

def run(url, chrome, captures):
    with tempfile.TemporaryDirectory() as temp, sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=chrome)
        from field_photo_fixture import create_field_photo
        jpg=create_field_photo(browser,temp)
        bad=Path(temp)/'invalid.jpg';bad.write_text('not an image',encoding='utf-8')
        context=use_vietnamese(browser.new_context(viewport={'width':1440,'height':960}))
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url+'/') else r.abort())
        page=use_vietnamese(context.new_page());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url+'/?map=2d&offline=1&demoRole=manager');expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=25000)
        clear_prepared_survey(page)
        page.wait_for_timeout(600)
        visible_road=page.locator('.map-road-target:visible').first
        expect(visible_road).to_be_visible(timeout=25000)
        original_road_id=visible_road.get_attribute('data-road-id')
        original_roads=page.locator('.map-road-target:not([data-road-id^="local-"])').count()
        original_road_box=visible_road.bounding_box()
        original_map_box=page.locator('.map-canvas').bounding_box()
        map_tool(page, 'Dữ liệu GIS').click()
        gis_task(page)
        page.get_by_role('button',name='Thêm điểm tọa độ',exact=True).click()
        entry=page.locator('.field-point-entry');entry.get_by_label('Tên điểm',exact=True).fill('Điểm khảo sát A')
        entry.get_by_label('Vĩ độ (°)',exact=True).fill('21.782919');entry.get_by_label('Kinh độ (°)',exact=True).fill('104.053554')
        entry.get_by_role('button',name='Đánh dấu điểm',exact=True).click()
        page.get_by_role('button',name='Thêm ghi nhận thực địa',exact=True).click()
        form=page.locator('.field-observation')
        form.get_by_text('Thông tin bổ sung',exact=True).click()
        form.get_by_label('Loại ghi nhận',exact=True).select_option('suspected-landslide')
        form.get_by_label('Ghi chú hiện trường',exact=True).fill('Ghi nhận nghi sạt lở, cần kiểm tra tại hiện trường.')
        form.get_by_label('Người ghi nhận',exact=True).fill('Tổ khảo sát demo')
        assert form.get_by_label('Sai số vị trí (m)',exact=True).count()==0
        form.get_by_label('Ảnh hiện trường',exact=True).set_input_files(str(bad))
        expect(form.get_by_role('alert')).to_contain_text('Không đọc được ảnh')
        expect(form.locator('.field-photo-gallery img')).to_have_count(0)
        form.get_by_label('Ảnh hiện trường',exact=True).set_input_files(str(jpg))
        expect(form.locator('.field-photo-gallery img')).to_have_count(1,timeout=15000)
        expect(form.locator('input[type=datetime-local]')).to_have_value('2026-09-29T08:30:15')
        expect(form.locator('.field-photo-summary')).to_contain_text('Test Camera')
        form.get_by_role('button',name='Xem ảnh field-photo-test.jpg',exact=True).click()
        expect(page.locator('.field-photo-preview')).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.locator('.field-photo-preview')).to_have_count(0)
        expect(page.locator('.geodata-workspace')).to_be_visible()
        form.get_by_role('button',name='Lưu ghi nhận',exact=True).click()
        expect(form.get_by_role('button',name='Sửa ghi nhận',exact=True)).to_be_visible()
        records=json.loads(reviewed_records_json(page));record=records[0];oid=record['id'];obs=record['feature']['properties']['dearObservation'];photo=obs['photos'][0]
        assert record['feature']['geometry']['coordinates']==[104.053554,21.782919]
        assert record['role']=='reference' and obs['status']=='unreviewed'
        assert obs['observedAt']=='' and obs['observedLocalTime']=='2026-09-29T08:30:15'
        assert photo['sha256']==hashlib.sha256(jpg.read_bytes()).hexdigest()
        assert photo['exif']['Model']=='Test Camera',photo['exif']
        assert abs(photo['exif']['latitude']-(21+47/60))<1e-6,photo['exif']
        assert photo['exif']['latitude'] != record['feature']['geometry']['coordinates'][1]
        if captures:captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/'field-gis-light.png'))
        # GIS fitting must not move the independent response-map camera.
        page.get_by_role('button',name='Đóng dữ liệu GIS',exact=True).click()
        expect(page.locator('.geodata-workspace')).to_have_count(0)
        road_box=page.locator(f'.map-road-target[data-road-id="{original_road_id}"]').bounding_box()
        map_box=page.locator('.map-canvas').bounding_box()
        # Notices may move the whole map; compare within its own surface.
        assert all(abs((road_box[k]-map_box[k])-(original_road_box[k]-original_map_box[k]))<1 for k in ['x','y']),(road_box,original_road_box)
        assert all(abs(road_box[k]-original_road_box[k])<1 for k in ['width','height']),(road_box,original_road_box)
        map_tool(page, 'Dữ liệu GIS').click()
        gis_task(page)
        form=page.locator('.field-observation')
        page.locator('.geodata-inspector').get_by_role('button',name='Xem trên bản đồ ứng phó',exact=True).click()
        expect(page.locator('.geodata-workspace')).to_have_count(0)
        expect(page.locator(f'[data-field-id="{oid}"]')).to_be_visible()
        expect(page.locator('.field-map-card')).to_contain_text('Chờ kiểm tra')
        expect(page.locator('.field-map-card img')).to_have_count(1)
        assert page.locator('.map-road-target:not([data-road-id^="local-"])').count()==original_roads
        # Explicit visibility is separate from field classification and incident assessments.
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        page.locator('.layer-context > summary').click()
        page.get_by_label('Dữ liệu tham chiếu',exact=True).uncheck()
        expect(page.locator(f'[data-field-id="{oid}"]')).to_have_count(0)
        expect(page.locator('.field-map-card')).to_have_count(0)
        page.get_by_label('Dữ liệu tham chiếu',exact=True).check();page.get_by_role('button',name='Đóng lớp bản đồ',exact=True).click()
        expect(page.locator(f'[data-field-id="{oid}"]')).to_be_visible()
        page.locator(f'[data-field-id="{oid}"]').click()
        for width in [1440,1024,390,320]:
            page.set_viewport_size({'width':width,'height':900})
            if width < 900:
                page.locator('.mobile-view-switch').get_by_role('button', name='Thông tin', exact=True).click()
            expect(page.locator('.field-map-card')).to_be_visible()
            for theme in ['light','dark']:
                page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme)
                page.wait_for_timeout(220)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme)
                assert page.locator('.field-map-card').evaluate('n=>n.scrollWidth<=n.clientWidth'),(width,theme)
                card=page.locator('.field-map-card').bounding_box()
                if width >= 900:
                    toolbar=page.locator('.map-toolbar').bounding_box()
                    assert card['y'] >= toolbar['y']+toolbar['height'],(width,theme,card,toolbar)
                else:
                    body=page.locator('#response-details').bounding_box()
                    assert card['x'] >= body['x'] and card['x']+card['width'] <= body['x']+body['width'],(width,theme,card,body)
                if captures and width in [1440,320]:page.screenshot(path=str(captures/f'field-response-{width}-{theme}.png'))
        page.set_viewport_size({'width':1440,'height':960})
        page.locator('.field-map-card').get_by_role('button',name='Mở trong GIS',exact=True).click()
        form=page.locator('.field-observation');expect(form).to_contain_text(obs['note'])
        form.get_by_role('button',name='Sửa ghi nhận',exact=True).click();form.get_by_text('Thông tin bổ sung',exact=True).click();form.get_by_label('Ghi chú hiện trường',exact=True).fill('This change must not be retained')
        page.evaluate("""()=>{window.__fieldSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='dear.gis.v2')throw new Error('QuotaExceeded');return window.__fieldSet.call(this,k,v);};}""")
        form.get_by_role('button',name='Lưu ghi nhận',exact=True).click()
        page.get_by_role('button',name='Áp dụng thay đổi',exact=True).click()
        failure=page.get_by_role('dialog',name='Áp dụng thay đổi GIS?',exact=True)
        failure.get_by_role('button',name='Áp dụng',exact=True).click()
        expect(failure.get_by_role('alert')).to_be_visible()
        assert published_records(page)[0]['feature']['properties']['dearObservation']['note']==obs['note']
        failure.get_by_role('button',name='Hủy',exact=True).click()
        page.evaluate('()=>{Storage.prototype.setItem=window.__fieldSet;}')
        page.get_by_role('button',name='Bỏ bản nháp',exact=True).click()
        page.get_by_role('dialog',name='Bỏ bản nháp GIS?',exact=True).get_by_role('button',name='Bỏ bản nháp',exact=True).click()
        form.get_by_role('button',name='Sửa ghi nhận',exact=True).click()
        expect(form.get_by_label('Ghi chú hiện trường',exact=True)).to_have_value(obs['note'])
        form.get_by_role('button',name='Hủy',exact=True).click()
        page.goto(url+'/?map=2d&offline=1&demoRole=manager&gisPoint='+oid)
        expect(page.locator('.field-map-card')).to_contain_text(obs['note'],timeout=25000)
        expect(page.locator('.field-map-card img')).to_have_count(1)
        page.locator('.field-map-card').get_by_role('button',name='Mở trong GIS',exact=True).click()
        with page.expect_download() as download:download_geometry(page, 'GeoJSON')
        exported=json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
        assert exported['features'][0]['properties']['dearObservation']==obs
        with page.expect_download() as download:download_geometry(page, 'KML')
        kml=Path(temp)/'field-roundtrip.kml';kml.write_bytes(Path(download.value.path()).read_bytes())
        page.get_by_role('button',name='Nhập dữ liệu',exact=True).click()
        page.locator('.geodata-import input[type=file]').set_input_files(str(kml))
        expect(page.locator('.geodata-layers li')).to_have_count(2)
        page.locator('.geodata-layers li').last.get_by_role('button').first.click()
        expect(page.locator('.field-observation')).to_contain_text(obs['note'])
        expect(page.locator('.field-observation .field-photo-gallery img')).to_have_count(1)
        assert not errors,errors
        context.close();browser.close()
    print('Field observations passed: coordinate entry, pending annotation, real EXIF/camera GPS, thumbnail/hash, invalid-photo rollback, shared response map, visibility, storage failure, reload/export and responsive themes.')
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:5174');parser.add_argument('--chrome',default=None);parser.add_argument('--captures',type=Path)
    args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.captures)
