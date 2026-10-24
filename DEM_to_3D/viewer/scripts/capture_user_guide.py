"""Capture current DEAR guide screens. The report image is a labelled test fixture."""
from gis_browser_actions import map_tool
import argparse, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from field_photo_fixture import create_field_photo

ROOT=Path(__file__).resolve().parent.parent

def run(url,chrome,out):
    out.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=chrome,headless=True)
        photo=create_field_photo(browser,tempfile.gettempdir())
        context=browser.new_context(viewport={'width':1280,'height':820},timezone_id='Asia/Bangkok')
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url+'/') else r.abort())
        page=context.new_page();page.goto(url+'/?map=2d&offline=1')
        page.get_by_label('Tên hiển thị',exact=True).fill('Người dùng minh họa')
        page.get_by_role('button',name='Vào ứng dụng',exact=True).click()
        expect(page.locator('.citizen-workspace')).to_be_visible(timeout=25000)
        page.evaluate('document.fonts.ready')
        def wait_map():
            page.wait_for_function("Array.from(document.querySelectorAll('.map-2d-surface img.leaflet-image-layer')).some(n=>n.complete&&n.naturalWidth>0)",timeout=30000)
        wait_map()
        def shot(name):page.screenshot(path=str(out/name),type='jpeg',quality=88,animations='disabled')
        shot('resident-roads.jpg')
        page.get_by_role('button',name='Gửi ghi nhận',exact=True).click();shot('resident-report.jpg')
        page.get_by_label('Ảnh hiện trường',exact=True).set_input_files(str(photo))
        expect(page.get_by_label('Vĩ độ ghi nhận',exact=True)).to_have_value('21.783333',timeout=15000)
        page.locator('.field-observation').get_by_role('button',name='Gửi ghi nhận',exact=True).click()
        expect(page.locator('.citizen-submission')).to_be_visible();shot('resident-mine.jpg')
        page.get_by_role('button',name='Đổi vai trò',exact=True).click()
        page.get_by_role('radio',name='Điều phối ứng phó',exact=False).check()
        page.get_by_label('Tên hiển thị',exact=True).fill('Điều phối viên')
        page.get_by_role('button',name='Vào ứng dụng',exact=True).click()
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=25000)
        wait_map()
        page.locator('.incident-priority-row').first.click();shot('response.jpg')
        page.get_by_role('button',name='Lưu đánh giá',exact=True).click()
        expect(page.get_by_role('dialog',name='Lưu đánh giá tiếp cận',exact=True)).to_be_visible()
        preview=page.locator('.decision-export-preview')
        expect(preview).to_be_visible(timeout=30000)
        page.wait_for_function('n=>n.complete&&n.naturalWidth>0',arg=preview.element_handle())
        shot('save.jpg');page.keyboard.press('Escape')
        page.get_by_role('button',name='Ghi nhận gửi đến',exact=True).click()
        inbox=page.get_by_role('dialog',name='Ghi nhận gửi đến',exact=False)
        inbox.get_by_role('button',name='Người dùng minh họa',exact=False).click()
        expect(inbox.locator('.field-photo-gallery img')).to_be_visible();shot('reports.jpg')
        page.keyboard.press('Escape')
        map_tool(page, 'Tìm đường giữa hai điểm').click()
        journey=page.get_by_role('region',name='Tìm đường giữa hai điểm',exact=True)
        start=journey.get_by_label('Điểm xuất phát',exact=True)
        start.select_option(start.locator('option[value^="site:"]').first.get_attribute('value'))
        end=journey.get_by_label('Điểm đến',exact=True)
        end.select_option(end.locator('option[value^="community:"]').first.get_attribute('value'))
        expect(journey.locator('.journey-result')).to_be_visible();shot('map.jpg')
        journey.get_by_role('button',name='Đóng bảng tìm đường',exact=True).click()
        map_tool(page, 'Dữ liệu GIS').click()
        expect(page.locator('.geodata-workspace')).to_be_visible()
        page.get_by_role('button',name='Nhập dữ liệu',exact=True).click()
        expect(page.get_by_role('dialog',name='Nhập dữ liệu',exact=True)).to_be_visible()
        shot('gis.jpg')
        browser.close()
    print('DEAR guide captures:',out)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:5211')
    parser.add_argument('--chrome',required=True);parser.add_argument('--out',type=Path,default=ROOT/'public/guide')
    args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.out)
