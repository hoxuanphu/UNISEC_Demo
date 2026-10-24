"""Check default theme, compact preferences and contextual session actions."""
from browser_preferences import use_vietnamese
import argparse
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


def run(url, chrome, captures):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=chrome)
        for saved, system, expected in [(None, 'dark', 'light'), ('dark', 'light', 'dark'), ('light', 'dark', 'light'), ('auto', 'dark', 'light')]:
            context = use_vietnamese(browser.new_context(viewport={'width': 1366, 'height': 850}, color_scheme=system))
            if saved is not None:
                context.add_init_script(f"localStorage.setItem('dear.theme', '{saved}')")
            context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url + '/') else r.abort())
            page = use_vietnamese(context.new_page())
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(url + '/?map=2d&offline=1&demoRole=manager')
            expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=25000)
            initial_assessment = page.locator('.assessment-moment[aria-pressed="true"] time').get_attribute('datetime')
            expect(page.locator('html')).to_have_attribute('data-theme', expected)
            assert page.evaluate("localStorage.getItem('dear.theme')") == expected
            if saved is not None:
                context.close()
                assert not errors, errors
                continue

            trigger = page.get_by_role('button', name='Cài đặt', exact=True)
            trigger.click()
            expect(page.get_by_role('dialog', name='Cài đặt', exact=True)).to_be_visible()
            settings = page.locator('.settings-menu')
            expect(settings).to_be_visible()
            expect(settings.get_by_role('button', name='Sáng', exact=True)).to_have_attribute('aria-pressed', 'true')
            expect(settings.get_by_role('combobox', name='Kiểu chữ', exact=True)).to_have_value('source')
            expect(settings.locator('.font-sample')).to_have_count(0)
            # Role switch and session tools are visible without expanding anything.
            expect(page.locator('.app-header').get_by_role('button', name='Tài khoản', exact=True)).to_be_visible()
            expect(settings.get_by_role('button', name='Mô hình địa hình', exact=True)).to_be_visible()
            expect(settings.get_by_role('button', name='Đặt lại phiên làm việc', exact=True)).to_be_visible()
            assert settings.bounding_box()['height'] < 480, settings.bounding_box()
            for width in [1366, 390, 320]:
                page.set_viewport_size({'width': width, 'height': 850})
                bounds = settings.bounding_box()
                assert bounds['x'] >= 0 and bounds['x'] + bounds['width'] <= width + 1, bounds
                assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
                if captures:
                    page.screenshot(path=str(captures / f'display-settings-light-{width}.png'), animations='disabled')
            page.set_viewport_size({'width': 1366, 'height': 850})
            settings.get_by_role('button', name='Tối', exact=True).click()
            settings.get_by_role('button', name='English', exact=True).click()
            font = settings.get_by_role('combobox', name='Typography', exact=True)
            for choice in ['modern', 'plex', 'classic', 'source']:
                font.select_option(choice)
                expect(page.locator('html')).to_have_attribute('data-font', choice)
            expect(page.locator('html')).to_have_attribute('data-font', 'source')
            page.evaluate('document.fonts.ready')
            assert page.locator('.sidebar').evaluate("node => getComputedStyle(node).fontFamily.startsWith('\"Source Sans 3\"')")
            assert page.evaluate("document.fonts.check('400 14px \"Source Sans 3\"', 'Ghi nhận hiện trường')")
            expect(settings.get_by_role('button', name='Terrain model', exact=True)).to_be_visible()
            expect(settings.get_by_role('button', name='Reset workspace', exact=True)).to_be_visible()
            if captures:
                page.screenshot(path=str(captures / 'display-settings-dark-en-expanded.png'), animations='disabled')
            page.keyboard.press('Escape')
            expect(settings).to_have_count(0)
            expect(page.get_by_role('button', name='Settings', exact=True)).to_be_focused()
            page.reload()
            expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=25000)
            expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
            expect(page.locator('html')).to_have_attribute('data-font', 'source')
            expect(page.locator('html')).to_have_attribute('lang', 'en')
            page.get_by_role('button', name='Settings', exact=True).click()
            expect(page.get_by_role('combobox', name='Typography', exact=True)).to_have_value('source')
            page.get_by_role('button', name='Close settings', exact=True).click()
            expect(page.locator('.settings-menu')).to_have_count(0)
            # Session reset stays available directly in settings.
            page.get_by_role('button', name='Settings', exact=True).click()
            page.get_by_role('button', name='Reset workspace', exact=True).click()
            expect(page.locator('.settings-menu')).to_have_count(0)
            expect(page.locator('.assessment-moment[aria-pressed="true"] time')).to_have_attribute('datetime', initial_assessment)
            expect(page.locator('.assessment-moment[aria-pressed="true"]')).to_contain_text('Initial assessment')
            assert not errors, errors
            context.close()
        # A restricted browser must retain a usable light interface.
        context = use_vietnamese(browser.new_context(color_scheme='dark'))
        context.add_init_script("""{
          const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
          const protectedKeys = ['dear.theme', 'dear.locale', 'dear.font-choice'];
          Storage.prototype.getItem = function(key) { if (protectedKeys.includes(key)) throw new DOMException('denied', 'SecurityError'); return get.call(this, key); };
          Storage.prototype.setItem = function(key, value) { if (protectedKeys.includes(key)) throw new DOMException('denied', 'SecurityError'); return set.call(this, key, value); };
        }""")
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url + '/') else r.abort())
        page = use_vietnamese(context.new_page())
        page.goto(url + '/?map=2d&offline=1&demoRole=manager')
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=25000)
        expect(page.locator('html')).to_have_attribute('data-theme', 'light')
        expect(page.locator('html')).to_have_attribute('lang', 'en')
        page.get_by_role('button', name='Settings', exact=True).click()
        page.get_by_role('button', name='Dark', exact=True).click()
        expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
        context.close()
        browser.close()
    print('Display settings passed: light default independent of OS, explicit dark, compact font, responsive bounds, Escape/focus, preference persistence, contextual reset and unavailable storage.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5174')
    parser.add_argument('--chrome', default=None)
    parser.add_argument('--captures', type=Path)
    args = parser.parse_args()
    if args.captures:
        args.captures.mkdir(parents=True, exist_ok=True)
    run(args.url.rstrip('/'), args.chrome, args.captures)
