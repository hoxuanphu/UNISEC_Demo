"""Add the supplied single-VV STRIX sigma0 scene to the prepared imagery catalog.

Run with a GDAL Python environment (e.g. QGIS python-qgis-ltr.bat):
  prepare_strix_sar.py <sigma0.tif> <viewer/public/scenarios/che-tao/imagery> --input-scale linear

The supplied sigma0 product is interpreted as linear power, not raw amplitude/DN.
The explicit scale is retained in provenance because the TIFF has no band unit.
Average positive power pixels before 10*log10; never average zero NoData into them.
The 5 m display grid is not a claim about the sensor's spatial resolution.
"""
import argparse
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
LAYER_ID = 'strix007-oct20'
RANGE_DB = (-20.0, 5.0)
DISPLAY_PIXEL_M = 5.0


def sigma0_rgba(power, low=RANGE_DB[0], high=RANGE_DB[1]):
    """Fixed display range, transparent invalid/zero pixels, no change to source."""
    valid = np.isfinite(power) & (power > 0)
    db = np.zeros(power.shape, dtype=np.float32)
    np.log10(power, out=db, where=valid)
    grey = np.round(np.clip((10 * db - low) / (high - low), 0, 1) * 255).astype(np.uint8)
    rgba = np.zeros((4, *power.shape), dtype=np.uint8)
    rgba[:3] = np.where(valid, grey, 0)
    rgba[3] = np.where(valid, 255, 0)
    return rgba


def save_rgba(dataset, path):
    from osgeo import gdal
    result = gdal.GetDriverByName('WEBP').CreateCopy(str(path), dataset, options=['LOSSLESS=YES', 'QUALITY=90'])
    result = None
    return {'url': path.name, 'byteLength': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'width': dataset.RasterXSize, 'height': dataset.RasterYSize}


