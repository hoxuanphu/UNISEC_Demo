import { afterEach, describe, expect, it, vi } from 'vitest';
import { pairUploadedFiles, selectUploadedFiles } from './upload';
import {
  apiRequest, buildJobForm, defaultTerrainOptions, fetchViewerFiles, jobFileUrl,
  numericOption, validateShapes, viewerOutputs, watchProcessingJob,
  type JobFile, type ProcessingJob,
} from './processing';

const dem = new File(['dem'], 'dem.tif');
const shapes = ['shp', 'shx', 'dbf', 'prj', 'cpg'].map((ext) => new File([ext], `communes.${ext}`));
const output = (name: string): JobFile => ({ name, size: 42, url: `/api/jobs/job-1/files/${encodeURIComponent(name)}` });
const job = (status: ProcessingJob['status'] = 'succeeded'): ProcessingJob => ({
  id: 'job-1', operation: 'terrain', status, created_at: '2026-10-13T10:00:00Z', error: null,
  files: ['north.glb', 'north.terrain.json', 'north.grid.bin', 'south.glb', 'south.terrain.json', 'south.grid.bin', 'north.obj', 'notes.txt'].map(output),
});
const reply = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('processing multipart contract', () => {
  it('sends the DEM, repeated shapes, texture and all typed terrain options without a content-type override', async () => {
    const texture = new File(['texture'], 'satellite.tif');
    const options = { ...defaultTerrainOptions, version: 'v1' as const, formats: ['glb', 'obj'], step: 2, commune: 'Chiềng Lao', target_epsg: 32648 };
    const form = buildJobForm('terrain', dem, shapes, texture, options);
    expect((form.get('dem') as File).name).toBe('dem.tif');
    expect(form.getAll('shapes').map((file) => (file as File).name)).toEqual(shapes.map((file) => file.name));
    expect((form.get('texture') as File).name).toBe('satellite.tif');
    expect(JSON.parse(form.get('options') as string)).toEqual(options);
    const fetch = vi.fn().mockResolvedValue(reply({ id: 'job-1' }, 202)); vi.stubGlobal('fetch', fetch);
    await expect(apiRequest('/api/jobs/terrain', { method: 'POST', body: form })).resolves.toEqual({ id: 'job-1' });
    expect(fetch.mock.calls[0][1]).toEqual({ method: 'POST', body: form });
  });
  it('allows a whole DEM without shapes or texture and serializes nullable automatic options', () => {
    const form = buildJobForm('terrain', dem, [], null, defaultTerrainOptions);
    expect(form.getAll('shapes')).toEqual([]); expect(form.get('texture')).toBeNull();
    expect(JSON.parse(form.get('options') as string)).toMatchObject({ step: null, target_epsg: null, commune: null });
  });
  it('builds mutually exclusive split options and omits terrain-only texture', () => {
    for (const options of [{ code: '01234', name: null }, { code: null, name: 'Chế Tạo' }, { code: null, name: null }]) {
      const form = buildJobForm('split', dem, shapes, dem, options);
      expect(JSON.parse(form.get('options') as string)).toEqual(options); expect(form.get('texture')).toBeNull();
    }
    expect(() => buildJobForm('split', dem, shapes, null, { code: '1', name: 'two' })).toThrow(/not both/);
  });
  it('requires a DEM, formats, and shapes for splitting or commune clipping', () => {
    expect(() => buildJobForm('terrain', null, [], null, defaultTerrainOptions)).toThrow(/DEM/);
    expect(() => buildJobForm('terrain', new File(['x'], 'bad.png'), [], null, defaultTerrainOptions)).toThrow(/DEM/);
    expect(() => buildJobForm('terrain', dem, [], null, { ...defaultTerrainOptions, formats: [] })).toThrow(/format/);
    expect(() => buildJobForm('terrain', dem, [], null, { ...defaultTerrainOptions, commune: 'town' })).toThrow(/shapefile/);
    expect(() => buildJobForm('split', dem, [], null, { code: null, name: null })).toThrow(/shapefile/);
    expect(() => buildJobForm('terrain', dem, [], null, { ...defaultTerrainOptions, keep_geographic: true, target_epsg: 4326 })).toThrow(/either/);
  });
  it('validates matching shapefile stems case-insensitively and accepts optional cpg', () => {
    expect(() => validateShapes(shapes.slice(0, 4))).not.toThrow();
    expect(() => validateShapes(shapes)).not.toThrow();
    expect(() => validateShapes(['SHP', 'shx', 'DbF', 'prj'].map((ext) => new File(['x'], `COMMUNES.${ext}`)))).not.toThrow();
    expect(() => validateShapes(shapes.slice(0, 3))).toThrow(/\.prj/);
    expect(() => validateShapes([...shapes, shapes[0]])).toThrow(/Duplicate/);
    expect(() => validateShapes([...shapes, new File(['x'], 'other.shp')])).toThrow(/other: missing/);
    expect(() => validateShapes([new File(['x'], 'bundle.zip')])).toThrow(/Unsupported/);
  });
  it('converts numeric form input without silently sending NaN, zero steps or fractional EPSG codes', () => {
    expect(numericOption('', 'Step', 1, true, true)).toBeNull();
    expect(numericOption('  ', 'EPSG', 1, true, true)).toBeNull();
    expect(numericOption('2.5', 'Exaggeration', 0.001)).toBe(2.5);
    expect(numericOption('0', 'Buffer', 0)).toBe(0);
    for (const value of ['', 'NaN', 'Infinity', '0', '-1', '1.5']) expect(() => numericOption(value, 'Step', 1, true)).toThrow(/Step/);
  });
});

