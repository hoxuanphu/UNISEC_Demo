import { useRef, useState } from 'react';
import { readKmlFile, type KmlLayer } from '../terrain/kml';

type Props = { layers: KmlLayer[]; onLayers: (layers: KmlLayer[]) => void; available: boolean; status: string | null };

export function KmlPanel({ layers, onLayers, available, status }: Props): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const saved = useRef<KmlLayer[]>(layers);
  const request = useRef(0);
  const load = async (files: File[]): Promise<void> => {
    const id = ++request.current;
    if (!files.length) return;
    setBusy(true); setError(null);
    try {
      if (files.length > 8 || files.reduce((total, file) => total + file.size, 0) > 64 * 1024 * 1024) throw new Error('Chọn tối đa 8 file KML/KMZ, tổng dung lượng tối đa 64 MiB.');
      const next: KmlLayer[] = [];
      for (const file of files) next.push(await readKmlFile(file));
      if (id !== request.current) return;
      saved.current = next; setHidden(false); onLayers(next);
    } catch (reason) { if (id === request.current) setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { if (id === request.current) setBusy(false); }
  };
  return <section className='sar-controls' aria-label='Lớp KML / KMZ'>
    <label>Điểm, đường và vùng KML / KMZ <input type='file' accept='.kml,.kmz' multiple disabled={busy} onChange={(event) => { void load(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></label>
    <small>Phủ lên địa hình theo WGS84; bỏ qua cao độ trong KML. Chọn nhiều file cùng lúc để thay bộ lớp hiện tại.</small>
    {saved.current.length > 0 && <>
      <label><input type='checkbox' checked={!hidden} onChange={(event) => { setHidden(!event.target.checked); onLayers(event.target.checked ? saved.current : []); }} /> Hiện KML / KMZ</label>
      <button type='button' onClick={() => { request.current++; setBusy(false); saved.current = []; onLayers([]); setError(null); }}>Xóa lớp KML / KMZ</button>
      <ul>{saved.current.map((layer, index) => <li key={`${index}-${layer.name}`}>{layer.name} · {layer.features.length} đối tượng</li>)}</ul>
    </>}
    <span role='status'>{busy ? 'Đang đọc KML / KMZ…' : error ?? (!available ? 'Cần terrain có .terrain.json để định vị và phủ lớp KML / KMZ.' : status)}</span>
  </section>;
}
