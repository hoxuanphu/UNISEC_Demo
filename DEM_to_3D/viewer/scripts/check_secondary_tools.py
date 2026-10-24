"""Browser checks for map revisions, image comparison, layer display and export."""
from browser_preferences import use_vietnamese
import argparse
import json
import struct
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


def open_comparison(page):
    # Before/after lives in the map's additional tools.
    tools = page.get_by_role('button', name='Công cụ bổ sung', exact=True)
    if tools.get_attribute('aria-expanded') != 'true': tools.click()
    page.get_by_role('button', name='So sánh ảnh trước và sau', exact=True).click()


def fixture_tiff(path, color, longitude=104, epsg=4326):
    """Small RGB display GeoTIFF with a known footprint; not operational imagery."""
    entries = [(256, 4, [16]), (257, 4, [16]), (258, 3, [8, 8, 8]), (259, 3, [1]),
               (262, 3, [2]), (273, 4, [0]), (277, 3, [3]), (278, 4, [16]),
               (279, 4, [768]), (284, 3, [1]), (33550, 12, [.01, .01, 0]),
               (33922, 12, [0, 0, 0, longitude, 21.8, 0]),
               (34735, 3, [1, 1, 0, 3, 1024, 0, 1, 2, 1025, 0, 1, 1, 2048, 0, 1, epsg])]
    offset = 8 + 2 + len(entries) * 12 + 4
    external, encoded = bytearray(), []
    for tag, kind, values in entries:
        value = struct.pack('<' + {3: 'H', 4: 'I', 12: 'd'}[kind] * len(values), *values)
        if len(value) > 4:
            field = struct.pack('<I', offset + len(external)); external.extend(value)
        else:
            field = value.ljust(4, b'\0')
        encoded.append((tag, kind, len(values), field))
    pixel_offset = offset + len(external)
    header = bytearray(b'II' + struct.pack('<HIH', 42, 8, len(entries)))
    for tag, kind, count, field in encoded:
        header.extend(struct.pack('<HHI', tag, kind, count))
        header.extend(struct.pack('<I', pixel_offset) if tag == 273 else field)
    path.write_bytes(header + b'\0' * 4 + external + bytes(color) * 256)


