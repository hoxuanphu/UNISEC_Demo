import { useState } from 'react';
import type { VectorGeometry } from '../../geo/vector/types';
import type { Locale } from '../../types/dear';
import { vertexHandles } from './geometryEditing';

export function GeometryVertexEditor({
  geometry,
  locale,
  onMove
}: {
  geometry: VectorGeometry;
  locale: Locale;
  onMove: (path: number[], position: number[]) => void;
}): JSX.Element {
  const [index, setIndex] = useState(0),
    handles = vertexHandles(geometry);
  const selected = handles[Math.min(index, handles.length - 1)];
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);
  const vertexLabel = (path: number[], i: number) => {
    if (geometry.type === 'Point' || geometry.type === 'LineString') return String(i + 1);
    const ring = geometry.type === 'MultiPolygon' ? path[1] : path[0];
    const boundary = ring === 0 ? t('Biên ngoài', 'Exterior ring') : `${t('Lỗ', 'Hole')} ${ring}`;
    const part = geometry.type === 'MultiPolygon' ? `${t('Phần', 'Part')} ${path[0] + 1} · ` : '';
    return `${part}${boundary} · ${t('Đỉnh', 'Vertex')} ${path.at(-1)! + 1}`;
  };
  return (
    <section className="geodata-section">
      <h2>{t('Tọa độ đỉnh', 'Vertex coordinates')}</h2>
      <label className="geodata-field">
        {t('Đỉnh', 'Vertex')}
        <select value={index} onChange={(event) => setIndex(Number(event.target.value))}>
          {handles.map((handle, i) => (
            <option key={handle.path.join('.')} value={i}>
              {vertexLabel(handle.path, i)}
            </option>
          ))}
        </select>
      </label>
      <form
        key={selected.path.join('.') + '-' + selected.coordinate.join(',')}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onMove(selected.path, [Number(data.get('lon')), Number(data.get('lat'))]);
        }}
      >
        <label className="geodata-field">
          {t('Kinh độ', 'Longitude')}
          <input
            name="lon"
            type="number"
            min="-180"
            max="180"
            step="any"
            required
            defaultValue={selected.coordinate[0]}
          />
        </label>
        <label className="geodata-field">
          {t('Vĩ độ', 'Latitude')}
          <input
            name="lat"
            type="number"
            min="-85.05112878"
            max="85.05112878"
            step="any"
            required
            defaultValue={selected.coordinate[1]}
          />
        </label>
        <button className="button" type="submit">
          {t('Cập nhật đỉnh', 'Update vertex')}
        </button>
      </form>
    </section>
  );
}
