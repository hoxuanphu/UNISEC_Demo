"""Verify the default typeface, incident context, account access and illustrated guide."""
from browser_preferences import use_vietnamese
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

def run(url,chrome,captures):
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=chrome,headless=True)
  context=use_vietnamese(browser.new_context(viewport={'width':1440,'height':900}))
  context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url+'/') else r.abort())
  page=use_vietnamese(context.new_page());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url+'/?map=2d&offline=1&demoRole=manager')
  expect(page.locator('.incident-overview-heading')).to_be_visible(timeout=25000)
  expect(page.locator('html')).to_have_attribute('data-font','source')
  assert page.evaluate("async()=>{const faces=await document.fonts.load('400 14px \"Source Sans 3\"','Vùng đánh giá Nậm Kha');return faces.length>0&&faces.every(f=>f.status==='loaded')}")
  assert page.locator('.app-header').evaluate("n=>getComputedStyle(n).fontFamily.includes('Source Sans 3')")
  expect(page.locator('.incident-timing')).to_be_hidden()
  def inside(locator,width,height):
   box=locator.bounding_box();assert box and box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width+1 and box['y']+box['height']<=height+1,box
  for width in [1440,1024,390,320]:
   height=900;page.set_viewport_size({'width':width,'height':height})
   for theme in ['light','dark']:
    page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme)
    for control in page.locator('.app-header button').all():
     if control.is_visible():inside(control,width,height)
    trigger=page.get_by_role('button',name='Sự kiện đang xem',exact=True);trigger.click()
    details=page.locator('.header-context-popover');expect(details).to_be_visible();inside(details,width,height)
    expect(details).to_contain_text('INC-2026-0412')
    expect(details.locator('time')).to_have_attribute('dateTime',page.locator('.incident-context-trigger time').get_attribute('dateTime'))
    page.keyboard.press('Escape');expect(details).to_have_count(0);expect(trigger).to_be_focused()
    settings=page.get_by_role('button',name='Cài đặt',exact=True);settings.click()
    popup=page.locator('.settings-menu');inside(popup,width,height)
    expect(page.locator('.app-header').get_by_role('button',name='Tài khoản',exact=True)).to_be_visible()
    expect(page.locator('.app-header').get_by_role('button',name='Đổi vai trò',exact=True)).to_have_count(0)
    page.keyboard.press('Escape');expect(settings).to_be_focused()
    if captures and theme=='light':
     captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/f'header-{width}.png'))
  page.set_viewport_size({'width':1440,'height':900})
  trigger=page.get_by_role('button',name='Sự kiện đang xem',exact=True);trigger.click()
  page.get_by_role('button',name='Nguồn dữ liệu',exact=True).first.click()
  expect(page.get_by_role('dialog',name='Nguồn và thời điểm dữ liệu',exact=True)).to_be_visible()
  page.keyboard.press('Escape');expect(trigger).to_be_focused()
  for width in [1440,320]:
   page.set_viewport_size({'width':width,'height':900})
   help_button=page.get_by_role('button',name='Cài đặt',exact=True);help_button.click()
   page.get_by_role('button',name='Hướng dẫn sử dụng',exact=True).click()
   guide=page.get_by_role('dialog',name='Hướng dẫn sử dụng',exact=True)
   for topic in ['Đọc tình huống','Ảnh và kiểm tra ghi nhận','Bản đồ và tìm đường','Dữ liệu GIS và ảnh','Lưu và xuất']:
    guide.get_by_role('button',name=topic,exact=False).click()
    image=guide.locator('.user-guide-shot img')
    expect(image).to_be_visible();assert image.evaluate('(n)=>n.complete&&n.naturalWidth>0')
    assert guide.locator('.user-guide-steps li').count()>=4
    assert guide.evaluate('n=>n.scrollWidth<=n.clientWidth')
   page.keyboard.press('Escape');expect(help_button).to_be_focused()
  # A saved alternative remains a choice, rather than being overwritten on every visit.
  page.get_by_role('button',name='Cài đặt',exact=True).click()
  page.get_by_role('combobox',name='Kiểu chữ',exact=True).select_option('plex')
  page.keyboard.press('Escape');page.reload()
  expect(page.locator('html')).to_have_attribute('data-font','plex')
  assert not errors,errors
  context.close()
  context=use_vietnamese(browser.new_context());context.add_init_script("{const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k==='dear.font-choice')throw new DOMException('Blocked','SecurityError');return get.call(this,k)}}")
  context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url+'/') else r.abort())
  page=use_vietnamese(context.new_page());page.goto(url+'/?map=2d&offline=1&demoRole=manager')
  expect(page.locator('html')).to_have_attribute('data-font','source')
  browser.close()
 print('Header and guide passed: Source Sans default/fallback, saved choice, responsive controls/popovers, source access/focus and illustrated task navigation.')

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:5211');parser.add_argument('--chrome',default=None);parser.add_argument('--captures',type=Path)
 args=parser.parse_args();run(args.url.rstrip('/'),args.chrome,args.captures)
