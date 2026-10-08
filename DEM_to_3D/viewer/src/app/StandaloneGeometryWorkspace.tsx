import { useEffect, useState } from 'react';
import { workspaceConfiguration } from '../data/workspaceConfiguration';
import { GeometryWorkspace } from '../features/geodata/GeometryWorkspace';
import type { Locale } from '../types/dear';

/** Read launch settings without loading an incident, DEM, API snapshot or 3D model. */
export function StandaloneGeometryWorkspace({locale}: {locale:Locale}): JSX.Element {
  const [offline,setOffline]=useState<boolean | null>(()=>new URLSearchParams(location.search).has('offline') ? true : null);
  useEffect(()=>{
    if (offline !== null) return;
    const controller=new AbortController();
    void workspaceConfiguration(controller.signal).then(config=>setOffline(config.offline))
      .catch(()=>{if(!controller.signal.aborted)setOffline(true);});
    return ()=>controller.abort();
  },[offline]);
  const close=()=>{const url=new URL(location.href);url.searchParams.delete('workspace');location.assign(url.href);};
  if (offline === null) return <div className="geodata-workspace" role="status">{locale === 'vi' ? 'Đang mở bản đồ…' : 'Opening map…'}</div>;
  return <GeometryWorkspace locale={locale} standalone offline={offline} onClose={close}/>;
}
