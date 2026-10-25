"""Household inspection, rescue focus and compact EN/VI layouts without external requests."""
import argparse
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from browser_preferences import use_vietnamese


def run(url, chrome=None, captures=None):
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=chrome)
        for locale in ['en','vi']:
            context=browser.new_context(viewport={'width':1440,'height':960})
            if locale=='vi':use_vietnamese(context)
            context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url+'/') else r.abort())
            page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
            page.goto(url+'/?offline=1&map=2d&demoRole=manager')
            expect(page.locator('.incident-household-row')).to_have_count(4,timeout=30000)
            page.locator('.incident-household-row').first.click();card=page.locator('.household-card');expect(card).to_be_visible()
            expect(card).not_to_contain_text(re.compile('simulat|demo|mô phỏng|giả lập|Not verified in the field',re.I))
            expect(card.locator('footer')).to_have_count(0)
            expect(card).to_contain_text('Access path unknown' if locale=='en' else 'Chưa xác định lối vào')
            expect(page.locator('.household-zone')).to_have_count(0)
            expect(page.locator('.household-alert.is-selected[data-household]')).to_have_count(1)
            expect(page.locator('.leaflet-dear-selection-pane path[stroke="#c62828"][stroke-dasharray="4 5"]')).to_have_count(0)
            for width in [1440,390,320]:
                page.set_viewport_size({'width':width,'height':960})
                switch=page.locator('.mobile-view-switch').get_by_role('button',name='Map' if locale=='en' else 'Bản đồ',exact=True)
                if switch.is_visible():switch.click()
                expect(card).to_be_visible()
                box=card.bounding_box();assert box['x']>=0 and box['x']+box['width']<=width+1,box
            page.set_viewport_size({'width':1440,'height':960})
            if captures:
                captures.mkdir(parents=True,exist_ok=True)
                page.screenshot(path=str(captures/f'households-{locale}.png'))
            page.keyboard.press('Escape');expect(card).to_have_count(0)
            page.locator('.incident-household-row').first.click();expect(card).to_be_visible()
            expect(card.locator('.household-team strong')).to_contain_text('CH-')
            card.locator('.household-team').click();expect(card).to_have_count(0)
            page.locator('.incident-household-row').first.click();expect(card).to_be_visible()
            card.get_by_role('button',name='Road approach' if locale=='en' else 'Đường tiếp cận',exact=True).click()
            expect(page.locator('.road-journey-panel')).to_be_visible()
            assert not errors,errors
            context.close()
        browser.close()
    print('Household panel passed: EN/VI, Escape, team focus, no invented boundary/connector, compact status and 320–1440 px offline.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5213')
    parser.add_argument('--chrome')
    parser.add_argument('--captures', type=Path)
    args = parser.parse_args()
    run(args.url.rstrip('/'), args.chrome, args.captures)
