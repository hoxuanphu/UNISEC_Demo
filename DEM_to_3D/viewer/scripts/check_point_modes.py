"""Check grouped/original-point display, direct photo montage and cross-map preference."""
from browser_preferences import use_vietnamese
from gis_browser_actions import map_tool
from gis_browser_actions import gis_task
import argparse
import base64
import hashlib
import tempfile
import uuid
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from field_photo_fixture import create_field_photo

# Local Windows convenience only; CI (Linux) uses the Playwright-managed Chromium.


def run(url, chrome, captures):
    with tempfile.TemporaryDirectory() as temp, sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=chrome)
        photo_file = create_field_photo(browser, temp)
        raw = photo_file.read_bytes()
        preview = 'data:image/jpeg;base64,' + base64.b64encode(raw).decode()
        records = []
        # This group has a ground spread greater than the same-site threshold;
        # clicking must open the montage directly rather than automatically zooming.
        for index, offset in enumerate([0, 0.00016, -0.00016]):
            photo = {'id': str(uuid.uuid4()), 'name': f'field-{index}.jpg', 'mime': 'image/jpeg',
                     'bytes': len(raw), 'width': 640, 'height': 420, 'preview': preview,
                     'sha256': hashlib.sha256(raw).hexdigest(), 'addedAt': '2026-10-12T00:00:00Z', 'exif': {}}
            observation = {'schema': 'field-observation/v1', 'kind': 'other', 'note': '',
                           'observedAt': '', 'observer': '', 'accuracyM': None, 'status': 'unreviewed',
                           'updatedAt': '2026-10-12T00:00:00Z', 'photos': [photo]}
            records.append({'id': str(uuid.uuid4()), 'name': f'Điểm thực địa {index + 1}',
                            'role': 'reference', 'visible': True,
                            'source': {'name': 'field.geojson', 'format': 'GeoJSON', 'importedAt': '2026-10-12T00:00:00Z'},
                            'feature': {'type': 'Feature', 'properties': {'dearObservation': observation},
                                        'geometry': {'type': 'Point', 'coordinates': [104.05, 21.78 + offset]}}})
        context = use_vietnamese(browser.new_context(viewport={'width': 1440, 'height': 960}))
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(url + '/') else route.abort())
        page = use_vietnamese(context.new_page())
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url + '/?map=2d&offline=1&demoRole=manager')
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=25000)
        page.evaluate('''records=>{
            const data=JSON.parse(localStorage.getItem('dear.gis.v2'));
            data.records=records;
            localStorage.setItem('dear.gis.v2',JSON.stringify(data));
        }''', records)
        page.reload()
        map_tool(page, 'Dữ liệu GIS').click()
        gis_task(page)
        mode = page.get_by_role('combobox', name='Hiển thị điểm', exact=True)
        expect(mode).to_have_value('group')
        symbol = page.locator('.geodata-map .map-point-cluster')
        expect(symbol).to_have_count(1)
        scale = page.locator('.geodata-map .leaflet-control-scale-line').first.inner_text()
        symbol.focus()
        symbol.press('Enter')
        card = page.locator('.geodata-map .point-group-card')
        expect(card).to_be_visible()
        expect(card.locator('.point-group-hero button')).to_have_count(3)
        expect(card.locator('.point-group-row')).to_have_count(3)
        assert page.locator('.geodata-map .leaflet-control-scale-line').first.inner_text() == scale
        mode.select_option('individual')
        expect(symbol).to_have_count(0)
        expect(card).to_have_count(0)
        expect(page.locator('.geodata-map .field-map-marker')).to_have_count(3)
        originals = page.evaluate('JSON.parse(localStorage.getItem("dear.gis.v2")).records.map(r=>r.feature.geometry.coordinates)')
        assert originals == [record['feature']['geometry']['coordinates'] for record in records]
        if captures:
            captures.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(captures / 'individual-points.png'))
        page.get_by_role('button', name='Đóng dữ liệu GIS', exact=True).click()
        expect(page.locator('.map-2d .map-point-cluster')).to_have_count(0)
        expect(page.locator('.map-2d .field-map-marker')).to_have_count(3)
        map_tool(page, 'Dữ liệu GIS').click()
        gis_task(page)
        expect(mode).to_have_value('individual')
        mode.select_option('group')
        page.get_by_role('button', name='Đóng dữ liệu GIS', exact=True).click()
        expect(page.locator('.map-2d .map-point-cluster')).to_have_count(1)
        map_tool(page, 'Dữ liệu GIS').click()
        gis_task(page)
        expect(mode).to_have_value('group')
        symbol.focus()
        symbol.press('Space')
        expect(card).to_be_visible()
        expect(card.locator('.point-group-hero button')).to_have_count(3)
        if captures:
            page.screenshot(path=str(captures / 'grouped-points.png'))
        mode.select_option('individual')
        page.reload()
        map_tool(page, 'Dữ liệu GIS').click()
        gis_task(page)
        expect(mode).to_have_value('individual')
        expect(page.locator('.geodata-map .map-point-cluster')).to_have_count(0)
        assert not errors, errors
        browser.close()
    print('Point modes passed: explicit group/individual control, direct montage without zoom, keyboard, original coordinates, shared preference and reload.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:5174')
    parser.add_argument('--chrome', default=None)
    parser.add_argument('--captures', type=Path)
    args = parser.parse_args()
    run(args.url.rstrip('/'), args.chrome, args.captures)
