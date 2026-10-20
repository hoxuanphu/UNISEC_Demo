import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  apiRequest, buildJobForm, defaultTerrainOptions, fetchViewerFiles, isCompleted,
  jobFileUrl, jobUrl, numericOption, viewerOutputs, watchProcessingJob,
  type Operation, type ProcessingJob, type TerrainOptions,
} from '../terrain/processing';
import './ProcessingPanel.css';

type Props = { viewerBusy: boolean; onImport: (files: File[]) => Promise<void> };
const messageOf = (reason: unknown): string => reason instanceof Error ? reason.message : String(reason);

export function ProcessingPanel({ viewerBusy, onImport }: Props): JSX.Element {
  const [operation, setOperation] = useState<Operation>('terrain');
  const [dem, setDem] = useState<File | null>(null);
  const [shapes, setShapes] = useState<File[]>([]);
  const [texture, setTexture] = useState<File | null>(null);
  const [options, setOptions] = useState(defaultTerrainOptions);
  const [numbers, setNumbers] = useState({ step: '', max_vertices: '500000', exaggeration: '1', target_epsg: '', commune_buffer: '0' });
  const [commune, setCommune] = useState('');
  const [selector, setSelector] = useState<'code' | 'name'>('code');
  const [splitValue, setSplitValue] = useState('');
  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [busy, setBusy] = useState<'submit' | 'import' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking');
  const [healthAttempt, setHealthAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const action = useRef<AbortController | null>(null);

  useEffect(() => () => action.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    setHealth('checking');
    void apiRequest('/api/health', { signal: controller.signal }).then(() => setHealth('online')).catch(() => {
      if (!controller.signal.aborted) setHealth('offline');
    });
    return () => controller.abort();
  }, [healthAttempt]);

  const id = job?.id;
  const completed = job ? isCompleted(job) : false;
  useEffect(() => {
    if (!id || completed) return;
    return watchProcessingJob(id, setJob, setPollError);
  }, [id, completed, refresh]);

  const patchOption = <K extends keyof TerrainOptions>(key: K, value: TerrainOptions[K]): void => setOptions((previous) => ({ ...previous, [key]: value }));
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (action.current || job) return;
    setError(null); setNotice(null);
    let form: FormData;
    try {
      const payload = operation === 'split' ? { code: selector === 'code' ? splitValue.trim() || null : null, name: selector === 'name' ? splitValue.trim() || null : null } : {
        ...options,
        step: numericOption(numbers.step, 'Step', 1, true, true),
        max_vertices: numericOption(numbers.max_vertices, 'Max vertices', 1, true)!,
        exaggeration: numericOption(numbers.exaggeration, 'Exaggeration', 0.001)!,
        target_epsg: options.keep_geographic ? null : numericOption(numbers.target_epsg, 'Target EPSG', 1, true, true),
        commune_buffer: numericOption(numbers.commune_buffer, 'Commune buffer', 0)!,
        commune: commune.trim() || null,
      };
      form = buildJobForm(operation, dem, shapes, texture, payload);
    } catch (reason) { setError(messageOf(reason)); return; }
    const controller = new AbortController(); action.current = controller; setBusy('submit');
    try {
      const created = await apiRequest<{ id: string }>(`/api/jobs/${operation}`, { method: 'POST', body: form, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!created.id) throw new Error('The service did not return a job ID.');
      setPollError(null);
      setJob({ id: created.id, operation, status: 'queued', created_at: new Date().toISOString(), error: null, files: [] });
    } catch (reason) { if (!controller.signal.aborted) setError(messageOf(reason)); }
    finally { action.current = null; if (!controller.signal.aborted) setBusy(null); }
  };

  const importResult = async (): Promise<void> => {
    if (!job || action.current || viewerBusy) return;
    const controller = new AbortController(); action.current = controller; setBusy('import'); setError(null); setNotice(null);
    try {
      const files = await fetchViewerFiles(job, controller.signal);
      if (!controller.signal.aborted) { await onImport(files); if (!controller.signal.aborted) setNotice('Terrain opened in the viewer. Results remain available for download.'); }
    } catch (reason) { if (!controller.signal.aborted) setError(messageOf(reason)); }
    finally { action.current = null; if (!controller.signal.aborted) setBusy(null); }
  };
  const cleanup = async (): Promise<void> => {
    if (!job || !isCompleted(job) || action.current) return;
    const controller = new AbortController(); action.current = controller; setBusy('delete'); setError(null); setNotice(null);
    try {
      await apiRequest(jobUrl(job.id), { method: 'DELETE', signal: controller.signal });
      if (!controller.signal.aborted) { setJob(null); setPollError(null); setNotice('Server results deleted. Any imported viewer model is kept.'); }
    } catch (reason) { if (!controller.signal.aborted) setError(messageOf(reason)); }
    finally { action.current = null; if (!controller.signal.aborted) setBusy(null); }
  };
  const numberField = (key: keyof typeof numbers, label: string, min: number, step = '1', placeholder?: string): JSX.Element => (
    <label>{label}<input type='number' min={min} step={step} value={numbers[key]} placeholder={placeholder} onChange={(event) => setNumbers((previous) => ({ ...previous, [key]: event.target.value }))} /></label>
  );
  const importable = job?.status === 'succeeded' && viewerOutputs(job.files).some((file) => /\.glb$/i.test(file.name));

  return (
    <details className='processing-panel'>
      <summary><span><span className='eyebrow'>Processing workspace</span><strong>Generate terrain / Split DEM</strong><small>GeoTIFF → downloadable assets → 3D viewer</small></span><span className={`processing-badge ${job?.status ?? health}`}>{job?.status ?? `API ${health}`}</span></summary>
      <div className='processing-body'>
        <div className='processing-service'><span role='status'>{health === 'online' ? 'Processing service connected' : health === 'checking' ? 'Checking processing service…' : 'Service unavailable. Start the API on localhost:8000, then retry.'}</span><button type='button' onClick={() => setHealthAttempt((value) => value + 1)} disabled={health === 'checking'}>Check connection</button></div>
        <div className='processing-tabs' role='tablist' aria-label='Processing operation'>
          <button type='button' role='tab' id='generate-tab' aria-controls='processing-form' aria-selected={operation === 'terrain'} onClick={() => setOperation('terrain')} disabled={Boolean(busy)}>Generate terrain</button>
          <button type='button' role='tab' id='split-tab' aria-controls='processing-form' aria-selected={operation === 'split'} onClick={() => setOperation('split')} disabled={Boolean(busy)}>Split DEM</button>
        </div>
        <form id='processing-form' role='tabpanel' aria-labelledby={operation === 'terrain' ? 'generate-tab' : 'split-tab'} onSubmit={(event) => void submit(event)}>
          <fieldset disabled={Boolean(busy) || Boolean(job)} className='processing-fields'>
            <legend>Source data</legend>
            <div className='processing-grid processing-sources'>
              <label>DEM GeoTIFF *<input type='file' accept='.tif,.tiff' onChange={(event) => setDem(event.target.files?.[0] ?? null)} /><small>{dem?.name ?? 'Choose the elevation raster (.tif / .tiff).'}</small></label>
              <label>Shapefile bundle {operation === 'split' || commune.trim() ? '*' : '(optional)'}<input type='file' multiple accept='.shp,.shx,.dbf,.prj,.cpg' onChange={(event) => setShapes(Array.from(event.target.files ?? []))} /><small>Select matching .shp + .shx + .dbf + .prj together; .cpg optional.</small>{shapes.length > 0 && <span className='processing-file-names'>{shapes.map((file) => file.name).join(' · ')}</span>}</label>
              {operation === 'terrain' && <label>Texture (optional)<input type='file' accept='.tif,.tiff,.png,.jpg,.jpeg,.webp' onChange={(event) => setTexture(event.target.files?.[0] ?? null)} /><small>{texture?.name ?? 'Satellite / color image. Texture takes precedence over colormap.'}</small></label>}
            </div>
            {operation === 'terrain' ? <>
              <div className='processing-grid processing-settings'>
                <label>Exporter version<select value={options.version} onChange={(event) => patchOption('version', event.target.value as TerrainOptions['version'])}><option value='v1'>v1 — classic</option><option value='v2'>v2 — enhanced</option></select></label>
                <label>Colormap<select value={options.colormap} onChange={(event) => patchOption('colormap', event.target.value as TerrainOptions['colormap'])}>{['none', 'terrain', 'viridis', 'gray'].map((value) => <option key={value}>{value}</option>)}</select></label>
                {numberField('max_vertices', 'Max vertices', 1)}
                {numberField('exaggeration', 'Vertical exaggeration', 0.001, 'any')}
              </div>
              <div className='processing-formats' role='group' aria-label='Output formats'><strong>Output formats *</strong>{['glb', 'obj', 'stl', 'ply'].map((format) => <label key={format}><input type='checkbox' checked={options.formats.includes(format)} onChange={(event) => patchOption('formats', event.target.checked ? [...options.formats, format] : options.formats.filter((value) => value !== format))} />{format.toUpperCase()}</label>)}<small>Select GLB to open the result in this viewer.</small></div>
              <details className='processing-advanced'><summary>Advanced · sampling, coordinates & clipping</summary><div className='processing-grid processing-settings'>
                {numberField('step', 'Sampling step (optional)', 1, '1', 'Automatic')}
                {!options.keep_geographic && numberField('target_epsg', 'Target EPSG (optional)', 1, '1', 'Automatic projected CRS')}
                <label>Commune filter (optional)<input value={commune} onChange={(event) => setCommune(event.target.value)} placeholder='Commune name' /></label>
                {numberField('commune_buffer', 'Commune buffer (m)', 0, 'any')}
                <label>NoData holes<select value={options.hole_mode} onChange={(event) => patchOption('hole_mode', event.target.value as TerrainOptions['hole_mode'])}><option value='mask'>Mask — preserve holes</option><option value='fill'>Fill — interpolate holes</option></select></label>
              </div><div className='processing-toggles'><label><input type='checkbox' checked={options.keep_geographic} onChange={(event) => patchOption('keep_geographic', event.target.checked)} />Keep geographic coordinates</label><label><input type='checkbox' checked={options.normalize_base} onChange={(event) => patchOption('normalize_base', event.target.checked)} />Normalize base elevation</label></div><p className='processing-help'>Leave step blank to use the vertex budget. Commune clipping requires a shapefile bundle. Geographic coordinates are not suitable for metric geographic merge in the viewer.</p></details>
            </> : <div className='processing-grid processing-settings'><label>Filter by<select value={selector} onChange={(event) => { setSelector(event.target.value as 'code' | 'name'); setSplitValue(''); }}><option value='code'>Administrative code</option><option value='name'>Administrative name</option></select></label><label>{selector === 'code' ? 'Split code (optional)' : 'Split name (optional)'}<input value={splitValue} onChange={(event) => setSplitValue(event.target.value)} placeholder='Blank = split all features' /></label><p className='processing-help'>Code and name are mutually exclusive. Split outputs are elevation rasters; download them or use a raster as the DEM for a new terrain job.</p></div>}
          </fieldset>
          <div className='processing-actions'><button className='processing-primary' type='submit' disabled={Boolean(busy) || Boolean(job)}>{busy === 'submit' ? 'Uploading & submitting…' : operation === 'terrain' ? 'Generate terrain' : 'Split DEM'}</button><small>{job ? 'Clean up this completed job before starting another.' : 'Files are uploaded to the local processing service.'}</small></div>
        </form>
        {error && <p className='upload-error' role='alert'>{error}</p>}
        {pollError && <p className='upload-error' role='alert'>{pollError} <button type='button' onClick={() => setRefresh((value) => value + 1)}>Retry now</button></p>}
        {notice && <p className='processing-notice' role='status'>{notice}</p>}
        {job && <section className='processing-results' aria-label='Processing job results'>
          <div className='processing-result-heading'><div><strong>{job.operation === 'terrain' ? 'Terrain generation' : 'DEM splitting'}</strong><small>Job {job.id} · {new Date(job.created_at).toLocaleString()}</small></div><span className={`processing-badge ${job.status}`} role='status'>{job.status}</span></div>
          {!isCompleted(job) && <p role='status'><span className='processing-spinner' />{job.status === 'queued' ? 'Waiting for a worker…' : 'Processing source data…'} Status refreshes every 2 seconds. Keep this page open.</p>}
          {job.error && <p className='upload-error' role='alert'>{job.error.code}: {job.error.message}</p>}
          {job.status === 'succeeded' && <><ul className='processing-downloads'>{job.files.map((file) => {
            let url: string; try { url = jobFileUrl(job, file); } catch { return <li key={file.name}>{file.name} — invalid download URL</li>; }
            return <li key={file.name}><a href={url} download={file.name}>{file.name}</a><small>{(file.size / 1048576).toFixed(2)} MB</small></li>;
          })}</ul>{!job.files.length && <p>No output files returned.</p>}{job.operation === 'terrain' && !importable && <p className='processing-help'>No GLB available. Download the results, or generate with GLB selected to view them.</p>}</>}
          <div className='processing-actions'>{importable && <button className='processing-primary' type='button' disabled={Boolean(busy) || viewerBusy} onClick={() => void importResult()}>{busy === 'import' ? 'Downloading & opening…' : 'Open terrain in viewer'}</button>}{isCompleted(job) && <button type='button' disabled={Boolean(busy)} onClick={() => void cleanup()}>{busy === 'delete' ? 'Deleting…' : 'Delete server results / New job'}</button>}</div>
          {isCompleted(job) && <small className='processing-help'>Cleanup permanently deletes server downloads, not models already loaded in the viewer.</small>}
        </section>}
      </div>
    </details>
  );
}
