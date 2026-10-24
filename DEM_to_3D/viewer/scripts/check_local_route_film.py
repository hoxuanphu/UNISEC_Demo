"""Check shared yellow polygon context and the wide 3D A-B film/timeline.

Normal runs block Internet and use the packaged local map. --fixture replaces
external imagery only for Linux CI; terrain and route geometry stay unchanged.
"""
import argparse
import json
from pathlib import Path
import struct
import zlib
from playwright.sync_api import sync_playwright, expect


def fixture_tile():
    def chunk(kind,data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    pixels=b''.join(b'\x00'+bytes((42+y//5,67+y//8,48+y//7))*256 for y in range(256))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',256,256,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(pixels))+chunk(b'IEND',b'')


def run(url,chrome=None,fixture=False,output=None,captures=None):
    if captures:captures.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,**({'executable_path':chrome} if chrome else {}))
        # CI uses a software GPU; keep the same 3D path at a normal laptop viewport.
        context=browser.new_context(viewport={'width':960 if fixture else 1600,'height':640 if fixture else 950},accept_downloads=True)
        context.add_init_script('Object.defineProperty(navigator,"onLine",{configurable:true,get:()=>false})')
        page=context.new_page();errors=[];remote=[]
        if fixture:page.set_default_timeout(60000)
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' and any(word in msg.text for word in ['Shader Error','THREE.WebGLProgram','CONTEXT_LOST_WEBGL']) else None)
        def intercept(route):
            address=route.request.url
            if address.startswith(url+'/'):route.continue_()
            elif fixture and '/World_Imagery/MapServer/tile/' in address:route.fulfill(content_type='image/png',body=fixture_tile())
            else:remote.append(address);route.abort()
        page.route('**/*',intercept)
        page.goto(url+'/?workspace=routes')
        play=page.get_by_role('button',name='Play journey',exact=True)
        expect(play).to_be_enabled(timeout=60000)
        expect(page.locator('canvas.terrain-canvas')).to_be_visible()
        expect(page.locator('.map-context-point')).to_have_count(0)
        origin=page.get_by_role('combobox',name='Origin',exact=True)
        destination=page.get_by_role('combobox',name='Destination',exact=True)
        expect(origin).to_have_value('place-23');expect(destination).to_have_value('place-25')
        origin.select_option('place-24')
        expect(page.locator('.route-film-result')).to_contain_text('Landslide risk')
        expect(page.locator('.route-film-legend')).to_contain_text('Difficult but possible')
        detour=page.locator('.route-film-result strong').inner_text()
        avoid=page.get_by_role('checkbox',name='Avoid blocked roads',exact=True)
        avoid.uncheck();expect(page.locator('.route-film-result')).to_contain_text('Road blocked. Do not cross.')
        baseline=page.locator('.route-film-result strong').inner_text()
        assert float(detour.split()[0])>float(baseline.split()[0]),(detour,baseline)
        avoid.check();expect(play).to_be_enabled()
        stops=page.locator('.route-film-stops button')
        assert 1<=stops.count()<=3
        stops.first.click()
        card=page.get_by_role('complementary',name='Landslide area',exact=True)
        expect(card.locator('img')).to_be_visible(timeout=20000)
        expect(card).to_contain_text('not evidence of conditions')
        page.get_by_role('button',name='Close landslide area',exact=True).click()
        page.get_by_role('button',name='Pick on map A',exact=True).click()
        page.keyboard.press('Escape')
        expect(page.get_by_role('button',name='Pick on map A',exact=True)).to_have_attribute('aria-pressed','false')
        if captures:page.screenshot(path=str(captures/'local-3d-ready.png'))
        # Playback reuses the corridor timeline. It remains visible when idle,
        # supports seeking/rates, and the final pose includes the whole network.
        play.click()
        pause=page.get_by_role('button',name='Pause',exact=True)
        expect(pause).to_be_visible(timeout=60000);expect(origin).to_be_disabled()
        timeline=page.get_by_role('slider',name='Route playback position',exact=True)
        duration=float(timeline.get_attribute('max'))
        assert 20 <= duration <= 30, duration
        page.wait_for_timeout(2700)
        expect(timeline).to_be_visible()
        assert float(timeline.evaluate('el=>getComputedStyle(el.parentElement).opacity'))>.9
        # Software-rendered Linux frames can finish the clip before a separate
        # pointer action arrives. Pause in the browser task, then seek back;
        # seeking an ended clip also returns it to the paused state.
        page.evaluate("document.querySelector('.flyover-player button[aria-label=\"Pause\"]')?.click()")
        timeline.fill('0');expect(timeline).to_have_value('0')
        expect(page.get_by_role('button',name='Resume',exact=True)).to_be_visible()
        speed=page.get_by_role('combobox',name='Playback speed',exact=True)
        speed.select_option('1.25');expect(speed).to_have_value('1.25')
        speed.select_option('1')
        for time in [0,8,12,18,min(24.9,int(duration*10)/10)]:
            timeline.fill(str(time));expect(timeline).to_have_value(str(time))
            page.wait_for_timeout(120)
            if captures:page.screenshot(path=str(captures/f'local-3d-{time}.png'))
        if output:
            output.parent.mkdir(parents=True,exist_ok=True)
            with page.expect_download(timeout=240000) as download:
                page.get_by_role('button',name='Export MP4 video',exact=True).click()
            download.value.save_as(output)
            assert output.read_bytes()[4:8]==b'ftyp' and output.stat().st_size>100000
            page.route(url+'/__local-film.mp4',lambda route:route.fulfill(path=str(output),content_type='video/mp4'))
            decoded=page.evaluate('''async()=>{
                const src=URL.createObjectURL(await(await fetch('/__local-film.mp4')).blob()),video=document.createElement('video');video.muted=true;
                await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=reject;video.src=src;});
                const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const ctx=canvas.getContext('2d'),frames=[];
                for(const time of [.2,8,12,18,Math.min(24.8,video.duration-.2)]){
                    await new Promise(resolve=>{video.onseeked=resolve;video.currentTime=time;});
                    await new Promise(resolve=>{video.requestVideoFrameCallback(resolve);setTimeout(resolve,200);});
                    ctx.drawImage(video,0,0);const d=ctx.getImageData(0,0,1920,1080).data;let hash=2166136261,green=0,yellow=0,red=0;
                    for(let i=0;i<d.length;i+=16){hash=Math.imul(hash^d[i],16777619);if(d[i+1]>d[i]*1.04&&d[i+1]>d[i+2]*1.04&&d[i+1]>15)green++;if(d[i]>150&&d[i+1]>130&&d[i+2]<d[i+1]*.8)yellow++;if(d[i]>140&&d[i]>d[i+1]*1.25&&d[i]>d[i+2]*1.25)red++;}
                    frames.push({time,hash:hash>>>0,green,yellow,red});
                }
                const result={duration:video.duration,width:video.videoWidth,height:video.videoHeight,frames};URL.revokeObjectURL(src);return result;
            }''')
            assert abs(decoded['duration']-duration)<.1 and (decoded['width'],decoded['height'])==(1920,1080),decoded
            assert len(set(frame['hash'] for frame in decoded['frames']))>=4,decoded
            assert all(frame['green']>15000 for frame in decoded['frames']),decoded
            assert any(frame['yellow']>100 for frame in decoded['frames']),decoded
            assert any(frame['red']>30 for frame in decoded['frames']),decoded
            print('Decoded 3D film:',json.dumps(decoded))
        page.get_by_role('button',name='Exit 3D route view',exact=True).click()
        expect(play).to_be_visible()
        # All key controls remain reachable without horizontal page overflow.
        for width in [320,390,768,1440]:
            page.set_viewport_size({'width':width,'height':900})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
        page.set_viewport_size({'width':1600,'height':950})
        page.get_by_role('combobox',name='Language',exact=True).select_option('vi')
        expect(page.get_by_role('button',name='Phát hành trình',exact=True)).to_be_visible()
        # The same polygons appear on the coordination map, without installing
        # fake incident observations or centroid icons into the GIS workspace.
        page.goto(url+'/?map=2d&demoRole=manager&lang=en')
        expect(page.locator('.map-context-landslide').first).to_be_attached(timeout=30000)
        expect(page.locator('.map-context-point')).to_have_count(0)
        page.locator('.map-layer-launcher').click()
        page.get_by_role('button',name='Fit Chế Tạo local roads',exact=True).click()
        close=page.get_by_role('button',name='Close map layers',exact=True)
        if close.is_visible():close.click()
        page.wait_for_timeout(700)
        # Click a visible interior, not an outline underneath a road hit target.
        chosen=page.locator('.map-context-landslide').evaluate_all('''polygons => {
            for (const polygon of polygons) {
                const bounds=polygon.getBoundingClientRect(), matrix=polygon.getScreenCTM();
                if (!matrix) continue;
                const inverse=matrix.inverse();
                for (let ix=1;ix<12;ix++) for (let iy=1;iy<12;iy++) {
                    const x=bounds.left+bounds.width*ix/12, y=bounds.top+bounds.height*iy/12;
                    if (x<460 || x>1350 || y<140 || y>800) continue;
                    if (polygon.isPointInFill(new DOMPoint(x,y).matrixTransform(inverse)) && document.elementFromPoint(x,y)===polygon) return {x,y};
                }
            }
            return null;
        }''')
        assert chosen,'No visible shared polygon on the main map'
        page.mouse.click(chosen['x'],chosen['y'])
        expect(page.locator('.local-area-card')).to_be_visible(timeout=10000)
        expect(page.locator('.local-area-card img')).to_be_visible()
        assert not errors,errors
        if not fixture:assert not remote,remote
        browser.close()
    print('Local 3D film passed: shared yellow polygons without icons, soft water, blocked detour, illustrative photos, timeline/seek/rate, complete overview, responsive EN/VI'+(', decoded MP4.' if output else '.'))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:5212');parser.add_argument('--chrome');parser.add_argument('--fixture',action='store_true')
    parser.add_argument('--output',type=Path);parser.add_argument('--captures',type=Path)
    args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.fixture,args.output,args.captures)
