"""Serve the built workspace and a read-only prepared-snapshot API.

Local integration service. No ingestion, image processing or persistence.
"""
import argparse
import hashlib
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from workspace_configuration import workspace_manifest_path

DEFAULT_DIST = Path(__file__).resolve().parents[1] / 'dist'


def create_server(directory=DEFAULT_DIST, host='127.0.0.1', port=5212, offline=False):
    directory = Path(directory).resolve()
    manifest_path, configuration = workspace_manifest_path(directory)
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    asset = manifest['workspace']
    packet_path = (directory / asset['url'].lstrip('/')).resolve()
    if not packet_path.is_relative_to(directory):
        raise ValueError('Packet path is outside the workspace')
    packet = packet_path.read_bytes()
    digest = hashlib.sha256(packet).hexdigest()
    if len(packet) != asset['byteLength'] or digest != asset['sha256']:
        raise ValueError('Incident packet checksum mismatch')
    if json.loads(packet)['incident']['id'] != manifest['incidentId']:
        raise ValueError('Incident ID mismatch')
    schema = (directory / 'scenarios/incident-v1.schema.json').read_bytes()
    endpoint = f"/api/v1/incidents/{manifest['incidentId']}/workspace"

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(directory), **kwargs)

        def do_GET(self):
            path = urlsplit(self.path).path
            payload = packet if path == endpoint else schema if path == '/api/v1/schema/incident-v1' else None
            if path == '/workspace-config.json':
                payload = json.dumps({**configuration, 'dataSource': 'prepared' if offline else 'api', 'offline': offline}).encode()
            if path == '/api/health':
                payload = json.dumps({'status': 'ready', 'datasetVersion': manifest['datasetVersion']}).encode()
            if payload is not None:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(payload)))
                self.send_header('Cache-Control', 'no-store')
                if path == endpoint:
                    self.send_header('ETag', f'"{digest}"')
                self.end_headers(); self.wfile.write(payload)
            elif path.startswith('/api/'):
                self.send_error(404, 'API resource not found')
            else:
                super().do_GET()

        def log_message(self, *args):
            pass

    return ThreadingHTTPServer((host, port), Handler)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=DEFAULT_DIST)
    parser.add_argument('--port', type=int, default=5212)
    parser.add_argument('--offline', action='store_true', help='Use the prepared packet and disable remote basemap at startup')
    args = parser.parse_args()
    with create_server(args.directory, port=args.port, offline=args.offline) as server:
        print(f'Workspace and snapshot API: http://127.0.0.1:{args.port}', flush=True)
        server.serve_forever()
