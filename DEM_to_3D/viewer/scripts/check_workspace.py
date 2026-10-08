"""Browser regression for the prepared incident workspace.

Requires Playwright for Python and a Chromium browser. Run against a built app.
"""
import argparse
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def check_symbols(page):
    page.wait_for_timeout(150)
    problems = page.evaluate("""() => {
      const box = el => el.getBoundingClientRect();
      const overlap = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      const visible = el => el.offsetHeight && getComputedStyle(el).visibility !== 'hidden';
      const pins = [...document.querySelectorAll('.map-pin')].filter(visible);
      const controls = [...document.querySelectorAll('.map-tools,.map-toolbar,.map-search-results,.map-help [data-popover],.map-bottom-bar,.map-reference,.layers-panel,.map-attribution,.map-source-popover,.map-measure-panel')].filter(visible);
      const errors = [];
      pins.forEach((pin, i) => {
        pins.slice(i + 1).forEach(other => { if (overlap(box(pin), box(other))) errors.push('pins: ' + pin.title + ' / ' + other.title); });
        controls.forEach(control => { if (overlap(box(pin), box(control))) errors.push('control: ' + pin.title); });
      });
      const labels = [...document.querySelectorAll('.map-pin:not(.is-label-hidden) .map-pin-label')].filter(visible);
      labels.forEach((label, i) => {
        [...pins, ...controls, ...labels.slice(i + 1)].forEach(other => { if (overlap(box(label), box(other))) errors.push('label: ' + label.textContent); });
      });
      return errors;
    }""")
    assert not problems, problems


