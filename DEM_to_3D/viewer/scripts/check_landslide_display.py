"""Local browser regression: mapped fill and real resident submission symbols."""
from browser_preferences import use_vietnamese
import argparse
import tempfile
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
from field_photo_fixture import create_field_photo
from check_resident_workflow import switch_role


def run(url, captures, chrome=None):
    captures.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp, sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=chrome,
            args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        photo = create_field_photo(browser, temp)
        context = use_vietnamese(browser.new_context(viewport={'width':1440,'height':960}, reduced_motion='reduce'))
        context.route('**/*', lambda r:r.continue_() if r.request.url.startswith(url+'/') else r.abort())
        page = use_vietnamese(context.new_page())
        errors = []
        page.on('pageerror', lambda e:errors.append(str(e)))
        page.set_default_timeout(20000)

        def fill(value):
            page.get_by_role('slider',name='Độ phủ màu',exact=True).evaluate('''(e,value)=>{
                const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
                setter.call(e,String(value));e.dispatchEvent(new Event('input',{bubbles:true}));
                e.dispatchEvent(new Event('change',{bubbles:true}));}''',value)
            control=page.get_by_role('slider',name='Độ phủ màu',exact=True)
            assert control.evaluate("e=>getComputedStyle(e.parentElement).display==='grid'")

        def areas(opacity, prefix=''):
            expect(page.locator(prefix+'path.landslide-area')).to_have_count(47)
            assert page.locator(prefix+'path.landslide-area').evaluate_all('''(nodes,value)=>nodes.every(n=>{
                const compact=Number(n.getAttribute('stroke-width'))<2.5;
                return Math.abs(Number(n.getAttribute('fill-opacity'))-value*(compact?.16/.22:1))<.001 &&
                    n.getAttribute('stroke')==='#ffe36a' && Number(n.getAttribute('stroke-width'))>=1.6;
            })''',opacity)

        def symbol(selector, selected=True):
            marker=page.locator(selector)
            expect(marker).to_have_count(1,timeout=60000)
            expect(marker).to_be_visible(timeout=60000)
            expected={'width':34 if selected else 28,'height':46 if selected else 28}
            actual=marker.locator('.field-map-symbol > svg').evaluate('e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height}}')
            assert actual==expected,(selector,actual,expected)
            expect(marker.locator('b')).to_have_text('!')
            assert marker.evaluate("e=>Number(getComputedStyle(e.querySelector('b')).zIndex)>Number(getComputedStyle(e.querySelector('svg')).zIndex)")
            # Even a stretched marker host cannot enlarge the geographic symbol.
            marker.evaluate("e=>{e.style.width='280px';e.style.height='280px'}")
            assert marker.locator('.field-map-symbol > svg').evaluate('e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height}}')==expected
            marker.evaluate('(e,size)=>{e.style.width=size.width+"px";e.style.height=size.height+"px"}',expected)

        page.goto(url+'/?map=2d&offline=1')
        page.get_by_label('Tên của bạn',exact=True).fill('Kiểm tra hiển thị')
        page.get_by_role('button',name='Vào ứng dụng',exact=True).click()
        page.get_by_role('button',name='Gửi ghi nhận',exact=True).click()
        page.get_by_label('Chọn ảnh hiện trường',exact=True).set_input_files(str(photo))
        expect(page.get_by_label('Vĩ độ ghi nhận',exact=True)).to_have_value('21.783333')
        page.locator('.citizen-report-form').get_by_role('button',name='Gửi báo cáo',exact=True).click()
        # Residents use the mobile Information/Map navigation at every viewport size.
        page.locator('.citizen-mobile-switch').get_by_role('button',name='Bản đồ',exact=True).click()
        symbol('.field-map-marker.map-selected-reference')
        oid=page.locator('.field-map-marker [data-field-id]').get_attribute('data-field-id')
        areas(.22)
        # Residents have simple visibility controls; styling belongs to the
        # coordinator. Compact extents remain visible when viewing whole routes.
        expect(page.get_by_role('slider',name='Độ phủ màu',exact=True)).to_have_count(0)
        page.reload()
        expect(page.locator('.citizen-workspace')).to_be_visible()
        areas(.22)
        page.get_by_role('button',name='Đã gửi',exact=True).click()
        page.locator('.citizen-mobile-switch').get_by_role('button',name='Bản đồ',exact=True).click()
        symbol('.field-map-marker',False)
        page.locator('.field-map-marker').dispatch_event('click')
        for width in [1440,390,320]:
            page.set_viewport_size({'width':width,'height':900})
            page.locator('.citizen-mobile-switch').get_by_role('button',name='Bản đồ',exact=True).click()
            symbol('.field-map-marker.map-selected-reference')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(captures/'resident-mobile.png'))
        print('RESIDENT_SUBMISSION_SYMBOL_AND_FILL_PASSED',flush=True)

        page.set_viewport_size({'width':1440,'height':960})
        switch_role(page)
        page.get_by_role('radio',name='Điều phối viên',exact=False).check()
        page.get_by_role('button',name='Vào ứng dụng',exact=True).click()
        page.goto(url+'/?map=2d&offline=1&gisPoint='+oid)
        expect(page.locator('.incident-landslide-row')).to_have_count(3,timeout=45000)
        symbol('.field-map-marker.map-selected-reference')
        areas(.22)
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        fill(70);areas(.7)
        page.screenshot(path=str(captures/'response-fill.png'))
        page.get_by_role('button',name='Khôi phục hiển thị mặc định',exact=True).click()
        areas(.22)
        page.get_by_role('button',name='Đóng lớp bản đồ',exact=True).click()
        page.get_by_role('button',name='Chuyển sang 3D',exact=True).click()
        symbol('[data-map-reference="'+oid+'"]')
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        fill(50)
        expect(page.get_by_role('slider',name='Độ phủ màu',exact=True)).to_have_value('50')
        page.get_by_role('button',name='Đóng lớp bản đồ',exact=True).click()
        page.screenshot(path=str(captures/'terrain-report.png'))
        page.get_by_role('button',name='Chuyển sang 2D',exact=True).click()
        areas(.5)
        symbol('.field-map-marker.map-selected-reference')
        page.locator('#response-details').get_by_role('button',name='Mở trong GIS',exact=True).click()
        expect(page.locator('.geodata-workspace')).to_be_visible()
        symbol('.geodata-workspace .field-map-marker.map-selected-reference')
        page.locator('.geodata-task-nav').get_by_role('button',name='Vùng sạt lở',exact=True).click()
        fill(12);areas(.12,'.geodata-workspace ')
        page.screenshot(path=str(captures/'gis-fill.png'))
        assert not errors,errors
        print('RESPONSE_GIS_2D_3D_OPACITY_AND_SYMBOL_PASSED',flush=True)
        context.close();browser.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--url',default='http://127.0.0.1:5174')
    parser.add_argument('--captures',type=Path,required=True)
    parser.add_argument('--chrome')
    args=parser.parse_args()
    run(args.url.rstrip("/"),args.captures,args.chrome)
