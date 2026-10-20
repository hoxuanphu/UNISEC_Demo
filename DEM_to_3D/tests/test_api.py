import json
import shutil
import time
import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
from DEM_to_3D.api import HERE, SplitOptions, TerrainOptions, build_command, create_app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.root = HERE / ('.api-test-' + uuid4().hex)
        self.app = create_app(self.root)
        self.context = TestClient(self.app)
        self.client = self.context.__enter__()

    def tearDown(self):
        self.context.__exit__(None, None, None)
        shutil.rmtree(self.root, ignore_errors=True)

    def test_health_and_origin(self):
        self.assertEqual(self.client.get('/api/health').json()['status'], 'ok')
        self.assertEqual(self.client.get('/api/health', headers={'Origin': 'https://untrusted.example'}).status_code, 403)
        self.assertEqual(self.client.get('/api/health', headers={'Origin': 'http://localhost:5173'}).headers['access-control-allow-origin'], 'http://localhost:5173')

    def test_validation(self):
        for options in ['{"max_vertices": 99999999}', '{"version":"v3"}', '{"exaggeration": "NaN"}', '{"output":"../../bad"}']:
            response = self.client.post('/api/jobs/terrain', files={'dem': ('dem.tif', b'x')}, data={'options': options})
            self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(self.client.post('/api/jobs/terrain', files={'dem': ('dem.exe', b'x')}).status_code, 422)
        self.assertEqual(self.client.post('/api/jobs/split', files={'dem': ('dem.tif', b'x')}).status_code, 422)
        self.assertEqual(self.client.post('/api/jobs/terrain', files={'dem': ('dem.tif', b'')}).status_code, 422)
        self.assertEqual(self.client.get('/api/jobs/not-a-job').status_code, 404)
        self.assertFalse(self.app.state.store.jobs)

    def test_shapefile_validation(self):
        files = [('dem', ('dem.tif', b'x')), ('shapes', ('one.shp', b'x')), ('shapes', ('two.dbf', b'x'))]
        self.assertEqual(self.client.post('/api/jobs/split', files=files).status_code, 422)
        with self.assertRaises(ValueError):
            SplitOptions(code='123', name='Somewhere')

    def test_safe_command(self):
        options = TerrainOptions(commune='--verbose', formats=['glb', 'ply'])
        command = build_command('terrain', options, self.root, self.root / 'input.tif')
        self.assertIn('--commune=--verbose', command)
        self.assertIn('glb,ply', command)
        self.assertIn(str(HERE / 'dem_to_3d_v2.py'), command)
        self.assertNotIn('shell', command)

    def test_real_small_generated_terrain(self):
        import numpy as np
        from rasterio.io import MemoryFile
        from rasterio.transform import from_origin
        with MemoryFile() as memory:
            with memory.open(driver='GTiff', width=8, height=8, count=1, dtype='float32', crs='EPSG:32648', transform=from_origin(500000, 2400000, 30, 30), nodata=-9999) as dataset:
                dataset.write(np.arange(64, dtype='float32').reshape(1, 8, 8))
            payload = memory.read()
        response = self.client.post('/api/jobs/terrain', files={'dem': ('../../source.tif', payload)}, data={'options': json.dumps({'formats': ['glb'], 'step': 1, 'colormap': 'none'})})
        self.assertEqual(response.status_code, 202, response.text)
        key = response.json()['id']
        for _ in range(200):
            job = self.client.get('/api/jobs/' + key).json()
            if job['status'] not in ('queued', 'running'):
                break
            time.sleep(0.1)
        self.assertEqual(job['status'], 'succeeded', job)
        self.assertTrue({'terrain.glb', 'terrain.terrain.json', 'terrain.grid.bin'} <= {item['name'] for item in job['files']})
        for item in job['files']:
            result = self.client.get(item['url'])
            self.assertEqual(result.status_code, 200)
            self.assertEqual(len(result.content), item['size'])
        self.assertEqual(self.client.get(f'/api/jobs/{key}/files/status.json').status_code, 404)
        self.assertEqual(self.client.delete('/api/jobs/' + key).status_code, 204)
        self.assertEqual(self.client.get('/api/jobs/' + key).status_code, 404)

    def test_failure_is_structured(self):
        response = self.client.post('/api/jobs/terrain', files={'dem': ('dem.tif', b'not a raster')})
        key = response.json()['id']
        for _ in range(200):
            job = self.client.get('/api/jobs/' + key).json()
            if job['status'] == 'failed':
                break
            time.sleep(0.05)
        self.assertEqual(job['status'], 'failed')
        self.assertEqual(job['error']['code'], 'processing_failed')
        self.assertFalse(job['files'])

    def test_limits(self):
        with patch('DEM_to_3D.api.MAX_BODY', 20):
            response = self.client.post('/api/jobs/terrain', files={'dem': ('dem.tif', b'x' * 40)})
            self.assertEqual(response.status_code, 413)
        with patch('DEM_to_3D.api.MAX_JOBS', 0):
            self.assertEqual(self.client.post('/api/jobs/terrain', files={'dem': ('dem.tif', b'x')}).status_code, 429)

    def test_timeout(self):
        import sys
        with patch('DEM_to_3D.api.TIMEOUT', 0.05), patch('DEM_to_3D.api.build_command', return_value=[sys.executable, '-c', 'import time; time.sleep(10)']):
            response = self.client.post('/api/jobs/terrain', files={'dem': ('dem.tif', b'x')})
            key = response.json()['id']
            for _ in range(100):
                job = self.client.get('/api/jobs/' + key).json()
                if job['status'] == 'failed':
                    break
                time.sleep(0.02)
            self.assertEqual(job['error']['code'], 'timeout')

    def test_real_small_split(self):
        import numpy as np
        import shapefile
        from rasterio.io import MemoryFile
        from rasterio.crs import CRS
        from rasterio.transform import from_origin
        with MemoryFile() as memory:
            with memory.open(driver='GTiff', width=8, height=8, count=1, dtype='float32', crs='EPSG:32648', transform=from_origin(500000, 2400000, 30, 30), nodata=-9999) as dataset:
                dataset.write(np.arange(64, dtype='float32').reshape(1, 8, 8))
            payload = memory.read()
        fixture = self.root / 'fixture'
        fixture.mkdir()
        base = fixture / 'commune'
        with shapefile.Writer(str(base)) as writer:
            writer.field('ma_huyen', 'C')
            writer.field('ten_huyen', 'C')
            writer.field('ten_tinh', 'C')
            writer.poly([[[500000, 2400000], [500240, 2400000], [500240, 2399760], [500000, 2399760], [500000, 2400000]]])
            writer.record('123', 'Test', 'Province')
        base.with_suffix('.prj').write_text(CRS.from_epsg(32648).to_wkt())
        files = [('dem', ('dem.tif', payload))]
        files.extend(('shapes', (path.name, path.read_bytes())) for path in fixture.iterdir())
        response = self.client.post('/api/jobs/split', files=files, data={'options': '{"code":"123"}'})
        self.assertEqual(response.status_code, 202, response.text)
        key = response.json()['id']
        for _ in range(100):
            job = self.client.get('/api/jobs/' + key).json()
            if job['status'] not in ('queued', 'running'):
                break
            time.sleep(0.05)
        self.assertEqual(job['status'], 'succeeded', job)
        self.assertEqual(job['files'][0]['name'], 'Test_123.tif')

    def test_restart_and_cleanup(self):
        from DEM_to_3D.api import JobStore
        key = uuid4().hex
        (self.root / key).mkdir()
        job = {'id': key, 'status': 'running', 'timestamp': time.time(), 'files': []}
        (self.root / key / 'status.json').write_text(json.dumps(job))
        store = JobStore(self.root)
        store.restore()
        self.assertEqual(store.jobs[key]['error']['code'], 'interrupted')
        store.jobs[key]['timestamp'] = 0
        store.cleanup()
        self.assertFalse((self.root / key).exists())


if __name__ == '__main__':
    unittest.main()
