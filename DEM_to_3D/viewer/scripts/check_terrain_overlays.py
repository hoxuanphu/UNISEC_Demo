"""Browser checks for contours, SAR import and local tile models (no network data)."""
from browser_preferences import use_vietnamese
import argparse
import base64
import json
from pathlib import Path
import struct
import tempfile
import re

from playwright.sync_api import expect, sync_playwright


_current_phase = 'initialization'


def checkpoint(name):
    """Only fixed phase names enter public CI annotations, never browser data."""
    global _current_phase
    _current_phase = name
    print(f'::notice title=Terrain overlay check::{name}', flush=True)


def sar_fixture(path):
    """Write a small two-band Float32 GeoTIFF with explicit UTM georeferencing."""
    xml = b'<GDALMetadata><Item name="DESCRIPTION" sample="0" role="description">VV</Item><Item name="DESCRIPTION" sample="1" role="description">VH</Item></GDALMetadata>\0'
    tags = [
        (256, 4, 1, struct.pack('<I', 2)), (257, 4, 1, struct.pack('<I', 2)),
        (258, 3, 2, struct.pack('<HH', 32, 32)), (259, 3, 1, struct.pack('<H', 1)),
        (262, 3, 1, struct.pack('<H', 1)), (273, 4, 1, None),
        (277, 3, 1, struct.pack('<H', 2)), (278, 4, 1, struct.pack('<I', 2)),
        (279, 4, 1, struct.pack('<I', 32)), (284, 3, 1, struct.pack('<H', 1)),
        (339, 3, 2, struct.pack('<HH', 3, 3)),
        (33550, 12, 3, struct.pack('<ddd', 1000, 1000, 0)),
        (33922, 12, 6, struct.pack('<dddddd', 0, 0, 0, 398500, 2401500, 0)),
        (34735, 3, 16, struct.pack('<16H', 1, 1, 0, 3, 1024, 0, 1, 1, 1025, 0, 1, 1, 3072, 0, 1, 32648)),
        (42112, 2, len(xml), xml), (42113, 2, 6, b'-9999\0')]
    offset = 8 + 2 + len(tags) * 12 + 4
    entries, extra = [], bytearray()
    for tag, kind, count, data in tags:
        if data is None:
            entries.append((tag, kind, count, None)); continue
        if len(data) <= 4:
            entries.append((tag, kind, count, data.ljust(4, b'\0')))
        else:
            entries.append((tag, kind, count, struct.pack('<I', offset + len(extra))))
            extra.extend(data)
            if len(extra) % 2: extra.append(0)
    pixels = offset + len(extra)
    output = bytearray(b'II*\0' + struct.pack('<I', 8) + struct.pack('<H', len(tags)))
    for tag, kind, count, data in entries:
        output.extend(struct.pack('<HHI', tag, kind, count) + (data or struct.pack('<I', pixels)))
    output.extend(struct.pack('<I', 0)); output.extend(extra)
    output.extend(struct.pack('<8f', 1, 4, 2, 3, 3, 2, -9999, 1))
    path.write_bytes(output)


