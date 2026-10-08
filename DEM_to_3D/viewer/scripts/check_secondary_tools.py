"""Browser checks for map revisions, image comparison, layer display and export."""
import argparse
import json
import struct
import tempfile
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


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
    with tempfile.TemporaryDirectory() as temporary, sync_playwright() as p:
        fixture_dir = Path(temporary)
        fixture_tiff(fixture_dir / 'before.tif', [80, 140, 80])
        fixture_tiff(fixture_dir / 'after.tif', [180, 130, 80])
        fixture_tiff(fixture_dir / 'invalid-crs.tif', [180, 130, 80], epsg=9999)
        browser = p.chromium.launch(headless=True, executable_path=chrome)
        context = browser.new_context(viewport={'width': 1366, 'height': 768})
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(url) else route.abort())
        page = context.new_page()
        errors, requests = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: requests.append(request.url))
        page.goto(url)
        expect(page.locator('.leaflet-image-layer')).to_have_count(1, timeout=25000)
        assert not any('three.module' in request or '.glb' in request for request in requests)
        page.locator('.incident-priority-row').first.click()
        page.get_by_role('button', name='Thông báo sự kiện', exact=True).click()
        page.get_by_role('button', name='Tất cả thông báo', exact=True).click()
        expect(page.locator('.notification-history > li')).to_have_count(7)
        page.locator('.notification-history summary').first.click()
        expect(page.locator('.notification-record').first).to_contain_text('Ghi nhận')
        if captures:
            page.screenshot(path=str(captures / 'workspace-notification-history.png'))
        page.get_by_role('button', name='Xem báo cáo', exact=True).click()
        page.get_by_role('button', name='Cập nhật bản đồ', exact=True).click()
        expect(page.locator('.decision-overview')).to_contain_text('Các tuyến đã biết đều bị chặn')
        page.locator('.header-revision').click()
        page.get_by_role('radio', name='Đánh giá ban đầu').click()
        expect(page.locator('.revision-notice')).to_contain_text('09:31')
        expect(page.locator('.route-travel-estimate')).to_be_visible()
        page.get_by_role('button', name='Về dữ liệu mới nhất', exact=True).click()
        expect(page.locator('.revision-notice')).to_have_count(0)
        expect(page.locator('.decision-overview')).to_contain_text('Các tuyến đã biết đều bị chặn')
        page.get_by_role('button', name='Lớp bản đồ', exact=True).click()
        page.locator('.layer-appearance summary').click()
        slider = page.get_by_label('Độ rõ ảnh nền', exact=True)
        slider.focus(); slider.press('Home')
        for _ in range(30):
            slider.press('ArrowRight')
        expect(page.locator('.map-2d .leaflet-image-layer')).to_have_css('opacity', '0.6')
        page.get_by_label('Đường hiển thị', exact=True).select_option('affected')
        page.get_by_label('Nhãn địa danh', exact=True).select_option('selected')
        expect(page.locator('.decision-overview')).to_contain_text('Các tuyến đã biết đều bị chặn')
        if captures:
            page.screenshot(path=str(captures / 'workspace-layer-options.png'))
        page.get_by_role('button', name='So ảnh trước và sau sự kiện', exact=True).click()
        for i, filename in enumerate(['before.tif', 'after.tif']):
            field = page.locator('.comparison-form fieldset').nth(i)
            field.locator('input[type=file]').set_input_files(fixture_dir / filename)
            field.locator('input[type=datetime-local]').fill(['2026-09-20T09:00', '2026-09-29T09:00'][i])
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
        page.get_by_role('button', name='So ảnh trước và sau sự kiện', exact=True).click()
        expect(page.locator('.comparison-map .leaflet-image-layer')).to_have_count(2)
        page.keyboard.press('Escape')
        page.get_by_role('button', name='Lưu đánh giá', exact=True).click()
        expect(page.locator('.decision-export-preview')).to_be_visible(timeout=25000)
        page.locator('.export-formats summary').click()
        with page.expect_download() as download:
            page.get_by_role('button', name='Tải GeoJSON', exact=True).click()
        collection = json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
        assert collection['type'] == 'FeatureCollection' and 'crs' not in collection
        assert '09:45' in collection['metadata']['asOf']
        assert next(f for f in collection['features'] if f['id'] == 'road:E13')['properties']['status'] == 'blocked'
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
        page.get_by_role('button', name='Cài đặt hiển thị', exact=True).click()
        page.get_by_role('button', name='Đặt lại phiên làm việc', exact=True).click()
        expect(page.locator('.incident-priority-row').first).to_be_visible()
        expect(page.locator('.header-data')).to_contain_text('09:31')
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
