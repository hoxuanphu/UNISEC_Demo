"""Simulated resident/coordinator workflow; no external delivery or real authentication."""
from browser_preferences import use_vietnamese
from gis_browser_actions import map_tool
from gis_browser_actions import publish_draft, reviewed_records_json
import argparse,json,re,tempfile
from pathlib import Path
from playwright.sync_api import expect,sync_playwright
from field_photo_fixture import create_field_photo

def switch_role(page):
 account=page.get_by_role('button',name='Tài khoản',exact=True)
 if account.count(): account.click()
 elif page.locator('.settings-anchor').count():
  page.get_by_role('button',name='Cài đặt',exact=True).click()
 page.get_by_role('button',name='Đổi vai trò',exact=True).click()

def run(url,chrome,captures):
 with tempfile.TemporaryDirectory() as temp,sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=chrome)
  photo=create_field_photo(browser,temp)
  context=use_vietnamese(browser.new_context(viewport={'width':1440,'height':960},timezone_id='Asia/Bangkok'))
  context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(url+'/') else route.abort())
  page=use_vietnamese(context.new_page());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url+'/?map=2d&offline=1')
  expect(page.locator('.demo-signin')).to_be_visible(timeout=25000)
  for width in [1440,390,320]:
   page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.set_viewport_size({'width':1440,'height':960})
  page.get_by_label('Tên của bạn',exact=True).fill('Người dân A');page.get_by_role('button',name='Vào ứng dụng',exact=True).click()
  resident_identity=page.evaluate("localStorage.getItem('dear.demo-session.v1')")
  expect(page.locator('.citizen-workspace')).to_be_visible();assert page.get_by_role('button',name='Ghi nhận gửi đến',exact=True).count()==0
  # Village access summaries are separate from the explicit start/end directions form.
  page.locator('.citizen-mobile-switch').get_by_role('button',name='Thông tin đường',exact=True).click()
  page.get_by_role('button',name='Đường về thôn, bản',exact=True).click()
  card=page.locator('.citizen-route');expect(card).to_be_visible()
  expect(card.locator('.citizen-route-verdict')).to_have_text(re.compile('Chưa ghi nhận đoạn bị chặn|Có đoạn cần kiểm tra|Tuyến đang có đoạn bị chặn'))
  expect(card.locator('.citizen-route-advice')).not_to_be_empty()
  page.get_by_role('button',name='Gửi ghi nhận',exact=True).click()
  page.get_by_label('Chọn ảnh hiện trường',exact=True).set_input_files(str(photo))
  expect(page.get_by_label('Vĩ độ ghi nhận',exact=True)).to_have_value('21.783333',timeout=15000)
  expect(page.get_by_label('Kinh độ ghi nhận',exact=True)).to_have_value('104.050000')
  expect(page.locator('input[type=datetime-local]')).to_have_value('2026-09-29T08:30:15')
  assert page.locator('.field-extra[open]').count()==0
  assert page.get_by_label('Sai số vị trí (m)',exact=True).count()==0
  if captures:captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/'citizen-photo-first.png'))
  page.locator('.citizen-report-form').get_by_role('button',name='Gửi báo cáo',exact=True).click()
  expect(page.locator('.citizen-submission')).to_contain_text('Chờ kiểm tra')
  submitted=next(r for r in json.loads(reviewed_records_json(page)) if 'dearSubmission' in r['feature']['properties']);oid=submitted['id']
  assert submitted['feature']['properties']['dearSubmission']['authorName']=='Người dân A'
  assert submitted['feature']['properties']['dearObservation']['observedLocalTime']=='2026-09-29T08:30:15'
  switch_role(page)
  expect(page.locator('.demo-signin')).to_be_visible()
  page.get_by_role('radio',name='Điều phối viên',exact=False).check();page.get_by_role('button',name='Vào ứng dụng',exact=True).click()
  expect(page.locator('.incident-overview-heading')).to_be_visible()
  page.get_by_role('button',name='Ghi nhận gửi đến',exact=True).click()
  inbox=page.get_by_role('dialog',name='Ghi nhận gửi đến',exact=False)
  inbox.get_by_role('button',name='Người dân A',exact=False).click()
  expect(inbox.locator('.field-photo-gallery img')).to_have_count(1)
  expect(inbox.locator('.field-photo-summary')).to_have_count(0)
  photo_details=inbox.locator('.field-photo-gallery details');photo_details.locator('summary').click()
  expect(photo_details).to_contain_text('Test Camera');expect(photo_details).to_contain_text('SHA-256')
  photo_details.locator('summary').click()
  inbox.get_by_label('Nhận xét kiểm tra',exact=True).fill('Đã đối chiếu ảnh và vị trí, cần khảo sát khả năng đi qua.')
  inbox.get_by_role('button',name='Lưu kết quả',exact=True).click();expect(inbox).to_contain_text('Đã lưu kết quả kiểm tra')
  if captures:captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/'manager-inbox.png'))
  page.get_by_role('button',name='Đóng tiếp nhận',exact=True).click()
  # Names are edited directly at the selected community; source IDs and states stay unchanged.
  search=page.get_by_role('combobox',name='Tìm trên bản đồ',exact=True);search.fill('Chế Tạo');search.press('Enter')
  page.locator('#response-details').get_by_role('button',name='Sửa trong GIS',exact=True).click()
  card=page.locator('.scenario-card');card.get_by_role('button',name='Đổi tên',exact=True).click()
  card.get_by_label('Tên',exact=True).fill('Địa bàn thử nghiệm')
  card.get_by_role('button',name='Lưu',exact=True).click()
  expect(card.get_by_role('heading',level=2)).to_have_text('Địa bàn thử nghiệm')
  publish_draft(page)
  card.get_by_role('button',name='Xem trên bản đồ ứng phó',exact=True).click()
  expect(page.locator('#response-details h1')).to_have_text('Địa bàn thử nghiệm')
  # Arbitrary start/end includes a complete staging-to-community route and DEM profile.
  map_tool(page, 'Tìm đường giữa hai điểm').click()
  journey=page.get_by_role('region',name='Tìm đường giữa hai điểm',exact=True)
  start=journey.get_by_label('Điểm xuất phát',exact=True)
  start.select_option('local:place-23')
  end=journey.get_by_label('Điểm đến',exact=True)
  end.select_option('local:place-25')
  expect(journey.locator('.journey-result')).to_be_visible();expect(journey).to_contain_text('km')
  journey.get_by_role('button',name='Mặt cắt địa hình',exact=True).click()
  expect(page.get_by_role('region',name='Địa hình dọc tuyến',exact=True)).to_be_visible(timeout=15000)
  if captures:captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/'manager-journey-profile.png'))
  journey.get_by_role('button',name='Đóng bảng tìm đường',exact=True).click()
  switch_role(page)
  page.evaluate("value=>localStorage.setItem('dear.demo-session.v1',value)",resident_identity);page.reload()
  page.get_by_role('button',name='Đã gửi',exact=True).click()
  expect(page.locator('.citizen-submission')).to_contain_text('Đã kiểm tra')
  page.locator('.citizen-submission-head').click()
  expect(page.locator('.citizen-submission')).to_contain_text('Đã đối chiếu ảnh')
  assert page.locator('.citizen-submission').get_by_role('button',name='Sửa ghi nhận',exact=True).count()==0
  # Other residents can inspect roads but cannot see someone else's private report/photos.
  switch_role(page);page.get_by_label('Tên của bạn',exact=True).fill('Người dân A');page.get_by_role('button',name='Vào ứng dụng',exact=True).click()
  page.get_by_role('button',name='Đã gửi',exact=True).click();expect(page.locator('.citizen-panel')).to_contain_text('Bạn chưa gửi ghi nhận')
  for width in [1440,1024,390,320]:
   page.set_viewport_size({'width':width,'height':900})
   for theme in ['light','dark']:
    page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme)
   if captures and width in [1440,320]:page.screenshot(path=str(captures/f'citizen-{width}.png'))
  page.get_by_role('button',name='Hướng dẫn',exact=True).click();expect(page.get_by_role('dialog',name='Hướng dẫn sử dụng',exact=True)).to_be_visible();page.keyboard.press('Escape')
  expect(page.get_by_role('button',name='Hướng dẫn',exact=True)).to_be_focused()
  assert not errors,errors
  browser.close()
 print('Resident demo passed: entry roles, photo GPS/time, submit/review, privacy, label edits, complete journey/profile, responsive themes and help.')
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:5174');parser.add_argument('--chrome');parser.add_argument('--captures',type=Path);a=parser.parse_args();run(a.url.rstrip('/'),a.chrome,a.captures)
