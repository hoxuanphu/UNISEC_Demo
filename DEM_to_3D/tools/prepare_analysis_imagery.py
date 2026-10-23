"""Build DEAR analysis-imagery display products from the Planet and Sentinel-1 sources.

Each product is written twice: EPSG:32648 (terrain CRS, linear UVs in 3D) and EPSG:3857
(exact Leaflet image overlay). Values are display renderings, never analysis inputs.

  python tools/prepare_analysis_imagery.py <resources/dear> viewer/public/scenarios/che-tao/imagery

Needs rasterio, numpy and Pillow. Update the manifest checksum of imagery.json afterwards.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.merge import merge
from imagery_mosaic import optical_mosaic
from planet_sources import PLANET_DATES, select_scene
from rasterio.warp import calculate_default_transform, reproject, transform_bounds

parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
parser.add_argument('source', type=Path, help='folder with planet/ and sar/')
parser.add_argument('out', type=Path)
group = parser.add_mutually_exclusive_group()
group.add_argument('--optical-only', action='store_true', help='Rebuild Planet display products and retain the existing SAR catalog/assets')
group.add_argument('--sar-only', action='store_true', help='Rebuild SAR display products and retain the existing Planet catalog/assets')
arguments = parser.parse_args()
SOURCE, OUT = arguments.source, arguments.out
OUT.mkdir(parents=True, exist_ok=True)
TERRAIN, WEB = 'EPSG:32648', 'EPSG:3857'

NAMES = {'planet-post': ['PlanetScope sau mưa', 'PlanetScope post-monsoon'], 'planet-pre': ['PlanetScope trước mưa', 'PlanetScope pre-monsoon'],
         'planet-sep01': ['PlanetScope đối chiếu', 'PlanetScope reference'],
         'sentinel1': ['Sentinel-1 SAR', 'Sentinel-1 SAR']}
# Clearest post-monsoon scene per road strip (pixel cloud test and clear pixels over the field
# KML scars); 12/09 has haze over RoadPart1, so 01/09 is used there. Pre-monsoon: clearest
# April scene, including the additional RoadPart1 clip from 12/04.
# Fixed σ⁰ display ranges (dB). Fixed ranges keep two renderings comparable; a per-image
# percentile stretch would not. They span this scene's 2–98 % values with margin.
SAR_RANGES = {'vv': (-20.0, 5.0), 'vh': (-27.0, -2.0), 'ratio': (0.0, 15.0)}


def save(rgba: np.ndarray, name: str, lossless: bool = False) -> dict:
    path = OUT / f'{name}.webp'
    Image.fromarray(np.moveaxis(rgba, 0, -1)).save(path, 'WEBP', quality=88, alpha_quality=100, method=6, lossless=lossless)
    data = path.read_bytes()
    return {'url': path.name, 'byteLength': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'width': rgba.shape[2], 'height': rgba.shape[1]}


def warp(array: np.ndarray, src_transform, src_crs: str, dst_crs: str, resolution: float, resampling, nodata):
    bands, height, width = array.shape
    transform, w, h = calculate_default_transform(src_crs, dst_crs, width, height,
                                                  *rasterio.transform.array_bounds(height, width, src_transform), resolution=resolution)
    out = np.full((bands, h, w), nodata, dtype=array.dtype)
    reproject(array, out, src_transform=src_transform, src_crs=src_crs, dst_transform=transform, dst_crs=dst_crs,
              resampling=resampling, src_nodata=nodata, dst_nodata=nodata)
    return out, transform


def bounds(transform, shape) -> list[float]:
    left, bottom, right, top = rasterio.transform.array_bounds(shape[-2], shape[-1], transform)
    return [round(v, 3) for v in (left, bottom, right, top)]


def trim(array: np.ndarray, transform, alpha: np.ndarray):
    rows, cols = np.where(alpha.any(1))[0], np.where(alpha.any(0))[0]
    r0, r1, c0, c1 = rows.min(), rows.max() + 1, cols.min(), cols.max() + 1
    return array[:, r0:r1, c0:c1], transform * rasterio.Affine.translation(c0, r0)


def output(rgba: np.ndarray, transform, crs: str, name: str, resolution: float, lossless=False) -> dict:
    rgba, transform = trim(rgba, transform, rgba[3] > 0)
    terrain = save(rgba, f'{name}.utm', lossless) | {'crs': crs, 'bounds': bounds(transform, rgba.shape)}
    # Web Mercator metres stretch by 1/cos(latitude); keep roughly the source ground resolution.
    web_rgba, web_transform = warp(rgba, transform, crs, WEB, resolution / np.cos(np.radians(21.77)), Resampling.bilinear, 0)
    web_rgba[:, web_rgba[3] < 128] = 0
    web_rgba[3][web_rgba[3] > 0] = 255
    web_rgba, web_transform = trim(web_rgba, web_transform, web_rgba[3] > 0)
    west, south, east, north = transform_bounds(WEB, 'EPSG:4326', *rasterio.transform.array_bounds(web_rgba.shape[1], web_rgba.shape[2], web_transform))
    web = save(web_rgba, f'{name}.web', lossless) | {'latLngBounds': [[round(south, 7), round(west, 7)], [round(north, 7), round(east, 7)]]}
    return {'terrain': terrain, 'web': web}


manifest = {'layers': []}
if arguments.sar_only:
    previous = json.loads((OUT / 'imagery.json').read_text(encoding='utf-8'))
    manifest['layers'].extend(layer for layer in previous['layers'] if layer['kind'] != 'sar')
for layer, dates in ([] if arguments.sar_only else PLANET_DATES.items()):
    parts, inputs = [], []
    for part, date in dates.items():
        scene=select_scene(SOURCE,part,date)
        tif,meta=scene.path,scene.properties
        with rasterio.open(tif) as src:
            assert src.crs.to_string() == TERRAIN, src.crs
            rgba = src.read()
            transform = src.transform
        rgba[:, rgba[3] == 0] = 0
        inputs.append((rgba, transform))
        name = f'{layer}-{part.lower()}'
        parts.append({'id': name, 'part': part, 'acquired': meta['acquired'], 'source': f"Planet PSScene visual, strip {meta['strip_id']}",
                      'gsdM': meta['gsd'], 'pixelM': 3.0, 'cloudPercent': meta['cloud_percent'], 'clearPercent': meta['clear_percent'],
                      **output(rgba, transform, TERRAIN, name, 3.0, lossless=True)})
        print(name, date, parts[-1]['terrain']['byteLength'], parts[-1]['web']['byteLength'])
    mosaic_rgba, mosaic_transform = optical_mosaic(inputs)
    mosaic = output(mosaic_rgba, mosaic_transform, TERRAIN, f'{layer}-mosaic', 3.0, lossless=True)
    manifest['layers'].append({'id': layer, 'name': NAMES[layer], 'kind': 'optical', 'parts': parts,
                              'mosaic': mosaic, 'displayProcessing': 'Valid-pixel overlap feathering, 60 m; no gap fill; source acquisition dates retained.'})

if arguments.optical_only:
    previous = json.loads((OUT / 'imagery.json').read_text(encoding='utf-8'))
    manifest['layers'].extend(layer for layer in previous['layers'] if layer['kind'] != 'optical')
    (OUT / 'imagery.json').write_bytes(json.dumps(manifest, ensure_ascii=False, indent=1).encode('utf-8'))
    print('Optical mosaics rebuilt; SAR products retained.')
    raise SystemExit(0)

def render_sar(db, transform, crs, layer_id, acquired, files, **metadata):
    """Fixed dB ranges for every date; only prepared display pixels are stretched."""
    db[~np.isfinite(db)] = np.nan
    warped, warped_transform = warp(db, transform, crs, TERRAIN, 10.0, Resampling.bilinear, np.nan)
    valid = np.isfinite(warped).all(0)
    vv, vh = warped
    scaled = {key: np.clip((value - lo) / (hi - lo), 0, 1) for key, value, (lo, hi) in
              (('vv', vv, SAR_RANGES['vv']), ('vh', vh, SAR_RANGES['vh']), ('ratio', vv - vh, SAR_RANGES['ratio']))}
    renders = {'vv': [scaled['vv']] * 3, 'vh': [scaled['vh']] * 3,
               'rgb': [scaled['vv'], scaled['vh'], scaled['ratio']]}
    products = {}
    for mode, channels in renders.items():
        rgba = np.zeros((4, *valid.shape), dtype=np.uint8)
        for band, channel in enumerate(channels):
            rgba[band] = np.where(valid, np.round(np.nan_to_num(channel) * 255), 0).astype(np.uint8)
        rgba[3] = np.where(valid, 255, 0)
        products[mode] = output(rgba, warped_transform, TERRAIN, f'{layer_id}-{mode}', 10.0)
        print(layer_id, mode, products[mode]['terrain']['byteLength'], products[mode]['web']['byteLength'])
    manifest['layers'].append({'id': layer_id, 'name': NAMES['sentinel1'], 'kind': 'sar',
                               'acquired': acquired,
                               'source': 'Copernicus Sentinel-1D IW GRDH 1SDV (Google Earth Engine COPERNICUS/S1_GRD)',
                               'pixelM': 10.0, 'polarizations': ['VV', 'VH'], 'rangesDb': SAR_RANGES,
                               'sourceFiles': [{'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in files],
                               **metadata, 'modes': products})


# These two exports belong to 18 October; do not merge other acquisitions/CRSs.
sar_files = [SOURCE / 'sar' / name for name in (
    's1gee_04489_2026-09-20_2026-10-20.tif',
    's1gee_S1D_IW_GRDH_1SDV_20261018T110538_2026101_2026-10-18.tif',
)]
sources = [rasterio.open(path) for path in sar_files]
try:
    if any(src.crs.to_string() != 'EPSG:4326' or src.descriptions != ('VV', 'VH') for src in sources):
        raise ValueError('Unexpected 18 October SAR CRS/bands')
    db, sar_transform = merge(sources, nodata=np.nan, dtype='float32')
finally:
    for src in sources:
        src.close()
render_sar(db, sar_transform, 'EPSG:4326', 'sentinel1', '2026-10-18T11:05:38Z', sar_files)

# The separate UTM export has explicit source scene/date metadata. Keep its own
# footprint and acquisition; it is not another tile of the 18 October mosaic.
pre_path = SOURCE / 'sar' / 'Sentinel1_MuCangChai_CheTao_2026-10-11_20km_VV_VH_UTM48N.tif'
with rasterio.open(pre_path) as src:
    tags = src.tags()
    scene = tags.get('SOURCE_SCENE', '')
    if (src.crs.to_string() != TERRAIN or src.descriptions != ('VV', 'VH') or
            tags.get('ACQUISITION_DATE') != '2026-10-11' or
            scene != 'S1D_IW_GRDH_1SDV_20261011T111348_20261011T111413_004967_0095F5_9485'):
        raise ValueError('Unexpected 11 October SAR source metadata')
    render_sar(src.read(), src.transform, src.crs.to_string(), 'sentinel1-oct11',
               '2026-10-11T11:13:48Z', [pre_path], sourceScene=scene, orbitPass='ASCENDING')

# LF on every OS: the manifest checksum must match a Linux checkout (.gitattributes eol=lf).
(OUT / 'imagery.json').write_bytes(json.dumps(manifest, ensure_ascii=False, indent=1).encode('utf-8'))
print('total', sum(p.stat().st_size for p in OUT.glob('*.webp')) // 1024, 'KB')
