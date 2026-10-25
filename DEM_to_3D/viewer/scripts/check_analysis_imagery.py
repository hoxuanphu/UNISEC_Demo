"""Real WebGL proof: north-up analysis pixels above online imagery, below vectors, on unchanged terrain."""
from browser_preferences import use_vietnamese
from gis_browser_actions import map_tool
import argparse
import re
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


def run(url, chrome, captures):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=chrome)
        page = use_vietnamese(browser.new_page(viewport={'width': 1440, 'height': 960}))
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        def route(request):
            if request.request.url == url + '/analysis-fixture':
                request.fulfill(content_type='text/html', body='<html><head><link rel="stylesheet" href="/src/styles/workspace.css"><link rel="stylesheet" href="/src/styles/map-symbols.css"></head><body style="margin:0"><div id="fixture"></div></body></html>')
            elif request.request.url.startswith(url + '/') or request.request.url.startswith('blob:'):
                request.continue_()
            else:
                request.abort()
        page.route('**/*', route)
        page.goto(url + '/analysis-fixture')
        await_fixture = """async () => {
          const THREE = await import('/node_modules/.vite/deps/three.js');
          const {createAnalysisDrape} = await import('/src/terrain/analysisImageryDrape.ts');
          const {createScreenMarkers} = await import('/src/terrain/screenMarkers.ts');
          const scene = new THREE.Scene();
          const root = new THREE.Group(); root.position.set(1000,0,2000); scene.add(root);
          const geometry = new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2).translate(50,0,-50);
          const baseMaterial = new THREE.MeshBasicMaterial({color:0x005500});
          const base = new THREE.Mesh(geometry,baseMaterial); root.add(base);
          const onlineMaterial = new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false,
            polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
          const online = new THREE.Mesh(geometry,onlineMaterial); online.renderOrder=2.5; root.add(online);
          const vector = new THREE.Mesh(new THREE.PlaneGeometry(100,6).rotateX(-Math.PI/2).translate(50,.1,-50),
            new THREE.MeshBasicMaterial({color:0xffff00,transparent:true,depthWrite:false}));
          vector.renderOrder=4; root.add(vector);
          const camera = new THREE.OrthographicCamera(-50,50,50,-50,1,1000);
          camera.position.set(1050,300,1950);camera.up.set(0,0,-1);camera.lookAt(1050,0,1950);
          const renderer = new THREE.WebGLRenderer({preserveDrawingBuffer:true,antialias:false});
          renderer.setSize(256,256);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
          document.getElementById('fixture').append(renderer.domElement);
          const render=()=>renderer.render(scene,camera);scene.updateMatrixWorld(true);
          const positions=[...geometry.getAttribute('position').array], uv=geometry.getAttribute('uv');
          let originalGeometryDisposed=false; geometry.addEventListener('dispose',()=>originalGeometryDisposed=true);
          const drape=createAnalysisDrape([{model:{metadata:{world_origin:{x:0,y:0}}},root,meshes:[base]}],4096,render);
          const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;
          const ctx=canvas.getContext('2d');
          for(const [x,y,color] of [[0,0,'#ff0000'],[8,0,'#00ff00'],[0,8,'#0000ff'],[8,8,'#ff00ff']]){
            ctx.fillStyle=color;ctx.fillRect(x,y,8,8);
          }
          const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',1));
          const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
          const sha256=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
          const asset={url:URL.createObjectURL(blob),byteLength:blob.size,sha256};
          const raster={terrain:{...asset,bounds:[0,0,100,100],width:16},web:{...asset,latLngBounds:[[0,0],[1,1]]}};
          const pixel=(x,y)=>{render();const out=new Uint8Array(4);const gl=renderer.getContext();
            gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,out);return [...out];};
          window.analysisFixture={pixel,render,drape,raster,root,geometry,base,baseMaterial,
            original:()=>geometry.getAttribute('uv')===uv && positions.every((n,i)=>n===geometry.getAttribute('position').array[i]) &&
              base.material===baseMaterial && !originalGeometryDisposed};
          drape.set([raster],1);
          const host=document.createElement('div');host.id='cluster-fixture';
          Object.assign(host.style,{position:'fixed',left:'300px',top:'20px',width:'600px',height:'400px'});
          document.body.append(host);
          let canExpand=true;
          const options={communities:[],hazards:[
            {id:'a',name:['Điểm sạt A','A'],projected:{x:250,y:220},kind:'landslide',observation:'reported'},
            {id:'b',name:['Điểm sạt B','B'],projected:{x:255,y:221},kind:'landslide',observation:'reported'}],
            layers:{landslide:true},locale:'vi',selectedCommunityId:null,selectedObjectId:null,
            onSelect:hit=>window.pickedPoint=hit,canExpandGroup:()=>canExpand,
            onExpandGroup:points=>{window.expandedPoints=points;canExpand=false;}};
          const pins=createScreenMarkers(host,options);window.clusterPins=pins;pins.update(p=>p);
        }"""
        page.evaluate(await_fixture)
        page.wait_for_function('analysisFixture.pixel(90,170)[0]>240 && analysisFixture.pixel(90,170)[1]<15')
        assert page.evaluate('analysisFixture.pixel(90,90)[2]') > 240, 'South-west must be blue, not a flipped north row'
        centre = page.evaluate('analysisFixture.pixel(128,128)')
        assert centre[0] > 240 and centre[1] > 240 and centre[2] < 15, centre
        assert page.evaluate('analysisFixture.original()'), 'Analysis changed original geometry, UVs or materials'
        if captures:
            captures.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(captures / 'analysis-webgl-fixture.png'))
        group = page.locator('#cluster-fixture .map-pin:visible')
        expect(group).to_have_count(1)
        expect(group).to_have_attribute('data-group-action','zoom')
        group.click()
        assert len(page.evaluate('expandedPoints')) == 2
        expect(page.locator('.map-object-chooser')).to_have_count(0)
        page.evaluate('clusterPins.update(p=>p)')
        group.click()
        chooser = page.get_by_role('dialog', name='Chọn đối tượng', exact=True)
        expect(chooser).to_be_visible()
        expect(chooser.locator('.map-object-choice')).to_have_count(2)
        chooser.locator('.map-object-choice').filter(has_text='Điểm sạt B').click()
        assert page.evaluate('pickedPoint.id') == 'b'
        page.evaluate('analysisFixture.drape.set([],1)')
        assert page.evaluate('analysisFixture.pixel(90,170).slice(0,3)') == [255,255,255]
        page.evaluate('analysisFixture.drape.dispose()')
        assert page.evaluate('analysisFixture.original()')
        # Actual prepared Planet imagery also stays selected through 3D/2D changes.
        page.goto(url+'/?offline=1&map=3d&demoRole=manager')
        canvas=page.locator('canvas.terrain-canvas')
        expect(canvas).to_be_visible(timeout=30000)
        page.wait_for_timeout(1000)
        before=canvas.screenshot()
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        panel=page.locator('.layers-panel')
        expect(panel.locator('.layer-analysis')).to_have_attribute('open','')
        panel.get_by_role('radio',name='Tắt ảnh phủ',exact=True).check()
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)
        assert canvas.screenshot()!=before, 'Disabling Planet did not change the 3D view'
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        panel.get_by_role('radio',name=re.compile('^PlanetScope sau mưa')).check()
        expect(panel.locator('.analysis-active-details .analysis-note')).to_contain_text('chi tiết gốc')
        page.keyboard.press('Escape')
        page.wait_for_timeout(1300)
        expect(panel).to_have_count(0)
        if captures:page.screenshot(path=str(captures/'planet-3d.png'))
        page.get_by_role('button',name='Chuyển sang 2D',exact=True).click()
        expect(page.locator('img[alt="Ảnh phân tích"]')).to_have_count(1,timeout=15000)
        page.wait_for_function("""[...document.querySelectorAll('img[alt="Ảnh phân tích"]')].every(i=>i.complete&&i.naturalWidth>0)""")
        latest=page.locator('img[alt="Ảnh phân tích"]').get_attribute('src')
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        panel.get_by_role('radio',name=re.compile('^PlanetScope đối chiếu')).check()
        expect(panel.locator('.analysis-active-details .analysis-note')).to_contain_text('2 dải')
        expect(panel.get_by_role('radio',name=re.compile('^PlanetScope đối chiếu'))).to_be_checked()
        page.keyboard.press('Escape')
        page.wait_for_function("previous=>{const image=document.querySelector('img[alt=\"Ảnh phân tích\"]');return image?.src!==previous&&image?.complete&&image?.naturalWidth>0;}",arg=latest)
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        panel.get_by_role('radio',name=re.compile('^PlanetScope sau mưa')).check()
        page.keyboard.press('Escape')
        map_tool(page, 'Dữ liệu GIS').click()
        workspace=page.locator('.geodata-workspace')
        workspace.locator('.geodata-task-nav').get_by_role('button',name='Vùng sạt lở',exact=True).click()
        workspace.locator('.landslide-area-list li button').first.click()
        workspace.get_by_role('button',name='Xem trên bản đồ ứng phó',exact=True).click()
        expect(page.locator('.field-map-card')).to_be_visible()
        page.wait_for_timeout(700)
        if captures:page.screenshot(path=str(captures/'planet-2d-alignment.png'))
        assert not errors, errors
        browser.close()
    print('Analysis WebGL passed: native orientation/placement, online-layer ordering, vectors above imagery, original terrain retained, cluster zoom then choose.')


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:5220')
    parser.add_argument('--chrome')
    parser.add_argument('--captures',type=Path)
    args=parser.parse_args()
    run(args.url.rstrip('/'),args.chrome,args.captures)
