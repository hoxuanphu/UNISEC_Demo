"""Published extents survive road revisions; response defaults and layer controls stay usable."""
from browser_preferences import use_vietnamese
from gis_browser_actions import map_tool
import argparse
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


def run(url, chrome, captures):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=chrome)
        page = use_vietnamese(browser.new_page(viewport={'width': 1440, 'height': 960}, reduced_motion='reduce'))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url + '/') else r.abort())
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        # Boundary persistence and Leaflet layer assertions start in an explicit 2D fixture.
        page.goto(url + '/?map=2d&offline=1&demoRole=manager')
        expect(page.get_by_role('button', name='Chuyển sang 2D', exact=True)).to_have_attribute('aria-pressed', 'true')
        expect(page.locator('.landslide-area')).to_have_count(47, timeout=30000)
        # Same source checksum, older network version, and an operator's edit:
        # reinstallation must not be required, nor overwrite the saved boundary.
        saved = page.evaluate("""() => {
          const d=JSON.parse(localStorage.getItem('dear.gis.v2'));
          for (const r of d.records) if(r.feature.properties.dearLandslideArea)
            r.feature.properties.dearLandslideArea.networkVersion='previous-road-revision';
          const r=d.records.find(r=>r.feature.properties.dearLandslideArea);
          r.name='Vết sạt đã rà soát bên sườn đường vào khu dân cư';
          localStorage.setItem('dear.gis.v2',JSON.stringify(d));
          return JSON.stringify(d);
        }""")
        page.reload()
        expect(page.locator('.landslide-area')).to_have_count(47, timeout=30000)
        expect(page.locator('.map-2d .leaflet-image-layer').first).to_be_visible(timeout=30000)
        assert page.evaluate("localStorage.getItem('dear.gis.v2')") == saved
        page.get_by_role('button',name='Chú giải',exact=True).click()
        expect(page.locator('.map-legend')).to_contain_text('Vết sạt lở chưa rà soát')
        if captures:
            captures.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(captures / 'response-default.png'))
        page.get_by_role('button', name='Lớp bản đồ', exact=True).click()
        panel = page.get_by_role('dialog', name='Lớp bản đồ', exact=True)
        expect(panel.locator('.layer-count')).to_have_text('47')
        expect(panel.get_by_label('Sạt lở', exact=True)).to_be_checked()
        expect(panel.locator('.layer-analysis')).to_have_attribute('open', '')
        panel.locator('.layer-context > summary').click()
        expect(panel.get_by_label('Vùng đánh giá', exact=True)).not_to_be_checked()
        expect(panel.get_by_label('Bãi đáp đề xuất', exact=True)).to_have_count(0)
        panel.locator('.layer-context > summary').click()
        if captures:
            page.screenshot(path=str(captures / 'layers-default.png'))
        panel.get_by_label('Sạt lở', exact=True).uncheck()
        expect(page.locator('.landslide-area')).to_have_count(0)
        panel.get_by_role('button', name='Xem các vùng sạt lở', exact=True).click()
        expect(panel).to_have_count(0)
        expect(page.locator('.landslide-area')).to_have_count(47)
        page.wait_for_timeout(600)
        if captures:
            page.screenshot(path=str(captures / 'survey-extents.png'))
        for width in [1440, 768, 390, 320]:
            page.set_viewport_size({'width': width, 'height': 960})
            page.get_by_role('button', name='Lớp bản đồ', exact=True).click()
            expect(panel).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), width
            assert panel.evaluate('n=>n.scrollWidth<=n.clientWidth'), width
            assert panel.locator('.layers-content').evaluate('n=>n.scrollWidth<=n.clientWidth'), width
            panel.locator('.layer-appearance > summary').click()
            expect(panel.get_by_label('Nhãn địa danh', exact=True)).to_be_visible()
            panel.get_by_role('button', name='Khôi phục mặc định', exact=True).click()
            expect(panel.get_by_label('Sạt lở', exact=True)).to_be_checked()
            if captures:
                page.screenshot(path=str(captures / f'layers-{width}.png'))
            page.keyboard.press('Escape')
            expect(panel).to_have_count(0)
        assert page.evaluate("localStorage.getItem('dear.gis.v2')") == saved
        page.set_viewport_size({'width': 1440, 'height': 960})
        page.get_by_role('button', name='Cài đặt', exact=True).click()
        page.get_by_role('button', name='Tối', exact=True).click()
        page.keyboard.press('Escape')
        page.get_by_role('button', name='Lớp bản đồ', exact=True).click()
        if captures:
            page.screenshot(path=str(captures / 'layers-dark.png'))
        page.keyboard.press('Escape')
        map_tool(page, 'Dữ liệu GIS').click()
        workspace = page.locator('.geodata-workspace')
        workspace.locator('.geodata-task-nav').get_by_role('button', name='Vùng sạt lở', exact=True).click()
        workspace.locator('.landslide-area-list li button').first.click()
        expect(workspace.locator('.landslide-area')).to_have_count(47)
        workspace.get_by_role('button', name='Xem trên bản đồ ứng phó', exact=True).click()
        card = page.locator('.field-map-card')
        expect(card).to_contain_text('Vết sạt đã rà soát bên sườn đường vào khu dân cư')
        page.wait_for_timeout(600)
        if captures:
            page.screenshot(path=str(captures / 'selected-extent-dark.png'))
        card.get_by_role('button', name='Đóng điểm GIS', exact=True).click()
        page.get_by_role('button', name='Chuyển sang 3D', exact=True).click()
        expect(page.locator('canvas.terrain-canvas')).to_be_visible(timeout=30000)
        page.wait_for_timeout(1500)
        if captures:
            page.screenshot(path=str(captures / 'extents-3d.png'))
        page.get_by_role('button', name='Lớp bản đồ', exact=True).click()
        expect(panel.locator('.layer-count')).to_have_text('47')
        panel.get_by_role('button', name='Xem các vùng sạt lở', exact=True).click()
        expect(page.locator('.landslide-area')).to_have_count(47, timeout=10000)
        assert not errors, errors
        browser.close()
    print('Landslide visibility passed: retained boundaries after road revision, 47 extents, layer controls, 2D/3D and 320–1440 px.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5220')
    parser.add_argument('--chrome')
    parser.add_argument('--captures', type=Path)
    args = parser.parse_args()
    run(args.url.rstrip('/'), args.chrome, args.captures)
