import { useEffect, useState } from 'react';

type OrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type PermissionRequest = { requestPermission?: () => Promise<'granted' | 'denied'> };

const phoneCompass = () => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && window.matchMedia('(pointer: coarse)').matches;
const needsPermission = () => typeof (window.DeviceOrientationEvent as unknown as PermissionRequest | undefined)?.requestPermission === 'function';

/**
 * The way the phone faces, in whole degrees clockwise from north, while switched on.
 * Only phones report it. It starts by itself, as in a map app, where no permission is
 * needed; iOS asks on the first tap of the compass. Nothing is stored.
 */
export function useDeviceHeading() {
  const supported = phoneCompass();
  const [active, setActive] = useState(() => supported && !needsPermission());
  const [heading, setHeading] = useState<number | null>(null);
  useEffect(() => {
    if (!active) { setHeading(null); return; }
    const read = (event: Event) => {
      const e = event as OrientationEvent;
      const value = typeof e.webkitCompassHeading === 'number' ? e.webkitCompassHeading : e.absolute && e.alpha !== null ? 360 - e.alpha : null;
      // Small wobbles do not re-render the map.
      if (value !== null && Number.isFinite(value)) setHeading(previous => previous !== null && Math.abs(((value - previous + 540) % 360) - 180) < 3 ? previous : ((Math.round(value) % 360)+360)%360);
    };
    const type = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(type, read);
    return () => window.removeEventListener(type, read);
  }, [active]);
  const toggle = async () => {
    if (active) { setActive(false); return; }
    const request = (window.DeviceOrientationEvent as unknown as PermissionRequest | undefined)?.requestPermission;
    if (request && await request.call(window.DeviceOrientationEvent).catch(() => 'denied') !== 'granted') return;
    setActive(true);
  };
  return { supported, active, heading, toggle };
}
