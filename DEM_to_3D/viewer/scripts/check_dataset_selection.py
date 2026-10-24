"""Verify dataset selection and navigation against a distinct synthetic test fixture.

Reuses the local terrain only. It is a software regression, not a second validated site.
"""
from browser_preferences import use_vietnamese
import argparse
import hashlib
import json
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def run(url, chrome=None):
    folder = ROOT / 'public/scenarios/che-tao/v0.3'
    packet = json.loads((folder / 'incident.json').read_text(encoding='utf-8'))
    manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
    manifest.pop('fieldData', None)
    manifest.pop('referenceData', None)
    manifest.pop('terrainContext', None)
    manifest.pop('analysisImagery', None)
    manifest.pop('fieldPhotos', None)
    packet['incident']['id'] = 'INC-ALTERNATE'
    packet['incident']['title'] = ['Sự kiện kiểm thử', 'Test incident']
    packet['datasetVersion'] = 'alternate-v1'
    community = packet['communities'][0]
    community['name'] = 'Địa bàn kiểm thử'
    community['commune'] = 'Xã kiểm thử'
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
        context = use_vietnamese(browser.new_context(viewport={'width': 1366, 'height': 768}, accept_downloads=True))
        page = use_vietnamese(context.new_page()); errors = []; requests = []
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
        page.goto(url+'/?map=2d&demoRole=manager')
        expect(page.locator('#response-panel h1')).to_have_text('Sự kiện kiểm thử', timeout=25000)
        expect(page.locator('.incident-context-trigger')).to_have_attribute('title', 'Vùng kiểm thử')
        page.get_by_role('button', name='Sự kiện đang xem', exact=True).click()
        expect(page.locator('.header-context-popover')).to_contain_text('INC-ALTERNATE')
        page.keyboard.press('Escape')
        page.locator('.workspace-nav').get_by_role('button', name='Địa bàn', exact=True).click()
        expect(page.locator('#response-panel .community')).to_have_count(1)
        expect(page.locator('[data-map-object="community:KM"]')).to_have_count(0)
        page.locator('#response-panel .community').click()
        expect(page.locator('#response-details h1')).to_have_text('Địa bàn kiểm thử')
        expect(page.locator('.route-action')).to_contain_text('Không sử dụng tuyến này')
        # Close a road detail, then explicitly reopen the community tab without resetting it.
        page.locator('#response-details').get_by_role('button', name='Xem đoạn cần kiểm tra', exact=True).click()
        expect(page.locator('#response-details h1')).to_have_text('Địa bàn kiểm thử')
        expect(page.locator('.route-section-row[aria-expanded="true"]')).to_have_attribute('aria-controls', 'section-' + packet['report']['roadId'])
        page.locator('.route-section-tools button').first.click()
        page.locator('.evidence-road').click()
        expect(page.locator('#response-details h1')).to_have_text(next(road for road in packet['roads'] if road['id'] == packet['report']['roadId'])['name'][0])
        page.locator('#response-details').get_by_role('button',name='Đóng chi tiết đối tượng',exact=True).click()
        expect(page.locator('#response-details')).to_have_count(0)
        page.locator('.workspace-nav').get_by_role('button',name='Địa bàn',exact=True).click()
        expect(page.locator('#response-details h1')).to_have_text('Địa bàn kiểm thử')
        expect(page.locator('.route-section-row[aria-expanded="true"]')).to_have_attribute('aria-controls', 'section-' + packet['report']['roadId'])
        page.get_by_role('button', name='Xuất đánh giá', exact=True).click()
        page.locator('.export-formats summary').click()
        with page.expect_download() as download:
            page.get_by_role('button', name='Tải dữ liệu JSON', exact=True).click()
        exported = json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
        assert exported['datasetVersion'] == 'alternate-v1'
        assert exported['incidentId'] == 'INC-ALTERNATE'
        assert exported['community']['name'] == 'Địa bàn kiểm thử'
        assert exported['aoi']['name'] == packet['aoi']['name']
        assert exported['route']['status'] == 'blocked' and not exported['route'].get('eta')
        assert not any(request.endswith('/scenarios/che-tao/v0.3/manifest.json') for request in requests)
        assert not errors, errors
        context.close()
        # Resident views must not load or suggest the Chế Tạo local graph for a
        # different selected dataset, or keep a hardcoded commune in the header.
        context = use_vietnamese(browser.new_context(viewport={'width':390,'height':844}))
        context.route('**/*', respond)
        page = context.new_page()
        local_requests=[]
        page.on('request',lambda request:local_requests.append(request.url) if request.url.endswith('/local-network.json') else None)
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(url+'/?map=2d&offline=1')
        page.get_by_role('button',name='Vào ứng dụng',exact=True).click()
        expect(page.locator('.citizen-header')).to_contain_text('Xã kiểm thử')
        page.locator('.citizen-mobile-switch').get_by_role('button',name='Thông tin đường',exact=True).click()
        expect(page.locator('.citizen-village')).to_be_visible()
        expect(page.get_by_role('button',name='Trong xã',exact=True)).to_have_count(0)
        assert not local_requests,local_requests
        assert not errors,errors
        context.close()
        # A missing selected dataset must not display the prepared default.
        context = use_vietnamese(browser.new_context())
        context.route('**/workspace-config.json', lambda r: r.fulfill(json={'dataSource': 'prepared', 'manifestUrl': '/scenarios/missing/v1/manifest.json'}))
        context.route('**/scenarios/missing/v1/manifest.json', lambda r: r.fulfill(status=404, body='missing'))
        page = use_vietnamese(context.new_page()); page.goto(url+'/?map=2d&demoRole=manager')
        expect(page.get_by_role('alert').get_by_role('heading', level=1)).to_have_text('Chưa tải được dữ liệu', timeout=25000)
        expect(page.locator('.incident-context')).to_have_count(0)
        expect(page.locator('.incident-context-revision time')).to_have_count(0)
        expect(page.locator('.map-pin')).to_have_count(0)
        context.close()
        # A corporate download filter must identify the blocked file; Retry recovers
        # the same dataset after access is restored, rather than substituting data.
        context=browser.new_context()
        blocked=[True]
        def filter_grid(route):
            if blocked[0]:route.fulfill(status=403,body='VG-Blockdownload')
            else:route.continue_()
        context.route('**/terrain/*.grid.bin',filter_grid)
        page=context.new_page();page.goto(url+'/?map=2d&demoRole=manager&lang=en')
        alert=page.get_by_role('alert')
        expect(alert).to_contain_text('HTTP 403',timeout=25000)
        expect(alert).to_contain_text('.grid.bin')
        expect(page.locator('.map-pin')).to_have_count(0)
        blocked[0]=False
        alert.get_by_role('button',name='Retry',exact=True).click()
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=30000)
        context.close(); browser.close()
    print('Dataset selection passed: configured manifest, distinct AOI/road state, matching JSON export, no default fallback and contextual navigation.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5213')
    parser.add_argument('--chrome')
    args = parser.parse_args()
    run(args.url.rstrip('/'), args.chrome)
