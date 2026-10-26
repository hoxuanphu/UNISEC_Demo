import type {ResponsePriority} from '../features/landslides/responsePriority';
import type * as THREE from 'three';

/** Roads to verify and landslide areas breathe in one rhythm on both maps; the 2D CSS uses the
 * same period and range (road-journey.css, map-symbols.css). */
export const BREATH_MS = 2400;
/** Opacity multiplier, from .4 to 1 and back. */
export const breathFactor = (now: number) => .7 - .3 * Math.cos(now * Math.PI * 2 / BREATH_MS);

type BreathMaterial = THREE.Material & { opacity: number };
/** Mark a material to breathe around its current opacity. */
export function breathe<T extends BreathMaterial>(material: T,priority:ResponsePriority='urgent'): T { material.userData.breath = material.opacity; material.userData.breathPriority=priority; return material; }
/** Change the resting opacity of a breathing material, e.g. on hover. */
export function setBreathBase(material: BreathMaterial, opacity: number) { material.opacity = opacity; if (typeof material.userData.breath === 'number') material.userData.breath = opacity; }

/** Apply one breath step under `root`; true when anything changed and needs a render. */
export function applyBreath(root: THREE.Object3D | null | undefined, factor: number): boolean {
  let changed = false;
  root?.traverse(object => {
    const value = (object as THREE.Mesh).material;
    for (const material of Array.isArray(value) ? value : value ? [value] : []) {
      const base = material.userData.breath;
      if (typeof base !== 'number') continue;
      const priority=material.userData.breathPriority;
      const strength=priority==='routine'?1:priority==='review'?.76+.24*((factor-.4)/.6):factor;
      const opacity = base * strength;
      if (Math.abs(material.opacity - opacity) > .002) { material.opacity = opacity; changed = true; }
    }
  });
  return changed;
}

/** Warning ink remains readable while a modest width change makes the breath visible. */
export function applyWarningBreath(materials:readonly (BreathMaterial&{linewidth:number})[],factor:number,motion=true):boolean {
 const phase=Math.max(0,Math.min(1,(factor-.4)/.6));let changed=false;
 for(const material of materials){
  const base=material.userData.warningWidth??(material.userData.warningWidth=material.linewidth);
  const opacity=motion?.82+.18*phase:1,width=base*(motion?1+.24*phase:1);
  if(Math.abs(material.opacity-opacity)>.002||Math.abs(material.linewidth-width)>.002){material.opacity=opacity;material.linewidth=width;changed=true;}
 }
 return changed;
}
