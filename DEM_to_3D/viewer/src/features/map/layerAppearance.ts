export type LayerAppearance = {
  imageryOpacity: number;
  roadPalette?: 'schematic';
  networkOpacity: number;
  labels: 'auto' | 'selected' | 'none';
  roads: 'all' | 'affected';
};
export const defaultLayerAppearance: LayerAppearance = { imageryOpacity: 1, networkOpacity: .65, labels: 'auto', roads: 'all' };

export function clampOpacity(value: number): number {
  return Number.isFinite(value) ? Math.max(0.3, Math.min(1, value)) : 1;
}

export function showRoad(status: string, selected: boolean, filter: LayerAppearance['roads']): boolean {
  return selected || filter === 'all' || status !== 'open';
}