def run(url, chrome, captures):
    packet = json.loads((Path(__file__).resolve().parents[1] / 'public/scenarios/che-tao/v0.3/incident.json').read_text(encoding='utf-8'))
    with tempfile.TemporaryDirectory() as temporary, sync_playwright() as p:
        fixture_dir = Path(temporary)
        fixture_tiff(fixture_dir / 'before.tif', [80, 140, 80])
        fixture_tiff(fixture_dir / 'after.tif', [180, 130, 80])
        fixture_tiff(fixture_dir / 'invalid-crs.tif', [180, 130, 80], epsg=9999)
        browser = p.chromium.launch(headless=True, executable_path=chrome)
        context = use_vietnamese(browser.new_context(viewport={'width': 1366, 'height': 768}))
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(url) else route.abort())
        # Exercise the local GeoTIFF fallback when prepared imagery is unavailable.
        # The real prepared pair is checked by check_cartographic_evidence.py.
        context.route('**/scenarios/che-tao/imagery/imagery.json', lambda route: route.abort())
        page = use_vietnamese(context.new_page())
        errors, requests = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: requests.append(request.url))
        page.goto(url+'/?map=2d&demoRole=manager')
        basemap = page.locator('img[alt="Ảnh nền khu vực Chế Tạo"]')
        expect(basemap).to_be_visible(timeout=25000)
        initial_time = page.locator('.assessment-moment[aria-pressed="true"] time')
        initial_assessment = initial_time.get_attribute('datetime')
        initial_clock = initial_time.inner_text()
        assert not any('three.module' in request or '.glb' in request for request in requests)
        page.locator('.workspace-nav').get_by_role('button', name='Địa bàn', exact=True).click()
        page.locator('#response-panel .community').first.click()
        page.get_by_role('button', name='Thông báo sự kiện', exact=True).click()
        page.get_by_role('button', name='Nhật ký sự kiện', exact=True).click()
        expect(page.locator('.notification-history > li').first).to_be_visible()
        assert page.locator('.journal-list > li').evaluate_all("nodes=>nodes.every(node=>node.dataset.journalKind === 'report')")
        page.locator('.notification-history summary').first.click()
        expect(page.locator('.notification-record').first).to_contain_text('Ghi nhận')
        if captures:
            page.screenshot(path=str(captures / 'workspace-notification-history.png'))
        page.get_by_role('button', name='Xem báo cáo', exact=True).click()
        page.get_by_role('button', name='Cập nhật bản đồ', exact=True).click()
        updated_assessment = page.locator('.assessment-moment[aria-pressed="true"] time').get_attribute('datetime')
        assert updated_assessment != initial_assessment
        expect(page.locator('.route-action')).to_contain_text('Không sử dụng tuyến này')
        page.get_by_role('button', name='Sự kiện đang xem', exact=True).click()
        page.get_by_role('button', name='Nhật ký sự kiện', exact=True).click()
        page.get_by_role('radio', name='Đánh giá ban đầu').click()
        expect(page.locator('.revision-notice')).to_contain_text(initial_clock)
        expect(page.locator('.route-travel-estimate')).to_be_visible()
        page.get_by_role('button', name='Về dữ liệu mới nhất', exact=True).click()
        expect(page.locator('.revision-notice')).to_have_count(0)
        expect(page.locator('.route-action')).to_contain_text('Không sử dụng tuyến này')
        page.get_by_role('button', name='Lớp bản đồ', exact=True).click()
        page.locator('.layer-appearance summary').click()
        slider = page.get_by_label('Độ rõ ảnh nền', exact=True)
        slider.focus(); slider.press('Home')
        for _ in range(30):
            slider.press('ArrowRight')
        expect(basemap).to_have_css('opacity', '0.6')
        page.get_by_label('Đường hiển thị', exact=True).select_option('affected')
        page.get_by_label('Nhãn địa danh', exact=True).select_option('selected')
        expect(page.locator('.route-action')).to_contain_text('Không sử dụng tuyến này')
        if captures:
            page.screenshot(path=str(captures / 'workspace-layer-options.png'))
        open_comparison(page)
        for i, filename in enumerate(['before.tif', 'after.tif']):
            field = page.locator('.comparison-form fieldset').nth(i)
            field.locator('input[type=file]').set_input_files(fixture_dir / filename)
            acquired = datetime.fromisoformat(packet['incident']['triggeredAt']) + timedelta(days=-1 if i == 0 else 1)
            field.locator('input[type=datetime-local]').fill(acquired.strftime('%Y-%m-%dT%H:%M'))
            field.locator('input[type=text],input:not([type])').fill('Test fixture')
        # A failed member must stop the pair load and allow another submission.
        page.locator('.comparison-form input[type=file]').nth(1).set_input_files(fixture_dir / 'invalid-crs.tif')
        page.get_by_role('button', name='Mở so ảnh', exact=True).click()
        expect(page.locator('.comparison-error')).to_contain_text('GeoTIFF WGS84', timeout=25000)
        expect(page.get_by_role('button', name='Mở so ảnh', exact=True)).to_be_enabled()
        page.locator('.comparison-form input[type=file]').nth(1).set_input_files(fixture_dir / 'after.tif')
        page.get_by_role('button', name='Mở so ảnh', exact=True).click()
        expect(page.locator('.comparison-map .leaflet-image-layer')).to_have_count(2, timeout=25000)
        for width in [1366, 390, 320]:
            page.set_viewport_size({'width': width, 'height': 768})
            assert page.locator('.comparison-captions').evaluate('''node => {
              const [left, right] = [...node.children].map(child => child.getBoundingClientRect());
              return left.right + 7 <= right.left && node.scrollWidth <= node.clientWidth;
            }'''), ('Comparison dates overlap', width)
        page.set_viewport_size({'width': 1366, 'height': 768})
        before = page.locator('.comparison-map .leaflet-image-layer').nth(1)
        page.wait_for_function("!!document.querySelector('.comparison-map .leaflet-image-layer:nth-child(2)')?.style.clipPath")
        clip = before.evaluate('(element) => element.style.clipPath')
        slider = page.get_by_role('slider', name='Vị trí so ảnh', exact=True)
        slider.focus(); slider.press('Home')
        for _ in range(25):
            slider.press('ArrowRight')
        page.wait_for_timeout(100)
        assert before.evaluate('(element) => element.style.clipPath') != clip
        if captures:
            for _ in range(25):
                slider.press('ArrowRight')
            page.screenshot(path=str(captures / 'workspace-image-comparison.png'))
        page.keyboard.press('Escape')
        page.get_by_role('button', name='Lớp bản đồ', exact=True).click()
        open_comparison(page)
        expect(page.locator('.comparison-map .leaflet-image-layer')).to_have_count(2)
        page.keyboard.press('Escape')
        page.get_by_role('button', name='Xuất đánh giá', exact=True).click()
        expect(page.locator('.decision-export-preview')).to_be_visible(timeout=25000)
        page.locator('.export-formats summary').click()
        with page.expect_download() as download:
            page.get_by_role('button', name='Tải GeoJSON', exact=True).click()
        collection = json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
        assert collection['type'] == 'FeatureCollection' and 'crs' not in collection
        assert collection['metadata']['asOf'] == updated_assessment
        assert next(f for f in collection['features'] if f['id'] == 'road:' + packet['report']['roadId'])['properties']['status'] == 'blocked'
        # Intercept native print only in the test, keeping the exact print document.
        page.evaluate("""() => {
          window.printCalls = 0;
          new MutationObserver(() => document.querySelectorAll('iframe').forEach(frame => {
            frame.contentWindow.print = () => { window.printCalls++; };
          })).observe(document.body, {childList:true});
        }""")
        page.get_by_role('button', name='In / lưu PDF', exact=True).click()
        page.wait_for_function('window.printCalls === 1')
        assert page.frames[-1].locator('img').evaluate('(img) => img.complete && img.naturalWidth > 0')
        assert 'A4 landscape' in page.frames[-1].locator('style').text_content()
        page.evaluate("document.querySelector('iframe').contentWindow.dispatchEvent(new Event('afterprint'))")
        page.keyboard.press('Escape')
        page.get_by_role('button', name='Cài đặt', exact=True).click()
        page.get_by_role('button', name='Đặt lại phiên làm việc', exact=True).click()
        expect(page.locator('.incident-overview-heading')).to_be_visible()
        expect(page.locator('.assessment-moment[aria-pressed="true"] time')).to_have_attribute('datetime', initial_assessment)
        expect(page.locator('.assessment-moment[aria-pressed="true"]')).to_contain_text('Đánh giá ban đầu')
        assert not errors, errors
        browser.close()
        print('Secondary tools passed: revisions, notifications, layer display, GeoTIFF comparison, GeoJSON, print and reset.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5212')
    parser.add_argument('--chrome')
    parser.add_argument('--captures', type=Path)
    args = parser.parse_args()
    if args.captures:
        args.captures.mkdir(parents=True, exist_ok=True)
    run(args.url.rstrip('/'), args.chrome, args.captures)
