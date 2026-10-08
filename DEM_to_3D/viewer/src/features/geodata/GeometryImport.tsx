import { useRef, useState } from 'react';
import type { GeometryRole } from '../../geo/vector/types';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { roleLabel } from './geometryPresentation';

type Props = {
  locale: Locale; busy: boolean; disabled: boolean; count: number;
  onFiles: (files: File[], role: GeometryRole)=>Promise<boolean>;
  onText: (text: string, role: GeometryRole)=>boolean;
  onDraw: ()=>void;
};

export function GeometryImport({locale,busy,disabled,count,onFiles,onText,onDraw}: Props): JSX.Element {
  const t=(vi:string,en:string)=>locale === 'vi' ? vi : en;
  const input=useRef<HTMLInputElement>(null);
  const [role,setRole]=useState<GeometryRole>('reference'), [paste,setPaste]=useState(false), [text,setText]=useState('');
  const [expanded,setExpanded]=useState(!count);
  return <section className="geodata-section geodata-import">
    <h2><button className="geodata-section-toggle" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}>{t('Nhập dữ liệu','Import data')}<UiIcon name={expanded ? 'collapse' : 'expand'}/></button></h2>
    <div hidden={!expanded}>
    <label className="geodata-field">{t('Sử dụng làm','Use as')}
      <select value={role} disabled={disabled || busy} onChange={event=>setRole(event.target.value as GeometryRole)}>
        {(['reference','aoi','footprint'] as const).map(role=><option key={role} value={role}>{roleLabel(role,locale)}</option>)}
      </select>
    </label>
    <div className="geodata-actions">
      <button className="geodata-primary" disabled={busy || disabled} onClick={()=>input.current?.click()}><UiIcon name="plus"/>{busy ? t('Đang đọc…','Reading…') : t('Chọn tệp','Choose files')}</button>
      <button disabled={busy || disabled} onClick={()=>setPaste(value=>!value)} aria-expanded={paste}>{t('Dán tọa độ / WKT','Paste coordinates / WKT')}</button>
    </div>
    <input ref={input} type="file" aria-label={t('Tệp dữ liệu GIS','GIS data files')} accept=".kml,.geojson,.json,.wkt,.txt" multiple hidden
      onChange={async event=>{const files=[...(event.target.files ?? [])];event.target.value='';if(files.length && await onFiles(files,role))setExpanded(false);}}/>
    {paste && <form onSubmit={event=>{event.preventDefault();if(onText(text,role)) {setText('');setPaste(false);setExpanded(false);}}}>
      <label className="geodata-field">{t('Nội dung','Input')}<textarea aria-label={t('Tọa độ, WKT hoặc GeoJSON','Coordinates, WKT or GeoJSON')} value={text} disabled={disabled || busy} rows={5}
        placeholder={'21.782919° N, 104.053554° E\nPOLYGON((104 21, 105 21, 105 22, 104 21))'} onChange={event=>setText(event.target.value)}/></label>
      <p className="geodata-hint">{t('WGS84 · WKT/GeoJSON: kinh độ, vĩ độ','WGS84 · WKT/GeoJSON: longitude, latitude')}</p>
      <button className="geodata-primary" disabled={!text.trim() || busy || disabled} type="submit">{t('Nhập','Import')}</button>
    </form>}
    <p className="geodata-hint">KML · GeoJSON · WKT · {t('2 MB/tệp','2 MB/file')}</p>
    </div>
    <button className="geodata-draw" disabled={busy || disabled} onClick={onDraw}><UiIcon name="area"/>{t('Vẽ vùng quan tâm','Draw area of interest')}</button>
  </section>;
}
