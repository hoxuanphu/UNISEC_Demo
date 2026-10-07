"""Exercise operator measurement tools, persistence, editing and map space."""
import argparse
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


def run(url, chrome, captures):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, **({'executable_path': chrome} if chrome else {}))
        context = browser.new_context(viewport={'width': 1366, 'height': 768}, permissions=['clipboard-read', 'clipboard-write'])
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(url) else route.abort())
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url)
        expect(page.locator('.leaflet-image-layer')).to_have_count(1, timeout=25000)
        page.get_by_role('button', name='Cài đặt hiển thị', exact=True).click()
        page.get_by_role('button', name='English', exact=True).click()
        page.keyboard.press('Escape')
        panel = page.locator('.map-measure-panel')
        page.get_by_role('button', name='Measure on 2D map', exact=True).click()
        expect(page.locator('.map-bottom-bar')).to_be_hidden()
        initial_box = panel.bounding_box()
        panel.get_by_role('button', name='Measurement settings', exact=True).click()
        panel.get_by_role('checkbox', name='Snap to visible features', exact=True).uncheck()
        assert panel.bounding_box() == initial_box, (initial_box, panel.bounding_box())
        panel.get_by_role('button', name='Measurement settings', exact=True).click()

        def pick(x, y, click=True):
            box = page.locator('.map-2d-surface').bounding_box()
            position = (box['x'] + box['width'] * x, box['y'] + box['height'] * y)
            page.mouse.click(*position) if click else page.mouse.move(*position)

        def mode(value):
            selector = panel.get_by_role('combobox', name='Measurement type', exact=True)
            expect(selector).to_be_enabled()
            index = selector.evaluate('(node, value) => [...node.options].findIndex(option => option.value === value)', value)
            assert index >= 0, value
            # Use a real mouse click and native menu keys, not select_option().
            # This catches blocked pointer targets and an unexpectedly disabled control.
            selector.click()
            page.keyboard.press('Home')
            for _ in range(index): page.keyboard.press('ArrowDown')
            page.keyboard.press('Enter')
            expect(selector).to_have_value(value)

        pick(.55, .3); pick(.75, .35, False)
        expect(panel.locator('.map-measure-result')).to_contain_text('km')
        pick(.75, .35)
        # Enter on a button must activate that button, not finish a draft.
        panel.get_by_role('button', name='Undo', exact=True).focus()
        page.keyboard.press('Enter')
        expect(page.locator('.map-measure-vertex')).to_have_count(1)
        panel.get_by_role('button', name='Redo', exact=True).click()
        expect(page.locator('.map-measure-vertex')).to_have_count(2)
        page.locator('.map-measure-vertex').last.dblclick()
        expect(page.locator('.map-measure-label')).to_have_count(1)
        expect(page.locator('.map-measure-vertex')).to_have_count(2)
        expect(page.locator('.map-measure-vertex.is-editable')).to_have_count(0)
        panel.get_by_role('button', name='Edit', exact=True).click()
        before = panel.locator('.map-measure-result').text_content()
        vertex = page.locator('.map-measure-vertex').last.bounding_box()
        page.mouse.move(vertex['x'] + 10, vertex['y'] + 10)
        page.mouse.down(); page.mouse.move(vertex['x'] + 50, vertex['y'] + 50, steps=12); page.mouse.up()
        expect(panel.locator('.map-measure-result')).not_to_have_text(before)
        panel.get_by_role('button', name='Cancel', exact=True).click()
        expect(panel.locator('.map-measure-result')).to_have_text(before)
        panel.get_by_role('button', name='Edit', exact=True).click()
        vertex = page.locator('.map-measure-vertex').last.bounding_box()
        page.mouse.move(vertex['x'] + 12, vertex['y'] + 12)
        page.mouse.down(); page.mouse.move(vertex['x'] + 50, vertex['y'] + 50, steps=12); page.mouse.up()
        panel.get_by_role('button', name='Apply changes', exact=True).click()
        expect(panel.locator('.map-measure-result')).not_to_have_text(before)
        assert panel.bounding_box() == initial_box
        committed = panel.locator('.map-measure-result').text_content()
        panel.get_by_role('button', name='Edit', exact=True).click()
        vertex = page.locator('.map-measure-vertex').last.bounding_box()
        page.mouse.move(vertex['x'] + 12, vertex['y'] + 12)
        page.mouse.down(); page.mouse.move(vertex['x'] + 45, vertex['y'] + 40, steps=12); page.mouse.up()
        expect(panel.locator('.map-measure-result')).not_to_have_text(committed)
        page.get_by_role('button', name='Layers', exact=True).click()
        expect(panel).to_have_count(0)
        page.keyboard.press('Escape')
        page.get_by_role('button', name='Measure on 2D map', exact=True).click()
        expect(panel.locator('.map-measure-result')).to_have_text(committed)
        expect(panel).to_have_attribute('data-stage', 'finished')
        panel.get_by_role('button', name='Copy results', exact=True).click()
        expect(panel.get_by_role('button', name='Copied', exact=True)).to_be_visible()
        assert 'EPSG:32648' in page.evaluate('navigator.clipboard.readText()')
        result = panel.locator('.map-measure-result').text_content()
        panel.get_by_role('button', name='Close measurement', exact=True).click()
        expect(page.locator('.map-measure-label')).to_have_count(1)
        page.get_by_role('button', name='Measure on 2D map', exact=True).click()
        expect(panel.locator('.map-measure-result')).to_have_text(result)
        normal = panel.bounding_box()['height']
        panel.get_by_role('button', name='Collapse measurement', exact=True).click()
        assert panel.bounding_box()['height'] < normal * .5
        if captures: page.screenshot(path=str(captures / 'measurement-compact.png'))
        panel.get_by_role('button', name='Expand measurement', exact=True).click()
        # The operator can change tools while editing. The valid result is retained.
        retained_value = panel.locator('.map-measure-result dd').first.text_content()
        panel.get_by_role('button', name='Edit', exact=True).click()
        mode('area')
        expect(panel).to_have_attribute('data-stage', 'drawing')
        expect(page.locator('.map-measure-vertex')).to_have_count(0)
        expect(page.locator('.map-measure-label')).to_have_count(1)
        assert panel.bounding_box() == initial_box
        panel.locator('[aria-controls="measurement-saved-view"]').click()
        expect(panel.locator('.measure-history-row')).to_have_count(1)
        expect(panel.locator('.measure-history-row').first).to_contain_text(retained_value)
        panel.get_by_role('button', name='Measurement', exact=True).click()
        pick(.55, .3); pick(.75, .3); pick(.75, .5)
        # Closing by the first vertex avoids appending duplicate polygon points.
        page.locator('.map-measure-vertex').first.click()
        expect(panel.get_by_role('button', name='New', exact=True)).to_be_visible()
        assert page.locator('.map-2d-surface').evaluate("node => getComputedStyle(node).cursor") == 'grab'
        expect(panel.locator('.map-measure-result')).to_contain_text('Perimeter')
        panel.get_by_role('button', name='Measurement settings', exact=True).click()
        panel.get_by_role('combobox', name='Area units', exact=True).select_option('ha')
        expect(panel.locator('.map-measure-result')).to_contain_text('ha')
        panel.get_by_role('button', name='Measurement settings', exact=True).click()
        if captures: page.screenshot(path=str(captures / 'measurement-area.png'))
        for value, picks, label in [
            ('radius', [(.55, .3), (.65, .3)], 'Circle area'),
            ('bearing', [(.55, .3), (.65, .3)], 'Grid-north bearing'),
            ('angle', [(.55, .3), (.65, .3), (.65, .4)], 'Angle at point 2'),
            ('location', [(.55, .3)], 'Latitude')]:
            mode(value)
            for x, y in picks: pick(x, y)
            expect(panel.locator('.map-measure-result')).to_contain_text(label)
            expect(panel.get_by_role('button', name='Copy results', exact=True)).to_be_visible()
        # Source-only settings stay collapsed until requested, with independent retained results.
        panel.locator('[aria-controls="measurement-saved-view"]').click()
        saved = panel.locator('.measure-history-row')
        expect(saved).to_have_count(5)
        saved.first.get_by_role('checkbox').uncheck()
        expect(page.locator('.map-measure-label')).to_have_count(5)
        saved.first.get_by_role('button').click()
        expect(saved).to_have_count(4)
        panel.get_by_role('button', name='Close measurement', exact=True).click()
        width = page.locator('.map-area').bounding_box()['width']
        sidebar_width = page.locator('.sidebar').bounding_box()['width']
        page.get_by_role('button', name='Hide information panel', exact=True).click()
        expect(page.locator('.sidebar')).to_be_hidden()
        expect(page.get_by_role('separator')).to_be_hidden()
        assert page.locator('.map-area').bounding_box()['width'] > width + sidebar_width - 2
        page.get_by_role('button', name='Show information panel', exact=True).click()
        assert abs(page.locator('.sidebar').bounding_box()['width'] - sidebar_width) < 1
        # Completed measurements survive a 3D round trip. New sessions explicitly reset them.
        page.get_by_role('button', name='Measure on 2D map', exact=True).click()
        expect(panel).to_be_visible()
        page.get_by_role('button', name='Switch to 3D', exact=True).click()
        expect(page.locator('.map-2d')).to_have_count(0)
        expect(panel).to_have_count(0)
        expect(page.get_by_role('button', name='Measure on 2D map', exact=True)).to_have_attribute('aria-pressed', 'false')
        page.get_by_role('button', name='Measure on 2D map', exact=True).click()
        expect(panel.locator('.map-measure-result')).to_contain_text('Latitude')
        expect(page.locator('.map-measure-label')).to_have_count(5)
        for _ in range(12):
            panel.get_by_role('button', name='Close measurement', exact=True).click()
            page.get_by_role('button', name='Measure on 2D map', exact=True).click()
            expect(page.locator('.map-measure-label')).to_have_count(5)
            expect(page.locator('.map-measure-vertex')).to_have_count(1)
        # Mobile tool becomes a short bottom sheet, leaving the upper map usable.
        for width in [390, 320]:
            page.set_viewport_size({'width': width, 'height': 740})
            bounds = page.locator('.map-area').bounding_box()
            box = panel.bounding_box()
            assert box['height'] <= bounds['height'] * .49
            assert box['x'] >= bounds['x'] and box['x'] + box['width'] <= bounds['x'] + bounds['width']
            assert panel.evaluate('(node) => node.scrollWidth <= node.clientWidth + 1')
            toolbar = page.locator('.map-toolbar').bounding_box()
            north = page.locator('.map-north').bounding_box()
            tools = page.locator('.map-tools').bounding_box()
            assert toolbar['y'] + toolbar['height'] <= north['y'] - 6
            assert tools['y'] + tools['height'] <= north['y'] - 6
            page.wait_for_function("""() => {
                const visible = n => n.offsetWidth && n.offsetHeight && getComputedStyle(n).display !== 'none';
                const boxes = [...document.querySelectorAll('.map-tools,.map-toolbar,.map-measure-panel,.map-north')].filter(visible).map(n => n.getBoundingClientRect());
                return [...document.querySelectorAll('.map-measure-label')].filter(visible).every(n => {
                    const a = n.getBoundingClientRect();
                    return !boxes.some(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
                });
            }""")
            if captures: page.screenshot(path=str(captures / f'measurement-mobile-{width}.png'))
        page.set_viewport_size({'width': 1366, 'height': 768})
        panel.locator('[aria-controls="measurement-saved-view"]').click()
        panel.get_by_role('button', name='Clear all measurements', exact=True).click()
        expect(page.locator('.map-measure-label')).to_have_count(0)
        expect(page.locator('.map-measure-vertex')).to_have_count(0)
        expect(panel.locator('.measure-history-row')).to_have_count(0)
        panel.get_by_role('button', name='Measurement', exact=True).click()
        pick(.55, .3); pick(.75, .4)
        # Closing pauses an unfinished drawing rather than silently losing it.
        panel.get_by_role('button', name='Close measurement', exact=True).click()
        page.get_by_role('button', name='Measure on 2D map', exact=True).click()
        expect(page.locator('.map-measure-vertex.is-editable')).to_have_count(2)
        pick(.8, .4, False)
        page.keyboard.press('Enter')
        expect(panel.get_by_role('button', name='New', exact=True)).to_be_visible()
        panel.get_by_role('button', name='Close measurement', exact=True).click()
        page.locator('.incident-priority-row').first.click()
        page.get_by_role('button', name='Measure on 2D map', exact=True).click()
        panel.get_by_role('button', name='Measure selected route', exact=True).click()
        expect(panel.locator('.map-measure-source')).to_be_visible()
        expect(panel.get_by_role('button', name='Copy results', exact=True)).to_be_visible()
        assert page.locator('.map-measure-vertex').count() > 2
        panel.get_by_role('button', name='Close measurement', exact=True).click()
        page.locator('.workspace-nav button').first.click()
        page.locator('.incident-area-link').click()
        page.get_by_role('button', name='Measure on 2D map', exact=True).click()
        panel.get_by_role('button', name='Measure assessment area', exact=True).click()
        expect(panel.locator('.map-measure-result')).to_contain_text('Perimeter')
        expect(panel.locator('.map-measure-source')).to_be_visible()
        expect(panel.get_by_role('button', name='Copy results', exact=True)).to_be_visible()
        assert not errors, errors
        context.close(); browser.close()
        print('Measurement tools passed: six modes, native type selection while editing, live preview, undo/redo, units, copy, history, collapse, mobile and 3D lifecycle.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:5215')
    parser.add_argument('--chrome')
    parser.add_argument('--captures', type=Path)
    args = parser.parse_args()
    if args.captures: args.captures.mkdir(parents=True, exist_ok=True)
    run(args.url.rstrip('/'), args.chrome, args.captures)