describe('job lifecycle', () => {
  it('shows structured errors and falls back to HTTP status for unavailable proxy', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({ error: { code: 'invalid_dem', message: 'Raster is invalid' } }, 422))
      .mockResolvedValueOnce(reply({ detail: 'Job not found' }, 404)).mockResolvedValueOnce(new Response('Unavailable', { status: 502 }));
    vi.stubGlobal('fetch', fetch);
    await expect(apiRequest('/api/jobs/terrain')).rejects.toThrow('invalid_dem: Raster is invalid');
    await expect(apiRequest('/api/jobs/missing')).rejects.toThrow('Job not found');
    await expect(apiRequest('/api/health')).rejects.toThrow('502');
  });
  it('supports completed-job cleanup with an empty 204 response', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetch);
    await expect(apiRequest('/api/jobs/job-1', { method: 'DELETE' })).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('/api/jobs/job-1', { method: 'DELETE' });
  });
  it.each(['succeeded', 'failed'] as const)('polls queued → running → %s and stops', async (finalStatus) => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce(reply(job('queued'))).mockResolvedValueOnce(reply(job('running'))).mockResolvedValueOnce(reply(job(finalStatus)));
    vi.stubGlobal('fetch', fetch);
    const onJob = vi.fn(); const stop = watchProcessingJob('job-1', onJob, vi.fn());
    await vi.advanceTimersByTimeAsync(0); expect(onJob.mock.calls[0][0].status).toBe('queued');
    await vi.advanceTimersByTimeAsync(2000); expect(onJob.mock.calls[1][0].status).toBe('running');
    await vi.advanceTimersByTimeAsync(10000); expect(fetch).toHaveBeenCalledTimes(3); expect(onJob.mock.calls[2][0].status).toBe(finalStatus); stop();
  });
  it('retries transient status failures and clears the warning on recovery', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(reply(job())); vi.stubGlobal('fetch', fetch);
    const onError = vi.fn(); const stop = watchProcessingJob('job-1', vi.fn(), onError);
    await vi.advanceTimersByTimeAsync(0); expect(onError).toHaveBeenCalledWith(expect.stringContaining('offline'));
    await vi.advanceTimersByTimeAsync(2000); expect(onError).toHaveBeenLastCalledWith(null); stop();
  });
  it('aborts pending polling on unmount and ignores stale responses', async () => {
    vi.useFakeTimers();
    let resolve!: (value: Response) => void;
    const fetch = vi.fn().mockImplementation(() => new Promise<Response>((done) => { resolve = done; })); vi.stubGlobal('fetch', fetch);
    const onJob = vi.fn(); const onError = vi.fn(); const stop = watchProcessingJob('job-1', onJob, onError);
    stop(); expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    resolve(reply(job())); await vi.advanceTimersByTimeAsync(10000);
    expect(onJob).not.toHaveBeenCalled(); expect(onError).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('generated viewer import', () => {
  it('fetches both GLBs and their sidecars as named Files that pair with the existing merge loader', async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response('asset')); vi.stubGlobal('fetch', fetch);
    const files = await fetchViewerFiles(job());
    expect(files.map((file) => file.name)).toEqual(['north.glb', 'north.terrain.json', 'north.grid.bin', 'south.glb', 'south.terrain.json', 'south.grid.bin']);
    expect(files.every((file) => file instanceof File)).toBe(true);
    const pairs = pairUploadedFiles(selectUploadedFiles(files, 'merge'));
    expect(pairs).toHaveLength(2); expect(pairs[0].metadata?.name).toBe('north.terrain.json'); expect(pairs[1].grid?.name).toBe('south.grid.bin');
    expect(fetch).toHaveBeenCalledTimes(6);
  });
  it('keeps a single model and optional missing sidecars usable', () => {
    expect(viewerOutputs([output('model.glb'), output('other.grid.bin'), output('model.obj')]).map((file) => file.name)).toEqual(['model.glb']);
  });
  it('refuses incomplete jobs and missing GLB outputs without fetching', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(fetchViewerFiles(job('running'))).rejects.toThrow(/successful/);
    await expect(fetchViewerFiles({ ...job(), files: [output('dem.tif')] })).rejects.toThrow(/No GLB/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('fails the entire import if a sidecar download fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(fetchViewerFiles(job())).rejects.toThrow(/Unable to download/);
  });
  it('uses same-origin API download paths and rejects unrelated or unsafe URLs', () => {
    expect(jobFileUrl(job(), { ...output('north.glb'), url: 'http://localhost:8000/api/jobs/job-1/files/north.glb' })).toBe('/api/jobs/job-1/files/north.glb');
    expect(jobFileUrl(job(), output('terrain space.glb'))).toContain('terrain%20space.glb');
    expect(() => jobFileUrl(job(), { ...output('x.glb'), url: '/unrelated/file' })).toThrow(/Invalid/);
    expect(() => jobFileUrl(job(), output('../x.glb'))).toThrow(/Invalid/);
  });
});
