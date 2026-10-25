"""The SAR preview must respect sigma0 power values and source NoData."""
import sys
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
try:
    from osgeo import gdal, osr
    gdal.UseExceptions()
except ImportError:
    gdal = osr = None
from prepare_strix_sar import sigma0_rgba, prepare


class StrixPreviewTests(unittest.TestCase):
    def test_power_to_db_and_fixed_range(self):
        rgba = sigma0_rgba(np.array([[.01,.1,1,10]],dtype=np.float32))
        np.testing.assert_array_equal(rgba[0],[[0,102,204,255]])
        np.testing.assert_array_equal(rgba[0],rgba[1])
        np.testing.assert_array_equal(rgba[1],rgba[2])
        self.assertTrue(np.all(rgba[3]==255))

    def test_nodata_is_transparent_even_when_valid_dark_pixels_are_black(self):
        rgba = sigma0_rgba(np.array([[0,-1,np.nan,np.inf,.001]],dtype=np.float32))
        np.testing.assert_array_equal(rgba[3],[[0,0,0,0,255]])
        self.assertTrue(np.all(rgba[:3]==0))

    @unittest.skipIf(gdal is None, 'GDAL bindings required for integration: run with QGIS Python')
    def test_preparation_excludes_nodata_from_power_average_and_keeps_source_bytes(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            source=root/'IMG-VV-STRIX007-20261020T185150Z-STORT-sigma0.tif'
            dataset=gdal.GetDriverByName('GTiff').Create(str(source),8,9,1,gdal.GDT_Float32)
            crs=osr.SpatialReference(); crs.ImportFromEPSG(32648)
            dataset.SetProjection(crs.ExportToWkt()); dataset.SetGeoTransform([400000,1.25,0,2410000,0,-1.25])
            power=np.zeros((9,8),dtype=np.float32);power[0,0]=.1;power[-1,-1]=1
            dataset.GetRasterBand(1).SetNoDataValue(0);dataset.GetRasterBand(1).WriteArray(power)
            dataset=None
            original=hashlib.sha256(source.read_bytes()).hexdigest()
            (root/'imagery.json').write_text('{"layers":[]}',encoding='utf8')
            prepare(source,root,'linear')
            image=gdal.Open(str(root/'strix007-oct20-vv.utm.webp')).ReadAsArray()
            np.testing.assert_array_equal(image[0],[[102,0],[0,0],[0,204]])
            np.testing.assert_array_equal(image[3],[[255,0],[0,0],[0,255]])
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(),original)
            layer=json.loads((root/'imagery.json').read_text(encoding='utf8'))['layers'][0]
            self.assertEqual(set(layer['modes']),{'vv'})
            self.assertEqual(layer['acquired'],'2026-10-20T18:51:50Z')
            self.assertEqual(layer['modes']['vv']['terrain']['bounds'],[400000,2409985,400010,2410000])
            self.assertEqual(layer['modes']['vv']['terrain']['crs'],'EPSG:32648')
            self.assertFalse(list(root.glob('*.aux.xml')))


if __name__ == '__main__': unittest.main()
