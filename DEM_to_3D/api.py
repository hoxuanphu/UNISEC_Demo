"""Loopback-only terrain processing API; run with uvicorn DEM_to_3D.api:app."""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import time
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator
from starlette.middleware.trustedhost import TrustedHostMiddleware

HERE = Path(__file__).resolve().parent
ROOT = HERE / '.api-jobs'
MAX_UPLOAD = 512 * 1024 * 1024
MAX_BODY = MAX_UPLOAD + 1024 * 1024
MAX_JOBS = 16
TIMEOUT = 1800
TTL = 24 * 3600
ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174']


class UploadTooLarge(Exception):
    pass


class BodyLimitMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        total = 0

        async def bounded_receive():
            nonlocal total
            message = await receive()
            if message['type'] == 'http.request':
                total += len(message.get('body', b''))
                if total > MAX_BODY:
                    raise UploadTooLarge()
            return message

        try:
            await self.app(scope, bounded_receive, send)
        except UploadTooLarge:
            response = JSONResponse({'detail': 'Upload exceeds 512 MiB'}, status_code=413)
            await response(scope, receive, send)


class TerrainOptions(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    version: Literal['v1', 'v2'] = 'v2'
    formats: list[Literal['glb', 'obj', 'stl', 'ply']] = Field(default=['glb'], min_length=1, max_length=4)
    colormap: Literal['none', 'terrain', 'viridis', 'gray'] = 'terrain'
    step: int | None = Field(default=None, ge=1, le=10000)
    max_vertices: int = Field(default=500000, ge=100, le=1000000)
    exaggeration: float = Field(default=1.5, gt=0, le=100)
    target_epsg: int | None = Field(default=None, ge=1, le=999999)
    keep_geographic: bool = False
    normalize_base: bool = True
    commune: str | None = Field(default=None, min_length=1, max_length=200)
    commune_buffer: float = Field(default=0, ge=0, le=100000)
    hole_mode: Literal['mask', 'fill'] = 'mask'


class SplitOptions(BaseModel):
    model_config = ConfigDict(extra='forbid')
    code: str | None = Field(default=None, min_length=1, max_length=80, pattern=r'^[A-Za-z0-9_-]+$')
    name: str | None = Field(default=None, min_length=1, max_length=200)

    @model_validator(mode='after')
    def exclusive(self):
        if self.code and self.name:
            raise ValueError('Choose code OR name, not both')
        return self


def build_command(operation, options, directory, dem, shape=None, texture=None):
    if operation == 'split':
        args = [sys.executable, str(HERE / 'split_dem_by_commune.py'), '--dem', str(dem), '--shp', str(shape), '--output-dir', str(directory / 'output')]
        for key in ('code', 'name'):
            if getattr(options, key):
                args.append(f'--{key}={getattr(options, key)}')
        return args
    script = 'dem_to_3d_v2.py' if options.version == 'v2' else 'dem_to_3d.py'
    args = [sys.executable, str(HERE / script), '--input', str(dem), '--output', str(directory / 'output' / 'terrain'), '--formats', ','.join(options.formats)]
    for key in ('colormap', 'max_vertices', 'exaggeration', 'step', 'target_epsg', 'commune', 'commune_buffer', 'hole_mode'):
        value = getattr(options, key)
        if value is not None:
            args.append(f'--{key.replace("_", "-")}={value}')
    for enabled, flag in [(options.keep_geographic, '--keep-geographic'), (not options.normalize_base, '--no-normalize-base')]:
        if enabled:
            args.append(flag)
    if shape:
        args.extend(['--commune-shp', str(shape)])
    if texture:
        args.extend(['--texture', str(texture)])
    return args


class JobStore:
    def __init__(self, root):
        self.root = root
        self.jobs = {}
        self.queue = asyncio.Queue(maxsize=MAX_JOBS)
        self.submit_lock = asyncio.Lock()
        self.process = None

    def persist(self, job):
        directory = self.root / job['id']
        staging = directory / 'status.new'
        staging.write_text(json.dumps(job), encoding='utf-8')
        staging.replace(directory / 'status.json')

    def restore(self):
        self.root.mkdir(parents=True, exist_ok=True)
        for directory in self.root.iterdir():
            if not directory.is_dir() or len(directory.name) != 32:
                continue
            try:
                job = json.loads((directory / 'status.json').read_text(encoding='utf-8'))
                if job['id'] != directory.name:
                    continue
                if job['status'] in ('queued', 'running'):
                    job.update(status='failed', error={'code': 'interrupted', 'message': 'Server restarted; submit again.'})
                    self.persist(job)
                self.jobs[job['id']] = job
            except (OSError, ValueError, KeyError):
                shutil.rmtree(directory)
        self.cleanup()

    def cleanup(self):
        for key, job in list(self.jobs.items()):
            if job['status'] not in ('queued', 'running') and time.time() - job['timestamp'] > TTL:
                shutil.rmtree(self.root / key)
                del self.jobs[key]

    async def worker(self):
        while True:
            try:
                key, args = await asyncio.wait_for(self.queue.get(), 60)
            except asyncio.TimeoutError:
                self.cleanup()
                continue
            job = self.jobs[key]
            job['status'] = 'running'
            self.persist(job)
            try:
                env = {**os.environ, 'PYTHONIOENCODING': 'utf-8', 'GDAL_CACHEMAX': '128', 'GDAL_NUM_THREADS': '1'}
                self.process = await asyncio.create_subprocess_exec(*args, cwd=HERE, env=env, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE)
                tail = bytearray()

                async def drain():
                    while chunk := await self.process.stderr.read(4096):
                        tail.extend(chunk)
                        del tail[:-8192]
                    return await self.process.wait()

                try:
                    code = await asyncio.wait_for(drain(), TIMEOUT)
                except asyncio.TimeoutError:
                    self.process.kill()
                    await self.process.wait()
                    raise TimeoutError('Processing exceeded the 30 minute time limit')
                if code:
                    message = tail.decode('utf-8', errors='replace').replace(str(self.root), '[jobs]').replace(str(HERE), '[scripts]')
                    raise RuntimeError(message[-2000:] or f'Processor exited with code {code}')
                files = []
                for path in sorted((self.root / key / 'output').iterdir()):
                    if path.is_file() and not path.is_symlink() and path.name not in ('.', '..') and len(path.name) <= 240:
                        from urllib.parse import quote
                        files.append({'name': path.name, 'size': path.stat().st_size, 'url': f'/api/jobs/{key}/files/{quote(path.name)}'})
                if not files:
                    raise RuntimeError('No output produced. Check commune selection and DEM coverage.')
                job.update(status='succeeded', files=files)
            except asyncio.CancelledError:
                if self.process and self.process.returncode is None:
                    self.process.kill()
                    await self.process.wait()
                job.update(status='failed', error={'code': 'interrupted', 'message': 'Server stopped.'})
                self.persist(job)
                raise
            except Exception as exc:
                job.update(status='failed', error={'code': 'timeout' if isinstance(exc, TimeoutError) else 'processing_failed', 'message': str(exc)})
            finally:
                self.process = None
                self.queue.task_done()
            self.persist(job)


def create_app(root=ROOT):
    store = JobStore(Path(root))

    @asynccontextmanager
    async def lifespan(app):
        store.restore()
        spool = store.root / '.uploads'
        spool.mkdir(exist_ok=True)
        previous_tempdir = tempfile.tempdir
        tempfile.tempdir = str(spool)
        worker = asyncio.create_task(store.worker())
        yield
        worker.cancel()
        try:
            await worker
        except asyncio.CancelledError:
            pass
        finally:
            tempfile.tempdir = previous_tempdir

    app = FastAPI(title='Local Terrain Processing', lifespan=lifespan)
    app.state.store = store
    app.add_middleware(BodyLimitMiddleware)
    app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=['GET', 'POST', 'DELETE'], allow_headers=['Content-Type'])
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=['localhost', '127.0.0.1', 'testserver'])

    @app.middleware('http')
    async def local_requests(request, call_next):
        origin = request.headers.get('origin')
        if origin and origin not in ORIGINS and origin not in ['http://localhost:8000', 'http://127.0.0.1:8000']:
            return JSONResponse({'detail': 'Untrusted origin'}, status_code=403)
        if request.method == 'POST':
            try:
                length = int(request.headers.get('content-length', '0'))
            except ValueError:
                length = -1
            if length <= 0 or length > MAX_BODY:
                return JSONResponse({'detail': 'Content-Length required; upload limit is 512 MiB'}, status_code=413)
        return await call_next(request)

    @app.get('/api/health')
    async def health():
        modules = ['numpy', 'rasterio', 'shapefile', 'trimesh', 'PIL', 'matplotlib', 'pyproj', 'scipy']
        return {'status': 'ok', 'local_only': True, 'missing_dependencies': [name for name in modules if importlib.util.find_spec(name) is None], 'queue_size': store.queue.qsize()}

    async def submit(operation, dem, shapes, texture, raw_options):
        uploads = [dem, *shapes, *([texture] if texture else [])]
        directory = None
        try:
            try:
                options = (TerrainOptions if operation == 'terrain' else SplitOptions).model_validate_json(raw_options)
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from exc
            store.cleanup()
            if len(store.jobs) >= MAX_JOBS:
                raise HTTPException(429, 'Job capacity reached. Delete completed jobs or wait for cleanup.')
            dem_suffix = Path(dem.filename or '').suffix.lower()
            if dem_suffix not in ('.tif', '.tiff', '.asc', '.hgt', '.img'):
                raise HTTPException(422, 'DEM must be TIFF, ASC, HGT or IMG')
            if len(shapes) > 5:
                raise HTTPException(422, 'Upload one shapefile with its sidecars, not an archive')
            suffixes = [Path(item.filename or '').suffix.lower() for item in shapes]
            if shapes and (len(set(suffixes)) != len(suffixes) or not set(suffixes) <= {'.shp', '.shx', '.dbf', '.prj', '.cpg'} or not {'.shp', '.shx', '.dbf', '.prj'} <= set(suffixes) or len({Path(item.filename or '').stem for item in shapes}) != 1):
                raise HTTPException(422, 'Shapefile needs matching .shp, .shx, .dbf and .prj (optional .cpg)')
            if (operation == 'split' or getattr(options, 'commune', None)) and not shapes:
                raise HTTPException(422, 'This operation requires a shapefile and sidecars')
            texture_suffix = Path(texture.filename or '').suffix.lower() if texture else ''
            if texture and texture_suffix not in ('.tif', '.tiff', '.png', '.jpg', '.jpeg'):
                raise HTTPException(422, 'Texture must be TIFF, PNG or JPEG')
            key = uuid4().hex
            directory = store.root / key
            (directory / 'input').mkdir(parents=True)
            (directory / 'output').mkdir()
            total = 0

            async def save(upload, name):
                nonlocal total
                path = directory / 'input' / name
                size = 0
                with path.open('wb') as handle:
                    while chunk := await upload.read(1024 * 1024):
                        total += len(chunk)
                        size += len(chunk)
                        if total > MAX_UPLOAD:
                            raise HTTPException(413, 'Combined uploads exceed 512 MiB')
                        handle.write(chunk)
                if not size:
                    raise HTTPException(422, 'Empty uploads are not accepted')
                return path

            dem_path = await save(dem, 'dem' + dem_suffix)
            for upload, suffix in zip(shapes, suffixes):
                await save(upload, 'communes' + suffix)
            shape_path = directory / 'input' / 'communes.shp' if shapes else None
            texture_path = await save(texture, 'texture' + texture_suffix) if texture else None
            job = {'id': key, 'operation': operation, 'status': 'queued', 'created_at': datetime.now(timezone.utc).isoformat(), 'timestamp': time.time(), 'error': None, 'files': []}
            args = build_command(operation, options, directory, dem_path, shape_path, texture_path)
            store.jobs[key] = job
            store.persist(job)
            store.queue.put_nowait((key, args))
            return job
        except BaseException:
            if directory:
                store.jobs.pop(directory.name, None)
                shutil.rmtree(directory, ignore_errors=True)
            raise
        finally:
            for upload in uploads:
                await upload.close()

    @app.post('/api/jobs/terrain', status_code=202)
    async def terrain(dem: UploadFile = File(...), shapes: list[UploadFile] = File(default=[]), texture: UploadFile | None = File(default=None), options: str = Form('{}')):
        async with store.submit_lock:
            return await submit('terrain', dem, shapes, texture, options)

    @app.post('/api/jobs/split', status_code=202)
    async def split(dem: UploadFile = File(...), shapes: list[UploadFile] = File(default=[]), options: str = Form('{}')):
        async with store.submit_lock:
            return await submit('split', dem, shapes, None, options)

    def get_job(key):
        if len(key) != 32 or any(char not in '0123456789abcdef' for char in key) or key not in store.jobs:
            raise HTTPException(404, 'Job not found')
        return store.jobs[key]

    @app.get('/api/jobs/{key}')
    async def status(key: str):
        return get_job(key)

    @app.delete('/api/jobs/{key}', status_code=204)
    async def delete(key: str):
        job = get_job(key)
        if job['status'] in ('queued', 'running'):
            raise HTTPException(409, 'Cannot delete an active job')
        shutil.rmtree(store.root / key)
        del store.jobs[key]

    @app.get('/api/jobs/{key}/files/{name}')
    async def download(key: str, name: str):
        job = get_job(key)
        if job['status'] != 'succeeded' or name not in {item['name'] for item in job['files']}:
            raise HTTPException(404, 'Result file not found')
        path = store.root / key / 'output' / name
        if Path(name).name != name or '\\' in name or path.is_symlink() or not path.is_file():
            raise HTTPException(404, 'Result file not found')
        return FileResponse(path, filename=name)

    return app


app = create_app()
