import { useEffect, useRef, useState } from 'react';
import { imageMode, readSarRaster } from '../terrain/sarOverlay';
import { DEFAULT_IMAGE_CONTROL, MAX_IMAGE_LAYERS, type ImageControl, type ImageLayer } from '../terrain/imageLayers';

type Props = {
  layers: ImageLayer[];
  controls: Record<string, ImageControl>;
  onLayers: (layers: ImageLayer[]) => void;
  onControl: (id: string, control: ImageControl) => void;
  errors: Record<string, string | null>;
};

export function ImageLayersPanel({ layers, controls, onLayers, onControl, errors }: Props): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef(layers);
  current.current = layers;
  const request = useRef(0);
  const nextId = useRef(0);
  useEffect(() => () => { request.current++; }, []);

  const load = async (files: File[]): Promise<void> => {
    if (!files.length) return;
    const token = ++request.current;
    setError(null);
    if (current.current.length + files.length > MAX_IMAGE_LAYERS) {
      setError(`Tối đa ${MAX_IMAGE_LAYERS} ảnh GeoTIFF. Xóa bớt ảnh trước khi thêm.`);
      return;
    }
    setBusy(true);
    const added: ImageLayer[] = [];
    const failures: string[] = [];
    try {
      for (const file of files) {
        if (token !== request.current) return;
        try {
          const raster = await readSarRaster(file);
          imageMode(raster);
          added.push({ id: `image-${++nextId.current}`, raster, band: 0 });
        } catch (reason) { failures.push(`${file.name}: ${reason instanceof Error ? reason.message : String(reason)}`); }
      }
      if (token !== request.current) return;
      onLayers([...current.current, ...added]);
      setError(failures.join(' ') || null);
    } finally { if (token === request.current) setBusy(false); }
  };

  const clear = (): void => {
    request.current++;
    setBusy(false); setError(null); onLayers([]);
  };

  return <section className='sar-controls image-layers-panel' aria-label='Ảnh GeoTIFF độc lập'>
    <label>Ảnh GeoTIFF (RGB / thang xám) <input type='file' accept='.tif,.tiff' multiple disabled={busy || layers.length >= MAX_IMAGE_LAYERS} onChange={(event) => { void load(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></label>
    <small>Chọn nhiều file để thêm vào danh sách, tối đa {MAX_IMAGE_LAYERS} ảnh. Ảnh thêm sau phủ lên ảnh trước; bật/tắt và độ đậm riêng cho từng ảnh.</small>
    <span role='status'>{busy ? 'Đang đọc ảnh GeoTIFF…' : `${layers.length}/${MAX_IMAGE_LAYERS} ảnh GeoTIFF`}</span>
    {(layers.length > 0 || busy) && <button type='button' onClick={clear}>Xóa tất cả ảnh</button>}
    {error && <p role='alert'>{error}</p>}
    <ol className='image-layer-list'>
      {layers.map((layer, index) => {
        const control = controls[layer.id] ?? DEFAULT_IMAGE_CONTROL;
        const mode = imageMode(layer.raster);
        return <li key={layer.id}>
          <fieldset className='image-layer-controls'>
            <legend>{index + 1}. {layer.raster.name}</legend>
            <small>{mode === 'rgb' ? 'RGB (scale theo bit depth)' : 'Thang xám (stretch 2–98%)'} · {layer.raster.width}×{layer.raster.height}</small>
            <label><input type='checkbox' checked={control.visible} onChange={(event) => onControl(layer.id, { ...control, visible: event.target.checked })} /> Hiện ảnh GeoTIFF</label>
            {mode === 'gray' && <label>Band <select value={layer.band} onChange={(event) => onLayers(layers.map((item) => item.id === layer.id ? { ...item, band: Number(event.target.value) } : item))}>{layer.raster.bands.slice(0, layer.raster.bands.length - (layer.raster.extraSamples?.length ?? 0)).map((band) => <option key={band.index} value={band.index}>{band.label}</option>)}</select></label>}
            <label>Độ đậm ảnh <input type='range' min='0' max='1' step='0.05' value={control.opacity} onChange={(event) => onControl(layer.id, { ...control, opacity: Number(event.target.value) })} /> {Math.round(control.opacity * 100)}%</label>
            <button type='button' onClick={() => onLayers(layers.filter((item) => item.id !== layer.id))}>Xóa ảnh</button>
            <span role='status'>{errors[layer.id]}</span>
          </fieldset>
        </li>;
      })}
    </ol>
  </section>;
}
