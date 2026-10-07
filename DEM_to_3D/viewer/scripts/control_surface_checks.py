"""Check English controls in both themes and all fonts, including narrow panels."""
from playwright.sync_api import expect
from itertools import product


def check_control_surfaces(browser, url, captures=None):
    for theme, font in product(['light', 'dark'], ['classic', 'plex', 'modern']):
        context = browser.new_context(viewport={'width': 1366, 'height': 768})
        context.add_init_script(f"localStorage.setItem('dear.theme', '{theme}')")
        context.add_init_script(f"localStorage.setItem('dear.font-choice', '{font}')")
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url + '/') else r.abort())
        page = context.new_page()
        try:
            page.goto(url)
            expect(page.locator('.incident-priority-row').first).to_be_visible(timeout=25000)
            page.evaluate('document.fonts.ready')
            page.get_by_role('button', name='Cài đặt hiển thị', exact=True).click()
            page.get_by_role('button', name='English', exact=True).click()
            page.keyboard.press('Escape')
            page.locator('.panel-resize-handle').focus()
            page.keyboard.press('Home')
            page.wait_for_function("document.querySelector('.sidebar').clientWidth <= 320")
            for width in [1366, 1024, 390, 320]:
                page.set_viewport_size({'width': width, 'height': 768})
                page.locator('.workspace-nav button').last.click()
                problems = page.locator('.workspace-nav').evaluate("""nav => {
                    const errors = [], box = nav.getBoundingClientRect();
                    if (nav.scrollWidth > nav.clientWidth + 1) errors.push('navigation overflow');
                    nav.querySelectorAll('button').forEach(button => {
                        const r = button.getBoundingClientRect(), label = button.querySelector('span').getBoundingClientRect();
                        const icon = button.querySelector('svg').getBoundingClientRect();
                        if (r.left < box.left || r.right > box.right) errors.push('tab outside navigation');
                        if (icon.left - r.left < 7 || r.right - label.right < 7) errors.push('tab content touches border: ' + button.textContent);
                        if (label.left - icon.right < 5) errors.push('tab icon touches label');
                    });
                    return errors;
                }""")
                assert not problems, (theme, font, width, problems)
            page.set_viewport_size({'width': 1366, 'height': 768})
            page.get_by_role('button', name='Measure on 2D map', exact=True).click()
            expect(page.locator('.map-measure-panel')).to_have_css('opacity', '1')
            page.mouse.move(0, 0)
            heading = page.locator('.map-measure-heading')
            assert heading.evaluate("""node => {
                const box = node.getBoundingClientRect(), title = node.querySelector('strong').getBoundingClientRect();
                const controls = [...node.querySelectorAll('button')].map(button => button.getBoundingClientRect());
                return title.left - box.left >= 11 && controls[0].left - title.right >= 3 &&
                    box.right - controls.at(-1).right >= 7 &&
                    controls.every((r, i) => !i || r.left - controls[i-1].right >= 3);
            }"""), 'Tool title and controls have insufficient spacing'
            buttons = heading.locator('button')
            for button in buttons.all():
                assert button.evaluate("node => getComputedStyle(node).backgroundColor === 'rgba(0, 0, 0, 0)'"), 'Idle tool button has a separate surface'
            settings = heading.get_by_role('button', name='Measurement settings', exact=True)
            settings.click()
            expect(settings).to_have_attribute('aria-expanded', 'true')
            expect(settings).not_to_have_css('background-color', 'rgba(0, 0, 0, 0)')
            settings.click()
            page.mouse.move(0, 0)
            if captures: page.screenshot(path=str(captures / f'workspace-measure-controls-{theme}-{font}.png'), animations='disabled')
            heading.get_by_role('button', name='Close measurement', exact=True).click()
            for name, selector in [('Layers', '.layers-heading'), ('Location information', '.map-location-heading')]:
                page.get_by_role('button', name=name, exact=True).click()
                panel_heading = page.locator(selector)
                expect(panel_heading).to_be_visible()
                page.mouse.move(0, 0)
                assert panel_heading.locator('button').last.evaluate("node => getComputedStyle(node).backgroundColor === 'rgba(0, 0, 0, 0)'")
                panel_heading.locator('button').last.click()
        finally:
            context.close()
