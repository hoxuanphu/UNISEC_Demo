"""Workspace layout and semantic layer visibility in coordinator/resident maps."""
from browser_preferences import use_vietnamese
from gis_browser_actions import map_tool
import argparse
import copy
import json
from playwright.sync_api import expect, sync_playwright

STAMP = '2026-09-29T02:00:00Z'
VERSION = 'che-tao-2026-09-12-v0.3'


def fixture_records():
    area = dict(schema='landslide-area/v1', state='potential', part='source', review='unreviewed', reviewer='', reviewedAt='', sources=['field'], basis='Vùng kiểm thử có căn cứ thực địa.', observedAt=STAMP, imageReference='', imageResolutionM=None, boundaryAccuracyM=None, observationIds=[], networkVersion=VERSION, roadLinks=[], mappedAt=STAMP, updatedAt=STAMP)
    polygon = dict(type='Polygon', coordinates=[[[104.02,21.71],[104.035,21.71],[104.035,21.725],[104.02,21.71]]])
    def record(id, name, geometry, properties=None, visible=True):
        return dict(id=id, name=name, role='reference', visible=visible, source=dict(name='Browser fixture',format='drawing',importedAt=STAMP), feature=dict(type='Feature',geometry=geometry,properties=properties or {}))
    slope = record('slope','Vùng nguy cơ kiểm thử',polygon,{'dearLandslideArea':area})
    other = copy.deepcopy(slope);other['id']='other-network';other['feature']['properties']['dearLandslideArea']['networkVersion']='other'
    point = record('reference','Điểm tham chiếu',dict(type='Point',coordinates=[104.04,21.73]))
    hidden = record('hidden-owner','Ghi nhận đã ẩn',dict(type='Point',coordinates=[104.03,21.71]),visible=False)
    child = record('hidden-area','Vùng gắn ghi nhận đã ẩn',polygon,{'dearFieldArea':dict(schema='field-area/v1',observationId='hidden-owner',status='unreviewed',createdAt=STAMP)})
    return [slope,other,point,hidden,child]