def prepare(source, output, input_scale):
    from osgeo import gdal, osr
    gdal.UseExceptions()
    gdal.SetConfigOption('GDAL_PAM_ENABLED','NO')
    if input_scale != 'linear':
        raise ValueError('This preparer expects the supplied linear sigma0 power product')
    match = re.fullmatch(r'IMG-VV-(STRIX\d+)-(\d{8}T\d{6}Z)-STORT-sigma0.tif', source.name)
    if not match:
        raise ValueError('Expected single-VV STRIX STORT sigma0 product name')
    sensor, stamp = match.groups()
    if sensor != 'STRIX007' or stamp != '20261020T185150Z':
        raise ValueError('This catalog entry is reserved for STRIX007 acquisition 20261020T185150Z')
    acquired = datetime.strptime(stamp, '%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
    original = gdal.Open(str(source))
    crs = osr.SpatialReference(wkt=original.GetProjection())
    transform = original.GetGeoTransform()
    if (original.RasterCount != 1 or crs.GetAuthorityCode(None) != '32648' or
            transform[2] != 0 or transform[4] != 0 or transform[1] <= 0 or transform[5] >= 0 or
            original.GetRasterBand(1).GetNoDataValue() != 0):
        raise ValueError('Unexpected STRIX band, CRS, grid or NoData')
    # Preserve the real footprint. No clipping to the current viewport, gap fill or fabricated bands.
    left, top = transform[0], transform[3]
    right = left + math.ceil(original.RasterXSize * transform[1] / DISPLAY_PIXEL_M) * DISPLAY_PIXEL_M
    bottom = top - math.ceil(original.RasterYSize * -transform[5] / DISPLAY_PIXEL_M) * DISPLAY_PIXEL_M
    projected = gdal.Warp('', original, format='MEM', dstSRS='EPSG:32648', xRes=DISPLAY_PIXEL_M,
                          yRes=DISPLAY_PIXEL_M, resampleAlg='average', srcNodata=0, dstNodata=0,
                          outputBounds=[left,bottom,right,top], overviewLevel='NONE', outputType=gdal.GDT_Float32)
    rgba = sigma0_rgba(projected.ReadAsArray())
    if not np.any(rgba[3]):
        raise ValueError('No valid positive sigma0 pixels')
    terrain = gdal.GetDriverByName('MEM').Create('', projected.RasterXSize, projected.RasterYSize, 4, gdal.GDT_Byte)
    terrain.SetProjection(projected.GetProjection()); terrain.SetGeoTransform(projected.GetGeoTransform())
    for index, colour in enumerate([gdal.GCI_RedBand,gdal.GCI_GreenBand,gdal.GCI_BlueBand,gdal.GCI_AlphaBand], 1):
        terrain.GetRasterBand(index).WriteArray(rgba[index-1]); terrain.GetRasterBand(index).SetColorInterpretation(colour)
    output.mkdir(parents=True, exist_ok=True)
    gt = terrain.GetGeoTransform()
    bounds = [gt[0], gt[3] + terrain.RasterYSize * gt[5], gt[0] + terrain.RasterXSize * gt[1], gt[3]]
    terrain_asset = save_rgba(terrain, output / f'{LAYER_ID}-vv.utm.webp') | {'crs':'EPSG:32648','bounds':bounds}
    web = gdal.Warp('', terrain, format='MEM', dstSRS='EPSG:3857', srcAlpha=True, dstAlpha=True,
                    xRes=DISPLAY_PIXEL_M/math.cos(math.radians(21.8)), yRes=DISPLAY_PIXEL_M/math.cos(math.radians(21.8)),
                    resampleAlg='bilinear')
    mercator = osr.SpatialReference(); mercator.ImportFromEPSG(3857)
    geographic = osr.SpatialReference(); geographic.ImportFromEPSG(4326)
    for system in [mercator,geographic]: system.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    to_geo = osr.CoordinateTransformation(mercator,geographic)
    wgt = web.GetGeoTransform()
    west,south,_ = to_geo.TransformPoint(wgt[0],wgt[3]+web.RasterYSize*wgt[5])
    east,north,_ = to_geo.TransformPoint(wgt[0]+web.RasterXSize*wgt[1],wgt[3])
    web_asset = save_rgba(web, output / f'{LAYER_ID}-vv.web.webp') | {'latLngBounds':[[south,west],[north,east]]}
    layer = {'id':LAYER_ID,'name':['STRIX-007 SAR','STRIX-007 SAR'],'kind':'sar','sensor':sensor,'credit':'Synspective STRIX-007',
             'acquired':acquired,'acquiredBasis':'source filename UTC, not TIFF processing time',
             'source':f'{sensor} STORT sigma0, supplied single-VV GeoTIFF','pixelM':DISPLAY_PIXEL_M,
             'nativePixelM':transform[1], 'polarizations':['VV'],'rangesDb':{'vv':list(RANGE_DB)},
             'sourceFiles':[{'file':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest()}],
             'displayProcessing':{'inputScale':input_scale,'inputScaleBasis':'supplied sigma0 product; TIFF band unit absent',
                                  'formula':'10*log10(sigma0)','resampling':'average positive power to 5 m before logarithm',
                                  'sourceNodata':0,'stretchDb':list(RANGE_DB),'sourceModified':False},
             'modes':{'vv':{'terrain':terrain_asset,'web':web_asset}}}
    catalog_path = output / 'imagery.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf8'))
    catalog['layers'] = [item for item in catalog['layers'] if item['id'] != LAYER_ID] + [layer]
    catalog_path.write_bytes(json.dumps(catalog,ensure_ascii=False,indent=1).encode('utf8'))
    print(json.dumps({'id':layer['id'],'acquired':acquired,'nativePixelM':transform[1],
                      'displayPixelM':DISPLAY_PIXEL_M,'validPercent':float(np.mean(rgba[3]>0)*100),
                      'bounds':bounds,'files':[terrain_asset['byteLength'],web_asset['byteLength']]}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path); parser.add_argument('output',type=Path)
    parser.add_argument('--input-scale',required=True,choices=['linear'])
    args = parser.parse_args(); prepare(args.source,args.output,args.input_scale)
