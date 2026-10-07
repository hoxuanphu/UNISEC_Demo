"""Extract, verify and exercise the distributed build with remote requests blocked."""
import argparse
import hashlib
import json
import tempfile
import threading
import zipfile
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
from serve_workspace import create_server


def run(archive, chrome):
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary).resolve()
        with zipfile.ZipFile(archive) as package:
            for name in package.namelist():
                if not (root / name).resolve().is_relative_to(root):
                    raise ValueError('Archive member outside package')
            release = json.loads(package.read('release.json'))
            for name, digest in release['files'].items():
                assert hashlib.sha256(package.read(name)).hexdigest() == digest, name
            package.extractall(root)
        server = create_server(root / 'dist', port=0, offline=True)
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True, executable_path=chrome)
                context = browser.new_context(viewport={'width': 1366, 'height': 768})
                base = f'http://127.0.0.1:{server.server_port}'
                requests, errors = [], []
                context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
                page = context.new_page()
                page.on('request', lambda request: requests.append(request.url))
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(base)
                expect(page.locator('.leaflet-image-layer')).to_have_count(1, timeout=25000)
                page.locator('.incident-priority-row').first.click()
                expect(page.locator('.sidebar h1')).to_have_text('Nậm Khắt')
                page.get_by_role('button', name='Thông báo sự kiện', exact=True).click()
                page.get_by_role('button', name='Xem chi tiết', exact=True).click()
                page.get_by_role('button', name='Cập nhật bản đồ', exact=True).click()
                expect(page.locator('.decision-overview')).to_contain_text('Các tuyến đã biết đều bị chặn')
                page.get_by_role('button', name='Lưu đánh giá', exact=True).click()
                expect(page.locator('.decision-export-preview')).to_be_visible(timeout=25000)
                with page.expect_download() as download:
                    page.get_by_role('button', name='Tải bản đồ PNG', exact=True).click()
                assert Path(download.value.path()).read_bytes().startswith(b'\x89PNG')
                page.keyboard.press('Escape')
                page.get_by_role('button', name='Chuyển sang 3D', exact=True).click()
                expect(page.locator('canvas.terrain-canvas')).to_be_visible(timeout=25000)
                page.get_by_role('button', name='Chuyển sang 2D', exact=True).click()
                expect(page.locator('.leaflet-image-layer')).to_have_count(1, timeout=25000)
                page.get_by_role('button', name='Cài đặt hiển thị', exact=True).click()
                page.get_by_role('button', name='Đặt lại phiên làm việc', exact=True).click()
                expect(page.locator('.header-data')).to_contain_text('09:31')
                assert not errors, errors
                external = [request for request in requests if request.startswith(('http:', 'https:')) and not request.startswith(base)]
                assert not external, external
                browser.close()
        finally:
            server.shutdown(); server.server_close(); thread.join()
    print('Offline package passed: checksums, clean extraction, no remote requests, response flow, PNG, 3D/2D and reset.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    windows_chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    parser.add_argument('--chrome', default=windows_chrome if Path(windows_chrome).is_file() else None)
    args = parser.parse_args()
    run(args.archive, args.chrome)
