import { useMemo, useState } from 'react';
import { GeometryError, type VectorFeature } from '../../geo/vector/types';
import { validateGeometry } from '../../geo/vector/validateGeometry';
import { polygonCoverage } from '../../geo/vector/polygonCoverage';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { downloadBlob } from '../../shared/downloadBlob';
import { GeometryImport } from './GeometryImport';
import { GeometryLayers } from './GeometryLayers';
import { GeometryCoverage } from './GeometryCoverage';
import { GeometryMap } from './GeometryMap';
import { useGeometrySession } from './useGeometrySession';
import { createGeometryRecords } from './geometrySession';
import { exportGeometryGeoJSON, exportGeometryKml } from './geometryExports';
import { geometryErrorText } from './geometryErrors';
import './geodata.css';

type Props = {locale:Locale;onClose:()=>void;offline?:boolean;standalone?:boolean};

/** Local GIS workspace: geometry roles and analysis do not alter the incident's published data. */
export function GeometryWorkspace({locale,onClose,offline=false,standalone=false}: Props): JSX.Element {
  const t=(vi:string,en:string)=>locale === 'vi' ? vi : en;
  const session=useGeometrySession();
  const [drawing,setDrawing]=useState(false), [vertices,setVertices]=useState<number[][]>([]);
  const [mobileTab,setMobileTab]=useState<'data'|'map'>('data'), [exportScope,setExportScope]=useState('all');
  const analysis=useMemo(()=>{
    try {return {result:polygonCoverage(session.records),error:null};}
    catch {return {result:null,error:new GeometryError('analysis')};}
  },[session.records]);
  const cancel=()=>{setDrawing(false);setVertices([]);session.setError(null);};
  const finish=()=>{
    try {
      const feature:VectorFeature={type:'Feature',properties:{name:t('Vùng quan tâm','Area of interest')},
        geometry:validateGeometry({type:'Polygon',coordinates:[[...vertices,vertices[0]]]})};
      session.add(createGeometryRecords({features:[feature],format:'drawing'},t('Vẽ trên bản đồ','Map drawing'),'aoi'));cancel();setMobileTab('data');
    } catch (error) {session.setError(error);}
  };
  const draw=()=>{session.setError(null);setVertices([]);setDrawing(true);setMobileTab('map');};
  const select=(id:string)=>{if(!drawing){session.select(id);setMobileTab('data');}};
  const exportRecords=exportScope === 'aoi' ? session.records.filter(record=>record.role === 'aoi') : session.records;
  const exportFile=(format:'geojson'|'kml')=>{
    try {
      const contents=format === 'geojson' ? exportGeometryGeoJSON(exportRecords) : exportGeometryKml(exportRecords);
      downloadBlob(new Blob([contents],{type:format === 'geojson' ? 'application/geo+json' : 'application/vnd.google-earth.kml+xml'}),`dear-${exportScope}.${format}`);
    } catch {session.setError(new GeometryError('analysis'));}
  };
  const error=session.error || analysis.error;
  return <div className="geodata-workspace" role={standalone ? undefined : 'dialog'} aria-modal={standalone ? undefined : true} aria-labelledby="geodata-title" data-mobile-tab={mobileTab}>
    <header className="geodata-header"><button className="icon-button" onClick={onClose} aria-label={t('Về bản đồ ứng phó','Back to response map')} title={t('Về bản đồ ứng phó','Back to response map')}><UiIcon name="back"/></button>
      <div><h1 id="geodata-title">{t('Dữ liệu GIS','GIS data')}</h1><span>{t('Vùng quan tâm và phạm vi ảnh','Areas of interest and image footprints')}</span></div>
      <span className="geodata-local">{t('Lưu tại trình duyệt','Browser storage')}</span>
      {!standalone && <button className="icon-button" onClick={onClose} aria-label={t('Đóng dữ liệu GIS','Close GIS data')}><UiIcon name="close"/></button>}
    </header>
    <nav className="geodata-mobile-tabs" aria-label={t('Không gian dữ liệu GIS','GIS workspace')}>
      <button aria-pressed={mobileTab === 'data'} onClick={()=>setMobileTab('data')}>{t('Dữ liệu','Data')}</button><button aria-pressed={mobileTab === 'map'} onClick={()=>setMobileTab('map')}>{t('Bản đồ','Map')}</button>
    </nav>
    {error && <div className="geodata-error" role="alert"><UiIcon name="uncertain"/><span>{geometryErrorText(error,locale)}</span><button className="icon-button" onClick={()=>session.setError(null)} aria-label={t('Đóng lỗi nhập','Dismiss import error')}><UiIcon name="close"/></button></div>}
    {drawing && <div className="geodata-drawing-bar"><strong>{t('Vẽ vùng quan tâm','Draw area of interest')} · {vertices.length} {t('đỉnh','vertices')}</strong>
      <button onClick={()=>setVertices(previous=>previous.slice(0,-1))} disabled={!vertices.length}>{t('Bỏ đỉnh cuối','Undo vertex')}</button><button onClick={cancel}>{t('Hủy','Cancel')}</button><button className="geodata-primary" disabled={vertices.length < 3} onClick={finish}>{t('Kết thúc','Finish')}</button>
    </div>}
    <div className="geodata-body">
      <aside className="geodata-sidebar" aria-label={t('Quản lý dữ liệu GIS','GIS data controls')}>
        <div className="geodata-sidebar-scroll">
          <GeometryImport locale={locale} busy={session.busy} disabled={drawing} count={session.records.length} onFiles={session.importFiles} onText={session.importText} onDraw={draw}/>
          <GeometryCoverage locale={locale} coverage={analysis.result} onSelect={select}/>
          <GeometryLayers records={session.records} selectedId={session.selectedId} locale={locale} disabled={drawing || session.busy} onSelect={select} onUpdate={session.update} onRemove={session.remove}/>
        </div>
        <footer className="geodata-export"><label className="geodata-field">{t('Xuất dữ liệu','Export data')}<select aria-label={t('Phạm vi xuất GIS','GIS export scope')} value={exportScope} onChange={event=>setExportScope(event.target.value)}><option value="all">{t('Tất cả đối tượng','All features')}</option><option value="aoi">{t('Vùng quan tâm','Area of interest')}</option></select></label>
          <div className="geodata-actions">{(['geojson','kml'] as const).map(format=><button key={format} disabled={!exportRecords.length || drawing || session.busy} onClick={()=>exportFile(format)}><UiIcon name="download"/>{format === 'geojson' ? 'GeoJSON' : 'KML'}</button>)}</div>
        </footer>
      </aside>
      <GeometryMap records={session.records} selectedId={session.selectedId} locale={locale} offline={offline} viewRequest={session.viewRequest} onSelect={select}
        drawing={drawing} vertices={vertices} onVertex={point=>{if(vertices.length < 1499)setVertices(previous=>[...previous,point]);else session.setError(new GeometryError('vertex-limit'));}}
        onFinish={finish} onUndo={()=>setVertices(previous=>previous.slice(0,-1))} onCancel={cancel} intersection={analysis.result?.intersection ?? null}/>
    </div>
  </div>;
}
