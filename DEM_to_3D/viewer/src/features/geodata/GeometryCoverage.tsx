import { useState } from 'react';
import type { polygonCoverage } from '../../geo/vector/polygonCoverage';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { formatArea } from './geometryPresentation';

export function GeometryCoverage({coverage,locale,onSelect}: {coverage:ReturnType<typeof polygonCoverage>;locale:Locale;onSelect:(id:string)=>void}): JSX.Element {
  const t=(vi:string,en:string)=>locale === 'vi' ? vi : en;
  const [method,setMethod]=useState(false);
  const percent=(fraction:number)=>new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-GB',{style:'percent',maximumFractionDigits:1}).format(fraction);
  return <section className="geodata-section geodata-coverage">
    <h2>{t('Độ phủ vùng quan tâm','AOI coverage')}<button className="icon-button" aria-label={t('Phương pháp độ phủ','Coverage method')} aria-expanded={method} onClick={()=>setMethod(value=>!value)}><UiIcon name="info"/></button></h2>
    {!coverage ? <p className="geodata-empty">{t('Chọn một polygon làm vùng quan tâm (AOI).','Assign a polygon as the area of interest (AOI).')}</p> : !coverage.rows.length ?
      <p className="geodata-empty">{t('Nhập hoặc chọn polygon làm phạm vi ảnh để đối chiếu với ','Import or assign image footprints to compare with ')}<strong>{coverage.aoiName}</strong>.</p> : <>
      <div className="geodata-coverage-summary"><span>{coverage.aoiName}</span><strong data-coverage-total>{percent(coverage.fraction ?? 0)}</strong><small>≈ {formatArea(coverage.coveredArea ?? 0,locale)} / {formatArea(coverage.aoiArea,locale)}</small></div>
      <table><thead><tr><th>{t('Phạm vi ảnh','Image footprint')}</th><th>{t('Phủ AOI','AOI covered')}</th></tr></thead><tbody>
        {coverage.rows.map(row=><tr key={row.id}><td><button onClick={()=>onSelect(row.id)}>{row.name}</button></td><td>{percent(row.fraction)}</td></tr>)}
      </tbody></table>
      <p className="geodata-hint">{t('Tổng độ phủ đã loại phần chồng lấn.','Combined coverage excludes double counting.')}</p>
    </>}
    {method && <div className="geodata-method"><p>{t('Phần giao AOI với hợp của các phạm vi ảnh. Diện tích xấp xỉ trên mặt cầu (R = 6.371.008,8 m), hình học WGS84 trong kinh/vĩ độ.','AOI intersection with the union of image footprints. Approximate spherical area (R = 6,371,008.8 m), WGS84 geometry in longitude/latitude.')}</p>
      <p>{t('Ẩn lớp chỉ đổi hiển thị. Độ phủ hình học chưa đánh giá mây, thời gian chụp hoặc chất lượng ảnh.','Hiding layers only changes display. Geometric coverage does not assess clouds, acquisition time or image quality.')}</p><code>polygon-coverage-v1</code></div>}
  </section>;
}
