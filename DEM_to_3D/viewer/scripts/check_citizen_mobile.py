"""Resident mobile flow, real browser audio, explicit origins and group picking."""
from browser_preferences import use_vietnamese
import argparse,json,tempfile,base64
from pathlib import Path
from playwright.sync_api import expect,sync_playwright
from field_photo_fixture import create_field_photo

def run(url,chrome,captures):
 with sync_playwright() as p,tempfile.TemporaryDirectory() as temp:
  browser=p.chromium.launch(headless=True,executable_path=chrome,args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
  photo=create_field_photo(browser,temp)
  ctx=use_vietnamese(browser.new_context(viewport={'width':390,'height':844},permissions=['geolocation','microphone'],geolocation={'latitude':21.783333,'longitude':104.05,'accuracy':45},timezone_id='Asia/Bangkok'))
  ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url+'/') else r.abort())
  page=use_vietnamese(ctx.new_page());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url+'/?map=2d&offline=1')
  page.get_by_label('Tên của bạn',exact=True).fill('Mobile A');page.get_by_role('button',name='Vào ứng dụng',exact=True).click()
  page.get_by_role('button',name='Tìm đường',exact=True).click()
  directions=page.locator('.citizen-directions')
  expect(directions.locator('select').nth(0)).to_have_value('')
  expect(directions.locator('select').nth(1)).to_have_value('')
  expect(page.locator('.citizen-route')).not_to_be_visible()
  directions.get_by_role('button',name='Vị trí của tôi',exact=True).click()
  expect(directions.locator('select').nth(0)).to_have_value('device')
  directions.locator('select').nth(1).select_option(directions.locator('select').nth(1).locator('option[value^="community:"]').first.get_attribute('value'))
  expect(directions.locator('.citizen-direction-result')).to_be_visible()
  # Map GPS is independent of the position reported for a new observation.
  page.get_by_role('button',name='Gửi ghi nhận',exact=True).click()
  form=page.locator('.citizen-report-form')
  expect(form.get_by_role('textbox').first).to_be_visible()
  # Camera capture is offered only on touch devices.
  if form.locator('input[capture]').count():
   assert form.locator('input[capture]').get_attribute('capture')=='environment'
   assert form.locator('input[capture]').get_attribute('multiple') is None
  expect(form.get_by_label('Vĩ độ ghi nhận',exact=True)).to_have_value('')
  form.get_by_label('Chọn ảnh hiện trường',exact=True).set_input_files(str(photo))
  expect(form.locator('.citizen-photo-strip img')).to_have_count(1)
  expect(form.get_by_label('Vĩ độ ghi nhận',exact=True)).to_have_value('21.783333')
  expect(form.locator('input[type="datetime-local"]')).to_have_value('2026-09-29T08:30:15')
  if captures:captures.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(captures/'resident-mobile-photo.png'),full_page=True)
  form.get_by_role('button',name='Gửi ghi nhận',exact=True).click()
  expect(page.locator('.citizen-submission')).to_have_count(1)
  records=json.loads(page.evaluate('JSON.stringify(JSON.parse(localStorage.getItem("dear.gis.v2")).records.filter(r=>r.feature.properties.dearSubmission))'))
  assert records[0]['feature']['properties']['dearObservation']['observedLocalTime']=='2026-09-29T08:30:15'
  assert records[0]['feature']['properties']['dearSubmission']['locationSource']=='photo'
  expect(page.locator('.citizen-feedback')).to_contain_text('Đã lưu ghi nhận trên thiết bị này')
  page.get_by_role('button',name='Gửi ghi nhận',exact=True).click()
  # Blank submissions and missing positions fail without fake coordinates.
  form.get_by_role('button',name='Gửi ghi nhận',exact=True).click();expect(form).to_contain_text('Thêm ảnh, ghi âm hoặc viết')
  note=form.get_by_role('textbox').first;note.fill('Đá rơi gần đường vào bản.')
  form.get_by_role('button',name='Gửi ghi nhận',exact=True).click();expect(page.locator('.citizen-feedback')).to_contain_text('Chọn vị trí')
  # Draft survives tabs.
  page.get_by_role('button',name='Thông tin đường',exact=True).click();page.get_by_role('button',name='Gửi ghi nhận',exact=True).click()
  expect(note).to_have_value('Đá rơi gần đường vào bản.')
  village=form.locator('.citizen-position select')
  village.select_option(village.locator('option').nth(1).get_attribute('value'))
  form.get_by_role('button',name='Gửi ghi nhận',exact=True).click()
  expect(page.locator('.citizen-submission')).to_have_count(2)
  records=json.loads(page.evaluate('JSON.stringify(JSON.parse(localStorage.getItem("dear.gis.v2")).records.filter(r=>r.feature.properties.dearSubmission))'))
  approximate=next(r for r in records if r['feature']['properties']['dearSubmission']['locationSource']=='community')
  assert approximate['feature']['properties']['dearSubmission']['locationCommunityId']
  page.locator('.citizen-submission-head').nth(1).click()
  expect(page.locator('.citizen-submission-body')).to_contain_text('Vị trí gần đúng')
  page.get_by_role('button',name='Gửi ghi nhận',exact=True).click()
  # Use a real MediaRecorder with Chrome's fake microphone. Stop/release, save voice only.
  form.get_by_role('button',name='Ghi âm',exact=True).click()
  expect(form.get_by_role('button',name='Dừng ghi âm',exact=False)).to_be_visible()
  expect(form.get_by_role('button',name='Gửi ghi nhận',exact=True)).to_be_disabled()
  page.wait_for_timeout(1300)
  form.get_by_role('button',name='Dừng ghi âm',exact=False).click()
  expect(form.locator('audio')).to_be_visible(timeout=10000)
  expect(form.get_by_role('button',name='Gửi ghi nhận',exact=True)).to_be_enabled()
  form.locator('.citizen-position select').select_option(form.locator('.citizen-position select option').nth(1).get_attribute('value'))
  form.get_by_role('button',name='Gửi ghi nhận',exact=True).click()
  records=json.loads(page.evaluate('JSON.stringify(JSON.parse(localStorage.getItem("dear.gis.v2")).records.filter(r=>r.feature.properties.dearSubmission))'))
  voice=next(r for r in records if r['feature']['properties']['dearObservation'].get('voice'))
  obs=voice['feature']['properties']['dearObservation']
  assert not obs['note'] and not obs['photos'] and obs['voice']['duration']>0
  assert obs['voice']['mime']=='audio/webm' and obs['voice']['bytes']<=800000
  # Leaving a recording cancels it and releases every track.
  page.get_by_role('button',name='Gửi ghi nhận',exact=True).click()
  page.evaluate("""() => {
   window.recordingStreams=[];const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
   navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await original(constraints);recordingStreams.push(stream);return stream;};
  }""")
  form.get_by_role('button',name='Ghi âm',exact=True).click()
  expect(form.get_by_role('button',name='Dừng ghi âm',exact=False)).to_be_visible()
  page.get_by_role('button',name='Thông tin đường',exact=True).click()
  assert page.evaluate('recordingStreams.every(s=>s.getTracks().every(t=>t.readyState==="ended"))')
  page.get_by_role('button',name='Gửi ghi nhận',exact=True).click()
  expect(form.locator('audio')).to_have_count(0)
  # Previously recorded browser audio can also be attached as a file.
  audio_file=Path(temp)/'recorded.webm';audio_file.write_bytes(base64.b64decode(obs['voice']['data'].split(',')[1]))
  form.get_by_label('Tệp ghi âm',exact=True).set_input_files(str(audio_file))
  expect(form.locator('audio')).to_be_visible(timeout=8000)
  form.get_by_role('button',name='Xóa ghi âm',exact=True).click()
  # Permission denial is actionable and never replaces another chosen report position.
  page.evaluate('() => { navigator.geolocation.getCurrentPosition=(ok,fail)=>fail({code:1}); }')
  form.get_by_role('button',name='Vị trí của tôi',exact=True).click()
  expect(page.locator('.citizen-panel')).to_contain_text('Chưa được phép lấy vị trí')
  expect(form.get_by_label('Vĩ độ ghi nhận',exact=True)).to_have_value('')
  # A delayed GPS result cannot override an explicit village or manual position.
  page.evaluate('() => { navigator.geolocation.getCurrentPosition=(ok,fail)=>{window.pendingLocation=ok;}; }')
  form.get_by_role('button',name='Vị trí của tôi',exact=True).click()
  form.locator('.citizen-position select').select_option(form.locator('.citizen-position select option').nth(1).get_attribute('value'))
  chosen=form.get_by_label('Vĩ độ ghi nhận',exact=True).input_value()
  page.evaluate('() => pendingLocation({coords:{latitude:20,longitude:103,accuracy:4},timestamp:Date.now()})')
  expect(form.get_by_label('Vĩ độ ghi nhận',exact=True)).to_have_value(chosen)
  expect(form.locator('.citizen-position-value')).to_contain_text('gần đúng')
  # Width, theme and native input sizing.
  for width in [320,390,760,1440]:
   page.set_viewport_size({'width':width,'height':844})
   for theme in ['light','dark']:
    page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme);page.wait_for_timeout(160)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme)
    if width<=390:
     assert form.locator('textarea').evaluate('(n)=>parseFloat(getComputedStyle(n).fontSize)>=16')
    if captures and width in [390,1440]:page.screenshot(path=str(captures/f'resident-report-{width}-{theme}.png'))
  # Voice survives reload and can be played by the coordinator, not exposed as a hazard.
  page.goto(url+'/?map=2d&offline=1&demoRole=manager')
  page.get_by_role('button',name='Ghi nhận gửi đến',exact=True).click()
  inbox=page.get_by_role('dialog',name='Ghi nhận gửi đến',exact=False)
  inbox.locator('nav button').filter(has=page.locator('strong[title$="('+voice['name'].rsplit(' ',1)[-1]+')"]')).click()
  expect(inbox.locator('audio')).to_be_visible()
  assert len(json.loads(page.evaluate('JSON.stringify(JSON.parse(localStorage.getItem("dear.gis.v2")).records.filter(r=>r.feature.properties.dearSubmission))')))==3
  assert not errors,errors
  browser.close()
 print('Resident mobile passed: explicit origin, GPS, camera input, photo/text/voice-only, approximate location, draft persistence, microphone cleanup, permission denial, responsive themes and coordinator playback.')

if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:5341');a.add_argument('--chrome');a.add_argument('--captures',type=Path);args=a.parse_args();run(args.url.rstrip('/'),args.chrome,args.captures)