def model_fixture(root):
    """Tiny model package: all assets are generated in a system temporary folder."""
    positions = [-500,100,-500, 500,200,-500, -500,300,500, 500,400,500]
    normals = [0,1,0]*4
    binary = struct.pack('<24f6H', *(positions+normals+[0,2,1,1,2,3]))
    document = {'asset':{'version':'2.0'}, 'scene':0, 'scenes':[{'nodes':[0]}], 'nodes':[{'mesh':0}],
        'buffers':[{'byteLength':len(binary)}], 'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':48},{'buffer':0,'byteOffset':48,'byteLength':48},{'buffer':0,'byteOffset':96,'byteLength':12}],
        'accessors':[{'bufferView':0,'componentType':5126,'count':4,'type':'VEC3','min':[-500,100,-500],'max':[500,400,500]}, {'bufferView':1,'componentType':5126,'count':4,'type':'VEC3'}, {'bufferView':2,'componentType':5123,'count':6,'type':'SCALAR'}],
        'materials':[{'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':1},'doubleSided':True}],
        'meshes':[{'primitives':[{'attributes':{'POSITION':0,'NORMAL':1},'indices':2,'material':0}]}]}
    encoded = json.dumps(document).encode(); encoded += b' ' * (-len(encoded)%4)
    glb = struct.pack('<III',0x46546C67,2,12+8+len(encoded)+8+len(binary)) + struct.pack('<I4s',len(encoded),b'JSON') + encoded + struct.pack('<I4s',len(binary),b'BIN\0') + binary
    (root/'model.glb').write_bytes(glb)
    metadata = {'schema_version':1,'asset_id':'model','analysis_supported':True,'crs':{'authority':'EPSG','code':32648,'linear_unit':'metre','proj4':'+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs'},'scene_axes':{'x':'east','y':'up','z':'negative_north'},'world_origin':{'x':399500,'y':2400500},
        'grid':{'file':'model.grid.bin','shape':[2,2],'shape_order':'rows_cols','dtype':'float32','byte_order':'little_endian','layout':'row_major','nodata_encoding':'nan','elevation_unit':'metre','sampling_method':'nearest_subsample','source_step':1,'byte_length':16},
        'grid_transform':{'a':1000,'b':0,'c':398500,'d':0,'e':-1000,'f':2401500,'convention':'rasterio_affine','pixel_reference':'center'},'elevation':{'base_elevation':0,'exaggeration':1,'normalize_base':False,'min':100,'max':400},'mesh':{'file':'model.glb','vertex_count':4,'triangle_count':2},'administrative':{'commune_name':'Chế Tạo kiểm thử','headquarters':'Trụ sở kiểm thử','population':123}}
    (root/'model.terrain.json').write_text(json.dumps(metadata),encoding='utf-8'); (root/'model.grid.bin').write_bytes(struct.pack('<4f',100,200,300,400))
    tile = {'schema_version':1,'asset_id':'model','format':'webp','quality':88,'tile_size':8,'gutter_px':0,'min_zoom':0,'max_zoom':0,'bounds_projected':{'min_x':398500,'min_y':2399500,'max_x':400500,'max_y':2401500},'crs':{'authority':'EPSG','code':32648,'linear_unit':'metre'},'orientation':{'origin':'top_left','x':'east','y':'north_to_south'},'levels':[{'zoom':0,'width_px':8,'height_px':8,'columns':1,'rows':1,'pixel_size_x':250,'pixel_size_y':250}],'source':'fixture.png'}
    (root/'model.tiles.json').write_text(json.dumps(tile),encoding='utf-8')
    # Fixed 8x8 WebP fixture; no image encoder dependency is needed in browser CI.
    image = base64.b64decode('UklGRh4AAABXRUJQVlA4TBEAAAAvB8ABAAdQlHKXov+BiOh/AAA=')
    tiles=root/'model_tiles'/'z0'; tiles.mkdir(parents=True); (tiles/'0_0.webp').write_bytes(image)


