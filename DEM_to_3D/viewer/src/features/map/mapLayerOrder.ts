/** Bottom to top. Navigation warnings, symbols and tools stay above editable layers. */
export const mapLayerOrder = {
  imagery: 1,
  analysis: 1.5,
  boundary: 2,
  landslides: 2.5,
  reference: 3,
  roads: 3.5,
  route: 4,
  roadStatus: 5,
  selection: 6,
  tools: 7,
} as const;
export type MapPane = keyof typeof mapLayerOrder;
export const mapPane = (name: MapPane) => `dear-${name}`;
export const defaultDrawingOrder = ['roads', 'reference', 'landslides', 'boundary'] as const;
export type DrawingLayer = typeof defaultDrawingOrder[number];
/** Top to bottom, matching a GIS layer stack. Ignore obsolete/duplicate saved entries. */
export function normaliseDrawingOrder(value: unknown): DrawingLayer[] {
  const supplied = Array.isArray(value) ? value : [];
  return [...new Set([...supplied.filter((id): id is DrawingLayer =>
    defaultDrawingOrder.includes(id)), ...defaultDrawingOrder])];
}
export function moveDrawingLayer(order: readonly DrawingLayer[], id: DrawingLayer, direction: -1 | 1): DrawingLayer[] {
  const next = normaliseDrawingOrder(order), index = next.indexOf(id), to = index + direction;
  if (to >= 0 && to < next.length) [next[index], next[to]] = [next[to], next[index]];
  return next;
}
export function drawingLayerRank(name: MapPane, order: readonly DrawingLayer[]): number {
  const index = order.indexOf(name as DrawingLayer);
  // Reserve [2, 3.75] between imagery and navigation overlays.
  return index < 0 ? mapLayerOrder[name] : 2 + (order.length - 1 - index) * .5;
}
/** Tag only vector primitives. Terrain depth testing and source geometry are unchanged. */
export function setDrawingLayer<T extends { userData: Record<string, unknown>; renderOrder: number }>(object: T, layer: DrawingLayer, offset = 0): T {
  object.userData.drawingLayer = layer;
  object.userData.drawingOffset = offset;
  object.renderOrder = drawingLayerRank(layer, defaultDrawingOrder) * 2 + offset;
  return object;
}
export function applyDrawingOrder(root: { traverse: (visit: (object: {userData: Record<string, unknown>; renderOrder: number}) => void) => void }, order: readonly DrawingLayer[]): void {
  root.traverse(object => {
    const layer = object.userData.drawingLayer;
    if (defaultDrawingOrder.includes(layer as DrawingLayer))
      object.renderOrder = drawingLayerRank(layer as DrawingLayer, order) * 2 + Number(object.userData.drawingOffset ?? 0);
  });
}
