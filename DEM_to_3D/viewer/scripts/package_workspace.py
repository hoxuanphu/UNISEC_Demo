"""Package a built workspace, local server and checksums. No downloads at runtime."""
import argparse
import hashlib
import json
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from workspace_configuration import workspace_manifest_path

ROOT = Path(__file__).resolve().parents[1]


def package_workspace(dist, destination):
    dist, destination = Path(dist).resolve(), Path(destination).resolve()
    required = ['index.html', 'scenarios/incident-v1.schema.json']
    for relative in required:
        if not (dist / relative).is_file():
            raise ValueError(f'Missing build asset: {relative}')
    manifest_path, _ = workspace_manifest_path(dist)
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    assets = [manifest['workspace'], *manifest['terrain'].values()]
    for asset in assets:
        if not isinstance(asset, dict) or 'url' not in asset:
            continue
        path = (dist / asset['url'].lstrip('/')).resolve()
        if not path.is_relative_to(dist):
            raise ValueError('Asset path outside build')
        content = path.read_bytes()
        if len(content) != asset['byteLength'] or hashlib.sha256(content).hexdigest() != asset['sha256']:
            raise ValueError(f'Asset checksum mismatch: {asset["url"]}')
    files = {}
    for path in sorted(dist.rglob('*')):
        if path.is_file():
            if not path.resolve().is_relative_to(dist):
                raise ValueError('Build symlink outside package')
            files['dist/' + path.relative_to(dist).as_posix()] = path.read_bytes()
    files['scripts/serve_workspace.py'] = (ROOT / 'scripts/serve_workspace.py').read_bytes()
    files['scripts/workspace_configuration.py'] = (ROOT / 'scripts/workspace_configuration.py').read_bytes()
    files['Start.ps1'] = b'''param([int]$Port = 5212)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 scripts/serve_workspace.py --offline --port $Port
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    & python scripts/serve_workspace.py --offline --port $Port
} else { throw 'Python 3.11+ is required.' }
'''
    files['README.md'] = b'''# DEAR workspace

Requires Python 3.11+. Run `powershell -ExecutionPolicy Bypass -File .\\Start.ps1`.
Open http://127.0.0.1:5212. Stop the server with Ctrl+C.

The prepared packet, imagery, terrain and fonts are included. Internet is optional.
Use the account menu to reset the session. PDF uses browser Print / Save PDF.
Image comparison accepts georeferenced 8-bit display GeoTIFF pairs.

Data status and source limitations are in the app's data panel and manifest.
This package contains synthetic, draft incident data; it is not an approved response dataset.
Version and file checksums: release.json.
'''
    files['licenses/lucide.txt'] = (ROOT / 'vendor/lucide/LICENSE').read_bytes()
    lock = json.loads((ROOT / 'package-lock.json').read_text(encoding='utf-8'))
    for package_path, metadata in lock['packages'].items():
        if not package_path.startswith('node_modules/') or metadata.get('dev'):
            continue
        package = package_path.removeprefix('node_modules/')
        directory = ROOT / package_path
        for license_path in directory.glob('*'):
            if license_path.is_file() and license_path.name.lower().startswith(('license', 'copying', 'notice')):
                files['licenses/' + package + '/' + license_path.name] = license_path.read_bytes()
    revision = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    dirty = subprocess.run(['git', 'status', '--porcelain', '--', '.'], cwd=ROOT,
                           capture_output=True, text=True, check=True).stdout.strip()
    release = {'createdAt': datetime.now(timezone.utc).isoformat(), 'sourceCommit': revision, 'sourceTreeDirty': bool(dirty),
               'datasetVersion': manifest['datasetVersion'], 'dataKind': manifest['dataKind'], 'reviewStatus': manifest['reviewStatus'],
               'files': {name: hashlib.sha256(content).hexdigest() for name, content in files.items()}}
    files['release.json'] = json.dumps(release, indent=2).encode()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return release


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', type=Path, default=ROOT / 'dist')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = package_workspace(args.dist, args.output)
    print(f'Packaged {len(result["files"])} files: {args.output}')
