import { useState } from 'react';
import area from '@turf/area';
import { geometryPositions, isPolygon, type GeometryRecord, type GeometryRole } from '../../geo/vector/types';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { roleLabel, roleColors, formatArea } from './geometryPresentation';
import { exportGeometryWkt } from './geometryExports';

type Props = {
  records: GeometryRecord[]; selectedId: string | null; locale: Locale; disabled: boolean;
  onSelect: (id:string)=>void; onRemove: (id:string)=>void;
  onUpdate: (id:string,patch:Partial<Pick<GeometryRecord,'name'|'visible'|'role'>>)=>void;
};

export function GeometryLayers({records,selectedId,locale,disabled,onSelect,onRemove,onUpdate}: Props): JSX.Element {
  const t=(vi:string,en:string)=>locale === 'vi' ? vi : en;
  const [metadata,setMetadata]=useState(false), [copied,setCopied]=useState<string | null>(null), [copyError,setCopyError]=useState(false);
  const selected=records.find(record=>record.id === selectedId);
  const copy=async()=>{if(!selected)return;try {await navigator.clipboard.writeText(exportGeometryWkt(selected.feature.geometry));setCopied(selected.id);setCopyError(false);}catch{setCopyError(true);}};
  return <>
    <section className="geodata-section geodata-layers">
      <h2>{t('Đối tượng','Features')}<span>{records.length}</span></h2>
      {!records.length && <p className="geodata-empty">{t('Nhập tệp hoặc vẽ vùng để bắt đầu.','Import a file or draw an area to start.')}</p>}
      <ul>{records.map(record=><li key={record.id} className={record.id === selectedId ? 'is-selected' : ''} data-geodata-id={record.id}>
        <input type="checkbox" disabled={disabled} checked={record.visible} aria-label={t('Hiện ','Show ')+record.name} onChange={event=>onUpdate(record.id,{visible:event.target.checked})}/>
        <button className="geodata-feature" disabled={disabled} onClick={()=>{onSelect(record.id);setCopied(null);}}>
          <span className="geodata-symbol" style={{color:roleColors[record.role]}}><UiIcon name={record.feature.geometry.type === 'Point' ? 'location' : record.feature.geometry.type === 'LineString' ? 'minus' : 'area'} size={18}/></span>
          <span><strong>{record.name}</strong><small>{roleLabel(record.role,locale)}</small></span>
        </button>
      </li>)}</ul>
    </section>
    {selected && <section className="geodata-section geodata-detail" key={selected.id}>
      <h2>{t('Thuộc tính','Properties')}<button className="icon-button" disabled={disabled} aria-label={t('Xóa ','Remove ')+selected.name} title={t('Xóa đối tượng','Remove feature')} onClick={()=>onRemove(selected.id)}><UiIcon name="trash"/></button></h2>
      <label className="geodata-field">{t('Tên','Name')}<input maxLength={160} aria-label={t('Tên đối tượng','Feature name')} value={selected.name} disabled={disabled} onChange={event=>onUpdate(selected.id,{name:event.target.value})}/></label>
      <label className="geodata-field">{t('Sử dụng làm','Use as')}<select value={selected.role} disabled={disabled || !isPolygon(selected.feature.geometry)} aria-label={t('Vai trò đối tượng','Feature role')} onChange={event=>onUpdate(selected.id,{role:event.target.value as GeometryRole})}>
        {(['reference','aoi','footprint'] as const).map(role=><option key={role} value={role}>{roleLabel(role,locale)}</option>)}
      </select></label>
      <dl className="geodata-properties"><div><dt>{t('Hình học','Geometry')}</dt><dd>{selected.feature.geometry.type}</dd></div>
        {isPolygon(selected.feature.geometry) && <div><dt>{t('Diện tích','Area')}</dt><dd>≈ {formatArea(area(selected.feature),locale)}</dd></div>}
        {selected.feature.geometry.type === 'Point' && <div><dt>WGS84</dt><dd className="geodata-coordinate">{selected.feature.geometry.coordinates[1].toFixed(6)}°, {selected.feature.geometry.coordinates[0].toFixed(6)}°</dd></div>}
      </dl>
      <div className="geodata-actions"><button aria-expanded={metadata} onClick={()=>setMetadata(value=>!value)}><UiIcon name={metadata ? 'collapse' : 'expand'}/>{t('Nguồn và tọa độ','Source and coordinates')}</button>
        <button className="icon-button" aria-label={t('Sao chép WKT','Copy WKT')} title={t('Sao chép WKT','Copy WKT')} onClick={()=>void copy()}><UiIcon name="copy"/></button></div>
      {copied === selected.id && <p className="geodata-hint" role="status">{t('Đã sao chép WKT','WKT copied')}</p>}
      {copyError && <p className="geodata-hint" role="status">{t('Không truy cập được bộ nhớ tạm. Xuất GeoJSON để lấy tọa độ.','Clipboard unavailable. Export GeoJSON to get coordinates.')}</p>}
      {metadata && <div className="geodata-metadata"><dl className="geodata-properties">
        <div><dt>{t('Tệp / đầu vào','File / input')}</dt><dd>{selected.source.name}</dd></div>
        <div><dt>{t('Định dạng','Format')}</dt><dd>{selected.source.format}</dd></div><div><dt>CRS</dt><dd>WGS84 · OGC:CRS84</dd></div>
        <div><dt>{t('Đỉnh','Vertices')}</dt><dd>{geometryPositions(selected.feature.geometry).length}</dd></div>
        <div><dt>{t('Thời điểm nhập','Imported')}</dt><dd>{new Date(selected.source.importedAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB')}</dd></div>
      </dl><pre tabIndex={0}>{exportGeometryWkt(selected.feature.geometry)}</pre>
      {Object.entries(selected.feature.properties).filter(([key,value])=>key !== 'name' && value != null && value !== '').map(([key,value])=><div className="geodata-input-property" key={key}><strong>{key}</strong><span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span></div>)}
      </div>}
    </section>}
  </>;
}