def run(url, chrome, captures, prepared=False):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, **({'executable_path': chrome} if chrome else {}))
        context = browser.new_context(viewport={'width': 1440, 'height': 900})
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(url) else route.abort())
        context.add_init_script("""const original = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(type, ...rest) {
            return type === 'webgl' || type === 'webgl2' ? null : original.call(this, type, ...rest);
          };""")
        page = context.new_page()
        errors, requests = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: requests.append(request.url))
        page.goto(url)
        expect(page.locator('[data-map-object="community:NK"]')).to_be_visible(timeout=25000)
        expect(page.locator('.leaflet-image-layer')).to_have_count(1, timeout=25000)
        assert not any('.glb' in request for request in requests), '2D requested a 3D model'
        if prepared:
            assert not any('/api/' in request for request in requests), 'Static deployment depends on an API'
        assert page.locator('canvas.terrain-canvas').count() == 0
        page.wait_for_timeout(200)
        check_symbols(page)
        if captures:
            page.screenshot(path=str(captures / 'workspace-flat-2d.png'))

        handle = page.get_by_role('separator')
        handle.focus()
        before = int(handle.get_attribute('aria-valuenow'))
        page.keyboard.press('ArrowRight')
        expect(handle).to_have_attribute('aria-valuenow', str(before + 16))
        rect = handle.bounding_box()
        page.mouse.move(rect['x'] + 4, rect['y'] + 200)
        page.mouse.down(); page.mouse.move(rect['x'] + 84, rect['y'] + 200, steps=8); page.mouse.up()
        assert int(handle.get_attribute('aria-valuenow')) == before + 96
        assert abs(page.locator('.sidebar').bounding_box()['width'] - (before + 96)) < 2
        page.reload()
        expect(page.get_by_role('separator')).to_have_attribute('aria-valuenow', str(before + 96))
        expect(page.locator('.leaflet-image-layer')).to_have_count(1, timeout=25000)
        page.wait_for_function("document.querySelector('.leaflet-image-layer')?.complete")
        page.get_by_role('separator').dblclick()

        page.locator('.incident-priority-row').first.click()
        expect(page.locator('.assessment-action')).to_contain_text('Kiểm tra')
        expect(page.locator('.route-travel-estimate')).to_contain_text('40')
        if captures:
            page.screenshot(path=str(captures / 'workspace-summary.png'))
        expect(page.locator('.route-card')).to_have_count(2)
        page.get_by_role('button', name='Lưu đánh giá', exact=True).click()
        expect(page.locator('.decision-export-preview')).to_be_visible(timeout=25000)
        with page.expect_download() as download:
            page.get_by_role('button', name='Tải bản đồ PNG', exact=True).click()
        assert Path(download.value.path()).read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
        if captures:
            download.value.save_as(str(captures / 'decision-map.png'))
            page.screenshot(path=str(captures / 'workspace-export.png'))
        with page.expect_download() as download:
            page.locator('.export-formats summary').click()
            page.get_by_role('button', name='Tải dữ liệu JSON', exact=True).click()
        snapshot = json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
        assert snapshot['community']['id'] == 'NK' and snapshot['route']['status'] == 'uncertain'
        assert snapshot['dataKind'] == 'synthetic' and snapshot['appliedReportIds'] == []
        assert snapshot['terrainAssets']['image']['sha256']
        page.keyboard.press('Escape')
        page.locator('.route-card').nth(1).click()
        page.get_by_role('button', name='Lưu đánh giá', exact=True).click()
        expect(page.locator('.decision-export-preview')).to_be_visible(timeout=25000)
        with page.expect_download() as download:
            page.locator('.export-formats summary').click()
            page.get_by_role('button', name='Tải dữ liệu JSON', exact=True).click()
        direct = json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
        assert direct['route']['id'] != snapshot['route']['id'] and direct['route']['status'] == 'blocked'
        assert 'eta' not in direct['route']
        page.keyboard.press('Escape'); page.locator('.route-card').first.click()
        if captures:
            page.screenshot(path=str(captures / 'workspace-routes.png'))
        page.get_by_role('button', name='Mặt cắt địa hình', exact=True).click()
        expect(page.locator('.profile-svg')).to_contain_text('km')
        slider = page.locator('#profile-dist-slider'); slider.focus(); page.keyboard.press('ArrowRight')
        expect(page.locator('.map-profile-point-2d')).to_have_count(1)
        cursor = page.locator('.map-profile-point-2d').get_attribute('d')
        for _ in range(10): page.keyboard.press('ArrowRight')
        expect(page.locator('.map-profile-point-2d')).not_to_have_attribute('d', cursor)
        if captures:
            page.screenshot(path=str(captures / 'workspace-profile.png'))
        page.get_by_role('button', name='Đóng mặt cắt', exact=True).click()
        page.get_by_role('button', name='Chuyển sang 3D', exact=True).click()
        expect(page.locator('.map-2d-surface')).to_be_visible(timeout=25000)
        expect(page.locator('.sidebar h1')).to_have_text('Nậm Khắt')
        expect(page.locator('.toast')).to_contain_text('2D')

        source = page.get_by_role('button', name='Nguồn bản đồ', exact=True)
        source.click(); expect(page.locator('.map-source-popover')).to_be_visible()
        page.keyboard.press('Escape'); expect(page.locator('.map-source-popover')).to_have_count(0)
        expect(source).to_be_focused()

        page.get_by_role('button', name='Đóng chi tiết địa bàn', exact=True).click()
        search = page.get_by_role('combobox', name='Tìm trên bản đồ', exact=True)
        search.fill('nam khat'); page.keyboard.press('Enter')
        expect(page.locator('.sidebar h1')).to_have_text('Nậm Khắt')
        expect(page.locator('.map-search-results')).to_have_count(0)
        page.get_by_role('button', name='Đóng chi tiết địa bàn', exact=True).click()
        search.fill('E3'); page.keyboard.press('Enter')
        expect(page.locator('.sidebar h1')).to_have_text('Đường vào Khau Mang qua cầu')
        page.get_by_role('button', name='Đóng chi tiết đối tượng', exact=True).click()
        page.get_by_role('button', name='Xóa tìm kiếm', exact=True).click()
        page.locator('.workspace-nav button').nth(1).click()
        page.get_by_role('searchbox', name='Tìm đường hoặc điểm ảnh hưởng').fill('E3')
        page.locator('.impact-row').click()
        expect(page.locator('.sidebar')).to_contain_text('Kiểm tra mực nước')
        expect(page.locator('.sidebar')).not_to_contain_text('Thông tin tham chiếu')
        page.get_by_role('button', name='Xem báo cáo', exact=True).click()
        expect(page.locator('.evidence-metadata')).to_contain_text('03:55')
        expect(page.locator('.evidence-metadata')).to_contain_text('04:10')
        expect(page.locator('.evidence-road')).to_contain_text('Khau Mang')
        if captures:
            expect(page.locator('.toast')).to_have_count(0, timeout=6000)
            page.screenshot(path=str(captures / 'workspace-evidence.png'))
        page.locator('.evidence-road').click()
        expect(page.locator('.modal-overlay')).to_have_count(0)
        expect(page.locator('.sidebar h1')).to_have_text('Đường vào Khau Mang qua cầu')
        if captures:
            expect(page.locator('.toast')).to_have_count(0, timeout=6000)
            page.screenshot(path=str(captures / 'workspace-road-action.png'))
        page.get_by_role('button', name='Đóng chi tiết đối tượng', exact=True).click()
        page.get_by_role('button', name='Xem toàn khu vực', exact=True).click()
        for _ in range(7):
            page.get_by_role('button', name='Thu nhỏ', exact=True).click()
            page.wait_for_timeout(150)
        group = page.locator('.map-pin.is-cluster:visible,.map-pin.is-overlap:visible,.map-pin.has-overlap:visible').first
        expect(group).to_be_visible()
        check_symbols(page)
        assert page.locator('.map-pin.is-overlap:visible .map-pin-count:visible').count() == 0
        group.click()
        expect(page.locator('.map-object-chooser')).to_be_visible()
        page.keyboard.press('Escape'); expect(page.locator('.map-object-chooser')).to_have_count(0)

        # Measurement must consume map clicks, never select response objects.
        page.get_by_role('button', name='Xem toàn khu vực', exact=True).click()
        page.get_by_role('button', name='Đo trên bản đồ 2D', exact=True).click()
        panel = page.locator('.map-measure-panel')
        expect(panel).to_be_visible()
        expect(page.get_by_role('button', name='Chuyển sang 3D')).to_be_enabled()
        area = page.locator('.map-2d-surface').bounding_box()
        def pick(x, y):
            page.mouse.click(area['x'] + area['width'] * x, area['y'] + area['height'] * y)
        pick(.55, .4)
        expect(panel.get_by_role('button', name='Kết thúc')).to_be_disabled()
        pick(.7, .4)
        expect(panel.locator('.map-measure-result')).to_contain_text('km')
        panel.get_by_role('button', name='Kết thúc').click()
        expect(panel.get_by_role('button', name='Đo mới', exact=True)).to_be_visible()
        panel.get_by_role('button', name='Chỉnh sửa', exact=True).click()
        expect(panel.get_by_role('button', name='Hoàn tác', exact=True)).to_be_disabled()
        panel.get_by_role('button', name='Hủy', exact=True).click()
        panel.get_by_role('combobox', name='Kiểu đo', exact=True).select_option('area')
        pick(.55, .4); pick(.7, .4); pick(.7, .6)
        expect(panel.locator('.map-measure-result')).to_contain_text('Chu vi')
        expect(panel.get_by_role('button', name='Kết thúc')).to_be_enabled()
        if captures:
            page.screenshot(path=str(captures / 'workspace-measurement.png'))
        panel.get_by_role('button', name='Kết thúc').click()
        page.keyboard.press('Escape')
        expect(panel).to_have_count(0)
        expect(page.get_by_role('button', name='Đo trên bản đồ 2D')).to_be_focused()
        expect(page.get_by_role('button', name='Chuyển sang 3D')).to_be_enabled()
        check_symbols(page)

        for width, height in [(1366, 768), (1024, 768), (390, 740), (320, 740)]:
            page.set_viewport_size({'width': width, 'height': height})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            if width < 900:
                expect(page.get_by_role('separator')).to_be_hidden()
                page.get_by_role('button', name='Bản đồ', exact=True).click()
            page.get_by_role('button', name='Lớp bản đồ', exact=True).click()
            panel = page.locator('.layers-panel').bounding_box()
            area = page.locator('.map-area').bounding_box()
            assert panel['x'] >= area['x'] and panel['x'] + panel['width'] <= area['x'] + area['width']
            page.get_by_role('button', name='Đóng lớp bản đồ', exact=True).click()
            toolbar = page.locator('.map-toolbar').bounding_box()
            assert toolbar['x'] >= area['x'] and toolbar['x'] + toolbar['width'] <= area['x'] + area['width']
            check_symbols(page)
        assert not errors, errors
        context.close()

        # Verify the complete report flow, AOI inspection and recalculated route.
        context = browser.new_context(viewport={'width': 1440, 'height': 900})
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(url) else route.abort())
        page = context.new_page(); page.goto(url)
        expect(page.locator('.incident-priority-row').first).to_be_visible(timeout=25000)
        page.get_by_role('button', name='Vùng đánh giá Nậm Kha', exact=True).click()
        expect(page.locator('.sidebar')).to_contain_text('201.3 km')
        page.get_by_role('button', name='Đóng chi tiết đối tượng', exact=True).click()
        page.locator('.incident-priority-row').first.click()
        page.get_by_role('button', name='Thông báo sự kiện', exact=True).click()
        expect(page.locator('.notification-popover')).to_be_visible()
        page.get_by_role('button', name='Mở sự kiện', exact=True).click()
        expect(page.locator('.incident-priority-row').first).to_be_visible()
        page.locator('.incident-priority-row').first.click()
        page.get_by_role('button', name='Thông báo sự kiện', exact=True).click()
        page.get_by_role('button', name='Xem chi tiết', exact=True).click()
        expect(page.locator('.header-data')).to_contain_text('09:31')
        page.get_by_role('button', name='Cập nhật bản đồ', exact=True).click()
        expect(page.locator('.sidebar h1')).to_have_text('Nậm Khắt')
        expect(page.locator('.header-data')).to_contain_text('09:45')
        expect(page.locator('.decision-overview')).to_contain_text('Các tuyến đã biết đều bị chặn')
        expect(page.locator('.route-travel-estimate')).to_have_count(0)
        page.get_by_role('button', name='Lưu đánh giá', exact=True).click()
        with page.expect_download() as download:
            page.locator('.export-formats summary').click()
            page.get_by_role('button', name='Tải dữ liệu JSON', exact=True).click()
        snapshot = json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
        assert '09:45' in snapshot['asOf'] and snapshot['route']['status'] == 'blocked'
        assert 'eta' not in snapshot['route'] and snapshot['appliedReportIds']
        expect(page.locator('.decision-export-preview')).to_be_visible(timeout=25000)
        if captures:
            with page.expect_download() as download:
                page.get_by_role('button', name='Tải bản đồ PNG', exact=True).click()
            download.value.save_as(str(captures / 'decision-map-updated.png'))
        page.keyboard.press('Escape')
        page.get_by_role('button', name='Dữ liệu', exact=True).click()
        expect(page.locator('.data-source-row').filter(has_text='Phương án tiếp cận').locator('time')).to_have_text('09:45')
        page.keyboard.press('Escape')
        page.get_by_role('button', name='Đóng chi tiết địa bàn', exact=True).click()
        page.locator('.workspace-nav button').nth(1).click()
        page.locator('.sidebar .decision-tabs button').nth(1).click()
        page.get_by_role('searchbox', name='Tìm đường hoặc điểm ảnh hưởng').fill('U-1')
        page.locator('.impact-row').click()
        expect(page.locator('.sidebar')).to_contain_text('Có đoạn đường bị chặn')
        expect(page.locator('.sidebar')).not_to_contain_text('Mã tham chiếu')
        page.get_by_role('button', name='Đường vòng qua sườn núi, đoạn vượt khe').click()
        expect(page.locator('.sidebar h1')).to_have_text('Đường vòng qua sườn núi, đoạn vượt khe')
        expect(page.locator('.sidebar')).to_contain_text('Bị chặn')
        context.close()

        # Explicit API errors must not display the bundled mock snapshot.
        context = browser.new_context(viewport={'width': 1440, 'height': 900})
        context.route('**/workspace-config.json', lambda route: route.fulfill(content_type='application/json', body='{"dataSource":"api"}'))
        context.route('**/api/v1/incidents/*/workspace', lambda route: route.fulfill(status=503, body='unavailable'))
        page = context.new_page(); page.goto(url)
        expect(page.locator('.sidebar h1')).to_have_text('Chưa tải được dữ liệu', timeout=25000)
        expect(page.locator('.sidebar')).not_to_contain_text('Nậm Khắt')
        expect(page.locator('.header-data time')).to_have_count(0)
        context.close()

        # A damaged/missing GLB must not remove the independent 2D workspace.
        context = browser.new_context(viewport={'width': 1440, 'height': 900})
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(url) and not '.glb' in route.request.url else route.abort())
        page = context.new_page(); page.goto(url)
        expect(page.locator('[data-map-object="community:NK"]')).to_be_visible(timeout=25000)
        page.locator('.incident-priority-row').first.click()
        page.get_by_role('button', name='Chuyển sang 3D', exact=True).click()
        expect(page.locator('.toast')).to_contain_text('2D', timeout=25000)
        expect(page.locator('.map-2d-surface')).to_be_visible()
        expect(page.locator('.sidebar h1')).to_have_text('Nậm Khắt')
        context.close()

        # Losing an active GPU context also falls back without losing selection.
        context = browser.new_context(viewport={'width': 1440, 'height': 900})
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(url) else route.abort())
        page = context.new_page(); page.goto(url)
        expect(page.locator('[data-map-object="community:NK"]')).to_be_visible(timeout=25000)
        page.locator('.incident-priority-row').first.click()
        page.get_by_role('button', name='Chuyển sang 3D', exact=True).click()
        expect(page.locator('canvas.terrain-canvas')).to_be_visible(timeout=25000)
        expect(page.locator('[data-map-object="community:NK"]')).to_be_visible(timeout=25000)
        page.locator('canvas.terrain-canvas').evaluate("el => el.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
        expect(page.locator('.map-2d-surface')).to_be_visible(timeout=25000)
        expect(page.locator('.sidebar h1')).to_have_text('Nậm Khắt')
        context.close(); browser.close()
        print('Workspace passed: incident/AOI/access/route/evidence/report, search, PNG/JSON export, conditional ETA, independent offline 2D, GPU/file recovery, API error boundary, panel resize, symbols and responsive layout')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5211')
    parser.add_argument('--chrome', help='Optional installed Chromium/Chrome executable')
    parser.add_argument('--captures', type=Path)
    parser.add_argument('--prepared', action='store_true', help='Verify static delivery without an API')
    args = parser.parse_args()
    if args.captures:
        args.captures.mkdir(parents=True, exist_ok=True)
    run(args.url.rstrip('/'), args.chrome, args.captures, args.prepared)
