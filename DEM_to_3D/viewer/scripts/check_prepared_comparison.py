"""Exercise real Planet/SAR before-after imagery with all Internet blocked."""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright, expect


def open_comparison(page, vi=False):
    expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=30000)
    if page.locator('.map-compare-trigger').count():
        tools=page.get_by_role('button',name='Công cụ bổ sung' if vi else 'Additional map tools',exact=True)
        if tools.get_attribute('aria-expanded')!='true':tools.click()
        page.locator('.map-compare-trigger').click()
    else:
        page.get_by_role('button',name='Lớp bản đồ' if vi else 'Layers',exact=True).click()
        action=page.locator('.layer-compare-action')
        details=action.locator('xpath=ancestor::details[1]')
        if details.get_attribute('open') is None:details.locator('summary').click()
        action.click()


def run(url, chrome=None, captures=None, output=None):
    if captures: captures.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, **({'executable_path':chrome} if chrome else {}))
        page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True)
        page.add_init_script('Object.defineProperty(navigator,"onLine",{configurable:true,get:()=>false})')
        errors=[];external=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        def intercept(route):
            if route.request.url.startswith(url+'/'): route.continue_()
            else: external.append(route.request.url);route.abort()
        page.route('**/*',intercept)
        page.goto(url+'/?map=2d&demoRole=manager&lang=en')
        open_comparison(page)
        dialog=page.get_by_role('dialog',name='Compare mapped extents with imagery',exact=True)
        export=dialog.get_by_role('button',name='Download GIF',exact=True)
        expect(export).to_be_enabled(timeout=30000)
        source=dialog.get_by_role('group',name='Imagery type',exact=True)
        page.route('**/sentinel1-vv.web.webp',lambda route:route.abort(),times=1)
        source.get_by_role('button',name='Sentinel-1 SAR',exact=True).click()
        expect(dialog.locator('footer')).to_contain_text('Could not load the image pair.',timeout=30000)
        dialog.get_by_role('button',name='Retry',exact=True).click()
        expect(export).to_be_enabled(timeout=30000)
        expect(dialog.locator('.prepared-comparison-slider')).to_contain_text('11/10/2026')
        expect(dialog.locator('.prepared-comparison-slider')).to_contain_text('18/10/2026')
        expect(dialog.locator('img[alt="Sentinel-1 SAR VV"]')).to_have_count(2)
        expect(dialog.locator('.has-balanced-basemap')).to_have_count(0)
        expect(dialog.locator('footer')).to_contain_text('Copernicus Sentinel-1')
        expect(dialog.locator('footer')).not_to_contain_text('Planet Labs')
        maps=dialog.locator('.prepared-comparison-map')
        # The same viewport survives VV/VH/RGB switches. Each date retains its
        # own projected bounds rather than stretching pixels to the other image.
        panes=dialog.locator('.leaflet-comparison-before-pane, .leaflet-comparison-after-pane')
        def pixels():
            return dialog.locator('.leaflet-comparison-before-pane img').evaluate('''async el=>{
                await el.decode();const canvas=document.createElement('canvas');canvas.width=80;canvas.height=80;
                const ctx=canvas.getContext('2d');ctx.drawImage(el,0,0,80,80);const d=ctx.getImageData(0,0,80,80).data;
                let grey=0,colour=0,hash=2166136261;
                for(let i=0;i<d.length;i+=4){hash=Math.imul(hash^d[i],16777619);if(d[i+3]>200){if(Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2])<5)grey++;else colour++;}}
                return {grey,colour,hash:hash>>>0,left:el.style.left,transform:el.style.transform,width:el.style.width};
            }''')
        vv=pixels();assert vv['grey']>5000,vv
        channel=dialog.get_by_role('combobox',name='SAR channel',exact=True)
        channel.select_option('vh');expect(export).to_be_enabled(timeout=30000)
        vh=pixels();assert vh['grey']>5000 and vh['hash']!=vv['hash'],(vv,vh)
        channel.select_option('rgb');expect(export).to_be_enabled(timeout=30000)
        rgb=pixels();assert rgb['colour']>5000,rgb
        assert (vv['transform'],vv['width'])==(rgb['transform'],rgb['width']),(vv,rgb)
        slider=dialog.get_by_role('slider',name='Image comparison position',exact=True)
        slider.fill('25');before_clip=panes.first.evaluate('el=>el.style.clip')
        slider.fill('75');assert panes.first.evaluate('el=>el.style.clip')!=before_clip
        dialog.get_by_role('button',name='Blink',exact=True).click()
        pause=dialog.get_by_role('button',name='Pause',exact=True);pause.click()
        dialog.get_by_role('button',name='Before',exact=True).click()
        expect(dialog.locator('.prepared-comparison-badge')).to_contain_text('11/10/2026')
        expect(dialog.locator('.leaflet-comparison-after-pane')).to_have_css('visibility','hidden')
        dialog.get_by_role('button',name='After',exact=True).click()
        expect(dialog.locator('.prepared-comparison-badge')).to_contain_text('18/10/2026')
        expect(dialog.locator('.leaflet-comparison-before-pane')).to_have_css('visibility','hidden')
        if output:
            output.parent.mkdir(parents=True,exist_ok=True)
            with page.expect_download(timeout=60000) as download: export.click()
            download.value.save_as(output)
            data=output.read_bytes();assert data[:6] in [b'GIF87a',b'GIF89a'] and len(data)>100000
        if captures: page.screenshot(path=str(captures/'sar-comparison.png'))
        # Original Planet comparison remains available and unmodified.
        source.get_by_role('button',name='PlanetScope',exact=True).click()
        expect(export).to_be_enabled(timeout=30000)
        expect(dialog.locator('img[alt="Original Planet imagery"]')).to_have_count(2)
        expect(dialog.get_by_role('combobox',name='SAR channel',exact=True)).to_have_count(0)
        # Rapid switches cannot let a stale decode reinstall the previous band.
        source.get_by_role('button',name='Sentinel-1 SAR',exact=True).click()
        channel.select_option('vv');channel.select_option('vh');channel.select_option('rgb')
        expect(export).to_be_enabled(timeout=30000)
        expect(dialog.locator('img[alt="Sentinel-1 SAR RGB"]')).to_have_count(2)
        expect(dialog.locator('img[alt="Sentinel-1 SAR VH"]')).to_have_count(0)
        for width in [320,390,768,1440]:
            page.set_viewport_size({'width':width,'height':950})
            assert dialog.evaluate('el=>el.scrollWidth<=el.clientWidth+1'),width
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
        dialog.get_by_role('button',name='Close',exact=True).click()
        page.goto(url+'/?map=2d&demoRole=manager&lang=vi')
        open_comparison(page,vi=True)
        vi=page.get_by_role('dialog',name='Đối chiếu vùng sạt trên ảnh',exact=True)
        vi.get_by_role('button',name='Sentinel-1 SAR',exact=True).click()
        expect(vi.get_by_role('button',name='Tải GIF',exact=True)).to_be_enabled(timeout=30000)
        expect(vi.get_by_role('combobox',name='Kênh SAR',exact=True)).to_be_visible()
        expect(vi.locator('footer')).to_contain_text('Cùng thang dB')
        assert not errors,errors
        # On the portable package even the comparison basemap stays local.
        if '/offline-map/' in str(page.request.get(url+'/workspace-config.json').json().get('localMap','')):
            assert not external,external
        browser.close()
    print('Prepared comparison passed: real SAR dates, VV/VH/RGB, stable georeferencing, swipe/blink/GIF, Planet switching, stale-load cleanup, EN/VI and responsive offline UI.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:5212');parser.add_argument('--chrome')
    parser.add_argument('--captures',type=Path);parser.add_argument('--output',type=Path)
    args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.captures,args.output)
