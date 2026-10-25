"""Check real survey/extent evidence, shared label placement and imagery selection recovery."""
from browser_preferences import use_vietnamese
import argparse
from urllib.parse import quote
from pathlib import Path
from playwright.sync_api import sync_playwright, expect


def run(url, chrome, captures=None):
    if captures:
        captures.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, **({"executable_path":chrome} if chrome else {}))
        page = use_vietnamese(browser.new_page(viewport={"width": 1440, "height": 960}))
        errors = []
        failed_requests = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("requestfailed", lambda request: failed_requests.append((request.url, request.failure)))
        page.route("**/*", lambda route: route.continue_() if route.request.url.startswith(url + "/") else route.abort())
        page.goto(url + "/?map=2d&offline=1&demoRole=manager")
        expect(page.locator(".incident-overview-heading")).to_be_visible(timeout=30000)
        page.wait_for_function('JSON.parse(localStorage.getItem("dear.gis.v2") || "{}").records?.some(r=>r.feature.properties.sourceName==="Talus 3")')
        area_id = page.evaluate('JSON.parse(localStorage.getItem("dear.gis.v2")).records.find(r=>r.feature.properties.sourceName==="Talus 3").id')
        page.goto(url + "/?map=2d&offline=1&demoRole=manager&gisPoint=" + quote(area_id))
        detail = page.locator("#response-details")
        expect(detail.locator("h2")).to_have_text("Vùng tích tụ vật liệu 3", timeout=30000)
        footer=detail.locator('footer');expect(footer).to_be_visible()
        buttons=footer.get_by_role('button').all()
        if len(buttons)>1:
            first,second=buttons[0].bounding_box(),buttons[1].bounding_box()
            assert first['x']+first['width']+6<=second['x'] or first['y']+first['height']+6<=second['y'],(first,second)

        expect(detail.locator(".field-photo-strip-grid button")).to_have_count(4)
        expect(detail.locator(".field-photo-strip")).to_contain_text("Scar 3 [0926]")
        expect(detail.locator(".field-photo-strip")).to_contain_text("08/10/2026")
        try:
            expect(page.locator('img[alt="Ảnh phân tích"]')).to_be_visible(timeout=30000)
        except AssertionError:
            if captures:
                page.screenshot(path=str(captures / "analysis-load-failure.png"))
            print({'imageryStatus': page.locator('.analysis-load-status').all_text_contents(),
                   'images': page.locator('img').evaluate_all('images=>images.filter(i=>!i.classList.contains("leaflet-tile")).map(i=>({alt:i.alt,src:i.currentSrc,complete:i.complete,width:i.naturalWidth}))'),
                   'failedRequests': failed_requests, 'errors': errors}, flush=True)
            raise
        # Photographs lead; the following measure card retains a real gap.
        assert detail.locator(".field-photo-strip").evaluate('(el)=>el.nextElementSibling.getBoundingClientRect().top-el.getBoundingClientRect().bottom') >= 10

        def clear_label(selector):
            page.wait_for_function("""selector=>{
              const label=document.querySelector(selector);
              if(!label||label.hidden||getComputedStyle(label).visibility==='hidden')return false;
              const a=label.getBoundingClientRect();
              return a.width>0 && [...document.querySelectorAll('.map-pin,.map-pin-label,#response-details')].every(el=>{
                if(el.hidden||getComputedStyle(el).visibility==='hidden'||getComputedStyle(el).display==='none')return true;
                const b=el.getBoundingClientRect();
                return !b.width||!b.height||a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom;
              });
            }""", arg=selector, timeout=30000)

        expect(detail.locator(".field-map-card-body > .field-photo-strip:first-child")).to_be_visible()
        detail.get_by_role("button",name="Đối chiếu ảnh",exact=True).click()
        comparison=page.get_by_role("dialog",name="Đối chiếu vùng sạt trên ảnh",exact=True)
        expect(comparison).to_be_visible()
        expect(comparison.get_by_role("status")).to_have_count(0,timeout=30000)
        expect(comparison.locator('img[alt="Ảnh Planet gốc"]')).to_have_count(2)
        # Tone matching belongs to the new context basemap; the two comparison
        # scenes and their ancestor panes must retain their original pixel colours.
        expect(comparison.locator('.leaflet-tile-pane > .leaflet-layer')).to_have_count(1)
        assert comparison.locator('img[alt="Ảnh Planet gốc"]').evaluate_all('''images=>images.every(image=>{
            for(let node=image;node&&node.closest('.prepared-comparison-map');node=node.parentElement){
                if(getComputedStyle(node).filter!=='none')return false;
            }
            return true;
        })''')
        comparison.get_by_role("slider",name="Vị trí so ảnh",exact=True).fill("35")
        assert comparison.locator(".leaflet-comparison-before-pane").evaluate('el=>el.style.clip')
        assert comparison.locator(".leaflet-comparison-after-pane").evaluate('el=>el.style.clip')
        if captures:page.screenshot(path=str(captures / "original-planet-comparison.png"))
        comparison.get_by_role("button",name="Đóng",exact=True).click()
        clear_label(".leaflet-tooltip:has(.landslide-map-label)")
        if captures:
            page.screenshot(path=str(captures / "mapped-area-2d.png"))
        page.get_by_role("button", name="Chuyển sang 3D", exact=True).click()
        expect(page.locator("canvas.terrain-canvas")).to_be_visible(timeout=30000)
        clear_label(".terrain-area-label")
        expect(page.locator(".analysis-load-status")).to_have_count(0, timeout=30000)
        if captures:
            page.screenshot(path=str(captures / "mapped-area-3d.png"))
        page.get_by_role("button", name="Chuyển sang 2D", exact=True).click()
        expect(page.locator('img[alt="Ảnh phân tích"]')).to_be_visible(timeout=30000)

        page.locator('.incident-landslide-row[data-map-preview^="hazard:"]').first.click()
        expect(detail.locator(".hazard-detail > .field-photo-strip:first-child")).to_be_visible()
        expect(detail.locator(".hazard-basis")).not_to_have_attribute("open","")
        if captures:page.screenshot(path=str(captures / "hazard-photo-first.png"))
        page.locator(".workspace-nav").get_by_role("button", name="Đường sá", exact=True).click()
        page.locator("#response-panel .impact-row").first.click()
        title = detail.locator("h1").inner_text()
        page.locator('[data-road-filter="blocked"]').click()
        expect(detail.locator("h1")).to_have_text(title)
        expect(page.locator("#response-panel .decision-tabs")).to_be_visible()
        edit = detail.get_by_role("button", name="Cập nhật tình trạng", exact=True)
        edit.click()
        expect(edit).to_be_visible()
        expect(edit).to_have_attribute("aria-expanded", "true")
        expect(detail.get_by_role("button", name="Mặt cắt địa hình", exact=True)).to_be_visible()
        detail.get_by_role("button", name="Hủy", exact=True).click()
        expect(edit).to_have_attribute("aria-expanded", "false")
        linked_rows=detail.locator(".object-row").count()
        edit.click()
        expect(detail.locator(".object-row")).to_have_count(linked_rows)
        radios=detail.locator('.road-status-switch input[type="radio"]')
        for index in range(radios.count()):
            if not radios.nth(index).is_checked():
                radios.nth(index).check()
                break
        expect(detail.get_by_label("Ghi chú",exact=True)).to_be_hidden()
        detail.get_by_role("button",name="Lưu",exact=True).click()
        expect(detail.locator("h1")).to_have_text(title)
        expect(edit).to_have_attribute("aria-expanded","false")
        expect(detail.get_by_role("button",name="Mặt cắt địa hình",exact=True)).to_be_visible()
        page.locator("#response-panel .decision-tabs").get_by_role("button", name="Điểm ảnh hưởng", exact=True).click()
        expect(page.locator('[data-road-filter="blocked"]')).to_be_visible()

        page.get_by_role("button", name="Lớp bản đồ", exact=True).click()
        panel = page.locator(".layers-panel")
        expect(panel.locator(".layer-analysis")).to_have_attribute("open", "")
        panel.get_by_role("radio", name="Tắt ảnh phủ", exact=True).check()
        expect(page.locator('img[alt="Ảnh phân tích"]')).to_have_count(0)
        panel.get_by_role("button", name="Khôi phục hiển thị mặc định", exact=True).click()
        expect(panel.locator('.analysis-imagery input[type="radio"]:checked')).not_to_have_count(0)
        expect(page.locator('img[alt="Ảnh phân tích"]')).to_be_visible(timeout=30000)
        # A new browser context has no in-memory imagery cache: exercise real failed requests.
        recovery = use_vietnamese(browser.new_page(viewport={"width":1440,"height":960}))
        recovery.on("pageerror",lambda error:errors.append(str(error)))
        failures={"catalog":True,"raster":True}
        def network(route):
            request=route.request.url
            if not request.startswith(url + "/"):
                route.abort()
            elif request.endswith("/imagery/imagery.json") and failures["catalog"]:
                route.abort()
            elif request.endswith("/planet-post-mosaic.web.webp") and failures["raster"]:
                route.abort()
            else:
                route.continue_()
        recovery.route("**/*",network)
        recovery.goto(url + "/?map=2d&offline=1&demoRole=manager")
        expect(recovery.locator(".incident-overview-heading")).to_be_visible(timeout=30000)
        recovery.get_by_role("button",name="Lớp bản đồ",exact=True).click()
        catalog_status=recovery.locator(".layer-analysis [role=status]")
        expect(catalog_status).to_contain_text("Chưa tải được danh sách ảnh",timeout=30000)
        failures["catalog"]=False
        catalog_status.get_by_role("button",name="Thử lại",exact=True).click()
        expect(recovery.locator(".analysis-load-status")).to_contain_text("Chưa tải được lớp ảnh",timeout=30000)
        recovery.get_by_role("button",name="Đóng lớp bản đồ",exact=True).click()
        failures["raster"]=False
        recovery.locator(".analysis-load-status").get_by_role("button",name="Thử lại",exact=True).click()
        expect(recovery.locator('img[alt="Ảnh phân tích"]')).to_be_visible(timeout=30000)
        expect(recovery.locator(".analysis-load-status")).to_have_count(0)
        # The 3D drape uses a separate projected raster; verify its failure is recoverable too.
        failures["terrain"]=True
        recovery.route("**/planet-post-mosaic.utm.webp",lambda route:route.abort() if failures["terrain"] else route.continue_())
        recovery.get_by_role("button",name="Chuyển sang 3D",exact=True).click()
        expect(recovery.locator(".analysis-load-status")).to_contain_text("Chưa tải được lớp ảnh",timeout=30000)
        failures["terrain"]=False
        recovery.locator(".analysis-load-status").get_by_role("button",name="Thử lại",exact=True).click()
        expect(recovery.locator(".analysis-load-status")).to_have_count(0,timeout=30000)
        # Photo loading failures stay actionable; opening a full image must not reject unhandled.
        photo_failure={"thumb":True,"image":True}
        recovery.route("**/*.thumb.webp",lambda route:route.abort() if photo_failure["thumb"] else route.continue_())
        recovery.route("**/*.image.webp",lambda route:route.abort() if photo_failure["image"] else route.continue_())
        recovery.locator('.incident-landslide-row[data-map-preview^="hazard:"]').first.click()
        strip=recovery.locator("#response-details .field-photo-strip")
        expect(strip.get_by_role("status")).to_contain_text("Chưa tải được ảnh",timeout=30000)
        photo_failure["thumb"]=False
        strip.get_by_role("button",name="Thử lại",exact=True).click()
        expect(strip.locator(".field-photo-strip-grid img")).to_have_count(4,timeout=30000)
        strip.locator(".field-photo-strip-grid button").first.click()
        expect(strip.get_by_role("status")).to_contain_text("Chưa tải được ảnh",timeout=30000)
        photo_failure["image"]=False
        strip.get_by_role("button",name="Thử lại",exact=True).click()
        strip.locator(".field-photo-strip-grid button").first.click()
        expect(recovery.locator(".photo-lightbox")).to_be_visible(timeout=30000)
        assert not errors, errors
        browser.close()
        print("Cartographic evidence passed: real survey photos, 2D/3D label separation, retained road context, Planet reset and failed imagery request recovery.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:5381")
    parser.add_argument("--chrome")
    parser.add_argument("--captures", type=Path)
    args = parser.parse_args()
    run(args.url.rstrip("/"), args.chrome, args.captures)
