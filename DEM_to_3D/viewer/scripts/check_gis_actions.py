"""GIS edits, deletion and export must be reviewed and report only persisted success."""
from browser_preferences import use_vietnamese
from gis_browser_actions import map_tool
from gis_browser_actions import gis_task, published_records, reviewed_records, clear_prepared_survey
import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect


def run(url, chrome, captures=None):
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, executable_path=chrome)
        context=use_vietnamese(browser.new_context(viewport={'width':1440,'height':960}))
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url+'/') else r.abort())
        page=use_vietnamese(context.new_page());errors=[];downloads=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('download',lambda download:downloads.append(download))
        page.goto(url+'/?offline=1&map=2d&demoRole=manager')
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=30000)
        clear_prepared_survey(page)
        map_tool(page, 'Dữ liệu GIS').click()
        gis_task(page)
        read=lambda:reviewed_records(page)
        def confirmation(title):
            dialog=page.get_by_role('dialog',name=title,exact=True)
            expect(dialog).to_be_visible()
            expect(page.locator('dialog[open]')).to_have_count(1)
            return dialog
        def dismiss_notice():
            button=page.get_by_role('button',name='Đóng thông báo',exact=True)
            if button.count():button.click()
        def notice(text):expect(page.locator('.notice-toast:visible')).to_be_visible()
        page.get_by_role('button',name='Thêm điểm tọa độ',exact=True).click()
        entry=page.get_by_role('dialog',name='Thêm điểm tọa độ',exact=True)
        entry.get_by_label('Tên điểm',exact=True).fill('Điểm ban đầu')
        entry.get_by_label('Vĩ độ (°)',exact=True).fill('21.78')
        entry.get_by_label('Kinh độ (°)',exact=True).fill('104.05')
        entry.get_by_role('button',name='Đánh dấu điểm',exact=True).click()
        notice('Đã thêm điểm tọa độ')
        inspector=page.locator('.geodata-inspector')
        name=inspector.get_by_label('Tên đối tượng',exact=True)
        name.fill('Tên chưa lưu');assert read()[0]['name']=='Điểm ban đầu'
        name.press('Escape');expect(name).to_have_value('Điểm ban đầu')
        expect(inspector).to_be_visible()
        name.fill('Điểm đã lưu')
        inspector.get_by_role('button',name='Lưu tên',exact=True).click()
        assert read()[0]['name']=='Điểm đã lưu';notice('Đã lưu tên')
        row=page.locator('.geodata-layers li').filter(has_text='Điểm đã lưu')
        # Show/hide is reversible, so it applies at once without a confirmation.
        row.get_by_role('checkbox').click()
        expect(page.get_by_role('dialog')).to_have_count(0)
        assert not read()[0]['visible'];notice('Đã cập nhật lớp')
        row.get_by_role('checkbox').click()
        assert read()[0]['visible']
        original=read()[0]
        inspector.get_by_role('button',name='Xóa Điểm đã lưu',exact=True).click()
        dialog=confirmation('Xóa đối tượng?');assert len(read())==1
        expect(dialog.get_by_role('button',name='Hủy',exact=True)).to_be_focused()
        page.keyboard.press('Escape');assert len(read())==1;expect(inspector).to_be_visible()
        inspector.get_by_role('button',name='Xóa Điểm đã lưu',exact=True).click()
        confirmation('Xóa đối tượng?').get_by_role('button',name='Xóa đối tượng',exact=True).click()
        assert not read();notice('Đã xóa đối tượng')
        page.get_by_role('button',name='Hoàn tác GIS',exact=True).click()
        assert read()[0]==original
        page.locator('.geodata-feature').filter(has_text='Điểm đã lưu').click()
        dismiss_notice()
        # Per-feature edits are drafts. Only whole-workspace publication touches storage.
        page.evaluate("""() => { window.originalSetItem=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){if(k==='dear.gis.v2') throw new DOMException('Full','QuotaExceededError');return originalSetItem.call(this,k,v)} }""")
        name=inspector.get_by_label('Tên đối tượng',exact=True)
        name.fill('Tên không lưu được');inspector.get_by_role('button',name='Lưu tên',exact=True).click()
        page.get_by_role('button',name='Áp dụng thay đổi',exact=True).click()
        failed=confirmation('Áp dụng thay đổi GIS?')
        failed.get_by_role('button',name='Áp dụng',exact=True).click()
        expect(failed.get_by_role('alert')).to_be_visible()
        assert published_records(page)[0]==original
        failed.get_by_role('button',name='Hủy',exact=True).click()
        page.get_by_role('button',name='Bỏ bản nháp',exact=True).click()
        confirmation('Bỏ bản nháp GIS?').get_by_role('button',name='Bỏ bản nháp',exact=True).click()
        expect(inspector.get_by_label('Tên đối tượng',exact=True)).to_have_value('Điểm đã lưu')
        inspector.get_by_role('button',name='Sửa tọa độ',exact=True).click()
        coordinates=page.get_by_role('dialog',name='Sửa tọa độ',exact=True)
        coordinates.get_by_label('Vĩ độ (°)',exact=True).fill('21.781')
        page.evaluate('() => { Storage.prototype.setItem=window.originalSetItem; }')
        coordinates.get_by_role('button',name='Lưu tọa độ',exact=True).click()
        expect(coordinates).to_have_count(0)
        assert read()[0]['feature']['geometry']['coordinates']==[104.05,21.781]
        notice('Đã cập nhật tọa độ')
        expect(name).to_have_value('Điểm đã lưu')
        # Preparing or cancelling an export must not download a file.
        page.locator('.geodata-export > details > summary').click()
        page.get_by_role('button',name='GeoJSON',exact=True).click()
        export=confirmation('Xuất dữ liệu GIS')
        expect(export).to_contain_text('dear-all.geojson');assert not downloads
        export.get_by_role('button',name='Hủy',exact=True).click();assert not downloads
        page.get_by_role('button',name='GeoJSON',exact=True).click()
        with page.expect_download() as download:
            confirmation('Xuất dữ liệu GIS').get_by_role('button',name='Tải tệp',exact=True).click()
        exported=json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
        assert exported['features'][0]['geometry']==read()[0]['feature']['geometry']
        notice('Đã tạo tệp dear-all.geojson')
        # The second rectangle corner saves the boundary at once; Undo GIS reverts it.
        gis_task(page, 'aoi')
        page.get_by_role('button',name='Vẽ hình chữ nhật',exact=True).click()
        surface=page.locator('.geodata-map-surface').bounding_box()
        page.mouse.click(surface['x']+150,surface['y']+150)
        page.mouse.click(surface['x']+290,surface['y']+290)
        expect(page.get_by_role('dialog')).to_have_count(0)
        if captures:
            captures.mkdir(parents=True,exist_ok=True)
            page.screenshot(path=str(captures/'gis-boundary-saved.png'))
        assert len(read())==2 and read()[1]['role']=='aoi'
        notice('Đã lưu ranh giới')
        # AOI names use the same explicit save flow.
        area_name=page.get_by_label('Tên vùng',exact=True)
        original_area_name=read()[1]['name']
        area_name.fill('AOI mới');assert read()[1]['name']==original_area_name
        area_name.press('Enter');assert read()[1]['name']=='AOI mới'
        page.get_by_role('tab',name='Lớp',exact=True).click()
        page.locator('.geodata-feature').filter(has_text='AOI mới').click()
        role=page.get_by_label('Vai trò đối tượng',exact=True)
        role.select_option('reference')
        dialog=confirmation('Đổi vai trò của vùng?');assert read()[1]['role']=='aoi'
        dialog.get_by_role('button',name='Áp dụng',exact=True).click()
        assert read()[1]['role']=='reference'
        # Bulk deletion also has a modal review and a complete undo.
        page.get_by_role('button',name='Chọn nhiều',exact=True).click()
        page.get_by_label('Chọn tất cả',exact=False).check()
        page.locator('.geodata-bulk').get_by_role('button',name='Xóa',exact=True).click()
        dialog=confirmation('Xóa đối tượng đã chọn?');assert len(read())==2
        dialog.get_by_role('button',name='Hủy',exact=True).click();assert len(read())==2
        page.locator('.geodata-bulk').get_by_role('button',name='Xóa',exact=True).click()
        confirmation('Xóa đối tượng đã chọn?').get_by_role('button',name='Xóa mục đã chọn',exact=True).click()
        assert not read()
        page.get_by_role('button',name='Hoàn tác GIS',exact=True).click();assert len(read())==2
        # Native review is bounded on phone and respects Escape/focus restoration.
        done=page.get_by_role('button',name='Xong',exact=True)
        if done.is_visible():done.click()
        for width in [390,320]:
            page.set_viewport_size({'width':width,'height':960})
            page.get_by_role('button',name='KML',exact=True).click()
            dialog=confirmation('Xuất dữ liệu GIS');box=dialog.bounding_box()
            assert box['x']>=0 and box['x']+box['width']<=width+1
            assert dialog.evaluate('n=>n.scrollWidth<=n.clientWidth')
            page.keyboard.press('Escape')
            expect(page.get_by_role('button',name='KML',exact=True)).to_be_focused()
        assert not errors,errors
        browser.close()
    print('GIS action checks passed: explicit edits, cancel/confirm, persisted success, quota rollback, geometry drafts, exports, bulk undo and mobile reviews.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:5321');parser.add_argument('--chrome',default=None);parser.add_argument('--captures',type=Path)
    args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.captures)
