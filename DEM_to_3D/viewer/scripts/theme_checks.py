"""Check readable workspace text and tool surfaces in both display themes."""
from playwright.sync_api import expect


def check_themes(browser, url, captures=None):
    for theme in ['dark', 'light']:
        context = browser.new_context(viewport={'width': 1366, 'height': 768})
        context.add_init_script(f"localStorage.setItem('dear.theme', '{theme}')")
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url + '/') else r.abort())
        page = context.new_page()
        try:
            page.goto(url)
            expect(page.locator('.incident-priority-row').first).to_be_visible(timeout=25000)
            expect(page.locator('.incident-timing dt')).to_have_text(['Cảnh báo', 'Tổng hợp'])
            metrics_reader = """() => {
              const rgba = color => color.match(/[\\d.]+/g).map(Number);
              const blend = (top, bottom) => top.slice(0, 3).map((c, i) => c * (top[3] ?? 1) + bottom[i] * (1 - (top[3] ?? 1)));
              const background = node => {
                if (!node) return [255, 255, 255];
                return blend(rgba(getComputedStyle(node).backgroundColor), background(node.parentElement));
              };
              const luminance = color => color.map(c => {
                c /= 255;
                return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
              }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
              const contrast = node => {
                const bg = background(node), fg = blend(rgba(getComputedStyle(node).color), bg);
                const a = luminance(fg), b = luminance(bg);
                return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
              };
              const selector = '.sidebar h1, .sidebar h3, .sidebar dt, .sidebar dd, .sidebar p, .sidebar .status-text, .map-toolbar input, .map-layer-trigger, .layers-heading, .layers-panel, .map-source-popover dt, .map-source-popover dd, .map-source-status';
              return {
                text: [...document.querySelectorAll(selector)].filter(node => node.getClientRects().length).map(node => ({text: node.textContent.trim().slice(0, 60), ratio: contrast(node)})),
                toolbar: luminance(background(document.querySelector('.map-toolbar'))),
                window: luminance(background(document.querySelector('.layers-panel, .map-source-popover')))
              };
            }"""
            for popup in ['layers', 'sources']:
                if popup == 'layers':
                    page.locator('.map-layer-trigger').click()
                    expect(page.locator('.layers-panel')).to_be_visible()
                    expect(page.locator('.layers-panel')).to_have_css('opacity', '1')
                else:
                    page.get_by_role('button', name='Nguồn bản đồ', exact=True).click()
                    expect(page.locator('.map-source-popover')).to_be_visible()
                metrics = page.evaluate(metrics_reader)
                failures = [item for item in metrics['text'] if item['ratio'] < 4.5]
                assert not failures, (theme, popup, failures)
                for surface in ['toolbar', 'window']:
                    assert metrics[surface] < 0.1 if theme == 'dark' else metrics[surface] > 0.65, (theme, popup, surface, metrics[surface])
                if popup == 'layers':
                    if captures:
                        page.screenshot(path=str(captures / f'workspace-theme-{theme}.png'))
                    page.locator('.layers-heading .icon-button').click()
                else:
                    page.get_by_role('button', name='Đóng nguồn bản đồ', exact=True).click()
            page.locator('.incident-priority-row').first.click()
            page.locator('.decision-tabs button').nth(1).click()
            report = page.locator('.community-finding').filter(has_text='Đường chính vào Nậm Khắt')
            expect(report.locator('.finding-source dt')).to_have_text(['Ghi nhận', 'Tiếp nhận'])
            expect(report.locator('.finding-source time')).to_have_count(2)
            report.get_by_role('button', name='Xem báo cáo', exact=True).click()
            expect(page.locator('.evidence-metadata dt')).to_have_text(['Báo cáo', 'Ghi nhận', 'Tiếp nhận'])
        finally:
            context.close()
