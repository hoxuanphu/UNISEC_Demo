import type * as THREE from 'three';

/** Roads to verify and landslide areas breathe in one rhythm on both maps; the 2D CSS uses the
 * same period and range (road-journey.css, map-symbols.css). */
export const BREATH_MS = 2400;
/** Opacity multiplier, from .4 to 1 and back. */
export const breathFactor = (now: number) => .7 - .3 * Math.cos(now * Math.PI * 2 / BREATH_MS);

type BreathMaterial = THREE.Material & { opacity: number };
/** Mark a material to breathe around its current opacity. */
export function breathe<T extends BreathMaterial>(material: T): T { material.userData.breath = material.opacity; return material; }
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
      const opacity = base * factor;
      if (Math.abs(material.opacity - opacity) > .002) { material.opacity = opacity; changed = true; }
    }
  });
  return changed;
}
