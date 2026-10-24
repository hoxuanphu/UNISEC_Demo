"""Exercise a fixed production build for a recorded duration and write timing/memory results."""
from browser_preferences import use_vietnamese
from network_browser_fixture import install_network_fixture
import argparse
import hashlib
import json
import platform
import time
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


def run(url, chrome, duration, output, interval=30, heap_snapshot=None):
    started = time.monotonic()
    report = {'durationRequestedSeconds': duration, 'cycleIntervalSeconds': interval, 'os': platform.platform(), 'viewport': [1366, 768],
              'network': 'local static delivery, external requests blocked', 'samples': [], 'errors': [], 'timings': {}}
    index = Path(__file__).resolve().parents[1] / 'dist/index.html'
    report['buildIndexSha256'] = hashlib.sha256(index.read_bytes()).hexdigest() if index.exists() else None
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, **({'executable_path': chrome} if chrome else {}))
        report['browser'] = browser.version
        context = use_vietnamese(browser.new_context(viewport={'width': 1366, 'height': 768}))
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url + '/') else r.abort())
        install_network_fixture(context,url)
        page = use_vietnamese(context.new_page())
        page.on('pageerror', lambda error: report['errors'].append(str(error)))
        page.on('crash', lambda: report['errors'].append('Page crashed'))
        try:
            t = time.monotonic(); page.goto(url+'/?map=2d&demoRole=manager')
            expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=25000)
            expect(page.locator('.leaflet-image-layer')).to_have_count(1, timeout=25000)
            page.wait_for_function("document.querySelector('.leaflet-image-layer')?.complete")
            report['timings']['cold2DSeconds'] = round(time.monotonic() - t, 3)
            page.locator('.workspace-nav button').nth(2).click()
            page.locator('#response-panel .community').first.click()
            t = time.monotonic(); page.get_by_role('button', name='Chuyển sang 3D', exact=True).click()
            expect(page.locator('canvas.terrain-canvas')).to_be_visible(timeout=25000)
            expect(page.locator('[data-map-object="community:NK"]')).to_be_visible(timeout=25000)
            report['timings']['first3DSeconds'] = round(time.monotonic() - t, 3)
            page.get_by_role('button', name='Chuyển sang 2D', exact=True).click()
            cdp = context.new_cdp_session(page); cdp.send('Performance.enable')

            def sample(cycle):
                cdp.send('HeapProfiler.collectGarbage')
                metrics = {m['name']: m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
                report['samples'].append({'cycle': cycle, 'elapsedSeconds': round(time.monotonic() - started, 1),
                                          'jsHeapMB': round(metrics['JSHeapUsedSize'] / 1024 ** 2, 2),
                                          **cdp.send('Memory.getDOMCounters')})

            def reset():
                page.get_by_role('button', name='Cài đặt', exact=True).click()
                page.get_by_role('button', name='Đặt lại phiên làm việc', exact=True).click()
                expect(page.locator('.incident-overview-heading')).to_be_visible()

            reset(); sample(0)
            deadline = time.monotonic() + duration
            cycle = 0
            while time.monotonic() < deadline or cycle == 0:
                cycle += 1
                page.locator('.workspace-nav button').nth(2).click()
                page.locator('#response-panel .community').first.click()
                page.get_by_role('button', name='Mặt cắt địa hình', exact=True).click()
                expect(page.locator('.profile-svg')).to_be_visible()
                slider = page.locator('#profile-dist-slider'); slider.focus(); slider.press('End')
                page.get_by_role('button', name='Đóng mặt cắt', exact=True).click()
                page.get_by_role('button', name='Chuyển sang 3D', exact=True).click()
                expect(page.locator('canvas.terrain-canvas')).to_be_visible(timeout=25000)
                page.get_by_role('button', name='Phóng to', exact=True).click()
                page.get_by_role('button', name='Thu nhỏ', exact=True).click()
                page.get_by_role('button', name='Chuyển sang 2D', exact=True).click()
                page.get_by_role('button', name='Thông báo sự kiện', exact=True).click()
                page.get_by_role('button', name='Xem chi tiết', exact=True).click()
                page.get_by_role('button', name='Cập nhật bản đồ', exact=True).click()
                page.locator('.decision-tabs button').first.click()
                expect(page.locator('.route-action')).to_contain_text('Không sử dụng tuyến này')
                if cycle % 3 == 1:
                    t = time.monotonic(); page.get_by_role('button', name='Xuất đánh giá', exact=True).click()
                    expect(page.locator('.decision-export-preview')).to_be_visible(timeout=25000)
                    with page.expect_download() as download:
                        page.get_by_role('button', name='Tải bản đồ PNG', exact=True).click()
                    assert Path(download.value.path()).read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
                    report['timings'].setdefault('exportSeconds', []).append(round(time.monotonic() - t, 3))
                    page.keyboard.press('Escape')
                reset()
                # Match the same UI state before collecting retained objects.
                page.wait_for_timeout(100)
                sample(cycle)
                assert not report['errors'], report['errors']
                print(f"Session cycle {cycle}: {report['samples'][-1]}", flush=True)
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
                remaining = deadline - time.monotonic()
                if remaining > 0: page.wait_for_timeout(min(remaining, interval) * 1000)
            assert not report['errors'], report['errors']
            first, last = report['samples'][0], report['samples'][-1]
            report['retainedGrowth'] = {'jsHeapMB': round(last['jsHeapMB'] - first['jsHeapMB'], 2), 'nodes': last['nodes'] - first['nodes']}
            # Catch substantial retained growth; this does not measure GPU memory.
            assert report['retainedGrowth']['jsHeapMB'] < 30, report['retainedGrowth']
            assert report['retainedGrowth']['nodes'] < 1000, report['retainedGrowth']
            if cycle > 10:
                warm = report['samples'][10]
                report['growthAfterWarmup'] = {
                    'jsHeapMB': round(last['jsHeapMB'] - warm['jsHeapMB'], 2),
                    'nodes': last['nodes'] - warm['nodes'],
                    'jsEventListeners': last['jsEventListeners'] - warm['jsEventListeners']}
                assert report['growthAfterWarmup']['nodes'] <= 30, report['growthAfterWarmup']
                assert report['growthAfterWarmup']['jsEventListeners'] <= 5, report['growthAfterWarmup']
                assert report['growthAfterWarmup']['jsHeapMB'] < 10, report['growthAfterWarmup']
            if heap_snapshot:
                chunks = []
                cdp.on('HeapProfiler.addHeapSnapshotChunk', lambda event: chunks.append(event['chunk']))
                cdp.send('HeapProfiler.takeHeapSnapshot', {'reportProgress': False})
                heap_snapshot.parent.mkdir(parents=True, exist_ok=True)
                heap_snapshot.write_text(''.join(chunks), encoding='utf-8')
            report['passed'] = True
        except Exception as error:
            report['passed'] = False; report['failure'] = str(error)
            raise
        finally:
            report['elapsedSeconds'] = round(time.monotonic() - started, 1)
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
            browser.close()
    print(f'Session passed: {cycle} cycles, {report["elapsedSeconds"]} seconds. Report: {output}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5213')
    parser.add_argument('--chrome')
    parser.add_argument('--duration-seconds', type=int, default=1800)
    parser.add_argument('--cycle-interval-seconds', type=float, default=30)
    parser.add_argument('--output', type=Path, default=Path('dist-release/session-review.json'))
    parser.add_argument('--heap-snapshot', type=Path)
    args = parser.parse_args()
    if args.duration_seconds < 0: parser.error('duration must be non-negative')
    if args.cycle_interval_seconds < 0: parser.error('cycle interval must be non-negative')
    run(args.url.rstrip('/'), args.chrome, args.duration_seconds, args.output, args.cycle_interval_seconds, args.heap_snapshot)
