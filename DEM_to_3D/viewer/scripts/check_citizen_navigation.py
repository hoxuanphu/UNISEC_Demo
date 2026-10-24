"""Resident map chrome, local network directions and mobile navigation regression."""
import argparse
import re
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
from browser_preferences import use_vietnamese


def run(url, chrome, captures):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=chrome)
        context = use_vietnamese(browser.new_context(
            viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True))
        # All product data must work without fetching third party maps.
        context.route("**/*", lambda route: route.continue_()
                      if route.request.url.startswith(url + "/") else route.abort())
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(url + "/?map=2d&offline=1")
        resident_name = 'A Phủ ở bản Chế Tạo, huyện Mù Cang Chải'
        page.get_by_label("Tên của bạn", exact=True).fill(resident_name)
        page.get_by_role("button", name="Vào ứng dụng", exact=True).click()
        nav = page.locator(".citizen-mobile-switch")
        expect(page.locator(".citizen-map")).to_be_visible()
        expect(page.get_by_role("button", name="Đổi vai trò", exact=True)).to_have_count(0)
        page.get_by_role('button', name='Tài khoản', exact=True).click()
        account = page.get_by_role('dialog', name='Tài khoản', exact=True)
        expect(account).to_contain_text(resident_name)
        expect(account).to_contain_text('Người dân')
        expect(account.get_by_role('button', name='Đổi vai trò', exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        expect(account).to_have_count(0)
        expect(page.locator(".map-overview")).to_have_count(0)
        expect(nav.get_by_role("button")).to_have_count(4)
        expect(page.locator('.citizen-map-context')).to_contain_text('Đường trong xã')
        expect(page.locator('.citizen-map-tools button')).to_have_count(2)
        expect(page.locator('.map-source-button')).not_to_be_visible()
        layers = page.locator(".citizen-map-layers")
        layers.locator("summary").click()
        expect(layers.get_by_role("checkbox")).to_have_count(4)
        layers.get_by_label("Vùng và điểm sạt lở", exact=True).uncheck()
        layers.get_by_label("Vùng và điểm sạt lở", exact=True).check()
        expect(layers).to_contain_text("Chạm vùng sạt")
        if captures:
            captures.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(captures / "resident-layers-390.png"))
        layers.locator("summary").click()
        for width in [320, 390, 430, 760]:
            page.set_viewport_size({"width": width, "height": 844})
            for theme in ["light", "dark"]:
                page.evaluate("theme => document.documentElement.dataset.theme = theme", theme)
                page.wait_for_timeout(200)
                # Read final colours after theme transitions, including icons.
                page.wait_for_function('''() => {
                    const header = document.querySelector('.citizen-header');
                    const rgb = value => value.match(/[\\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
                    const lum = value => {const c=rgb(value);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
                    const bg = lum(getComputedStyle(header).backgroundColor);
                    return [...header.querySelectorAll('button')].every(button => {
                        const fg=lum(getComputedStyle(button).color);
                        return (Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)>=4.5;
                    });
                }''')
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (width, theme)
                assert page.locator(".citizen-map").evaluate("""map => {
                    const canvas = map.querySelector('.map-canvas').getBoundingClientRect();
                    return Math.abs(canvas.top - map.getBoundingClientRect().top) < 1;
                }"""), "Unexpected toolbar gap above map"
                if captures and width in [320, 390]:
                    page.screenshot(path=str(captures / f"resident-map-{width}-{theme}.png"))
                if width == 320:
                    page.get_by_role('button', name='Tài khoản', exact=True).click()
                    expect(account).to_be_visible()
                    assert account.evaluate('node => {const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth;}')
                    if captures:
                        page.screenshot(path=str(captures / f'resident-account-320-{theme}.png'))
                    page.keyboard.press('Escape')
        page.set_viewport_size({"width": 390, "height": 844})
        page.evaluate("document.documentElement.dataset.theme = 'light'")
        nav.get_by_role("button", name="Thông tin đường", exact=True).click()
        page.get_by_role("button", name="Trong xã", exact=True).click()
        expect(page.locator(".citizen-local-places li")).not_to_have_count(0)
        expect(page.locator(".citizen-local")).to_contain_text("Đường trong xã")
        directions = page.locator(".citizen-directions")
        selects = directions.locator("select")
        # The source network used by the existing route workspace has this A-C connection.
        selects.nth(0).select_option(label="Bản A")
        selects.nth(1).select_option(label="Bản C")
        expect(directions.locator(".citizen-direction-result")).to_be_visible()
        expect(directions.locator(".citizen-direction-result")).to_contain_text("km")
        expect(directions).to_contain_text("Đường nên đi")
        if captures:
            page.screenshot(path=str(captures / "resident-local-directions-390.png"))
        directions.get_by_role("button", name="Xem trên bản đồ", exact=True).click()
        expect(page.locator(".citizen-map-summary")).to_contain_text("Bản A")
        expect(page.locator(".citizen-map-summary")).to_contain_text("Bản C")
        expect(page.locator(".journey-map-pin")).to_have_count(2)
        expect(page.locator(".map-road-route-line").first).to_be_attached()
        expect(page.locator(".resident-route-arrow")).to_have_count(3)
        expect(page.locator('.resident-blocked-comparison')).to_have_count(1)
        expect(page.locator('.map-context-landslide')).to_have_count(29)
        expect(page.locator('.road-closure-sign.is-landslide')).to_have_count(6)
        assert page.locator('.road-closure-sign svg').evaluate_all('svgs => new Set(svgs.map(svg=>svg.innerHTML)).size===1'), 'All blocked sections must share the same symbol'
        expect(page.locator('.resident-road-area-link')).to_have_count(16)
        expect(page.locator('.citizen-comparison-legend')).to_contain_text('Đường khác')
        expect(page.locator('.citizen-comparison-legend')).to_contain_text('Bị chặn')
        assert page.locator('.resident-blocked-comparison,.resident-route-alternative').evaluate_all('''lines =>
            lines.length >= 2 && new Set(lines.map(line=>line.getAttribute('stroke'))).size === 1
        '''), 'All non-selected routes must use the same colour'
        assert page.locator('.map-road-route-line').evaluate_all("""lines => lines.every(line =>
            line.getAttribute('stroke') === '#2f80ed' && !line.getAttribute('stroke-dasharray') &&
            parseFloat(line.getAttribute('stroke-width')) >= 5)
        """), 'Suggested route must be continuous and clearly emphasised'
        assert not re.search(r'[·→—]|demo|mô phỏng', page.locator('.citizen-workspace').inner_text(), re.I)
        page.wait_for_timeout(650)
        assert page.locator('.journey-map-pin').evaluate_all("""pins => {
            const map = document.querySelector('.citizen-map').getBoundingClientRect();
            const sheet = document.querySelector('.citizen-map-summary').getBoundingClientRect();
            return pins.every(pin => {const rect = pin.getBoundingClientRect();
                return rect.left >= map.left && rect.right <= map.right && rect.top >= map.top && rect.bottom < sheet.top;
            });
        }"""), "Route endpoints must be visible above the summary card"
        if captures:
            page.screenshot(path=str(captures / "resident-local-route-390.png"))
        def assert_clear_symbols():
            expect(page.locator('.citizen-map .map-pin.is-cluster')).to_have_count(0)
            expect(page.locator('.citizen-map .map-pin.has-overlap')).to_have_count(0)
            assert page.locator('.citizen-map').evaluate("""map => {
                const nodes = [...map.querySelectorAll('.map-pin:not([hidden]), .resident-route-pins > button, .map-pin:not([hidden]):not(.is-label-hidden) .map-pin-label, .resident-stop-name:not([hidden]), .road-closure-sign svg')];
                return nodes.every((node,i) => nodes.slice(i+1).every(other => {
                    const a=node.getBoundingClientRect(), b=other.getBoundingClientRect();
                    const clear = a.right<=b.left || a.left>=b.right || a.bottom<=b.top || a.top>=b.bottom;
                    if (!clear) throw new Error(`Overlapping symbols: ${node.outerHTML.slice(0,250)} / ${other.outerHTML.slice(0,250)}`);
                    return clear;
                }));
            }"""), 'Place symbols, endpoint letters and labels must not overlap'
        assert_clear_symbols()
        # All northern hazards remain visible when fitting both routes on a phone.
        for width in [320, 390, 430]:
            page.set_viewport_size({'width': width, 'height': 844})
            page.get_by_role('button', name='Vừa bản đồ', exact=True).click()
            page.wait_for_timeout(700)
            assert page.locator('.citizen-map-summary').evaluate('node=>node.getBoundingClientRect().height<=120'), 'Route summary must stay compact'
            assert page.locator('.road-closure-sign.is-landslide').evaluate_all('''pins => pins.every(pin => {
                return (pin.dataset.landslideAreas || pin.dataset.landslideArea).split(' ').every(id => {
                    const polygon = document.querySelector(`.map-context-landslide[data-context-area="${id}"],.landslide-area[data-landslide-area="${id}"]`);
                    const link = document.querySelector(`.resident-road-area-link[data-landslide-area="${id}"]`);
                    if (!polygon || !link || !polygon.isConnected) return false;
                    const a = pin.getBoundingClientRect(), b = polygon.getBoundingClientRect();
                    const dx = Math.max(b.left-a.right, a.left-b.right, 0), dy = Math.max(b.top-a.bottom, a.top-b.bottom, 0);
                    return Math.hypot(dx, dy) < 35;
                });
            })'''), 'Every landslide marker must correspond to a nearby visible yellow extent'
            assert page.locator('.road-closure-sign.is-landslide').evaluate_all('''pins => {
                const map = document.querySelector('.citizen-map').getBoundingClientRect();
                const sheet = document.querySelector('.citizen-map-summary').getBoundingClientRect();
                return pins.every(pin => { const r = pin.getBoundingClientRect();
                    return r.left >= map.left && r.right <= map.right && r.top >= map.top && r.bottom <= sheet.top;
                });
            }'''), 'Northern landslides must be in view above the summary'
            if captures:
                page.screenshot(path=str(captures / f'resident-northern-comparison-{width}.png'))
        page.set_viewport_size({'width': 390, 'height': 844})
        page.locator('.road-closure-sign.is-landslide').first.click()
        expect(page.locator('.citizen-map-summary')).to_contain_text('Bị chặn do sạt lở. Không đi qua.')
        page.get_by_role('button', name='Đóng đoạn đường', exact=True).click()
        expect(page.locator('.citizen-map-summary')).to_contain_text('Đường nên đi')
        # A route choice has the same name on the map and in directions.
        alternative = page.locator('.resident-route-alternative-label button').first
        expect(alternative).to_be_visible()
        alternative.click()
        expect(page.locator('.citizen-map-summary')).to_contain_text('Đường bạn chọn')
        nav.get_by_role('button', name='Thông tin đường', exact=True).click()
        expect(directions.locator('.citizen-direction-verdict')).to_have_text('Đường bạn chọn')
        directions.get_by_role('button', name='Xem trên bản đồ', exact=True).click()
        expect(page.locator('.citizen-map-summary')).to_contain_text('Đường bạn chọn')
        # Road selection and polygon selection replace each other. Closing the
        # polygon must return to the route, without resurrecting a stale road card.
        sign = page.locator('.road-closure-sign.is-landslide').first
        area_id = sign.get_attribute('data-landslide-area')
        sign.click()
        expect(page.locator('.citizen-map-summary')).to_contain_text('Bị chặn do sạt lở')
        page.locator(f'.landslide-area[data-landslide-area="{area_id}"]').first.dispatch_event('click')
        expect(page.locator('.citizen-place')).to_contain_text('Bị chặn')
        expect(page.locator('.citizen-map-summary')).to_have_count(0)
        page.locator('.citizen-place').get_by_role('button', name='Đóng', exact=True).click()
        expect(page.locator('.citizen-map-summary')).to_contain_text('Đường bạn chọn')
        layers.locator('summary').click()
        # Hiding yellow geometry never moves the road warning or changes advice.
        page.wait_for_timeout(650)
        warning_positions = page.locator('.road-closure-sign').evaluate_all('nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.roadId,n.style.transform]))')
        layers.get_by_label('Vùng và điểm sạt lở', exact=True).uncheck()
        expect(page.locator('.resident-road-area-link')).to_have_count(0)
        expect(page.locator('.map-context-landslide,.landslide-area')).to_have_count(0)
        assert page.locator('.road-closure-sign').evaluate_all('nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.roadId,n.style.transform]))') == warning_positions
        layers.get_by_label('Vùng và điểm sạt lở', exact=True).check()
        expect(page.locator('.resident-road-area-link')).to_have_count(16)
        layers.get_by_label('Tình trạng đường', exact=True).uncheck()
        expect(page.locator('.resident-blocked-comparison')).to_have_count(0)
        expect(page.locator('.road-closure-sign')).to_have_count(0)
        expect(page.locator('.citizen-comparison-legend')).not_to_contain_text('Bị chặn')
        layers.get_by_label('Tình trạng đường', exact=True).check()
        layers.locator('summary').click()
        expect(page.locator('.resident-blocked-comparison')).to_have_count(1)
        expect(page.locator('.map-scale')).not_to_be_visible()
        expect(page.locator('.map-source-button')).not_to_be_visible()
        nav.get_by_role('button', name='Thông tin đường', exact=True).click()
        selects.nth(0).select_option(label='Bản B')
        directions.get_by_role('button', name='Xem trên bản đồ', exact=True).click()
        for width in [320,390]:
            page.set_viewport_size({'width':width, 'height':844})
            page.get_by_role('button', name='Vừa bản đồ', exact=True).click()
            page.wait_for_timeout(700)
            assert_clear_symbols()
            if captures:
                page.screenshot(path=str(captures / f'resident-b-c-{width}.png'))
        page.set_viewport_size({'width':390,'height':844})
        nav.get_by_role("button", name="Thông tin đường", exact=True).click()
        page.locator(".citizen-local-places button").first.click()
        expect(page.locator(".citizen-map-summary")).to_contain_text("Tìm đường đến đây")
        page.get_by_role("button", name="Tìm đường đến đây", exact=True).click()
        expect(page.locator(".citizen-directions select").nth(1)).not_to_have_value("")
        nav.get_by_role("button", name="Gửi ghi nhận", exact=True).click()
        expect(page.locator(".citizen-report-form")).to_be_visible()
        page.locator(".citizen-report-form textarea").first.fill("Draft survives map navigation")
        nav.get_by_role("button", name="Bản đồ", exact=True).click()
        nav.get_by_role("button", name="Gửi ghi nhận", exact=True).click()
        expect(page.locator(".citizen-report-form textarea").first).to_have_value("Draft survives map navigation")
        nav.get_by_role("button", name="Thông tin đường", exact=True).click()
        page.get_by_role("button", name="Đường về thôn, bản", exact=True).click()
        expect(page.locator(".citizen-route")).to_be_visible()
        page.locator(".citizen-route-map").click()
        expect(page.locator(".resident-route-endpoint")).to_have_count(2)
        page.get_by_role("button", name="Chuyển sang tiếng Anh", exact=True).click()
        page.set_viewport_size({"width": 320, "height": 700})
        expect(nav.get_by_role("button", name="Map", exact=True)).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        page.get_by_role("button", name="Switch to Vietnamese", exact=True).click()
        # A failed optional network can be retried without losing the resident session.
        page.route("**/local-network.json", lambda route: route.fulfill(status=503, body="Unavailable"))
        page.reload()
        expect(page.locator(".citizen-map-summary")).to_contain_text("Chưa tải được đường")
        page.unroute("**/local-network.json")
        page.get_by_role("button", name="Thử lại", exact=True).click()
        expect(page.locator(".citizen-map-summary [role=alert]")).to_have_count(0)
        # An unchecked-only alternative remains blue with a caution; a blocked
        # network must remove the previous route rather than retain stale advice.
        for road_status in ['uncertain', 'blocked']:
            def with_status(route):
                response = route.fetch()
                data = response.json()
                for road in data['roads']:
                    if road['status'] != 'blocked':
                        road['status'] = road_status
                route.fulfill(response=response, json=data)
            page.route('**/local-network.json', with_status)
            page.reload()
            nav.get_by_role('button', name='Thông tin đường', exact=True).click()
            selects = page.locator('.citizen-directions select')
            expect(selects.nth(0).locator('option').filter(has_text='Bản A')).to_have_count(1)
            selects.nth(0).select_option(label='Bản A')
            selects.nth(1).select_option(label='Bản C')
            if road_status == 'uncertain':
                expect(page.locator('.citizen-direction-result')).to_contain_text('Có nguy cơ sạt lở')
                page.get_by_role('button', name='Xem trên bản đồ', exact=True).click()
                expect(page.locator('.citizen-route-status')).to_contain_text('Hỏi lại trước khi đi')
                expect(page.locator('.map-road-route-line').first).to_have_attribute('stroke', '#2f80ed')
                if captures:
                    page.wait_for_timeout(650)
                    page.screenshot(path=str(captures / 'resident-caution-route.png'))
            else:
                expect(page.locator('.citizen-direction-result')).to_contain_text('đang bị chặn')
                nav.get_by_role('button', name='Bản đồ', exact=True).click()
                expect(page.locator('.map-road-route-line')).to_have_count(0)
                expect(page.locator('.citizen-map-summary')).to_contain_text('Chưa tìm được đường đi')
            page.unroute('**/local-network.json', with_status)
        # Coincident places use a normal place symbol and an accessible picker,
        # never a numbered bubble or a displaced location.
        def coincident_places(route):
            response = route.fetch()
            data = response.json()
            place = next(item for item in data['places'] if item['name']=='Village B')
            data['places'].append({**place, 'id':'overlap-place', 'name':'Điểm gần bản'})
            route.fulfill(response=response, json=data)
        page.route('**/local-network.json', coincident_places)
        page.reload()
        expect(page.locator('.map-marker-layer[data-presentation=places]')).to_be_visible()
        point = page.locator('.map-pin[data-map-object="community:overlap-place"]')
        expect(point).to_be_visible()
        expect(page.locator('.map-pin.is-cluster,.map-pin.has-overlap')).to_have_count(0)
        point.click()
        chooser = page.get_by_role('dialog', name='Chọn đối tượng', exact=True)
        expect(chooser).to_contain_text('Bản B')
        expect(chooser).to_contain_text('Điểm gần bản')
        chooser.get_by_role('button', name='Bản B', exact=True).click()
        expect(page.locator('.citizen-map-summary')).to_contain_text('Bản B')
        page.unroute('**/local-network.json', coincident_places)
        # A potential landslide has its own amber signal and does not claim a closure.
        def with_risk(route):
            response = route.fetch()
            data = response.json()
            road = next(item for item in data['roads'] if item['id']=='local-4-2')
            road.update(status='uncertain', hz='landslide-risk')
            route.fulfill(response=response, json=data)
        page.route('**/local-network.json', with_risk)
        page.reload()
        expect(page.locator('.road-risk-sign[data-road-id="local-4-2"]')).to_be_attached()
        assert page.locator('.road-risk-sign').count() > 1
        expect(page.locator('.citizen-comparison-legend')).to_contain_text('Có nguy cơ')
        assert page.locator('.road-risk-sign svg').first.evaluate('svg=>!!svg.querySelector("path") && !svg.querySelector("rect")')
        page.wait_for_timeout(650)
        page.locator('.road-risk-sign[data-road-id="local-4-2"]').click()
        expect(page.locator('.citizen-map-summary')).to_contain_text('Có nguy cơ sạt lở, cần hỏi lại trước khi đi.')
        page.unroute('**/local-network.json', with_risk)
        page.get_by_role('button', name='Tài khoản', exact=True).click()
        page.get_by_role('button', name='Đổi vai trò', exact=True).click()
        expect(page.get_by_role('button', name='Vào ứng dụng', exact=True)).to_be_visible()
        assert not re.search(r'demo|mô phỏng', page.locator('.demo-signin').inner_text(), re.I)
        assert not errors, errors
        browser.close()
    print("Resident navigation passed: map chrome, layers, 320–760 px themes, local A–B routes, places and draft preservation.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:5347")
    parser.add_argument("--chrome")
    parser.add_argument("--captures", type=Path)
    args = parser.parse_args()
    run(args.url.rstrip("/"), args.chrome, args.captures)
