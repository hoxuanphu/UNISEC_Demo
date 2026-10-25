"""Reproduce toolbar-covered inspectors and reach the commune overview film from the UI."""
import argparse
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


def front(locator):
    assert locator.evaluate('''node=>{
      const r=node.getBoundingClientRect();
      return [0.25,0.5,0.75].every(x=>node.contains(document.elementFromPoint(r.x+r.width*x,r.y+r.height/2)));
    }'''), 'Covered control: '+locator.inner_text()


def run(url,chrome=None,captures=None):
    if captures: captures.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,**({'executable_path':chrome} if chrome else {}))
        context=browser.new_context(viewport={'width':1440,'height':900})
        context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(url+'/') else route.abort())
        page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(url+'/?offline=1&map=2d&demoRole=manager&lang=en')
        expect(page.locator('.map-context-road').first).to_be_attached(timeout=30000)
        for width,height in [(1440,900),(1024,768),(1024,480),(390,844),(320,640)]:
            print(f'Inspector layout: {width} x {height}',flush=True)
            page.set_viewport_size({'width':width,'height':height})
            switch=page.locator('.mobile-view-switch').get_by_role('button',name='Map',exact=True)
            if switch.is_visible():switch.click()
            if width==1024:
                handle=page.locator('.panel-resize-handle');handle.focus();page.keyboard.press('End')
            page.get_by_role('button',name='Layers',exact=True).click()
            page.get_by_role('button',name='Fit Chế Tạo local roads',exact=True).click()
            close=page.get_by_role('button',name='Close map layers',exact=True)
            if close.is_visible():close.click()
            page.wait_for_timeout(400)
            hit=page.wait_for_function('''()=>{
              const area=document.querySelector('.map-canvas').getBoundingClientRect();
              for(const node of document.querySelectorAll('.map-road-target[data-road-id^="local-"]')){
                const m=node.getScreenCTM();if(!m)continue;
                for(let t=.025;t<1;t+=.025){
                  const p=node.getPointAtLength(node.getTotalLength()*t).matrixTransform(m);
                  if(p.x<area.x+8||p.x>area.right-8||p.y<area.top+8||p.y>area.bottom-32)continue;
                  if(document.elementFromPoint(p.x,p.y)?.closest('[data-road-id]')?.dataset.roadId===node.dataset.roadId)return {x:p.x,y:p.y};
                }
              }return null;
            }''',timeout=10000).json_value()
            page.mouse.click(hit['x'],hit['y'])
            card=page.locator('.local-road-card');expect(card).to_be_visible()
            toggle=page.get_by_role('button',name='Additional map tools',exact=True)
            if toggle.get_attribute('aria-expanded')!='true':toggle.click()
            page.wait_for_timeout(100)
            assert page.locator('.map-advanced-tools').evaluate('''tools=>{
              const r=tools.getBoundingClientRect();
              return [...tools.querySelectorAll('.icon-button')].filter(node=>node.getClientRects().length).every(node=>{
                const b=node.getBoundingClientRect();return b.left>=r.left && b.right<=r.right+1 && b.top>=r.top && b.bottom<=r.bottom+1;
              });
            }'''), ('Toolbar button escaped its row',width,height)
            bounds=card.bounding_box();area=page.locator('.map-area').bounding_box()
            bottom=page.locator('.map-toolbar,.map-tools,.map-advanced-tools:not([hidden])').evaluate_all('nodes=>Math.max(...nodes.map(node=>node.getBoundingClientRect().bottom))')
            assert bounds['y']>=bottom+8,(width,bounds,bottom)
            assert bounds['y']+bounds['height']<=area['y']+area['height']-8,(width,bounds,area)
            front(card.locator('h2'));front(card.get_by_role('button',name='Close road section',exact=True))
            if captures:page.screenshot(path=str(captures/f'road-inspector-{width}-{height}.png'),animations='disabled')
            if width==1440:
                # Match the reported failure with the real terrain renderer and both toolbar rows.
                page.get_by_role('button',name='Switch to 3D',exact=True).click()
                expect(page.locator('canvas.terrain-canvas')).to_be_visible(timeout=60000)
                front(card.locator('h2'));front(card.get_by_role('button',name='Close road section',exact=True))
                assert card.bounding_box()['y']>=bottom+8
                if captures:page.screenshot(path=str(captures/'road-inspector-3d.png'),animations='disabled')
                page.get_by_role('button',name='Switch to 2D',exact=True).click()
                expect(page.locator('.map-context-road').first).to_be_attached(timeout=30000)
            # A popup and a bottom inspector must not cover each other on a small map.
            page.get_by_role('button',name='3D route view',exact=True).click()
            expect(card).to_have_count(0)
            link=page.get_by_role('link',name='Chế Tạo overview video',exact=False)
            expect(link).to_be_visible();front(link)
            popup=page.locator('.flyover-menu').bounding_box()
            assert popup['y']>=bottom+4,(width,popup,bottom)
            assert popup['x']>=area['x'] and popup['x']+popup['width']<=area['x']+area['width']+1,(width,popup,area)
            assert popup['y']+popup['height']<=area['y']+area['height']-4,(width,popup,area)
            if captures:page.screenshot(path=str(captures/f'overview-entry-{width}-{height}.png'),animations='disabled')
            page.keyboard.press('Escape')
        page.set_viewport_size({'width':1440,'height':900})
        page.get_by_role('button',name='3D route view',exact=True).click()
        page.get_by_role('link',name='Chế Tạo overview video',exact=False).click()
        expect(page).to_have_url(url+'/?offline=1&map=2d&demoRole=manager&lang=en&workspace=routes')
        expect(page.get_by_role('combobox',name='Origin',exact=True)).to_have_value('place-23',timeout=60000)
        expect(page.get_by_role('combobox',name='Destination',exact=True)).to_have_value('place-25')
        play=page.get_by_role('button',name='Play journey',exact=True)
        expect(play).to_be_enabled(timeout=60000)
        expect(page.locator('canvas.terrain-canvas')).to_be_visible(timeout=60000)
        print('Overview film: start A to C from the toolbar link',flush=True)
        play.click()
        expect(page.locator('.flyover-player')).to_be_visible(timeout=60000)
        expect(page.get_by_role('button',name='Pause',exact=True)).to_be_visible()
        assert not errors,errors
        browser.close()
    print('Inspector layout passed: toolbar clearance, visible heading/close, short/narrow maps, popup exclusivity and overview A-C playback.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:5213');parser.add_argument('--chrome');parser.add_argument('--captures',type=Path)
    args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.captures)
