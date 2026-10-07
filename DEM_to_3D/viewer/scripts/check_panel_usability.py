"""Check panel spacing, access context, grouped markers and Vietnamese search."""
import argparse
import re
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
from check_workspace import check_symbols


def check_panel(page):
    problems = page.locator('.sidebar').evaluate("""panel => {
      const errors = [];
      if (panel.scrollWidth > panel.clientWidth + 1) errors.push('panel overflow');
      const body = panel.querySelector('.sidebar-scroll');
      if (body.scrollWidth > body.clientWidth + 1) errors.push('body overflow');
      panel.querySelectorAll('.workflow-section > p + button').forEach(button => {
        const gap = button.getBoundingClientRect().top - button.previousElementSibling.getBoundingClientRect().bottom;
        if (gap < 11) errors.push('copy touches action: ' + button.textContent);
      });
      panel.querySelectorAll('dd').forEach(value => {
        if (value.scrollWidth > value.clientWidth + 1) errors.push('clipped value: ' + value.textContent);
      });
      return errors;
    }""")
    assert not problems, problems


def run(url, chrome, captures):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, **({'executable_path': chrome} if chrome else {}))
        context = browser.new_context(viewport={'width': 1366, 'height': 768})
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url + '/') else r.abort())
        page = context.new_page(); errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url)
        expect(page.locator('.incident-priority-row').first).to_be_visible(timeout=25000)
        expect(page.locator('.leaflet-image-layer')).to_have_count(1, timeout=25000)
        page.wait_for_function("document.querySelector('.leaflet-image-layer')?.complete")
        # A priority village must not disappear into a nameless mixed group.
        priority = page.locator('[data-map-object="community:KM"]')
        expect(priority).to_be_visible()
        assert 'is-label-hidden' not in priority.get_attribute('class')
        priority.click()
        expect(page.locator('.map-object-chooser')).to_contain_text('Các điểm trong nhóm')
        expect(page.locator('.map-chooser-expand')).to_have_text('Xem khu vực này')
        page.keyboard.press('Escape')
        check_symbols(page)
        for width in [1366, 1024, 390, 320]:
            page.set_viewport_size({'width': width, 'height': 768})
            if width < 900:
                page.get_by_role('button', name='Thông tin', exact=True).click()
            page.locator('.workspace-nav button').first.click()
            page.locator('.incident-area-link').click()
            check_panel(page)
            assert page.locator('.area-facts dd').first.bounding_box()['height'] < 40
            expect(page.locator('.object-reference')).not_to_have_attribute('open', '')
            if captures and width == 1366:
                page.screenshot(path=str(captures / 'workspace-area.png'))
            page.get_by_role('button', name='Xem địa bàn trong vùng', exact=True).click()
            expect(page.locator('.sidebar .community')).to_have_count(7)
            query = page.get_by_role('searchbox', name='Tìm địa bàn', exact=True)
            query.fill('nam khat')
            expect(page.locator('.sidebar .community')).to_have_count(1)
            row = page.locator('.sidebar .community').first
            spacing = row.evaluate("""row => {
                const box = row.getBoundingClientRect();
                const title = row.querySelector('strong').getBoundingClientRect();
                const status = row.querySelector('.status-text').getBoundingClientRect();
                const description = row.querySelector('p').getBoundingClientRect();
                return {left: title.left-box.left, right: box.right-status.right,
                    top: title.top-box.top, gap: description.top-Math.max(title.bottom,status.bottom),
                    bottom: box.bottom-description.bottom};
            }""")
            assert min(spacing['left'], spacing['right'], spacing['top'], spacing['bottom']) >= 11, spacing
            assert spacing['gap'] >= 7, spacing
            before = row.locator('strong').bounding_box()
            row.hover()
            assert row.locator('strong').bounding_box() == before
            if captures and width == 1366:
                page.screenshot(path=str(captures / 'workspace-community-hover.png'))
            page.locator('.sidebar .community').click()
            expect(page.locator('.decision-overview')).to_contain_text('Có tuyến bị chặn, tuyến khác cần xác minh')
            check_panel(page)
            if captures and width == 1366:
                page.screenshot(path=str(captures / 'workspace-access.png'))
            expect(page.locator('.decision-tabs button')).to_have_count(2)
            if width >= 900:
                action = page.locator('.access-primary').bounding_box()
                panel_box = page.locator('.sidebar').bounding_box()
                assert action['y'] + action['height'] <= panel_box['y'] + panel_box['height'], 'Primary action is below the initial viewport'
                route = page.locator('.decision-route').bounding_box()
                assert route['y'] + route['height'] <= action['y'], 'Route context must appear before its action'
            expect(page.locator('.access-issues .road-constraint')).to_have_count(1)
            expect(page.locator('.access-issues')).to_contain_text('vượt khe')
            expect(page.locator('.access-issues')).not_to_contain_text(re.compile('đoạn sạt lở', re.I))
            expect(page.locator('.assessment-action')).to_contain_text('Kiểm tra điểm vượt khe')
            expect(page.locator('.constraint-observation')).to_contain_text('Chưa xác nhận xe bán tải')
            expect(page.locator('.constraint-source')).to_contain_text('Ghi nhận 08:58')
            page.get_by_role('button', name='So sánh tuyến', exact=True).click()
            page.locator('.route-card').nth(1).click()
            # Returning to Access summarizes the community, not the selected route.
            page.locator('.decision-tabs button').first.click()
            expect(page.locator('.decision-overview')).to_contain_text('Có tuyến bị chặn, tuyến khác cần xác minh')
            expect(page.locator('.decision-route .status-text')).to_have_text('Bị chặn')
            expect(page.locator('.assessment-action')).to_contain_text('Tuyến đang xem bị chặn')
            expect(page.locator('.route-travel-estimate')).to_have_count(0)
            expect(page.locator('.access-issues')).to_contain_text(re.compile('đoạn sạt lở', re.I))
            expect(page.locator('.access-issues')).not_to_contain_text('vượt khe')
            page.get_by_role('button', name='Xem tuyến khác', exact=True).click()
            expect(page.locator('.access-issues')).to_contain_text('vượt khe')
            expect(page.locator('.route-travel-estimate')).to_contain_text('40')
            expect(page.locator('.route-card').first).to_have_attribute('aria-pressed', 'true')
            page.locator('.decision-tabs button').nth(1).click()
            expect(page.locator('.assessment-basis')).to_contain_text('Có đường bị chặn và mất liên lạc')
            report = page.locator('.community-finding').filter(has_text='Đường chính vào Nậm Khắt')
            expect(report.locator('.finding-source')).to_contain_text('Báo cáo')
            expect(report.locator('time')).to_have_count(2)
            report.get_by_role('button', name='Xem báo cáo', exact=True).click()
            expect(page.locator('.evidence-metadata')).to_contain_text('07:40')
            expect(page.locator('.evidence-metadata')).to_contain_text('07:50')
            expect(page.locator('.evidence-metadata dt')).to_have_text(['Báo cáo', 'Ghi nhận', 'Tiếp nhận'])
            page.keyboard.press('Escape')
            check_panel(page)
            page.get_by_role('button', name='Đóng chi tiết địa bàn', exact=True).click()
            expect(query).to_have_value('nam khat')
            page.locator('.workspace-nav button').nth(1).click()
            road_query = page.get_by_role('searchbox', name='Tìm đường hoặc điểm ảnh hưởng', exact=True)
            road_query.fill('khau mang')
            expect(page.locator('.impact-row')).to_have_count(1)
            page.locator('.impact-row').click()
            expect(page.locator('.sidebar h1')).to_have_text('Đường vào Khau Mang qua cầu')
            check_panel(page)
            page.get_by_role('button', name='Xem báo cáo', exact=True).click()
            expect(page.locator('.evidence-metadata')).to_contain_text('03:55')
            page.keyboard.press('Escape')
            page.get_by_role('button', name='Đóng chi tiết đối tượng', exact=True).click()
            expect(road_query).to_have_value('khau mang')
            page.locator('.decision-tabs button').nth(1).click()
            expect(page.locator('.impact-metrics [aria-pressed="true"]')).to_have_count(0)
            page.locator('[data-road-filter="blocked"]').click()
            expect(road_query).to_have_value('')
            expect(page.locator('.decision-tabs button').first).to_have_attribute('aria-pressed', 'true')
            expect(page.locator('.impact-row')).to_have_count(1)
            page.locator('[data-road-filter="all"]').click()
            if width < 900:
                page.get_by_role('button', name='Bản đồ', exact=True).click()
            search = page.get_by_role('combobox', name='Tìm trên bản đồ', exact=True)
            search.fill('bai dap')
            search.press('Escape')
            expect(search).to_have_attribute('aria-expanded', 'false')
            search.press('Enter')
            expect(page.locator('.object-facts')).to_have_count(0)
            search.press('ArrowDown')
            expect(search).to_have_attribute('aria-activedescendant', 'map-result-0')
            search.press('Enter')
            expect(page.locator('.object-facts')).to_contain_text('Vị trí đề xuất')
            check_panel(page)
            if captures and width == 1366:
                page.screenshot(path=str(captures / 'workspace-landing-site.png'))
            page.get_by_role('button', name='Đóng chi tiết đối tượng', exact=True).click()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        # Missing road coverage is one state, not multiple repeated warnings.
        for width in [1366, 320]:
            page.set_viewport_size({'width': width, 'height': 768})
            for name in ['Púng Hốc', 'Nậm Lắt', 'Tà Phình', 'Háng Cơ']:
                if width < 900:
                    page.get_by_role('button', name='Bản đồ', exact=True).click()
                search = page.get_by_role('combobox', name='Tìm trên bản đồ', exact=True)
                search.fill(name)
                search.press('Enter')
                panel = page.locator('.sidebar')
                expect(panel.get_by_text('Chưa có tuyến để đánh giá', exact=True)).to_have_count(1)
                expect(panel.locator('.decision-route')).to_have_count(0)
                expect(panel.locator('.sidebar-intro')).to_have_count(0)
                expect(panel.locator('.assessment-action')).to_contain_text('Bổ sung dữ liệu đường và báo cáo tình trạng đường')
                check_panel(page)
                if captures and name == 'Púng Hốc':
                    page.screenshot(path=str(captures / f'workspace-unmapped-{width}.png'))
                expect(panel.locator('.route-card')).to_have_count(0)
                expect(panel.locator('.access-disclosure')).to_have_count(0)
                page.get_by_role('button', name='Xem thông tin địa bàn', exact=True).click()
                expect(panel.get_by_text('Chưa đủ dữ liệu đường vào để đánh giá tiếp cận', exact=True)).to_have_count(1)
                expect(panel.get_by_text('Chưa có tuyến để đánh giá', exact=True)).to_have_count(0)
                expect(panel.locator('.sidebar-intro')).to_have_count(0)
                if name == 'Nậm Lắt':
                    expect(panel.get_by_role('heading', name='Thông tin còn thiếu', exact=True)).to_be_visible()
                    flood = panel.locator('.community-finding').filter(has_text='Phạm vi ngập')
                    expect(flood.locator('p')).to_have_text('Chưa có vùng ngập được khoanh.')
                    households = panel.locator('.community-finding').filter(has_text='Hộ bị ảnh hưởng')
                    expect(households.locator('p')).to_have_text('Chưa có thống kê.')
                    expect(panel.locator('.finding-source')).to_have_count(0)
                    expect(panel.locator('.community-findings')).not_to_contain_text('Tin hiện trường')
                check_panel(page)
        # The event overview and destination view must read the same updated snapshot.
        page.set_viewport_size({'width': 1366, 'height': 768})
        # Image acquisition and analysis receipt are not field-observation times.
        search = page.get_by_role('combobox', name='Tìm trên bản đồ', exact=True)
        search.fill('Lao Mải')
        search.press('Enter')
        page.locator('.decision-tabs button').nth(1).click()
        page.get_by_role('button', name='Xem phân tích', exact=True).click()
        expect(page.get_by_role('heading', name='Phân tích ảnh vệ tinh', exact=True)).to_be_visible()
        expect(page.locator('.evidence-metadata dt')).to_have_text(['Tài liệu phân tích', 'Thu nhận ảnh', 'Nhận kết quả'])
        expect(page.locator('.evidence-metadata time').first).to_have_attribute('datetime', '2026-09-29T06:12:00+07:00')
        expect(page.locator('.evidence-metadata time').last).to_have_attribute('datetime', '2026-09-29T07:05:00+07:00')
        if captures: page.screenshot(path=str(captures / 'workspace-image-analysis-metadata.png'))
        page.keyboard.press('Escape')
        page.locator('.workspace-nav button').first.click()
        expect(page.locator('.incident-priority-row').first).to_contain_text('Có đường bị chặn và mất liên lạc với địa bàn')
        page.get_by_role('button', name='Thông báo sự kiện', exact=True).click()
        page.get_by_role('button', name='Xem chi tiết', exact=True).click()
        page.get_by_role('button', name='Cập nhật bản đồ', exact=True).click()
        expect(page.locator('.incident-priority-row').first).to_contain_text('Có đường bị chặn và mất liên lạc với địa bàn')
        page.locator('.incident-priority-row').first.click()
        expect(page.locator('.decision-overview')).to_contain_text('Các tuyến đã biết đều bị chặn')
        expect(page.locator('.route-travel-estimate')).to_have_count(0)
        page.get_by_role('button', name='So sánh tuyến', exact=True).click()
        expect(page.locator('.sidebar-intro')).to_have_count(0)
        expect(page.locator('.route-card')).to_have_count(2)
        expect(page.locator('.access-issues .status-text')).to_have_text('Bị chặn')
        expect(page.locator('.assessment-action')).to_contain_text('Không sử dụng tuyến này')
        expect(page.locator('.constraint-observation')).to_contain_text('Xe cơ giới không thể qua')
        expect(page.locator('.constraint-source')).to_contain_text('Ghi nhận 09:40')
        expect(page.locator('.route-travel-estimate')).to_have_count(0)
        page.locator('.decision-tabs button').nth(1).click()
        expect(page.locator('.sidebar').get_by_text('Có đường bị chặn và mất liên lạc với địa bàn', exact=True)).to_have_count(1)
        expect(page.locator('.sidebar-intro')).to_have_count(0)
        page.get_by_role('button', name='Cài đặt hiển thị', exact=True).click()
        page.get_by_role('button', name='English', exact=True).click()
        search = page.get_by_role('combobox', name='Search map', exact=True)
        search.fill('pung hoc')
        search.press('Enter')
        panel = page.locator('.sidebar')
        expect(panel.get_by_text('No mapped access route', exact=True)).to_have_count(1)
        expect(panel.locator('.decision-route')).to_have_count(0)
        check_panel(page)
        page.get_by_role('button', name='Review community findings', exact=True).click()
        expect(panel.get_by_text('Insufficient road data to assess access', exact=True)).to_have_count(1)
        expect(panel.locator('.sidebar-intro')).to_have_count(0)
        check_panel(page)
        assert not errors, errors
        browser.close()
        print('Panel usability passed: 4 viewport sizes, spacing, search, access context, sources, markers, report update and non-repeated missing-route states.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:5213')
    parser.add_argument('--chrome')
    parser.add_argument('--captures', type=Path)
    args = parser.parse_args()
    if args.captures:
        args.captures.mkdir(parents=True, exist_ok=True)
    run(args.url.rstrip('/'), args.chrome, args.captures)
