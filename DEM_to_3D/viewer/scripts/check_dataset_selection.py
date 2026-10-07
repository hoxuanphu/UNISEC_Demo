"""Verify dataset selection and navigation against a distinct synthetic test fixture.

Reuses the local terrain only. It is a software regression, not a second validated site.
"""
import argparse
import hashlib
import json
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def run(url, chrome=None):
    folder = ROOT / 'public/scenarios/che-tao/v0.2'
    packet = json.loads((folder / 'incident.json').read_text(encoding='utf-8'))
    manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
    packet['incident']['id'] = 'INC-ALTERNATE'
    packet['incident']['title'] = ['Sự kiện kiểm thử', 'Test incident']
    packet['datasetVersion'] = 'alternate-v1'
    community = next(item for item in packet['communities'] if item['id'] == 'NK')
    community['name'] = 'Địa bàn kiểm thử'
    x, y = community['projected']['x'], community['projected']['y']
    packet['aoi']['name'] = ['Vùng kiểm thử', 'Test area']
    packet['aoi']['points'] = [{'x': px, 'y': py} for px, py in [
        (x-800, y-800), (x+800, y-800), (x+800, y+800), (x-800, y+800), (x-800, y-800)]]
    next(road for road in packet['roads'] if road['id'] == packet['report']['roadId'])['status'] = 'blocked'
    payload = json.dumps(packet, ensure_ascii=False).encode('utf-8')
    manifest.update(datasetVersion=packet['datasetVersion'], incidentId=packet['incident']['id'])
    manifest['workspace'] = {'url': '/scenarios/alternate/v1/incident.json', 'byteLength': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, **({'executable_path': chrome} if chrome else {}))
        context = browser.new_context(viewport={'width': 1366, 'height': 768}, accept_downloads=True)
        page = context.new_page(); errors = []; requests = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: requests.append(request.url))
        def respond(route):
            path = route.request.url.removeprefix(url)
            if path == '/workspace-config.json':
                route.fulfill(json={'dataSource': 'prepared', 'manifestUrl': '/scenarios/alternate/v1/manifest.json'})
            elif path == '/scenarios/alternate/v1/manifest.json':
                route.fulfill(json=manifest)
            elif path == manifest['workspace']['url']:
                route.fulfill(content_type='application/json', body=payload)
            elif route.request.url.startswith(url + '/'):
                route.continue_()
            else:
                route.abort()
        context.route('**/*', respond)
        page.goto(url)
        expect(page.locator('.sidebar h1')).to_have_text('Sự kiện kiểm thử', timeout=25000)
        expect(page.locator('.incident-meta')).to_contain_text('Vùng kiểm thử')
        expect(page.locator('.incident-priority-row')).to_have_count(1)
        expect(page.locator('[data-map-object="community:KM"]')).to_have_count(0)
        page.locator('.incident-priority-row').click()
        expect(page.locator('.sidebar h1')).to_have_text('Địa bàn kiểm thử')
        expect(page.locator('.decision-overview dd')).to_have_text('Các tuyến đã biết đều bị chặn')
        # Inspect a road and return to the original community without resetting it.
        page.locator('.sidebar').get_by_role('button', name='Xem đoạn cần kiểm tra', exact=True).click()
        expect(page.locator('.sidebar h1')).to_have_text('Đường vòng qua sườn núi, đoạn vượt khe')
        page.locator('.sidebar .panel-parent').click()
        expect(page.locator('.sidebar h1')).to_have_text('Địa bàn kiểm thử')
        page.get_by_role('button', name='Lưu đánh giá', exact=True).click()
        page.locator('.export-formats summary').click()
        with page.expect_download() as download:
            page.get_by_role('button', name='Tải dữ liệu JSON', exact=True).click()
        exported = json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
        assert exported['datasetVersion'] == 'alternate-v1'
        assert exported['incidentId'] == 'INC-ALTERNATE'
        assert exported['community']['name'] == 'Địa bàn kiểm thử'
        assert exported['aoi']['name'] == packet['aoi']['name']
        assert exported['route']['status'] == 'blocked' and not exported['route'].get('eta')
        assert not any(request.endswith('/scenarios/che-tao/v0.2/manifest.json') for request in requests)
        assert not errors, errors
        context.close()
        # A missing selected dataset must not display the prepared default.
        context = browser.new_context()
        context.route('**/workspace-config.json', lambda r: r.fulfill(json={'dataSource': 'prepared', 'manifestUrl': '/scenarios/missing/v1/manifest.json'}))
        context.route('**/scenarios/missing/v1/manifest.json', lambda r: r.fulfill(status=404, body='missing'))
        page = context.new_page(); page.goto(url)
        expect(page.locator('.sidebar h1')).to_have_text('Chưa tải được dữ liệu', timeout=25000)
        expect(page.locator('.incident-meta')).to_have_count(0)
        expect(page.locator('.header-data time')).to_have_count(0)
        expect(page.locator('.map-pin')).to_have_count(0)
        context.close(); browser.close()
    print('Dataset selection passed: configured manifest, distinct AOI/road state, matching JSON export, no default fallback and contextual navigation.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5213')
    parser.add_argument('--chrome')
    args = parser.parse_args()
    run(args.url.rstrip('/'), args.chrome)
