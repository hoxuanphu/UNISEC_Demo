"""Verify response work, journal semantics, route verification and GIS paint containment."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from check_geodata_workspace import paste


def run(url, chrome, captures):
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, **({'executable_path':chrome} if chrome else {}))
        context=browser.new_context(viewport={'width':1440,'height':900})
        context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(url+'/') else route.abort())
        page=context.new_page();errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(url)
        expect(page.locator('.incident-work-row').first).to_be_visible(timeout=25000)
        expect(page.locator('.incident-timing dt')).to_have_text(['Mở đánh giá','Tổng hợp'])
        page.locator('.incident-work-row').first.click()
        expect(page.locator('.response-work-edit')).to_be_visible()
        edit=page.locator('.response-work-edit')
        task_title=edit.locator('h3').inner_text()
        edit.get_by_label('Trạng thái công việc',exact=True).select_option('done')
        edit.get_by_role('button',name='Ghi nhận',exact=True).click()
        expect(page.get_by_role('alert')).to_contain_text('ghi kết quả')
        edit.get_by_label('Người phụ trách',exact=True).fill('Tổ trực demo')
        edit.get_by_label('Kết quả / lý do chờ',exact=True).fill('Đã chuyển yêu cầu xác minh cho đầu mối địa phương.')
        edit.get_by_role('button',name='Ghi nhận',exact=True).click()
        expect(page.locator('.response-work-list')).not_to_contain_text(task_title)
        page.get_by_role('button',name='Tất cả',exact=True).click()
        expect(page.locator('.response-work-list')).to_contain_text('Hoàn tất')
        page.locator('.response-work-row').filter(has_text=task_title).click()
        with page.expect_download() as output:
            page.get_by_role('button',name='Xuất công việc',exact=True).click()
        exported=json.loads(Path(output.value.path()).read_text(encoding='utf-8'))
        assert len(exported['entries'])==1 and exported['entries'][0]['status']=='done'
        page.keyboard.press('Escape')
        page.get_by_role('button',name='Nhật ký sự kiện',exact=True).click()
        page.get_by_role('button',name='Công việc',exact=True).click()
        expect(page.locator('.journal-list > li')).to_have_count(1)
        page.locator('.journal-list summary').first.click()
        expect(page.locator('.journal-work-detail')).to_contain_text('Tổ trực demo')
        page.get_by_role('button',name='Báo cáo',exact=True).click()
        expect(page.locator('.journal-list > li')).to_have_count(6)
        page.locator('.journal-list summary').first.click()
        page.get_by_role('button',name='Xem báo cáo',exact=True).click()
        page.get_by_role('button',name='Cập nhật bản đồ',exact=True).click()
        expect(page.locator('.incident-pending-report')).to_have_count(0)
        page.locator('.incident-priority-row').first.click()
        expect(page.locator('.route-verification')).to_contain_text('Chưa có')
        expect(page.locator('.decision-overview')).to_contain_text('Các tuyến đã biết đều bị chặn')
        page.locator('.header-revision').click()
        page.get_by_role('button',name='Bản đồ',exact=True).click()
        expect(page.locator('.journal-list > li')).to_have_count(1)
        page.get_by_role('radio',name='Đánh giá ban đầu').click()
        expect(page.locator('.revision-notice')).to_be_visible()
        page.locator('.workspace-nav button').first.click()
        page.locator('.incident-work .incident-section-heading button').click()
        page.locator('.response-work-row').filter(has_text='Xác minh').first.click()
        expect(page.locator('.response-work-edit select')).to_be_disabled()
        assert page.locator('.response-work-notices').evaluate('node=>node.getBoundingClientRect().bottom<=document.querySelector(".response-work-body").getBoundingClientRect().top+1'), 'Historical notice overlaps work editor'
        page.keyboard.press('Escape')
        page.get_by_role('button',name='Về dữ liệu mới nhất',exact=True).click()
        page.reload()
        expect(page.locator('.incident-work-row')).to_have_count(2,timeout=25000)
        page.locator('.incident-work .incident-section-heading button').click()
        page.get_by_role('button',name='Tất cả',exact=True).click()
        expect(page.locator('.response-work-list')).to_contain_text('Hoàn tất')
        if captures:captures.mkdir(parents=True,exist_ok=True)
        page.locator('.response-work-row').filter(has_text=task_title).click()
        for width in [1440,1024,390,320]:
            page.set_viewport_size({'width':width,'height':900})
            for theme in ['light','dark']:
                page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
                page.wait_for_timeout(200)
                assert page.locator('.response-work-dialog').evaluate('node=>node.scrollWidth<=node.clientWidth')
                if captures and width in [1440,320]:page.screenshot(path=str(captures/f'work-{width}-{theme}.png'),animations='disabled')
        page.keyboard.press('Escape')
        assert not errors,errors
        context.close()
        # Tile paint must stay inside the GIS map during pan/zoom/resize, including CSS zoom.
        context=browser.new_context(viewport={'width':1440,'height':900})
        context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(url+'/') else route.abort())
        context.route('**/workspace-config.json',lambda route:route.fulfill(json={'dataSource':'prepared','offline':False}))
        context.route('https://tiles.maps.eox.at/**',lambda route:route.fulfill(content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#28704b"/><path d="M0 0H256V256H0Z" fill="none" stroke="white"/></svg>'))
        page=context.new_page();page.goto(url+'/?workspace=geodata')
        expect(page.locator('.leaflet-tile-loaded').first).to_be_visible(timeout=25000)
        paste(page,'POLYGON((103.9 21.6,104.1 21.6,104.1 21.9,103.9 21.9,103.9 21.6))','aoi')
        for zoom in [1,1.25,.8]:
            page.evaluate('(zoom)=>document.body.style.zoom=zoom',zoom)
            for width in [1440,1024]:
                page.set_viewport_size({'width':width,'height':900})
                page.get_by_role('button',name='Thu nhỏ GIS',exact=True).click()
                surface=page.locator('.geodata-map-surface').bounding_box()
                page.mouse.move(surface['x']+150,surface['y']+150);page.mouse.down()
                page.mouse.move(surface['x']+350,surface['y']+250,steps=8);page.mouse.up()
                page.wait_for_timeout(250)
                assert page.locator('.geodata-sidebar').evaluate('''node=>{
                  const b=node.getBoundingClientRect();
                  return [b.top+25,b.top+b.height/2,b.bottom-35].every(y=>node.contains(document.elementFromPoint(b.right-25,y)))
                    && b.right<=document.querySelector('.geodata-map').getBoundingClientRect().left+1;
                }'''),'Map covers GIS sidebar'
                assert page.locator('.geodata-map-surface').evaluate("node=>getComputedStyle(node).overflow==='hidden'")
        context.close();browser.close()
    print('Response operations passed: evidence-derived work, result required, local persistence, read-only historical revision, journal, map update, route verification and tile containment.')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--url',default='http://127.0.0.1:5213')
    parser.add_argument('--chrome',default=None)
    parser.add_argument('--captures',type=Path)
    args=parser.parse_args()
    run(args.url.rstrip('/'),args.chrome,args.captures)
