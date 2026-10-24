"""Check layer provenance, revision timestamps, keyboard controls and narrow layouts."""
from browser_preferences import use_vietnamese
from network_browser_fixture import install_network_fixture
import argparse
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


def run(url, chrome, captures):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, **({'executable_path': chrome} if chrome else {}))
        context = use_vietnamese(browser.new_context(viewport={'width': 1366, 'height': 768}))
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url + '/') else r.abort())
        install_network_fixture(context,url)
        page = use_vietnamese(context.new_page()); errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url+'/?map=2d&demoRole=manager')
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=25000)
        # Provenance is in one source dialog; the layer panel only controls display.
        page.get_by_role('button', name='Sự kiện đang xem', exact=True).click()
        page.locator('.header-context-popover').get_by_role('button', name='Nguồn dữ liệu', exact=True).click()
        sources = page.get_by_role('dialog', name='Nguồn và thời điểm dữ liệu', exact=True)
        expect(sources).to_contain_text('14:02')
        expect(sources.locator('.data-terrain')).to_contain_text('Chưa khai báo')
        expect(sources).to_contain_text('EPSG:32648')
        page.keyboard.press('Escape')
        page.get_by_role('button', name='Lớp bản đồ', exact=True).click()
        status = page.get_by_role('checkbox', name='Tình trạng đường', exact=True)
        status.uncheck()
        page.keyboard.press('Escape')
        page.get_by_role('button', name='Chú giải', exact=True).click()
        expect(page.locator('.map-legend')).to_contain_text('Mạng đường')
        expect(page.locator('.map-legend')).not_to_contain_text('Chưa ghi nhận chặn')
        page.get_by_role('button', name='Lớp bản đồ', exact=True).click()
        page.get_by_role('checkbox', name='Tình trạng đường', exact=True).check()
        page.keyboard.press('Escape')
        expect(page.locator('.map-legend')).to_contain_text('Chưa ghi nhận chặn')
        page.get_by_role('button', name='Thông báo sự kiện', exact=True).click()
        page.get_by_role('button', name='Xem chi tiết', exact=True).click()
        page.get_by_role('dialog', name='Báo cáo hiện trường', exact=True).get_by_role('button', name='Cập nhật bản đồ', exact=True).click()
        page.get_by_role('button', name='Sự kiện đang xem', exact=True).click()
        page.locator('.header-context-popover').get_by_role('button', name='Nguồn dữ liệu', exact=True).click()
        expect(sources).to_contain_text('14:16')
        expect(sources).to_contain_text('14:11')
        page.keyboard.press('Escape')
        for width in [1366, 1024, 390, 320]:
            page.set_viewport_size({'width': width, 'height': 740})
            if width < 900: page.get_by_role('button', name='Bản đồ', exact=True).click()
            page.get_by_role('button', name='Lớp bản đồ', exact=True).click()
            expect(page.locator('.layers-panel')).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert page.locator('.layers-content').evaluate('(e) => e.scrollWidth <= e.clientWidth + 1')
            page.keyboard.press('Escape')
        assert not errors, errors
        browser.close()
    print('Layer sources passed: one source dialog, explicit unknown DEM provenance, active revision times, neutral road display, keyboard and responsive layers.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5213')
    parser.add_argument('--chrome')
    parser.add_argument('--captures', type=Path)
    args = parser.parse_args()
    if args.captures: args.captures.mkdir(parents=True, exist_ok=True)
    run(args.url.rstrip('/'), args.chrome, args.captures)
