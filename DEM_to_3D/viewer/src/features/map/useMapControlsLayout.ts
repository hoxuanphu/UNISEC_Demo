import { useLayoutEffect, type RefObject } from 'react';

/** Panels share the actual bottom edge of every visible toolbar row. */
export function useMapControlsLayout(toolbar: RefObject<HTMLElement>) {
  useLayoutEffect(()=>{
    const area=toolbar.current?.closest<HTMLElement>('.map-area');
    if(!area)return;
    let controls=Array.from(area.children).filter((node):node is HTMLElement=>node instanceof HTMLElement && node.matches('.map-toolbar,.map-tools,.map-advanced-tools'));
    const update=()=>{
      const top=area.getBoundingClientRect().top;
      const bottom=Math.ceil(Math.max(0,...controls.filter(node=>!node.hidden&&node.getClientRects().length).map(node=>node.getBoundingClientRect().bottom-top)));
      const value=`${bottom}px`;
      const space=`${Math.max(0,area.clientHeight-bottom-16)}px`;
      if(area.style.getPropertyValue('--map-controls-bottom')===value && area.style.getPropertyValue('--map-controls-space')===space)return;
      area.style.setProperty('--map-controls-bottom',value);
      area.style.setProperty('--map-controls-space',space);
      area.dataset.controlsLayout='measured';
      area.dispatchEvent(new Event('dear:map-layout'));
    };
    const observer=new ResizeObserver(update);
    observer.observe(area);controls.forEach(node=>observer.observe(node));
    const mutations=new MutationObserver(()=>{
      const next=Array.from(area.children).filter((node):node is HTMLElement=>node instanceof HTMLElement&&node.matches('.map-toolbar,.map-tools,.map-advanced-tools'));
      controls.filter(node=>!next.includes(node)).forEach(node=>observer.unobserve(node));
      next.filter(node=>!controls.includes(node)).forEach(node=>observer.observe(node));
      controls=next;update();
    });
    mutations.observe(area,{childList:true});
    update();window.addEventListener('resize',update);
    return()=>{
      observer.disconnect();mutations.disconnect();window.removeEventListener('resize',update);
      area.style.removeProperty('--map-controls-bottom');area.style.removeProperty('--map-controls-space');delete area.dataset.controlsLayout;
    };
  },[toolbar]);
}
