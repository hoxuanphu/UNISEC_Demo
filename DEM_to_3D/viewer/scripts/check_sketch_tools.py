"""Vertex editing in the measurement panel and shapes saved by the drawing tool."""
from browser_preferences import use_vietnamese
from gis_browser_actions import map_tool
import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect


def run(url, chrome, captures=None):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, **({'executable_path': chrome} if chrome else {}))
        page = use_vietnamese(browser.new_page(viewport={'width': 1440, 'height': 900}))
        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url + '/') else r.abort())
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url + '/?map=2d&offline=1&demoRole=manager')
        expect(page.locator('img[alt="Ảnh nền khu vực Chế Tạo"]')).to_be_visible(timeout=25000)
        box = page.locator('.map-2d-surface').bounding_box()
        at = lambda x, y: (box['x'] + box['width'] * x, box['y'] + box['height'] * y)

        # Measurement: the table lists every vertex while drawing; rows and map vertices select each other.
        map_tool(page, 'Đo trên bản đồ 2D').click()
        panel = page.locator('.map-measure-panel')
        for x, y in [(.45, .25), (.62, .32), (.7, .55)]: page.mouse.click(*at(x, y))
        page.mouse.move(*at(.78, .6))
        # Leaflet fades a replaced tooltip out for 200 ms; read the newest one.
        expect(page.locator('.map-sketch-cursor').last).to_contain_text('tổng')
        rows = panel.locator('.vertex-table tbody tr')
        expect(rows).to_have_count(3)
        expect(page.locator('.map-measure-midpoint')).to_have_count(2)
        expect(page.locator('.map-measure-vertex').nth(1)).to_contain_text('2')
        page.keyboard.press('Enter')
        # Finishing adds the result at once.
        expect(panel.locator('[aria-controls="measurement-saved-view"]')).to_contain_text('1')
        panel.get_by_role('button', name='Chọn điểm 2', exact=True).click()
        expect(page.locator('.map-measure-vertex.is-selected')).to_have_count(1)
        page.locator('.map-2d-surface').focus()
        page.keyboard.press('Delete')
        expect(rows).to_have_count(2)
        expect(panel.get_by_role('button', name='Áp dụng', exact=True)).to_be_visible()
        page.locator('.map-measure-midpoint').first.click()
        expect(rows).to_have_count(3)
        panel.get_by_role('button', name='Hủy', exact=True).click()
        expect(rows).to_have_count(3)
        expect(panel.get_by_role('button', name='Chỉnh sửa', exact=True)).to_be_visible()
        # Coordinates are typed in the row; an invalid pair is refused without changing the vertex.
        panel.get_by_role('button', name='Chỉnh sửa', exact=True).click()
        panel.get_by_role('button', name='Sửa tọa độ điểm 1:', exact=False).click()
        field = panel.get_by_role('textbox', name='Sửa tọa độ điểm 1', exact=True)
        field.fill('Hà Nội'); field.press('Enter')
        expect(panel.get_by_role('alert')).to_be_visible()
        field.fill('21.73, 104.03'); field.press('Enter')
        expect(panel.locator('.vertex-coordinate').first).to_have_text('21.73000, 104.03000')
        panel.get_by_role('button', name='Áp dụng', exact=True).click()
        panel.locator('[aria-controls="measurement-saved-view"]').click()
        expect(panel.locator('.measure-history-row')).to_have_count(1)
        if captures:
            captures.mkdir(parents=True, exist_ok=True); page.screenshot(path=str(captures / 'sketch-measure.png'))
        panel.get_by_role('button', name='Đóng công cụ đo', exact=True).click()

        # Drawing: circles and notes become GIS reference records that stay on the map.
        map_tool(page, 'Vẽ trên bản đồ 2D').click()
        draw = page.locator('.map-draw-panel')
        expect(page.locator('.map-measure-panel')).to_have_count(0)
        draw.get_by_role('radio', name='Hình tròn', exact=True).check()
        save = draw.get_by_role('button', name='Lưu vào GIS', exact=True)
        page.mouse.click(*at(.4, .6))
        expect(save).to_be_disabled()
        page.mouse.click(*at(.47, .6))
        expect(draw.locator('.map-draw-result')).to_contain_text('Diện tích hình tròn')
        draw.get_by_role('textbox', name='Tên', exact=True).fill('Vùng nghi ảnh hưởng')
        save.click()
        expect(page.locator('.notice-toast')).to_contain_text('Vùng nghi ảnh hưởng')
        expect(draw.locator('.vertex-table')).to_have_count(0)
        draw.get_by_role('radio', name='Ghi chú', exact=True).check()
        page.mouse.click(*at(.55, .7))
        expect(save).to_be_disabled()
        draw.get_by_role('textbox', name='Nội dung ghi chú', exact=True).fill('Cầu yếu, không cho xe tải')
        save.click()
        records = page.evaluate("JSON.parse(localStorage.getItem('dear.gis.v2') || '{}').records || []")
        circle = next(r for r in records if r['feature']['properties'].get('shape') == 'circle')
        assert circle['role'] == 'reference' and circle['source']['format'] == 'drawing', circle
        assert circle['feature']['geometry']['type'] == 'Polygon' and circle['feature']['properties']['radius_m'] > 0, circle
        ring = circle['feature']['geometry']['coordinates'][0]
        assert ring[0] == ring[-1], 'Circle ring must be closed'
        assert any(r['feature']['properties'].get('note') == 'Cầu yếu, không cho xe tải' for r in records), json.dumps(records)[:400]
        expect(page.locator('.map-note-label')).to_contain_text('Cầu yếu')
        if captures: page.screenshot(path=str(captures / 'sketch-draw.png'))
        page.keyboard.press('Escape')
        expect(draw).to_have_count(0)
        assert not errors, errors
        browser.close()
    print('Sketch tools passed: vertex table while drawing, row/map selection, delete and insert, coordinate entry, Apply/Cancel, circle and note saved as GIS records.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5174'); parser.add_argument('--chrome'); parser.add_argument('--captures', type=Path)
    args = parser.parse_args(); run(args.url.rstrip('/'), args.chrome, args.captures)