def run(url, chrome):
    with tempfile.TemporaryDirectory(prefix='dear-terrain-') as temp, sync_playwright() as playwright:
        root=Path(temp); package=root/'package'; package.mkdir(); model_fixture(package); sar_fixture(root/'sar.tif')
        browser=playwright.chromium.launch(headless=True, executable_path=chrome, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=use_vietnamese(browser.new_page(viewport={'width':1440,'height':960}))
        page.on('crash',lambda:checkpoint('terrain page crashed'))
        errors=[]; page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('console',lambda message: errors.append(message.text) if message.type=='error' and ('THREE.WebGLProgram' in message.text or 'GL_INVALID' in message.text) else None)
        page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(url+'/') else route.abort())
        checkpoint('initial 3D terrain load')
        page.goto(url+'/?offline=1&map=3d&demoRole=manager')
        expect(page.locator('.terrain-canvas')).to_be_visible(timeout=30000)
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        layers=page.locator('.layers-panel')
        layers.locator('.layer-terrain > summary').click()
        expect(layers.get_by_label('Đường đồng mức',exact=True)).to_be_enabled(timeout=30000)
        page.evaluate('window.originalTerrainCanvas=document.querySelector(".terrain-canvas")')
        checkpoint('enable contours')
        layers.get_by_label('Đường đồng mức',exact=True).check()
        expect(page.locator('.terrain-contour-label').first).to_be_attached(timeout=30000)
        checkpoint('change contour interval')
        layers.get_by_label('Khoảng cao độ',exact=True).select_option('200')
        expect(page.locator('.terrain-contour-label').first).to_be_attached(timeout=30000)
        layers.locator('.terrain-sar-controls > summary').click()
        checkpoint('import SAR raster')
        layers.get_by_label('Nhập GeoTIFF',exact=True).set_input_files(str(root/'sar.tif'))
        expect(layers.get_by_label('Kênh SAR',exact=True)).to_be_visible(timeout=15000)
        expect(layers.get_by_label('Kênh SAR',exact=True).locator('option')).to_have_text(['VV','VH'])
        expect(layers.locator('.terrain-raster-upload')).to_be_visible()
        assert layers.get_by_label('Độ rõ lớp SAR',exact=True).bounding_box()['width'] > 160
        layers.get_by_label('Kênh SAR',exact=True).select_option('1')
        layers.get_by_label('Độ rõ lớp SAR',exact=True).fill('40')
        expect(layers.locator('[role=alert]')).to_have_count(0)
        checkpoint('switch between prepared imagery and the private raster')
        layers.get_by_role('radio',name=re.compile('^STRIX-007')).check()
        raw=layers.get_by_role('checkbox',name='sar.tif',exact=True)
        expect(raw).not_to_be_checked()
        raw.check()
        expect(layers.get_by_role('radio',name='Tắt ảnh phủ',exact=True)).not_to_be_checked()
        expect(raw).to_be_checked()
        layers.get_by_role('radio',name='Tắt ảnh phủ',exact=True).check()
        expect(raw).not_to_be_checked()
        raw.check()
        # A prepared scene chosen during an asynchronous import wins over late file completion.
        for next_source in [re.compile('^STRIX-007'), 'Tắt ảnh phủ']:
            page.evaluate('''()=>{
              window.sarFileReadStarted=false;
              const read=FileReader.prototype.readAsArrayBuffer;
              FileReader.prototype.readAsArrayBuffer=function(blob){
                FileReader.prototype.readAsArrayBuffer=read;
                window.sarFileReadStarted=true;
                window.releaseSarFileRead=()=>read.call(this,blob);
              };
            }''')
            layers.get_by_label('Nhập GeoTIFF',exact=True).set_input_files({'name':'sar-late.tif','mimeType':'image/tiff','buffer':(root/'sar.tif').read_bytes()})
            page.wait_for_function('window.sarFileReadStarted===true')
            expect(layers.get_by_role('radio',name='Tắt ảnh phủ',exact=True)).not_to_be_checked()
            layers.get_by_role('radio',name=next_source).check()
            expect(layers.get_by_label('Nhập GeoTIFF',exact=True)).to_be_enabled()
            page.evaluate('window.releaseSarFileRead()')
            page.wait_for_timeout(400)
            expect(layers.get_by_role('radio',name=next_source)).to_be_checked()
            expect(layers.get_by_role('checkbox',name='sar-late.tif',exact=True)).to_have_count(0)
        # Continue the original remove/restore checks with the imported raster active.
        layers.get_by_label('Nhập GeoTIFF',exact=True).set_input_files(str(root/'sar.tif'))
        expect(layers.get_by_label('Kênh SAR',exact=True)).to_be_visible(timeout=15000)
        checkpoint('retain terrain renderer after SAR update')
        assert page.evaluate('window.originalTerrainCanvas===document.querySelector(".terrain-canvas")'), 'Overlay controls reset the renderer'
        layers.get_by_role('button',name='Gỡ lớp SAR',exact=True).click()
        checkpoint('remove contour labels')
        layers.get_by_label('Đường đồng mức',exact=True).uncheck()
        expect(page.locator('.terrain-contour-label')).to_have_count(0)
        page.keyboard.press('Escape')
        page.get_by_role('button',name='Cài đặt',exact=True).click()
        page.get_by_role('button',name='Mô hình địa hình',exact=True).click()
        dialog=page.get_by_role('dialog',name='Mô hình địa hình',exact=True)
        checkpoint('import local tile model')
        directory=dialog.locator('input[webkitdirectory]')
        expect(directory).to_be_enabled()
        directory.set_input_files(str(package))
        checkpoint('await local model dialog closure')
        try:
            # Software rendering replaces the prepared terrain and its GPU resources
            # here. CI has completed this transition just beyond 30 s; keep a bounded
            # 60 s budget and still fail on a stuck import or a rejected package.
            expect(dialog).not_to_be_visible(timeout=60000)
        except Exception:
            # Report only an allowlisted diagnosis of this generated fixture.
            # Arbitrary DOM text, file names and error payloads stay in the job log.
            if page.is_closed():
                checkpoint('terrain page closed during model import')
                raise
            if not dialog.is_visible():
                checkpoint('local model import completed after the deadline')
                raise
            alert=dialog.locator('.upload-error')
            if alert.count():
                message=alert.inner_text().lower()
                categories=[('tile package is incomplete','incomplete fixture tiles'),('unsafe tile path','unsafe fixture tile path'),
                    ('does not match','fixture metadata mismatch'),('duplicate','duplicate fixture assets'),
                    ('could not be read','fixture file read failed'),('failed to fetch','fixture module request failed'),
                    ('json','fixture JSON rejected')]
                checkpoint(next((label for text,label in categories if text in message),'unexpected fixture import error'))
            elif directory.count() and directory.is_disabled():
                checkpoint('local model import still busy')
            else:
                checkpoint('local model import did not start or was cancelled')
            raise
        checkpoint('await imported model renderer')
        page.wait_for_function('''()=>{
            const canvas=document.querySelector('.terrain-canvas');
            return canvas && canvas!==window.originalTerrainCanvas && canvas.width>0 && canvas.height>0;
        }''',timeout=60000)
        expect(page.locator('.terrain-canvas')).to_be_visible()
        page.wait_for_timeout(1000)
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        layers=page.locator('.layers-panel')
        layers.locator('.layer-terrain > summary').click()
        checkpoint('enable contours')
        layers.get_by_label('Đường đồng mức',exact=True).check()
        expect(page.locator('.terrain-contour-label').first).to_be_attached(timeout=15000)
        canvas=page.locator('.terrain-canvas').bounding_box()
        clip={'x':canvas['x']+canvas['width']*.55,'y':canvas['y']+canvas['height']*.46,'width':80,'height':80}
        checkpoint('capture local imagery reference')
        tile_image=page.screenshot(clip=clip)
        checkpoint('hide local imagery')
        layers.get_by_role('radio',name='Địa hình',exact=True).check()
        assert page.screenshot(clip=clip)!=tile_image, 'Turning imagery off did not hide local tiles'
        checkpoint('restore local imagery')
        layers.get_by_role('radio',name='Ảnh nền',exact=True).check()
        page.wait_for_timeout(300)
        assert page.screenshot(clip=clip)==tile_image, 'Turning imagery on did not restore local tiles'
        layers.locator('.terrain-sar-controls > summary').click()
        checkpoint('import SAR raster')
        layers.get_by_label('Nhập GeoTIFF',exact=True).set_input_files(str(root/'sar.tif'))
        expect(layers.get_by_label('Kênh SAR',exact=True)).to_be_visible(timeout=15000)
        page.wait_for_timeout(500)
        checkpoint('verify SAR shades local tile model')
        assert page.screenshot(clip=clip)!=tile_image, 'SAR did not shade the local tile model'
        layers.get_by_label('Kênh SAR',exact=True).select_option('1')
        page.wait_for_timeout(300)
        layers.get_by_role('button',name='Gỡ lớp SAR',exact=True).click()
        page.wait_for_timeout(100)
        checkpoint('verify SAR removal restores local imagery')
        assert page.screenshot(clip=clip)==tile_image, 'Removing SAR did not restore the local tile material'
        page.keyboard.press('Escape')
        page.get_by_role('button',name='Cài đặt',exact=True).click()
        page.get_by_role('button',name='Tối',exact=True).click()
        page.keyboard.press('Escape')
        page.get_by_role('button',name='Lớp bản đồ',exact=True).click()
        checkpoint('mobile layer panel layout')
        page.set_viewport_size({'width':390,'height':844})
        expect(page.locator('.layers-panel')).to_be_visible()
        panel=page.locator('.layers-panel').bounding_box()
        assert panel['x']>=0 and panel['x']+panel['width']<=391, panel
        checkpoint('verify no browser or GPU errors')
        assert not errors, errors
        page.screenshot(path=str(Path(tempfile.gettempdir())/'dear-terrain-overlays.png'))
        browser.close()
    print('Terrain overlays passed: contours, intervals, SAR bands/opacity/removal, retained renderer and local tile package without UVs.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--url',default='http://127.0.0.1:5217'); parser.add_argument('--chrome'); args=parser.parse_args()
    try:
        run(args.url.rstrip('/'),args.chrome)
    except Exception:
        print(f'::error title=Terrain overlay check failed::{_current_phase}', flush=True)
        raise
