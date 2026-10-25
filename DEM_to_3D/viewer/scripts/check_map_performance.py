"""Keep moving locations independent of static map layout and terrain rendering."""
import argparse
from playwright.sync_api import expect, sync_playwright


def run(url, chrome=None):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, **({'executable_path': chrome} if chrome else {}))
        context = browser.new_context(viewport={'width': 1440, 'height': 900})
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url + '/') else r.abort())
        context.add_init_script('''
          Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});
          window.mapWork={layout:0,draw:0,lastLayout:0,lastDraw:0};
          const rect=Element.prototype.getBoundingClientRect;
          Element.prototype.getBoundingClientRect=function(...args){
            if(this.matches('.map-toolbar')){window.mapWork.layout++;window.mapWork.lastLayout=performance.now();}
            return rect.apply(this,args);
          };
          for(const name of ['WebGLRenderingContext','WebGL2RenderingContext']){
            const proto=window[name]?.prototype;if(!proto)continue;
            for(const method of ['drawElements','drawArrays']){
              const draw=proto[method];
              proto[method]=function(...args){window.mapWork.draw++;window.mapWork.lastDraw=performance.now();return draw.apply(this,args);};
            }
          }
        ''')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            for mode in ['2d', '3d']:
                page.goto(url + '/?offline=1&map=' + mode + '&demoRole=manager&lang=en')
                expect(page.locator('.tracked-device').first).to_be_attached(timeout=45000)
                if mode == '3d':
                    expect(page.locator('canvas.terrain-canvas')).to_be_visible(timeout=45000)
                # Local imagery may still be uploading on slower machines. Wait
                # for completed imagery and render quiet instead of a fixed delay.
                try:
                    page.wait_for_function('''()=>{
                      const now=performance.now(),work=window.mapWork;
                      return now>4000 && now-work.lastDraw>1600 &&
                        !document.querySelector('.terrain-loading,.analysis-load-status,.terrain-detail-status:not([hidden])');
                    }''',timeout=45000)
                except Exception:
                    print(mode + ' did not settle: ' + str(page.evaluate('''()=>({work:window.mapWork,now:performance.now(),
                      status:[...document.querySelectorAll('.terrain-loading,.analysis-load-status,.terrain-detail-status')].map(n=>({text:n.textContent,hidden:n.hidden})),
                      errors:document.querySelector('.map-3d-error')?.textContent})''')), flush=True)
                    raise
                page.evaluate('Object.assign(window.mapWork,{layout:0,draw:0})')
                before = page.locator('.tracked-device').evaluate_all('nodes=>nodes.map(n=>[n.dataset.worldX,n.dataset.worldY])')
                page.wait_for_timeout(1200)
                work = page.evaluate('window.mapWork')
                after = page.locator('.tracked-device').evaluate_all('nodes=>nodes.map(n=>[n.dataset.worldX,n.dataset.worldY])')
                print(mode + ' idle map work: ' + str(work), flush=True)
                assert before != after, 'Device feed stopped during the idle check'
                assert work['layout'] < 8, (mode, 'Moving dots repeatedly relaid static map labels', work)
                if mode == '3d':
                    assert work['draw'] == 0, ('Idle terrain kept rendering behind moving DOM markers', work)
                surface = page.locator('canvas.terrain-canvas' if mode == '3d' else '.map-2d-surface')
                box = surface.bounding_box()
                x, y = box['x'] + box['width'] * .55, box['y'] + box['height'] * .6
                page.mouse.move(x, y)
                page.mouse.down()
                page.mouse.move(x + 90, y + 35, steps=20)
                page.mouse.up()
                page.get_by_role('button', name='Zoom in', exact=True).click()
                page.wait_for_timeout(1000)
                expect(surface).to_be_visible()
                assert page.locator('.map-pin:not([hidden])').count() > 0
                if mode == '3d':
                    assert page.evaluate('window.mapWork.draw') > 0, 'Terrain failed to redraw after a camera change'
            assert page.evaluate('''()=>{
              const header=document.querySelector('.app-header');
              const outside=new WheelEvent('wheel',{ctrlKey:true,cancelable:true,bubbles:true,deltaY:-20});
              header.dispatchEvent(outside);
              return !outside.defaultPrevented;
            }'''), 'Map gestures suppressed page zoom outside the map'
            assert not errors, errors
            print('Map performance passed: live positions, idle layout/rendering and pan/zoom.', flush=True)
        finally:
            browser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5351')
    parser.add_argument('--chrome')
    args = parser.parse_args()
    run(args.url.rstrip('/'), args.chrome)
