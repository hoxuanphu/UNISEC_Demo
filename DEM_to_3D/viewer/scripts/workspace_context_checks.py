"""Check panel scroll restoration and dialog focus across object navigation."""
from playwright.sync_api import expect
from browser_preferences import use_vietnamese
from network_browser_fixture import install_network_fixture


def check_workspace_context(browser, url):
    context = use_vietnamese(browser.new_context(viewport={'width': 1366, 'height': 520}))
    context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url + '/') else r.abort())
    packet=install_network_fixture(context,url)
    page = context.new_page()
    try:
        page.goto(url+'/?map=2d&demoRole=manager')
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=25000)
        page.locator('.workspace-nav').get_by_role('button',name='Địa bàn',exact=True).click()
        page.locator('#response-panel .community').filter(has=page.get_by_text('Nậm Khắt',exact=True)).click()
        page.locator('.decision-tabs button').nth(1).click()
        scroll = page.locator('#response-details .sidebar-scroll')
        saved = scroll.evaluate("node => { node.scrollTop = 100; node.dispatchEvent(new Event('scroll')); return node.scrollTop; }")
        assert saved > 0, 'Fixture must exercise a scrollable detail panel'

        # A global dialog traps focus without changing the panel underneath it.
        # Data sources open from the incident popover; focus returns to its trigger.
        data = page.get_by_role('button', name='Sự kiện đang xem', exact=True)
        data.click()
        page.locator('.header-context-popover').get_by_role('button', name='Nguồn dữ liệu', exact=True).click()
        dialog = page.get_by_role('dialog')
        expect(dialog).to_be_visible()
        for key in ['Shift+Tab', 'Tab', 'Tab']:
            page.keyboard.press(key)
            assert dialog.evaluate('node => node.contains(document.activeElement)'), 'Focus escaped the dialog'
        page.keyboard.press('Escape')
        expect(dialog).to_have_count(0)
        expect(data).to_be_focused()
        assert abs(scroll.evaluate('node => node.scrollTop') - saved) <= 1

        # Opening a report's road and returning restores the Evidence tab and its scroll.
        report = page.locator('.community-finding').filter(has_text='Đường chính vào Nậm Khắt')
        report_button = report.get_by_role('button', name='Xem báo cáo', exact=True)
        report_button.scroll_into_view_if_needed()
        saved = scroll.evaluate('node => node.scrollTop')
        report_button.click()
        expect(page.locator('.evidence-road')).to_be_visible()
        page.locator('.evidence-road').click()
        expect(page.locator('#response-details h1')).to_have_text(next(road['name'][0] for road in packet['roads'] if road['id']=='E8'))
        expect(page.get_by_role('dialog')).to_have_count(0)
        page.get_by_role('button', name='Đóng chi tiết đối tượng', exact=True).click()
        page.locator('.workspace-nav').get_by_role('button',name='Địa bàn',exact=True).click()
        expect(page.locator('#response-details h1')).to_have_text('Nậm Khắt')
        expect(page.locator('.decision-tabs button').nth(1)).to_have_attribute('aria-pressed', 'true')
        assert abs(scroll.evaluate('node => node.scrollTop') - saved) <= 1, 'Evidence scroll was reset after returning from a road'

        # A long community list restores its position after a detail is closed.
        page.locator('.workspace-nav button').last.click()
        scroll = page.locator('#response-panel .sidebar-scroll')
        row = page.locator('.sidebar .community').last
        row.scroll_into_view_if_needed()
        saved = scroll.evaluate('node => node.scrollTop')
        assert saved > 0, 'Fixture must exercise a scrollable community list'
        name = row.locator('strong').text_content()
        row.click()
        expect(page.locator('#response-details h1')).to_have_text(name)
        page.get_by_role('button', name='Đóng chi tiết địa bàn', exact=True).click()
        expect(page.locator('.sidebar .community')).to_have_count(7)
        assert abs(scroll.evaluate('node => node.scrollTop') - saved) <= 1, 'Community list scroll was reset'
    finally:
        context.close()
