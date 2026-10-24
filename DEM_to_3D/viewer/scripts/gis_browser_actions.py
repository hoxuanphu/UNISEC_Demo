"""Shared GIS steps for browser checks."""
from playwright.sync_api import expect


def gis_task(page, task='data'):
    """Choose a business task before using its controls, including on a narrow screen."""
    mobile = page.locator('.geodata-mobile-tabs')
    if mobile.is_visible(): mobile.get_by_role('button', name='Dữ liệu', exact=True).click()
    names = {'data': 'Dữ liệu', 'areas': 'Vùng sạt lở', 'roads': 'Đường'}
    primary = page.locator('.geodata-task-nav').get_by_role('button', name=names.get(task, 'Dữ liệu'), exact=True)
    if primary.get_attribute('aria-pressed') != 'true': primary.click()
    tools=page.locator('.geodata-data-tools')
    if task in ('data','aoi') and tools.is_visible() and tools.get_attribute('open') is None:
        tools.locator('summary').click()
    if task == 'aoi': page.get_by_role('tab', name='Vùng quan tâm', exact=True).click()


def apply_boundary(page):
    # Saving on the drawing bar applies the boundary; a finished rectangle is already saved.
    toolbar=page.locator('.geodata-drawing-bar')
    if not toolbar.is_visible(): return
    apply=toolbar.get_by_role('button',name='Áp dụng',exact=True)
    (apply if apply.count() else toolbar.get_by_role('button',name='Kết thúc',exact=True)).click()


def select_scenario_community(page, name):
    """Use the community list even when a map symbol is outside the viewport."""
    gis_task(page)
    layers=page.get_by_role('tab',name='Lớp',exact=True)
    if layers.get_attribute('aria-selected') != 'true':layers.click()
    collection=page.locator('.geodata-scenario-data')
    if collection.get_attribute('open') is None:
        collection.locator(':scope > summary').click()
    for group in collection.locator('.scenario-feature-list > details').all():
        if group.locator('.scenario-feature-row').filter(has_text=name).count() and group.get_attribute('open') is None:
            group.locator(':scope > summary').click()
    collection.get_by_role('button',name=name,exact=True).click()


def download_geometry(page, format):
    disclosure=page.locator('.geodata-export > details')
    if disclosure.get_attribute('open') is None: disclosure.locator('summary').click()
    page.locator('.geodata-export').get_by_role('button',name=format,exact=True).click()
    dialog=page.get_by_role('dialog',name='Xuất dữ liệu GIS',exact=True)
    expect(dialog).to_be_visible()
    dialog.get_by_role('button',name='Tải tệp',exact=True).click()



def publish_draft(page):
    """Review and publish the whole GIS draft; per-feature Save remains unpublished."""
    bar = page.locator('.geodata-workspace .gis-draft-bar')
    if not bar.is_visible():
        return
    bar.get_by_role('button', name='Áp dụng thay đổi', exact=True).click()
    dialog = page.get_by_role('dialog', name='Áp dụng thay đổi GIS?', exact=True)
    expect(dialog).to_be_visible()
    dialog.get_by_role('button', name='Áp dụng', exact=True).click()
    if dialog.get_by_role('alert').count():
        raise AssertionError(dialog.get_by_role('alert').inner_text())
    expect(dialog).to_have_count(0)
    expect(bar).to_have_count(0)


def published_records(page):
    return page.evaluate("JSON.parse(localStorage.getItem('dear.gis.v2') || '{}').records || JSON.parse(localStorage.getItem('dear.geodata.v1') || '[]')")


def published_edits(page):
    return page.evaluate("Object.values(JSON.parse(localStorage.getItem('dear.gis.v2') || '{}').scenarios || {}).flat()")


def reviewed_records(page):
    """Existing geometry checks use an explicit publication checkpoint at each saved-state
    assertion. Pending modal/vertex edits remain uncommitted, so read the actual baseline.
    Dedicated draft checks verify no-write-until-review and publication failures separately.
    """
    if not page.locator('dialog[open]:visible, .geodata-drawing-bar:visible').count():
        publish_draft(page)
    return published_records(page)


def reviewed_records_json(page):
    import json
    return json.dumps(reviewed_records(page), ensure_ascii=False)


def scenario_properties(card):
    panel = card.locator('.scenario-properties')
    disclosure = panel.locator('xpath=..')
    if disclosure.get_attribute('open') is None:
        disclosure.locator('summary').click()
    return panel


def clear_prepared_survey(page):
    """Isolate drawing/edit fixtures; shipped survey coverage is checked by check_workspace_layers."""
    page.evaluate("""() => {
        const data=JSON.parse(localStorage.getItem('dear.gis.v2'));
        if (!data) return;
        data.records=data.records.filter(r=>!r.feature.properties.sourceDatasetId);
        localStorage.setItem('dear.gis.v2',JSON.stringify(data));
    }""")
    page.reload()
    expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=30000)
    return page.evaluate("localStorage.getItem('dear.gis.v2')")


def map_tool(page, name):
    """Reveal a secondary map action before using it, as a user would."""
    button=page.get_by_role('button',name=name,exact=True)
    if button.is_visible():
        return button
    expect(page.locator('.map-tool-toggle')).to_be_visible(timeout=30000)
    page.locator('.map-tool-toggle').click()
    expect(button).to_be_visible()
    return button


def open_header_help(page):
    page.get_by_role('button',name='Cài đặt',exact=True).click()
    page.get_by_role('button',name='Hướng dẫn sử dụng',exact=True).click()
