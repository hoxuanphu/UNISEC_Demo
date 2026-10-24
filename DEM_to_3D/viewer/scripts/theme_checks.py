"""Check readable workspace text and tool surfaces in both display themes."""
from gis_browser_actions import map_tool
from browser_preferences import use_vietnamese
from network_browser_fixture import install_network_fixture
from playwright.sync_api import expect


def check_themes(browser, url, captures=None):
    for theme in ['dark', 'light']:
        context = use_vietnamese(browser.new_context(viewport={'width': 1366, 'height': 768}))
        context.add_init_script(f"localStorage.setItem('dear.theme', '{theme}')")
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url + '/') else r.abort())
        install_network_fixture(context,url)
        page = context.new_page()
        try:
            page.goto(url+'/?map=2d&demoRole=manager')
            expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=25000)
            expect(page.locator('.assessment-moment[aria-pressed="true"]')).to_contain_text('14:02')
            metrics_reader = """() => {
              const colors = new Map(), pixel = document.createElement('canvas');
              pixel.width = pixel.height = 1;
              const paint = pixel.getContext('2d', {willReadFrequently:true});
              // Chromium may resolve color-mix to color(srgb ...) with 0..1
              // channels. Read the browser's actual sRGB colour rather than
              // interpreting every CSS colour as legacy 0..255 rgb().
              const rgba = color => {
                if (!colors.has(color)) {
                  paint.clearRect(0,0,1,1); paint.fillStyle=color; paint.fillRect(0,0,1,1);
                  const bytes=paint.getImageData(0,0,1,1).data;
                  colors.set(color,[bytes[0],bytes[1],bytes[2],bytes[3]/255]);
                }
                return colors.get(color);
              };
              const blend = (top, bottom) => top.slice(0, 3).map((c, i) => c * (top[3] ?? 1) + bottom[i] * (1 - (top[3] ?? 1)));
              const background = node => {
                if (!node) return [255, 255, 255];
                return blend(rgba(getComputedStyle(node).backgroundColor), background(node.parentElement));
              };
              const luminance = color => color.map(c => {
                c /= 255;
                return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
              }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
              const contrast = (node, pseudo = null) => {
                const bg = background(node), fg = blend(rgba(getComputedStyle(node, pseudo).color), bg);
                const a = luminance(fg), b = luminance(bg);
                return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
              };
              const selector = '#response-details h1, #response-details h3, #response-details dt, #response-details dd, #response-details p, #response-details .status-text, .sidebar h1, .sidebar h3, .sidebar dt, .sidebar dd, .sidebar p, .sidebar .status-text, .workspace-nav button, .incident-badge-group strong, .incident-meta, .header-revision, .map-toolbar input, .map-layer-trigger, .layers-heading, .layers-panel, .map-source-popover dt, .map-source-popover dd, .map-source-status, .evidence-road strong, .evidence-road span, .map-measure-heading strong, .choice-group-option span, .measure-tabs button, .map-measure-result dt, .map-measure-result dd, .map-measure-hint';
              const text = [...document.querySelectorAll(selector)].filter(node => node.getClientRects().length).map(node => ({text: node.textContent.trim().slice(0, 60), ratio: contrast(node)}));
              document.querySelectorAll('.map-search input, .sidebar input').forEach(node => {
                if (node.getClientRects().length && !node.value && node.placeholder) text.push({text: node.placeholder, ratio: contrast(node, '::placeholder')});
              });
              return {
                text,
                toolbar: luminance(background(document.querySelector('.map-toolbar'))),
                window: luminance(background(document.querySelector('.layers-panel, .map-source-popover, .map-measure-panel')))
              };
            }"""
            for popup in ['layers', 'sources', 'measurement']:
                if popup == 'layers':
                    page.locator('.map-layer-trigger').click()
                    expect(page.locator('.layers-panel')).to_be_visible()
                    expect(page.locator('.layers-panel')).to_have_css('opacity', '1')
                elif popup == 'sources':
                    page.get_by_role('button', name='Nguồn bản đồ', exact=True).click()
                    expect(page.locator('.map-source-popover')).to_be_visible()
                else:
                    map_tool(page, 'Đo trên bản đồ 2D').click()
                    expect(page.locator('.map-measure-panel')).to_have_css('opacity', '1')
                metrics = page.evaluate(metrics_reader)
                failures = [item for item in metrics['text'] if item['ratio'] < 4.5]
                assert not failures, (theme, popup, failures)
                for surface in ['toolbar', 'window']:
                    assert metrics[surface] < 0.1 if theme == 'dark' else metrics[surface] > 0.65, (theme, popup, surface, metrics[surface])
                if popup == 'layers':
                    if captures:
                        page.screenshot(path=str(captures / f'workspace-theme-{theme}.png'))
                    page.get_by_role('button',name='Đóng lớp bản đồ',exact=True).click()
                elif popup == 'sources':
                    page.get_by_role('button', name='Đóng nguồn bản đồ', exact=True).click()
                else:
                    page.get_by_role('button', name='Đóng công cụ đo', exact=True).click()
            page.locator('.workspace-nav').get_by_role('button',name='Địa bàn',exact=True).click()
            page.locator('#response-panel .community').filter(has=page.get_by_text('Nậm Khắt',exact=True)).click()
            page.locator('.decision-tabs button').nth(1).click()
            report = page.locator('.community-finding').filter(has_text='Đường chính vào Nậm Khắt')
            expect(report.locator('.finding-provenance time')).to_have_count(2)
            report.get_by_role('button', name='Xem báo cáo', exact=True).click()
            expect(page.locator('.modal-dialog')).to_have_css('opacity', '1')
            expect(page.locator('.evidence-metadata dt')).to_have_text(['Báo cáo', 'Ghi nhận', 'Tiếp nhận'])
            page.locator('.evidence-road').first.hover()
            expect(page.locator('.evidence-road').first).not_to_have_css('background-color', 'rgba(0, 0, 0, 0)')
            metrics = page.evaluate(metrics_reader)
            assert not [item for item in metrics['text'] if item['ratio'] < 4.5], (theme, 'report row hover', metrics['text'])
            if captures: page.screenshot(path=str(captures / f'workspace-report-hover-{theme}.png'), animations='disabled')
        finally:
            context.close()
