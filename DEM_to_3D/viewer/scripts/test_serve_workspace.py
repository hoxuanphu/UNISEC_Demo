import hashlib
import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen

from serve_workspace import create_server


class SnapshotApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        folder = self.root / 'scenarios/che-tao/v0.2'
        folder.mkdir(parents=True)
        self.packet = b'{"incident":{"id":"event"}}'
        self.asset = {'url': '/scenarios/che-tao/v0.2/incident.json', 'byteLength': len(self.packet),
                      'sha256': hashlib.sha256(self.packet).hexdigest()}
        (folder / 'incident.json').write_bytes(self.packet)
        (folder / 'manifest.json').write_text(json.dumps({'incidentId': 'event', 'datasetVersion': 'v1', 'workspace': self.asset}))
        (self.root / 'scenarios/incident-v1.schema.json').write_text('{}')

    def test_serves_same_snapshot_and_explicit_api_configuration(self):
        server = create_server(self.root, port=0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f'http://127.0.0.1:{server.server_port}'
            with urlopen(base + '/api/v1/incidents/event/workspace') as response:
                self.assertEqual(response.read(), self.packet)
                self.assertEqual(response.headers['ETag'], '"' + self.asset['sha256'] + '"')
            with urlopen(base + '/workspace-config.json') as response:
                self.assertEqual(json.load(response), {'dataSource': 'api', 'offline': False, 'manifestUrl': '/scenarios/che-tao/v0.2/manifest.json'})
            with self.assertRaises(HTTPError) as error:
                urlopen(base + '/api/v1/incidents/unknown/workspace')
            self.assertEqual(error.exception.code, 404)
        finally:
            server.shutdown(); server.server_close(); thread.join()

    def test_refuses_corrupt_snapshot_before_opening_server(self):
        (self.root / 'scenarios/che-tao/v0.2/incident.json').write_bytes(b'changed data')
        with self.assertRaisesRegex(ValueError, 'checksum'):
            create_server(self.root, port=0)

    def test_offline_configuration_explicitly_uses_prepared_packet(self):
        server = create_server(self.root, port=0, offline=True)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with urlopen(f'http://127.0.0.1:{server.server_port}/workspace-config.json') as response:
                self.assertEqual(json.load(response), {'dataSource': 'prepared', 'offline': True, 'manifestUrl': '/scenarios/che-tao/v0.2/manifest.json'})
        finally:
            server.shutdown(); server.server_close(); thread.join()


if __name__ == '__main__':
    unittest.main()