def run(url, chrome):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, **({'executable_path':chrome} if chrome else {}))
        context = use_vietnamese(browser.new_context(viewport={'width':1280,'height':720}))
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url+'/') else r.abort())
        page = use_vietnamese(context.new_page());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url+'/?map=2d&offline=1&demoRole=manager')
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=30000)
        # Verify the shipped survey before isolating the semantic visibility fixture.
        survey=page.evaluate('JSON.parse(localStorage.getItem("dear.gis.v2"))')
        field=[r for r in survey['records'] if r['source']['format']=='KML']
        reference=[r for r in survey['records'] if r['source']['format']=='GeoJSON']
        assert len(field)==50
        assert len(reference)==0
        stations=[r for r in field if r['feature']['geometry']['type']=='Point']
        assert len(stations)==3
        assert any(r['feature']['geometry']['coordinates'][:2]==[104.0443985889399,21.78370568781054] for r in stations)
        assert len([r for r in field if r['feature']['geometry']['type']=='Polygon'])==47
        assert len([r for r in field if r['feature']['geometry']['type']=='Point'])==3
        assert len(survey['installedSources'])==1
        assert all(not r['feature']['properties'].get('dearLandslideArea',{}).get('roadLinks') for r in survey['records'])
        survey['records']=fixture_records()
        page.evaluate('(d)=>localStorage.setItem("dear.gis.v2",JSON.stringify(d))',survey)
        page.reload()
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=30000)
        expect(page.get_by_role('button',name='Trình chiếu',exact=True)).to_have_count(0)
        expect(page.locator('.assessment-timeline')).not_to_be_visible()
        page.get_by_role('button',name='Diễn biến sự kiện',exact=True).click()
        expect(page.locator('.assessment-timeline')).to_be_visible()
        assert page.locator('.sidebar').bounding_box()['x'] < page.locator('.map-area').bounding_box()['x']
        expect(page.locator('.landslide-area')).to_have_count(2)
        expect(page.locator('.map-reference-point')).to_have_count(1)
        # Select the polygon through an uncovered pixel. A road crossing its
        # centre correctly takes precedence at that centreline.
        point=page.locator('.landslide-area').last.evaluate('''node=>{
            const box=node.getBoundingClientRect();
            for(let y=box.top+3;y<box.bottom-3;y+=3)for(let x=box.left+3;x<box.right-3;x+=3)
                if(document.elementFromPoint(x,y)===node)return {x,y};
            return null;
        }''')
        assert point,'Polygon has no selectable pixel outside the road hit targets'
        page.mouse.click(point['x'],point['y'])
        card=page.get_by_role('region',name='Vùng sạt lở',exact=True)
        expect(card).to_be_visible()
        page.get_by_role('button',name='Ẩn bảng thông tin',exact=True).click()
        expect(card).to_be_hidden()
        page.get_by_role('button',name='Mở bảng thông tin',exact=True).click()
        expect(card).to_be_visible()
        map_tool(page, 'Đo trên bản đồ 2D').click()
        expect(card).to_be_hidden()
        expect(page.locator('#response-panel')).to_have_css('visibility','visible')
        map_tool(page, 'Đo trên bản đồ 2D').click()
        expect(card).to_be_visible()
        card.get_by_role('button',name='Đóng điểm GIS',exact=True).click()
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        layers=page.locator('.layers-panel')
        layers.locator('.layer-context > summary').click()
        layers.get_by_label('Dữ liệu tham chiếu',exact=True).uncheck()
        expect(page.locator('.landslide-area')).to_have_count(2)
        expect(page.locator('.map-reference-point')).to_have_count(0)
        layers.get_by_label('Sạt lở',exact=True).uncheck()
        expect(page.locator('.landslide-area')).to_have_count(0)
        expect(page.locator('.map-pin.landslide')).to_have_count(0)
        layers.get_by_label('Tình trạng đường',exact=True).uncheck()
        layers.get_by_label('Cầu, điểm vượt khe',exact=True).uncheck()
        expect(page.locator('.map-pin.bridge')).to_have_count(0)
        expect(page.locator('.map-pin.crossing')).to_have_count(0)
        page.keyboard.press('Escape')
        page.locator('.incident-landslide-row').first.click()
        expect(page.locator('.map-pin.landslide.is-selected')).to_have_count(1)
        if page.locator('.workspace').get_attribute('data-response-layout') == 'dock':
            expect(page.locator('#response-panel')).to_have_css('visibility','visible')
        page.get_by_role('button',name='Đóng chi tiết đối tượng',exact=True).click()
        page.locator('.workspace-nav').get_by_role('button',name='Địa bàn',exact=True).click()
        page.locator('#response-panel .community').first.click()
        expect(page.locator('#response-details')).to_contain_text('Chế Tạo')
        timeline=page.locator('.assessment-timeline')
        timeline.get_by_role('button',name='14:16 Nhận báo cáo',exact=True).click()
        page.keyboard.press('Escape')
        expect(timeline.locator('.assessment-pending')).to_be_visible()
        timeline.locator('.assessment-pending').click()
        page.get_by_role('dialog',name='Báo cáo hiện trường',exact=True).get_by_role('button',name='Cập nhật bản đồ',exact=True).click()
        expect(timeline.get_by_role('button',name='14:16 Cập nhật thực địa',exact=True)).to_have_attribute('aria-pressed','true')
        expect(page.locator('.route-travel-estimate')).to_have_count(0)
        timeline.get_by_role('button',name='14:02 Đánh giá ban đầu',exact=True).click()
        expect(page.locator('.revision-notice')).to_be_visible()
        expect(page.locator('.landslide-area')).to_have_count(0)
        timeline.get_by_role('button',name='14:16 Cập nhật thực địa',exact=True).click()
        for width in [1440,390,320]:
            page.set_viewport_size({'width':width,'height':844})
            page.wait_for_function('document.documentElement.scrollWidth<=innerWidth')
        # The same published areas appear for residents; unrelated imported reference points do not.
        page.evaluate('localStorage.setItem("dear.demo-session.v1",JSON.stringify({id:"resident",role:"resident",name:"Người xem",communityId:null}))')
        page.goto(url+'/?map=2d&offline=1')
        expect(page.locator('.citizen-workspace')).to_be_visible(timeout=30000)
        page.get_by_role('button',name='Bản đồ',exact=True).click()
        expect(page.locator('.landslide-area')).to_have_count(2)
        expect(page.locator('.map-reference-point')).to_have_count(0)
        # Inspect the published village route separately from the local A/B map.
        nav=page.locator('.citizen-mobile-switch')
        nav.get_by_role('button',name='Thông tin đường',exact=True).click()
        page.get_by_role('button',name='Đường về thôn, bản',exact=True).click()
        nav.get_by_role('button',name='Bản đồ',exact=True).click()
        # All access sections are blocked after the accepted field report. A
        # resident must never see that corridor as a blue suggested route.
        expect(page.locator('.map-road-route-line')).to_have_count(0)
        blocked=page.locator('.map-road-network-line[data-road-status="blocked"]')
        expect(blocked.first).to_be_attached()
        assert blocked.evaluate_all('nodes=>nodes.every(n=>n.getAttribute("stroke")==="#d96552")')
        page.locator('.citizen-map-layers summary').click()
        page.get_by_label('Vùng và điểm sạt lở',exact=True).uncheck()
        expect(page.locator('.landslide-area')).to_have_count(0)
        expect(page.locator('.map-pin.landslide')).to_have_count(0)
        page.get_by_label('Vùng và điểm sạt lở',exact=True).check()
        expect(page.locator('.landslide-area')).to_have_count(2)
        assert not errors,errors
        browser.close()
    print('Workspace layers passed: context/detail panels, recorded assessments, explicit report update, historical map, mobile layout and shared resident/coordinator layers.')


if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:5377');a.add_argument('--chrome');args=a.parse_args()
    run(args.url.rstrip('/'),args.chrome)
