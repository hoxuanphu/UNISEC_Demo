import type { ChangeEvent } from 'react';

export type UploadMode = 'single' | 'merge';

type Props = {
  mode: UploadMode;
  geographicMerge: boolean;
  fileNames: string[];
  busy: boolean;
  error: string | null;
  showAdministrativeInfo: boolean;
  onModeChange: (mode: UploadMode) => void;
  onGeographicMergeChange: (enabled: boolean) => void;
  onShowAdministrativeInfoChange: (enabled: boolean) => void;
  onFiles: (files: File[]) => void;
  onTileFiles: (files: File[]) => void;
  onClear: () => void;
  onSarFile: (file: File | null) => void;
  sarFileName?: string;
};

const viCopy = {
  importLabel: '\u004e\u1ea1p \u006d\u00f4 \u0068\u00ec\u006e\u0068 3D',
  title: '\u0054\u1ea3i terrain l\u00ean \u0062\u1ea3n \u0111\u1ed3',
  single: '\u004d\u1ed9t model',
  singleHint: '\u0048i\u1ec3n th\u1ecb m\u1ed9t m\u00f4 h\u00ecnh',
  merge: '\u0047h\u00e9p nhi\u1ec1u model',
  mergeHint: '\u0048i\u1ec3n th\u1ecb nhi\u1ec1u m\u00f4 h\u00ecnh',
  geographic: '\u0054\u1ef1 gh\u00e9p theo v\u1ecb tr\u00ed \u0111\u1ecba l\u00fd',
  geographicHint: '\u0044\u00f9ng .terrain.json c\u1ee7a t\u1eebng model; CRS ph\u1ea3i tr\u00f9ng v\u00e0 \u0111\u01a1n v\u1ecb l\u00e0 m\u00e9t.',
  administrative: 'Th\u00f4ng tin h\u00e0nh ch\u00ednh',
  administrativeHint: 'Hi\u1ec3n th\u1ecb t\u00ean x\u00e3 v\u00e0 tr\u1ee5 s\u1edf tr\u00ean b\u1ea3ng th\u00f4ng tin.',
  busy: '\u0110ang t\u1ea3i model...',
  choose: '\u0043h\u1ecdn file 3D v\u00e0 sidecar',
  singleUpload: '\u0043h\u1ecdn m\u1ed9t .glb/.gltf',
  mergeUpload: '\u0043h\u1ecdn nhi\u1ec1u .glb/.gltf v\u00e0 sidecar t\u01b0\u01a1ng \u1ee9ng',
  clear: '\u0058\u00f3a model \u0111\u00e3 t\u1ea3i',
  help: '\u0047h\u00e9p ch\u00ednh x\u00e1c: ch\u1ecdn c\u00f9ng t\u00ean name.glb, name.terrain.json v\u00e0 t\u00f9y ch\u1ecdn name.grid.bin.',
  textureHelp: 'D\u00e1n \u1ea3nh ngo\u00e0i: k\u00e8m th\u00eam name.png/.jpg/.webp/.tif (c\u00f9ng t\u00ean v\u1edbi model). \u1ea2nh GeoTIFF (.tif) kh\u1edbp s\u1eb5n v\u1ecb tr\u00ed; \u1ea3nh PNG/JPG y\u00eau c\u1ea7u GLB \u0111\u00e3 c\u00f3 UV (xu\u1ea5t k\u00e8m --texture).',
  tileHelp: 'Tile chi ti\u1ebft: ch\u1ecdn th\u00eam th\u01b0 m\u1ee5c <model>_tiles v\u00e0 file <model>.tiles.json.',
} as const;

export function ModelUploadPanel({ mode, geographicMerge, fileNames, busy, error, showAdministrativeInfo, onModeChange, onGeographicMergeChange, onShowAdministrativeInfoChange, onFiles, onTileFiles, onClear, onSarFile, sarFileName }: Props): JSX.Element {
  const handleFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    onFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };
  const handleTileFiles = (event: ChangeEvent<HTMLInputElement>): void => { onTileFiles(Array.from(event.target.files ?? [])); event.target.value = ''; };

  return (
    <section className='upload-panel' aria-labelledby='upload-title'>
      <div className='upload-heading'>
        <div><span className='eyebrow'>{viCopy.importLabel}</span><h2 id='upload-title'>{viCopy.title}</h2></div>
        <span className='upload-format'>GLB / GLTF</span>
      </div>
      <div className='upload-modes' role='radiogroup' aria-label='Model display mode'>
        <label className={mode === 'single' ? 'upload-mode active' : 'upload-mode'}>
          <input type='radio' name='upload-mode' checked={mode === 'single'} onChange={() => onModeChange('single')} />
          <span><strong>{viCopy.single}</strong><small>{viCopy.singleHint}</small></span>
        </label>
        <label className={mode === 'merge' ? 'upload-mode active' : 'upload-mode'}>
          <input type='radio' name='upload-mode' checked={mode === 'merge'} onChange={() => onModeChange('merge')} />
          <span><strong>{viCopy.merge}</strong><small>{viCopy.mergeHint}</small></span>
        </label>
      </div>
      {mode === 'merge' && <label className='geographic-toggle'><input type='checkbox' checked={geographicMerge} onChange={(event) => onGeographicMergeChange(event.target.checked)} /><span><strong>{viCopy.geographic}</strong><small>{viCopy.geographicHint}</small></span></label>}
      <label className='geographic-toggle'><input type='checkbox' checked={showAdministrativeInfo} onChange={(event) => onShowAdministrativeInfoChange(event.target.checked)} /><span><strong>{viCopy.administrative}</strong><small>{viCopy.administrativeHint}</small></span></label>
      <label className='upload-dropzone'>
        <input type='file' multiple accept='.glb,.gltf,.bin,.png,.jpg,.jpeg,.webp,.tif,.tiff,.terrain.json' onChange={handleFiles} disabled={busy} />
        <strong>{busy ? viCopy.busy : viCopy.choose}</strong>
        <small>{mode === 'single' ? viCopy.singleUpload : viCopy.mergeUpload}</small>
      </label>
      <label className='upload-dropzone sar-upload-dropzone'>
        <input type='file' accept='.tif,.tiff' onChange={(event) => { onSarFile(event.target.files?.[0] ?? null); event.target.value = ''; }} disabled={busy} />
        <strong>GeoTIFF SAR overlay</strong><small>Upload VV/VH raster; bands are read from metadata, raw values are contrast-stretched for display only.</small>
        {sarFileName && <span>{sarFileName}</span>}
      </label>
      <label className='upload-dropzone tile-upload-dropzone'>
        <input type='file' multiple onChange={handleTileFiles} disabled={busy} {...({ webkitdirectory: '', directory: '' } as unknown as Record<string, string>)} />
        <strong>Chọn thư mục tile chi tiết</strong><small>{viCopy.tileHelp}</small>
      </label>
      {fileNames.length > 0 && <div className='upload-files' aria-live='polite'>{fileNames.map((name) => <span key={name}>{name}</span>)}</div>}
      {fileNames.length > 0 && <button type='button' className='upload-clear' onClick={onClear}>{viCopy.clear}</button>}
      {error && <div className='upload-error' role='alert'>{error}</div>}
      <p className='upload-help'>{viCopy.help}</p>
      <p className='upload-help'>{viCopy.textureHelp}</p>
    </section>
  );
}
