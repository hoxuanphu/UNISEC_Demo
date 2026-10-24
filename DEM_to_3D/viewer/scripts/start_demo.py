"""Launch a verified, self-contained demo on loopback; no install or network."""
import argparse
import contextlib
import errno
import hashlib
import json
import os
import subprocess
import urllib.request
import webbrowser
from pathlib import Path
from serve_workspace import create_server

ROOT = Path(__file__).resolve().parents[1]


def verify_package(root):
    root = Path(root).resolve()
    release = json.loads((root / 'release.json').read_text(encoding='utf8'))
    for name, digest in release['files'].items():
        path = (root / name).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError('Package missing or changed: ' + name)
        with path.open('rb') as handle:
            actual = hashlib.file_digest(handle, 'sha256').hexdigest()
        if actual != digest:
            raise ValueError('Package missing or changed: ' + name)
    return release


def presentation_url(url):
    return url + '/'


def open_demo(url, root):
    url = presentation_url(url)
    if os.name == 'nt':
        candidates = [
            Path(os.environ.get('PROGRAMFILES', '')) / 'Google/Chrome/Application/chrome.exe',
            Path(os.environ.get('LOCALAPPDATA', '')) / 'Google/Chrome/Application/chrome.exe',
            Path(os.environ.get('PROGRAMFILES(X86)', '')) / 'Microsoft/Edge/Application/msedge.exe',
            Path(os.environ.get('PROGRAMFILES', '')) / 'Microsoft/Edge/Application/msedge.exe'
        ]
        browser = next((path for path in candidates if path.is_file()), None)
        if browser:
            profile = root / 'user-data/browser'
            profile.mkdir(parents=True, exist_ok=True)
            subprocess.Popen([
                str(browser), '--user-data-dir=' + str(profile), '--no-first-run',
                '--no-default-browser-check', '--start-maximized', '--app=' + url
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
    webbrowser.open(url)


def remembered_port(root):
    try:
        value = json.loads((root / 'user-data/server.json').read_text(encoding='utf8'))['port']
        return value if type(value) is int and 1 <= value <= 65535 else None
    except (OSError, ValueError, KeyError, TypeError):
        return None


def remember_port(root, port):
    try:
        path = root / 'user-data/server.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix('.tmp')
        temporary.write_text(json.dumps({'port': port}), encoding='utf8')
        temporary.replace(path)
    except OSError:
        # A read-only location need not prevent an otherwise usable server.
        pass


def matching_package(port, expected):
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/health', timeout=.5) as response:
            health = json.loads(response.read(8192))
        return isinstance(health, dict) and health.get('packageId') == expected
    except (OSError, ValueError):
        return False


def start(root=ROOT, port=5212, browser=True):
    root = Path(root).resolve()
    if type(port) is not int or not 0 <= port <= 65535:
        raise ValueError('Local port must be between 0 and 65535')
    print('Checking DEAR package...', flush=True)
    verify_package(root)
    expected = hashlib.sha256((root / 'release.json').read_bytes()).hexdigest()
    previous = remembered_port(root)
    # Reuse this folder's origin so browser-local reports and preferences stay
    # available after restart. Never stop or open a different package's server.
    candidates = [0] if port == 0 else list(dict.fromkeys(
        ([previous] if previous else []) + list(range(port, min(65536, port + 10))) + [0]
    ))
    for candidate in candidates:
        try:
            server = create_server(root / 'dist', port=candidate, offline=True)
        except OSError as error:
            if error.errno != errno.EADDRINUSE and getattr(error, 'winerror', None) != 10048:
                raise
            if not matching_package(candidate, expected):
                continue
            url = f'http://127.0.0.1:{candidate}'
            remember_port(root, candidate)
            if browser:
                open_demo(url, root)
            print('This DEAR package is already running: ' + presentation_url(url), flush=True)
            return
        break
    else:
        raise RuntimeError('No local port is available for DEAR.')
    with server:
        url = f'http://127.0.0.1:{server.server_port}'
        remember_port(root, server.server_port)
        if browser:
            open_demo(url, root)
        print('DEAR offline ready: ' + presentation_url(url) + ' | Stop: Ctrl+C', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


def launch(root=ROOT, port=5212, browser=True, desktop=False):
    try:
        if desktop:
            directory = root / 'user-data'
            directory.mkdir(parents=True, exist_ok=True)
            with (directory / 'launcher.log').open('a', encoding='utf8', buffering=1) as log:
                with contextlib.redirect_stdout(log), contextlib.redirect_stderr(log):
                    start(root, port, browser)
        else:
            start(root, port, browser)
        return 0
    except Exception as error:
        message = 'DEAR could not start: ' + str(error)
        if desktop and os.name == 'nt':
            import ctypes
            ctypes.windll.user32.MessageBoxW(0, message, 'DEAR', 0x10)
        else:
            print(message, flush=True)
        return 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=5212, help='Preferred local port; automatically choose a free port if occupied')
    parser.add_argument('--offline', action='store_true', help='Compatibility flag; this launcher always uses offline mode')
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--desktop', action='store_true', help='Open the app without a server console; log startup diagnostics locally')
    args = parser.parse_args()
    raise SystemExit(launch(port=args.port, browser=not args.no_browser, desktop=args.desktop))
