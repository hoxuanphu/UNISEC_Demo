type Point = { x: number; y: number };
type PlaceSymbols = {
  layers: Record<string, boolean>;
  communities: readonly { projected: Point }[];
  responseSites?: readonly { kind: string; projected: Point }[];
};

/** Reuse a visible place symbol at a route stop instead of placing a second pin on it. */
export function hasRoutePlaceSymbol(point: Point, scene?: PlaceSymbols): boolean {
  if (!scene) return false;
  const same = (place: { projected: Point }) => Math.hypot(place.projected.x - point.x, place.projected.y - point.y) < 2;
  return Boolean(scene.layers.communities && scene.communities.some(same)) ||
    Boolean(scene.responseSites?.some(site => scene.layers[site.kind] && same(site)));
}
