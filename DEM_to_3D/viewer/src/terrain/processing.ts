export type Operation = 'terrain' | 'split';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type JobFile = { name: string; size: number; url: string };
export type ProcessingJob = {
  id: string;
  operation: Operation;
  status: JobStatus;
  created_at: string;
  error: { code: string; message: string } | null;
  files: JobFile[];
};
export type TerrainOptions = {
  version: 'v1' | 'v2';
  formats: string[];
  colormap: 'none' | 'terrain' | 'viridis' | 'gray';
  step: number | null;
  max_vertices: number;
  exaggeration: number;
  target_epsg: number | null;
  keep_geographic: boolean;
  normalize_base: boolean;
  commune: string | null;
  commune_buffer: number;
  hole_mode: 'mask' | 'fill';
};
export type SplitOptions = { code: string | null; name: string | null };
export const defaultTerrainOptions: TerrainOptions = {
  version: 'v2', formats: ['glb'], colormap: 'terrain', step: null,
  max_vertices: 500000, exaggeration: 1, target_epsg: null,
  keep_geographic: false, normalize_base: true, commune: null,
  commune_buffer: 0, hole_mode: 'mask',
};

export function validateShapes(files: readonly File[], required = false): void {
  if (!files.length) {
    if (required) throw new Error('Choose a shapefile bundle (.shp, .shx, .dbf, .prj).');
    return;
  }
  const groups = new Map<string, Set<string>>();
  for (const file of files) {
    const match = /^(.*)\.(shp|shx|dbf|prj|cpg)$/i.exec(file.name);
    if (!match) throw new Error(`Unsupported shapefile sidecar: ${file.name}`);
    const key = match[1].toLowerCase();
    const ext = match[2].toLowerCase();
    const group = groups.get(key) ?? new Set<string>();
    if (group.has(ext)) throw new Error(`Duplicate shapefile sidecar: ${file.name}`);
    group.add(ext); groups.set(key, group);
  }
  for (const [name, group] of groups) {
    const missing = ['shp', 'shx', 'dbf', 'prj'].filter((ext) => !group.has(ext));
    if (missing.length) throw new Error(`${name}: missing ${missing.map((ext) => `.${ext}`).join(', ')}. Select matching sidecars together.`);
  }
}

export function numericOption(value: string, label: string, minimum: number, integer = false, nullable = false): number | null {
  if (!value.trim()) {
    if (nullable) return null;
    throw new Error(`${label} is required.`);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || (integer && !Number.isInteger(number))) {
    throw new Error(`${label} must be ${integer ? 'an integer' : 'a number'} ≥ ${minimum}.`);
  }
  return number;
}

export function buildJobForm(operation: Operation, dem: File | null, shapes: File[], texture: File | null, options: TerrainOptions | SplitOptions): FormData {
  if (!dem || !/\.tiff?$/i.test(dem.name)) throw new Error('Choose a DEM GeoTIFF (.tif or .tiff).');
  validateShapes(shapes, operation === 'split' || (operation === 'terrain' && Boolean((options as TerrainOptions).commune)));
  if (operation === 'split') {
    const split = options as SplitOptions;
    if (split.code && split.name) throw new Error('Choose either a split code or a name, not both.');
  } else {
    const terrain = options as TerrainOptions;
    if (!terrain.formats.length) throw new Error('Select at least one output format.');
    if (terrain.keep_geographic && terrain.target_epsg !== null) throw new Error('Choose either geographic coordinates or a target EPSG.');
  }
  const form = new FormData();
  form.append('dem', dem);
  shapes.forEach((file) => form.append('shapes', file));
  if (texture && operation === 'terrain') form.append('texture', texture);
  form.append('options', JSON.stringify(options));
  return form;
}

export async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json() as { error?: { code?: string; message?: string }; detail?: unknown };
      if (body.error?.message) message = `${body.error.code ? `${body.error.code}: ` : ''}${body.error.message}`;
      else if (typeof body.detail === 'string') message = body.detail;
    } catch { /* Preserve the HTTP status for non-JSON proxy errors. */ }
    throw new Error(message);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const jobUrl = (id: string): string => `/api/jobs/${encodeURIComponent(id)}`;
export const isCompleted = (job: ProcessingJob): boolean => job.status === 'succeeded' || job.status === 'failed';

export function watchProcessingJob(id: string, onJob: (job: ProcessingJob) => void, onError: (error: string | null) => void): () => void {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const poll = async (): Promise<void> => {
    let completed = false;
    try {
      const job = await apiRequest<ProcessingJob>(jobUrl(id), { signal: controller.signal });
      if (controller.signal.aborted) return;
      completed = isCompleted(job);
      onJob(job); onError(null);
    } catch (reason) {
      if (!controller.signal.aborted) onError(`Status unavailable: ${reason instanceof Error ? reason.message : String(reason)} Retrying automatically…`);
    }
    if (!controller.signal.aborted && !completed) timer = setTimeout(() => void poll(), 2000);
  };
  void poll();
  return () => { controller.abort(); if (timer) clearTimeout(timer); };
}

export function jobFileUrl(job: ProcessingJob, file: JobFile): string {
  // Downloads stay on the same-origin API, including when the service reports absolute URLs.
  const expected = `${jobUrl(job.id)}/files/`;
  const url = new URL(file.url, 'http://viewer.local');
  if (!url.pathname.startsWith(expected) || decodeURIComponent(url.pathname.slice(expected.length)) !== file.name || url.search || url.hash || /[\\/]/.test(file.name)) {
    throw new Error(`Invalid output file URL: ${file.name}`);
  }
  return url.pathname;
}

export function viewerOutputs(files: readonly JobFile[]): JobFile[] {
  const models = files.filter((file) => /\.glb$/i.test(file.name));
  const stems = new Set(models.map((file) => file.name.slice(0, -4).toLowerCase()));
  return files.filter((file) => models.includes(file) || ['.terrain.json', '.grid.bin'].some((suffix) =>
    file.name.toLowerCase().endsWith(suffix) && stems.has(file.name.slice(0, -suffix.length).toLowerCase())));
}

export async function fetchViewerFiles(job: ProcessingJob, signal?: AbortSignal): Promise<File[]> {
  if (job.status !== 'succeeded') throw new Error('Wait for a successful job before importing.');
  const files = viewerOutputs(job.files);
  if (!files.some((file) => /\.glb$/i.test(file.name))) throw new Error('No GLB output. Generate again with GLB selected to open in the viewer.');
  return Promise.all(files.map(async (file) => {
    const response = await fetch(jobFileUrl(job, file), { signal });
    if (!response.ok) throw new Error(`Unable to download ${file.name} (${response.status}).`);
    return new File([await response.blob()], file.name, { type: /\.glb$/i.test(file.name) ? 'model/gltf-binary' : 'application/octet-stream' });
  }));
}
