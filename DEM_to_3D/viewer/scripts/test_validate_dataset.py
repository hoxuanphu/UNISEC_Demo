import contextlib
import hashlib
import io
import json
import struct
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import validate_dataset as validator


class PreparedDatasetTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.canonical = Path(self.temp.name) / 'DEM_to_3D'
        self.canonical.mkdir()
        self.public = self.canonical / 'viewer' / 'public'
        self.manifest_path = self.public / 'scenarios' / 'manifest.json'
        self.manifest_path.parent.mkdir(parents=True)
        contents = {
            'glb': ('terrain.glb', b'mesh fixture'),
            'grid': ('terrain.grid.bin', b'grid fixture'),
            'metadata': ('terrain.terrain.json', json.dumps({
                'crs': {'authority': 'EPSG', 'code': 32648},
                'mesh': {'file': 'terrain.glb'},
                'grid': {'file': 'terrain.grid.bin'}
            }).encode())
        }
        self.manifest = {
            'schemaVersion': 1, 'datasetVersion': 'fixture-v1',
            'dataKind': 'synthetic', 'reviewStatus': 'draft',
            'incidentId': 'fixture', 'snapshotAt': '2026-09-29T09:31:00+07:00',
            'crs': 'EPSG:32648', 'counts': {'communities': 0, 'roads': 0, 'hazards': 0},
            'terrain': {}
        }
        for key, (name, content) in contents.items():
            (self.canonical / name).write_bytes(content)
            self.manifest['terrain'][key] = {
                'url': f'/terrain/{name}', 'byteLength': len(content),
                'sha256': hashlib.sha256(content).hexdigest()
            }
        self.enterContext(patch.object(validator, 'PUBLIC', self.public))

    def run_validator(self, prepare=False):
        self.manifest_path.write_text(json.dumps(self.manifest), encoding='utf-8')
        with contextlib.redirect_stdout(io.StringIO()):
            validator.main(prepare=prepare, manifest_path=self.manifest_path)

    def test_clean_checkout_prepares_verified_files(self):
        self.run_validator(prepare=True)
        self.run_validator()
        for asset in self.manifest['terrain'].values():
            name = Path(asset['url']).name
            self.assertEqual((self.public / 'terrain' / name).read_bytes(), (self.canonical / name).read_bytes())

    def test_prepare_restores_a_stale_generated_file(self):
        self.run_validator(prepare=True)
        grid = self.public / 'terrain' / 'terrain.grid.bin'
        grid.write_bytes(b'bad data here')
        with self.assertRaisesRegex(SystemExit, 'mismatch'):
            self.run_validator()
        self.run_validator(prepare=True)
        self.assertEqual(grid.read_bytes(), (self.canonical / grid.name).read_bytes())

    def test_bad_canonical_source_fails_before_any_copy(self):
        (self.canonical / 'terrain.grid.bin').write_bytes(b'bad source')
        with self.assertRaisesRegex(SystemExit, 'mismatch'):
            self.run_validator(prepare=True)
        self.assertFalse((self.public / 'terrain').exists())

    def test_metadata_mismatch_fails_before_any_copy(self):
        self.manifest['crs'] = 'EPSG:4326'
        with self.assertRaisesRegex(SystemExit, 'terrain CRS mismatch'):
            self.run_validator(prepare=True)
        self.assertFalse((self.public / 'terrain').exists())

    def test_invalid_date_and_parent_paths_are_rejected(self):
        self.manifest['snapshotAt'] = '2026-02-30T09:31:00+07:00'
        with self.assertRaisesRegex(SystemExit, 'snapshotAt'):
            self.run_validator(prepare=True)
        self.manifest['snapshotAt'] = '2026-09-29T09:31:00+07:00'
        self.manifest['terrain']['glb']['url'] = '/terrain/../outside.glb'
        with self.assertRaisesRegex(SystemExit, 'asset path'):
            self.run_validator(prepare=True)

    def add_embedded_image(self):
        png = b'\x89PNG\r\n\x1a\nimage fixture'
        document = json.dumps({'images': [{'bufferView': 0, 'mimeType': 'image/png'}],
                               'bufferViews': [{'byteOffset': 0, 'byteLength': len(png)}]}).encode()
        document += b' ' * (-len(document) % 4)
        binary = png + b'\0' * (-len(png) % 4)
        body = struct.pack('<II', len(document), 0x4e4f534a) + document + struct.pack('<II', len(binary), 0x004e4942) + binary
        glb = b'glTF' + struct.pack('<II', 2, len(body) + 12) + body
        (self.canonical / 'terrain.glb').write_bytes(glb)
        self.manifest['terrain']['glb'].update(byteLength=len(glb), sha256=hashlib.sha256(glb).hexdigest())
        self.manifest['terrain']['image'] = {'url': '/terrain/terrain.image.png', 'byteLength': len(png), 'sha256': hashlib.sha256(png).hexdigest()}
        return png

    def test_prepares_independent_png_from_verified_glb(self):
        png = self.add_embedded_image()
        self.run_validator(prepare=True)
        self.assertEqual((self.public / 'terrain/terrain.image.png').read_bytes(), png)
        self.run_validator()

    def test_wrong_image_checksum_fails_before_any_copy(self):
        self.add_embedded_image()
        self.manifest['terrain']['image']['sha256'] = '0' * 64
        with self.assertRaisesRegex(SystemExit, 'embedded image checksum'):
            self.run_validator(prepare=True)
        self.assertFalse((self.public / 'terrain').exists())

    def test_corrupt_glb_header_is_rejected(self):
        glb = self.canonical / 'corrupt.glb'
        glb.write_bytes(b'glTF' + b'\0' * 36)
        with self.assertRaisesRegex(SystemExit, 'invalid GLB'):
            validator.embedded_image(glb)


if __name__ == '__main__':
    unittest.main()
