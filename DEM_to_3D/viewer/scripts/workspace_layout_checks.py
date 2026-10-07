"""Check overlapping controls at the narrowest supported desktop map width."""
from playwright.sync_api import expect


def check_front(locator):
    assert locator.evaluate("""node => {
        const r = node.getBoundingClientRect();
        return [0.25, 0.5, 0.75].every(fraction => node.contains(document.elementFromPoint(r.x + r.width * fraction, r.y + r.height / 2)));
    }"""), 'An overlay covers ' + locator.inner_text()


def check_workspace_layout(browser, url, captures=None):
    context = browser.new_context(viewport={'width': 1024, 'height': 768})
    context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url + '/') else r.abort())
    page = context.new_page()
    try:
        page.goto(url)
        expect(page.locator('.incident-priority-row').first).to_be_visible(timeout=25000)
        handle = page.locator('.panel-resize-handle')
        handle.focus()
        page.keyboard.press('End')
        page.wait_for_function("document.querySelector('.map-area').clientWidth === 480")
        nav = page.locator('.workspace-nav').bounding_box()
        toolbar = page.locator('.map-toolbar').bounding_box()
        assert abs(nav['y'] + nav['height'] - toolbar['y'] - toolbar['height']) < 1, 'Desktop tabs and search toolbar have different baselines'
        assert page.locator('.workspace-nav').evaluate('node => getComputedStyle(node).backgroundColor') == page.locator('.map-toolbar').evaluate('node => getComputedStyle(node).backgroundColor'), 'Workspace controls use different surface tones'
        search = page.get_by_role('combobox', name='Tìm trên bản đồ', exact=True)
        assert search.bounding_box()['width'] >= 160, 'Search was squeezed by the toolbars'
        for selector in ['.map-toolbar', '.map-tools']:
            bounds = page.locator(selector).bounding_box()
            for button in page.locator(selector + ' button').all():
                box = button.bounding_box()
                if box:
                    assert box['x'] >= bounds['x'] and box['x'] + box['width'] <= bounds['x'] + bounds['width'] + 1
                    check_front(button)
        search.fill('nam')
        expect(page.locator('.map-search-results')).to_have_css('opacity', '1')
        check_front(page.locator('.map-search-results [role=option]').first)
        if captures: page.screenshot(path=str(captures / 'workspace-narrow-search.png'))
        search.press('Escape')
        for name, surface in [('Lớp bản đồ', '.layers-panel'), ('Đo trên bản đồ 2D', '.map-measure-panel'), ('Thông tin vị trí', '.map-location-panel')]:
            page.get_by_role('button', name=name, exact=True).click()
            expect(page.locator(surface)).to_be_visible()
            controls = page.locator('.map-tools').bounding_box()
            box = page.locator(surface).bounding_box()
            assert box['y'] >= controls['y'] + controls['height'] + 8, (name, box, controls)
        page.get_by_role('button', name='Thông tin vị trí', exact=True).click()
        legend, overview = page.locator('.map-bottom-bar'), page.locator('.map-overview')
        expect(overview).to_be_visible()
        for expanded in [False, True]:
            if expanded: overview.get_by_role('button', name='Mở bản đồ tổng quan', exact=True).click()
            for full_legend in [False, True]:
                if full_legend: legend.get_by_role('button', name='Chú giải', exact=True).click()
                a, b = legend.bounding_box(), overview.bounding_box()
                assert a['x'] + a['width'] + 8 <= b['x'], (a, b)
                assert a['width'] <= 342, 'Legend uses more map width than needed'
                assert legend.evaluate('node => node.scrollWidth <= node.clientWidth'), 'Legend content is clipped horizontally'
                check_front(legend.get_by_role('button', name='Chú giải', exact=True))
            legend.get_by_role('button', name='Thu gọn chú giải', exact=True).click()
            assert legend.bounding_box()['height'] <= 42
            legend.get_by_role('button', name='Chú giải', exact=True).click()
            legend.get_by_role('button', name='Chú giải', exact=True).click()
        # A full legend must also leave the toolbars clear on a short window.
        page.set_viewport_size({'width': 1024, 'height': 480})
        legend.get_by_role('button', name='Chú giải', exact=True).click()
        tools, box = page.locator('.map-tools').bounding_box(), legend.bounding_box()
        assert box['y'] >= tools['y'] + tools['height'] + 8, ('Legend overlaps tools in short window', box, tools)
        check_front(legend.get_by_role('button', name='Chú giải', exact=True))
        legend.get_by_role('button', name='Chú giải', exact=True).click()
        # Header overlays stay above both toolbar rows in all supported views.
        for width in [1366, 1024, 390, 320]:
            page.set_viewport_size({'width': width, 'height': 768})
            tools = page.locator('.map-tools').bounding_box()
            canvas = page.locator('.map-canvas').bounding_box()
            assert abs(tools['y'] + tools['height'] - canvas['y']) < 1, ('Gap below map tools', width, tools, canvas)
            for label, selector in [('Thông báo sự kiện', '.notification-popover'), ('Cài đặt hiển thị', '.settings-menu')]:
                trigger = page.get_by_role('button', name=label, exact=True)
                trigger.click()
                surface = page.locator(selector)
                expect(surface).to_have_css('opacity', '1')
                check_front(surface.locator('button').first)
                if selector == '.notification-popover':
                    check_front(surface.locator('h2'))
                    expect(surface.get_by_role('button', name='Đóng thông báo', exact=True)).to_be_visible()
                else:
                    check_front(surface.locator('h2'))
                    close = surface.get_by_role('button', name='Đóng cài đặt', exact=True)
                    check_front(close)
                box = surface.bounding_box()
                assert box['x'] >= 0 and box['x'] + box['width'] <= width
                assert box['y'] + box['height'] <= 768
                page.keyboard.press('Escape')
                expect(surface).to_have_count(0)
                expect(trigger).to_be_focused()
                if selector == '.settings-menu':
                    trigger.click()
                    surface.get_by_role('button', name='Đóng cài đặt', exact=True).click()
                    expect(surface).to_have_count(0)
                    expect(trigger).to_be_focused()
    finally:
        context.close()
