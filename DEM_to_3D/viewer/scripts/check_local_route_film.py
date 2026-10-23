"""Fixed-scale Chế Tạo A–B planning/movie check, with optional real MP4 export.

Without --fixture this exercises the actual bundled offline map, with all remote
requests blocked. --fixture supplies only deterministic satellite tiles for CI;
road geometry, routing, selection and movie drawing still use the shipped data.
"""
import argparse
import json
from pathlib import Path
import struct
import zlib
from playwright.sync_api import sync_playwright, expect


def fixture_tile():
    def chunk(kind, data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    pixels=b''.join(b'\x00'+bytes((42+y//5,67+y//8,48+y//7))*256 for y in range(256))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',256,256,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(pixels))+chunk(b'IEND',b'')


def run(url, chrome=None, fixture=False, output=None, captures=None):
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,**({'executable_path':chrome} if chrome else {}))
        context=browser.new_context(viewport={'width':1600,'height':950},accept_downloads=True)
        context.add_init_script('Object.defineProperty(navigator,"onLine",{configurable:true,get:()=>false})')
        page=context.new_page(); errors=[];remote=[];fault={"next":False}
        page.on('pageerror',lambda e:errors.append(str(e)))
        def intercept(route):
            address=route.request.url
            if fault['next'] and ('/offline-map/imagery/' in address or '/World_Imagery/MapServer/tile/' in address):
                fault['next']=False;route.fulfill(status=503,body='temporary tile fault')
            elif address.startswith(url+'/'):route.continue_()
            elif fixture and '/World_Imagery/MapServer/tile/' in address:route.fulfill(content_type='image/png',body=fixture_tile())
            else:remote.append(address);route.abort()
        page.route('**/*',intercept)
        page.goto(url+'/?workspace=routes')
        play=page.get_by_role('button',name='Play journey',exact=True)
        expect(play).to_be_enabled(timeout=60000)
        origin=page.get_by_role('combobox',name='Origin',exact=True)
        end=page.get_by_role('combobox',name='Destination',exact=True)
        expect(origin).to_have_value('place-23');expect(end).to_have_value('place-25')
        origin.select_option('place-24')
        expect(play).to_be_enabled(timeout=60000)
        detour=page.locator('.route-film-result strong').inner_text()
        avoid=page.get_by_role('checkbox',name='Avoid blocked roads',exact=True)
        avoid.uncheck();expect(page.locator('.route-film-result')).to_contain_text('Includes a blocked road')
        baseline=page.locator('.route-film-result strong').inner_text()
        assert float(detour.split()[0])>float(baseline.split()[0]),(detour,baseline)
        avoid.check();expect(play).to_be_enabled(timeout=60000)
        play.click();expect(origin).to_be_disabled()
        page.wait_for_function("Number(document.querySelector('[aria-label=\"Film timeline\"]').value)>0.3")
        page.get_by_role('button',name='Pause',exact=True).click()
        timeline=page.get_by_role('slider',name='Film timeline',exact=True)
        def sample(time):
            timeline.fill(str(time))
            page.wait_for_function('(time)=>Number(document.querySelector("[aria-label=\\"Film timeline\\"]").value)===time',arg=time)
            page.wait_for_timeout(80)
            return page.locator('.route-film-stage canvas').evaluate('''canvas=>{
                const ctx=canvas.getContext('2d'),d=ctx.getImageData(0,0,canvas.width,canvas.height).data;
                let blue=0,red=0;for(let i=0;i<d.length;i+=4){if(d[i]===54&&d[i+1]===141&&d[i+2]===240)blue++;if(d[i]===239&&d[i+1]===101&&d[i+2]===89)red++;}
                const corners=[];for(let i=0;i<80;i++){const x=24+(i*431)%1800,y=100+(i*271)%800,k=(y*canvas.width+x)*4;corners.push(Array.from(d.slice(k,k+3)).join(','));}
                return {blue,red,corners,width:canvas.width,height:canvas.height};
            }''')
        first,middle,last=sample(0),sample(12),sample(25)
        assert first['blue']<middle['blue']<last['blue'],(first['blue'],middle['blue'],last['blue'])
        assert min(first['red'],middle['red'],last['red'])>50,'Blocked road disappeared'
        assert sum(a==b==c for a,b,c in zip(first['corners'],middle['corners'],last['corners']))>=74,'Map framing changed during film'
        assert (last['width'],last['height'])==(1920,1080)
        if captures:
            captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/'local-route-film.png'))
        page.get_by_role('button',name='Pick on map A',exact=True).click();page.keyboard.press('Escape')
        expect(page.get_by_role('button',name='Pick on map A',exact=True)).to_have_attribute('aria-pressed','false')
        # A failed tile must not export a half-empty map or reset the selected places.
        fault['next']=True
        page.get_by_role('button',name='Zoom in',exact=True).click()
        expect(page.get_by_role('alert')).to_contain_text('Map imagery unavailable.',timeout=60000)
        expect(page.get_by_role('button',name='Export MP4',exact=True)).to_be_disabled()
        page.get_by_role('button',name='Retry',exact=True).click()
        expect(play).to_be_enabled(timeout=60000)
        expect(origin).to_have_value('place-24');expect(end).to_have_value('place-25')
        page.get_by_role('button',name='Fit route',exact=True).click()
        expect(play).to_be_enabled(timeout=60000)
        page.get_by_role('button',name='Pick on map A',exact=True).click()
        page.locator('.route-film-stage canvas').click()
        expect(origin).to_have_value('map')
        origin.select_option('place-24');expect(play).to_be_enabled(timeout=60000)
        # The same canvas serves desktop and mobile; the canvas aspect is contained,
        # never stretched, and the page has no horizontal overflow.
        for width in (320,390,768,1440):
            page.set_viewport_size({'width':width,'height':900})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
        page.set_viewport_size({'width':1600,'height':950})
        page.get_by_role('combobox',name='Speed',exact=True).select_option('1.25')
        expect(page.locator('.route-film-playback output')).to_contain_text('/ 20 s')
        page.get_by_role('combobox',name='Speed',exact=True).select_option('1')
        if output:
            output.parent.mkdir(parents=True,exist_ok=True)
            with page.expect_download(timeout=240000) as download:
                page.get_by_role('button',name='Export MP4',exact=True).click()
            download.value.save_as(output)
            content=output.read_bytes();assert content[4:8]==b'ftyp' and len(content)>100000
            # Decode the actual MP4 via the browser video decoder, not just its header.
            page.route(url+'/__route-film.mp4',lambda route:route.fulfill(path=str(output),content_type='video/mp4'))
            decoded=page.evaluate('''async url=>{
                const video=document.createElement('video');video.muted=true;const blobUrl=URL.createObjectURL(await(await fetch(url)).blob());video.src=blobUrl;
                await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=reject;});
                const frames=[];for(const time of [.1,12,24.9]){
                    await new Promise((resolve,reject)=>{video.onseeked=resolve;video.onerror=reject;video.currentTime=time;});
                    await new Promise(resolve=>{video.requestVideoFrameCallback(resolve);setTimeout(resolve,200);});
                    const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const ctx=canvas.getContext('2d');ctx.drawImage(video,0,0);
                    const d=ctx.getImageData(0,0,1920,1080).data;let dark=0,bright=0,blue=0;
                    for(let i=0;i<d.length;i+=16){if(d[i]+d[i+1]+d[i+2]>180)bright++;if(d[i]+d[i+1]+d[i+2]<30)dark++;if(d[i+2]>d[i]+40&&d[i+2]>d[i+1]+30)blue++;}
                    frames.push({dark,bright,blue});
                }
                const result={duration:video.duration,width:video.videoWidth,height:video.videoHeight,frames};video.removeAttribute('src');video.load();URL.revokeObjectURL(blobUrl);return result;
            }''',url+'/__route-film.mp4')
            assert abs(decoded['duration']-25)<.1 and (decoded['width'],decoded['height'])==(1920,1080),decoded
            assert all(frame['bright']>1000 for frame in decoded['frames']),decoded
            assert decoded['frames'][-1]['blue']>decoded['frames'][0]['blue'],decoded
            print('Decoded film:',json.dumps(decoded))
        page.get_by_role('combobox',name='Language',exact=True).select_option('vi')
        expect(page.get_by_role('button',name='Phát hành trình',exact=True)).to_be_visible()
        assert not errors,errors
        if not fixture:assert not remote,remote
        browser.close()
    print('Local A–B route film passed: connected villages, blocked detour, fixed frame, progressive route, red closures, responsive canvas, speed, EN/VI'+(', decoded 25s MP4.' if output else '.'))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:5212');parser.add_argument('--chrome');parser.add_argument('--fixture',action='store_true')
    parser.add_argument('--output',type=Path);parser.add_argument('--captures',type=Path)
    args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.fixture,args.output,args.captures)
