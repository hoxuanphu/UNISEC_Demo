"""Exercise the actual single-VV STRIX scene, grouped imagery UI and source attribution."""
import argparse
import re
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
from gis_browser_actions import map_tool


def run(url, chrome=None, captures=None):
    if captures: captures.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        # Use the same deterministic WebGL backend as the terrain regression flow.
        browser=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'],**({'executable_path':chrome} if chrome else {}))
        context=browser.new_context(viewport={'width':1440,'height':1000})
        context.add_init_script('Object.defineProperty(navigator,"onLine",{configurable:true,get:()=>false})')
        context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(url+'/') else route.abort())
        page=context.new_page(); errors=[]; requests=[]; warnings=[]
        page.on('console',lambda message:warnings.append(message.text) if message.type in ['error','warning'] else None)
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('request',lambda request:requests.append(request.url))
        page.goto(url+'/?map=2d&demoRole=manager&offline=1&lang=vi')
        expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=30000)
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        panel=page.locator('.layers-panel')
        assert panel.locator('[data-layer-stack]').evaluate_all('nodes=>nodes.map(node=>node.dataset.layerStack)')==['points','lines','areas','reference','raster','basemap']
        optical=panel.get_by_role('group',name='Quang học',exact=True)
        radar=panel.get_by_role('group',name='SAR',exact=True)
        expect(optical.locator('legend')).to_be_visible()
        expect(radar.locator('legend')).to_be_visible()
        expect(optical.get_by_role('radio')).to_have_count(3)
        expect(radar.get_by_role('radio')).to_have_count(3)
        expect(radar.get_by_role('radio').first).to_have_accessible_name(re.compile('^STRIX-007'))
        panel.get_by_role('radio',name=re.compile('^Sentinel-1 SAR.*18')).check()
        panel.get_by_role('radio',name='VH',exact=True).click()
        panel.get_by_role('radio',name=re.compile('^STRIX-007')).check()
        expect(panel.locator('.analysis-sar-modes')).to_have_count(0)
        expect(panel.locator('.analysis-active-details')).to_contain_text('Pixel 1,25 m')
        expect(panel.locator('.analysis-legend')).to_contain_text('-20 dB')
        expect(panel.locator('.analysis-legend')).to_contain_text('5 dB')
        # Changing the basemap or its opacity never replaces or fades the selected EO scene.
        image=page.locator('img[alt="Ảnh phân tích"]')
        try:
            expect(image).to_be_visible(timeout=30000)
        except Exception:
            print('STRIX 2D status: '+str(page.locator('.analysis-load-status').all_text_contents()),flush=True)
            print('Browser warnings: '+str(warnings[-12:]),flush=True)
            print('Recent imagery requests: '+str([request for request in requests if 'imagery/' in request][-8:]),flush=True)
            if captures:page.screenshot(path=str(captures/'strix-2d-failure.png'))
            raise
        source=image.get_attribute('src')
        panel.get_by_role('slider',name='Độ rõ ảnh phân tích',exact=True).fill('60')
        expect(image).to_have_css('opacity','0.6')
        panel.get_by_role('slider',name='Độ rõ ảnh nền',exact=True).fill('40')
        expect(image).to_have_css('opacity','0.6')
        expect(image).to_have_attribute('src',source)
        panel.get_by_role('radio',name='Địa hình',exact=True).check()
        expect(panel.get_by_role('slider',name='Độ rõ ảnh nền',exact=True)).to_be_disabled()
        expect(image).to_have_attribute('src',source)
        expect(image).to_have_css('opacity','0.6')
        panel.get_by_role('radio',name='Ảnh nền',exact=True).check()
        panel.get_by_role('slider',name='Độ rõ ảnh phân tích',exact=True).fill('100')
        expect(panel.locator('.layer-analysis > summary')).to_contain_text('STRIX-007 SAR')
        for width,theme in [(1440,'light'),(1440,'dark'),(390,'light'),(320,'dark')]:
            page.set_viewport_size({'width':width,'height':1000 if width>900 else 800})
            page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
            panel.get_by_role('radio',name=re.compile('^STRIX-007')).scroll_into_view_if_needed()
            assert panel.locator('.layers-content').evaluate('node=>node.scrollWidth<=node.clientWidth+1')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            if captures: page.screenshot(path=str(captures/f'strix-layers-{width}-{theme}.png'),animations='disabled')
        page.set_viewport_size({'width':1440,'height':1000})
        panel.get_by_role('button',name='Xem vùng ảnh',exact=True).click()
        expect(panel).to_have_count(0)
        image=page.locator('img[alt="Ảnh phân tích"]')
        expect(image).to_be_visible(timeout=30000)
        page.wait_for_function('''()=>{const image=document.querySelector('img[alt="Ảnh phân tích"]');return image?.complete&&image.naturalWidth>2000;}''')
        pixels=image.evaluate('''async image=>{
          await image.decode();const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
          const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,256,256);const bytes=ctx.getImageData(0,0,256,256).data;
          let empty=0,grey=0,colour=0,min=255,max=0;
          for(let i=0;i<bytes.length;i+=4){if(bytes[i+3]<10){empty++;continue;}if(bytes[i+3]<200)continue;
            const spread=Math.max(bytes[i],bytes[i+1],bytes[i+2])-Math.min(bytes[i],bytes[i+1],bytes[i+2]);
            if(spread<3)grey++;else colour++;min=Math.min(min,bytes[i]);max=Math.max(max,bytes[i]);}
          return {empty,grey,colour,min,max};
        }''')
        assert pixels['empty']>40000 and pixels['grey']>10000 and pixels['colour']==0 and pixels['max']-pixels['min']>80,pixels
        assert image.evaluate('image=>Number(getComputedStyle(image.parentElement).zIndex)') < page.locator('.leaflet-dear-roadStatus-pane').evaluate('node=>Number(getComputedStyle(node).zIndex)')
        if captures: page.screenshot(path=str(captures/'strix-map-2d.png'),animations='disabled')
        page.get_by_role('button',name='Nguồn bản đồ',exact=True).click()
        expect(page.locator('.map-source-popover')).to_contain_text('Synspective STRIX-007')
        expect(page.locator('.map-source-popover')).to_contain_text('20/10/2026')
        page.keyboard.press('Escape')
        page.get_by_role('button',name='Chuyển sang 3D',exact=True).click()
        expect(page.locator('canvas.terrain-canvas')).to_be_visible(timeout=30000)
        page.wait_for_function('document.querySelectorAll("canvas.terrain-canvas").length>0')
        page.wait_for_function("performance.getEntriesByType('resource').some(entry=>entry.name.includes('strix007-oct20-vv.utm.webp'))",timeout=60000)
        assert any('strix007-oct20-vv.utm.webp' in request for request in requests),requests[-20:]
        try:
            expect(page.locator('.analysis-load-status')).to_have_count(0,timeout=30000)
        except Exception:
            print('STRIX 3D status: '+str(page.locator('.analysis-load-status').all_text_contents()),flush=True)
            print('Browser warnings: '+str(warnings[-12:]),flush=True)
            if captures:page.screenshot(path=str(captures/'strix-3d-failure.png'))
            raise
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        expect(panel.get_by_role('radio',name=re.compile('^STRIX-007'))).to_be_checked()
        if captures: page.screenshot(path=str(captures/'strix-map-3d.png'),animations='disabled')
        panel.get_by_role('radio',name=re.compile('^PlanetScope sau mưa')).check()
        page.keyboard.press('Escape')
        page.get_by_role('button',name='Chuyển sang 2D',exact=True).click()
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        expect(panel.get_by_role('radio',name=re.compile('^PlanetScope sau mưa'))).to_be_checked()
        panel.get_by_role('radio',name='Tắt ảnh phủ',exact=True).check()
        page.keyboard.press('Escape')
        expect(page.locator('img[alt="Ảnh phân tích"]')).to_have_count(0)
        # The GIS editor uses the same source identities and exposes only available bands.
        map_tool(page,'Dữ liệu GIS').click()
        picker=page.locator('.geodata-workspace').get_by_role('combobox',name='Ảnh phân tích',exact=True)
        expect(picker).to_be_visible(timeout=30000)
        assert picker.locator('optgroup').evaluate_all('nodes=>nodes.map(node=>node.label)')==['Quang học','SAR']
        expect(picker.locator('option[value^="strix007-oct20:"]')).to_have_count(1)
        expect(picker.locator('option[value="strix007-oct20:vv"]')).to_contain_text('STRIX-007 SAR')
        picker.select_option('strix007-oct20:vv')
        expect(picker).to_have_value('strix007-oct20:vv')
        if captures: page.screenshot(path=str(captures/'strix-gis.png'),animations='disabled')
        assert not errors,errors
        assert not [request for request in requests if request.startswith(('http:','https:')) and not request.startswith(url+'/')],requests
        browser.close()
    print('STRIX passed: actual VV/NoData pixels, optical/SAR groups, channel fallback, source, fit, 2D/3D, themes and 320 px layout.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:5213');parser.add_argument('--chrome');parser.add_argument('--captures',type=Path)
    args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.captures)
