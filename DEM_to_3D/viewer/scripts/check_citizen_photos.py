"""Resident photo metadata, real camera capture, approved gallery spacing and mobile layout."""
import argparse
import json
import tempfile
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
from browser_preferences import use_vietnamese
from field_photo_fixture import create_field_photo


def run(url, chrome, captures):
    with sync_playwright() as p, tempfile.TemporaryDirectory() as temp:
        browser = p.chromium.launch(headless=True, executable_path=chrome, args=[
            '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'])
        exif = create_field_photo(browser, temp)
        long_exif = Path(temp) / ('anh_' + 'sau_sat_lo_' * 15 + '.jpg')
        long_exif.write_bytes(exif.read_bytes())
        # Strip only the test APP1 segment. The decoded photo has no date or GPS.
        raw = exif.read_bytes()
        no_exif = Path(temp) / 'no-camera-information.jpg'
        no_exif.write_bytes(raw[:2] + raw[4 + int.from_bytes(raw[4:6], 'big'):])
        context = use_vietnamese(browser.new_context(viewport={'width':390,'height':844},
            is_mobile=True, has_touch=True, timezone_id='Asia/Bangkok',
            permissions=['camera','geolocation'], geolocation={'latitude':21.78,'longitude':104.05,'accuracy':12}))
        context.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url+'/') else r.abort())
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(url+'/?map=2d&offline=1')
        page.get_by_label('Tên của bạn',exact=True).fill('A Phủ')
        page.get_by_role('button',name='Vào ứng dụng',exact=True).click()
        nav = page.locator('.citizen-mobile-switch')
        nav.get_by_role('button',name='Gửi ghi nhận',exact=True).click()
        form = page.locator('.citizen-report-form')
        files = form.get_by_label('Chọn ảnh hiện trường',exact=True)
        time = form.locator('input[type=datetime-local]')
        latitude = form.get_by_label('Vĩ độ ghi nhận',exact=True)
        files.set_input_files(str(exif))
        expect(form.locator('.citizen-photo-metadata')).to_contain_text('Đã đọc ngày chụp và vị trí')
        expect(time).to_have_value('2026-09-29T08:30:15')
        expect(latitude).to_have_value('21.783333')
        form.get_by_role('button',name='Xem ảnh',exact=True).click()
        preview = page.locator('.field-photo-preview')
        expect(preview).to_contain_text('21.783333')
        expect(preview).to_contain_text('29/9/2026')
        page.keyboard.press('Escape')
        form.get_by_role('button',name='Xóa ảnh',exact=True).click()
        expect(time).to_have_value('')
        expect(latitude).to_have_value('')
        files.set_input_files(str(no_exif))
        expect(form.locator('.citizen-photo-metadata')).to_contain_text('Ảnh chưa có ngày chụp và vị trí')
        expect(time).to_have_value('')
        expect(latitude).to_have_value('')
        form.get_by_role('button',name='Xóa ảnh',exact=True).click()
        time.fill('2026-10-23T09:15')
        village = form.locator('.citizen-position select')
        village.select_option(village.locator('option').nth(1).get_attribute('value'))
        chosen = latitude.input_value()
        files.set_input_files(str(exif))
        expect(form.locator('.citizen-photo-strip img')).to_have_count(1)
        expect(time).to_have_value('2026-10-23T09:15')
        expect(latitude).to_have_value(chosen)
        form.get_by_role('button',name='Xóa ảnh',exact=True).click()
        expect(time).to_have_value('2026-10-23T09:15')
        expect(latitude).to_have_value(chosen)
        # A new draft captures an actual browser video frame and shutter metadata.
        page.reload()
        nav.get_by_role('button',name='Gửi ghi nhận',exact=True).click()
        form.get_by_role('button',name='Chụp ảnh',exact=True).click()
        camera = page.locator('.camera-capture-overlay')
        expect(camera.locator('.camera-capture-location')).to_contain_text('Đã có vị trí chụp')
        camera.get_by_role('button',name='Chụp',exact=True).click()
        expect(camera).to_have_count(0)
        expect(form.locator('.citizen-photo-strip img')).to_have_count(1)
        expect(latitude).to_have_value('21.780000')
        assert time.input_value() and time.evaluate('n=>n.validity.valid'), 'Capture time must be a valid native input value'
        files.set_input_files(str(long_exif))
        expect(form.locator('.citizen-photo-strip img')).to_have_count(2)
        expect(latitude).to_have_value('21.780000')
        form.locator('textarea').first.fill('Đất đá rơi cạnh đường vào bản.')
        form.get_by_role('button',name='Gửi ghi nhận',exact=True).click()
        expect(page.locator('.citizen-submission')).to_have_count(1)
        records = page.evaluate('JSON.parse(localStorage.getItem("dear.gis.v2")).records.filter(r=>r.feature.properties.dearSubmission)')
        observation = records[0]['feature']['properties']['dearObservation']
        photo = observation['photos'][0]
        assert photo['exif'] == {}
        assert photo['capture']['source'] == 'app-camera'
        assert photo['capture']['position']['accuracyM'] == 12
        assert photo['capture']['capturedAt'] == observation['observedAt']
        # Review through the actual coordinator workflow, then reopen as its author.
        page.goto(url+'/?map=2d&offline=1&demoRole=manager')
        page.get_by_role('button',name='Ghi nhận gửi đến',exact=True).click()
        inbox = page.locator('.report-inbox')
        expect(page.locator('.inbox-review')).to_be_visible()
        page.locator('.inbox-review').get_by_role('button',name='Lưu kết quả',exact=True).click()
        expect(page.locator('.inbox-review')).to_contain_text('Đã lưu kết quả kiểm tra')
        page.goto(url+'/?map=2d&offline=1')
        nav.get_by_role('button',name='Đã gửi',exact=True).click()
        page.locator('.citizen-submission-head').first.click()
        expect(page.locator('.citizen-submission')).to_contain_text('Đã kiểm tra')
        expect(page.locator('.citizen-report-facts')).to_contain_text('Vị trí ghi nhận')
        expect(page.locator('.field-photo-gallery figure').first.locator('.field-photo-summary')).to_have_count(0)
        expect(page.locator('.field-photo-gallery figure').nth(1).locator('.field-photo-summary')).to_contain_text('21.783333')
        expect(page.locator('.field-photo-gallery figure').nth(1)).to_contain_text('GPS trong ảnh khác vị trí ghi nhận')
        details = page.locator('.field-photo-info details').first
        details.locator('summary').click()
        expect(details).to_contain_text('Camera trong ứng dụng')
        if captures:
            captures.mkdir(parents=True,exist_ok=True)
        for width in [320,390,430]:
            page.set_viewport_size({'width':width,'height':844})
            for theme in ['light','dark']:
                page.evaluate('theme=>document.documentElement.dataset.theme=theme',theme)
                page.wait_for_timeout(250)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                assert page.locator('.citizen-submission-body').evaluate('n=>n.scrollWidth<=n.clientWidth')
                assert page.locator('.field-photo-info').evaluate_all('''nodes=>nodes.every(n=>{
                    const bounds=n.getBoundingClientRect();
                    return [...n.querySelectorAll('dt,dd')].filter(item=>item.getClientRects().length).every(item=>{const r=item.getBoundingClientRect();return r.left>=bounds.left+10 && r.right<=bounds.right-10;});
                })'''), 'Photo values must have real inner padding'
                if captures:
                    page.locator('.field-photo-info').first.scroll_into_view_if_needed()
                    page.screenshot(path=str(captures/f'approved-photo-{width}-{theme}.png'))
        page.locator('.field-photo-info details').nth(1).locator('summary').click()
        expect(page.locator('.field-photo-info').nth(1)).to_contain_text(long_exif.name)
        assert page.locator('.field-photo-info').nth(1).evaluate('n=>n.scrollWidth<=n.clientWidth')
        if captures:
            page.locator('.field-photo-info').nth(1).scroll_into_view_if_needed()
            page.screenshot(path=str(captures/'approved-long-filename.png'))
        # Location denial keeps an actual shutter time and leaves location unset.
        nav.get_by_role('button',name='Gửi ghi nhận',exact=True).click()
        page.evaluate('() => { navigator.geolocation.getCurrentPosition=(ok,fail)=>fail({code:1}); }')
        form.get_by_role('button',name='Chụp ảnh',exact=True).click()
        expect(camera.locator('.camera-capture-location')).to_contain_text('Chưa có vị trí')
        camera.get_by_role('button',name='Chụp',exact=True).click()
        expect(form.locator('.citizen-photo-strip img')).to_have_count(1)
        expect(latitude).to_have_value('')
        assert time.input_value() and time.evaluate('n=>n.validity.valid')
        expect(form.locator('.citizen-photo-metadata')).to_contain_text('Ảnh chưa có vị trí')
        if captures:
            page.locator('.citizen-panel-scroll').evaluate('n=>n.scrollTop=0')
            page.screenshot(path=str(captures/'capture-without-gps.png'))
        assert not errors, errors
        browser.close()
    print('Resident photos passed: EXIF, missing metadata, manual edits, removal, camera time/GPS, review and mobile gallery spacing.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url',default='http://127.0.0.1:5347')
    parser.add_argument('--chrome')
    parser.add_argument('--captures',type=Path)
    args = parser.parse_args()
    run(args.url.rstrip('/'),args.chrome,args.captures)
