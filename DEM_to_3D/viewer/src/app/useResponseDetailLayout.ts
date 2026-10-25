import { useLayoutEffect, useState, type RefObject } from 'react';

type DetailLayout = { mode: 'dock' | 'pane'; fitsProfile: boolean };

/** Keep a usable map beside the detail dock, including when the list is resized. */
export function useResponseDetailLayout(
  root: RefObject<HTMLDivElement>,
  profileOpen = false
): DetailLayout {
  const [layout, setLayout] = useState<DetailLayout>({
    mode: 'pane',
    fitsProfile: true
  });
  useLayoutEffect(() => {
    const map = root.current?.querySelector<HTMLElement>('.map-area');
    if (!map) return;
    const observed=new Set<Element>();
    const update = () => {
      const styles = getComputedStyle(map);
      const reserve =
        parseFloat(styles.getPropertyValue('--response-detail-reserve')) || 408;
      const work=map.closest('.work-area')?.getBoundingClientRect()??map.getBoundingClientRect();
      const controls=[...map.querySelectorAll<HTMLElement>('.map-toolbar,.map-tools,.map-advanced-tools')];
      for(const control of controls)if(!observed.has(control)){observer.observe(control);observed.add(control);}
      const visible=controls.map(control=>control.getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0);
      const top=Math.max(map.getBoundingClientRect().top,...visible.map(rect=>rect.bottom))+12;
      const profile=profileOpen?map.querySelector<HTMLElement>('.profile-panel')?.getBoundingClientRect():null;
      const bottom=profile&&profile.height?profile.top-12:work.bottom-(profileOpen?336:100);
      const available=Math.max(0,bottom-top);
      const fitsProfile=available>=300;
      const set=(name:string,value:string)=>{if(root.current?.style.getPropertyValue(name)!==value)root.current?.style.setProperty(name,value);};
      set('--response-detail-top',`${top-work.top}px`);
      set('--response-detail-max-height',`${Math.min(600,available)}px`);
      const mode =
        window.innerWidth > 900 && map.clientWidth >= reserve + 360 && available>=220 && (!profileOpen || fitsProfile)
          ? 'dock'
          : 'pane';
      setLayout((previous) =>
        previous.mode === mode && previous.fitsProfile === fitsProfile
          ? previous
          : { mode, fitsProfile }
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(map);
    const mutation=new MutationObserver(records=>{
      if(records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node instanceof Element &&
        (node.matches('.map-north,.profile-panel')||node.querySelector('.map-north,.profile-panel')))))update();
    });
    mutation.observe(map,{childList:true,subtree:true});
    map.addEventListener('dear:map-layout',update);
    update();
    return () => {observer.disconnect();mutation.disconnect();map.removeEventListener('dear:map-layout',update);root.current?.style.removeProperty('--response-detail-top');root.current?.style.removeProperty('--response-detail-max-height');};
  }, [root, profileOpen]);
  return layout;
}
