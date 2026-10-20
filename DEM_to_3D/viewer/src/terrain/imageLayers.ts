import type { SarRaster } from './sarOverlay';

export const MAX_IMAGE_LAYERS = 4;
export type ImageLayer = { id: string; raster: SarRaster; band: number };
export type ImageControl = { visible: boolean; opacity: number };
export const DEFAULT_IMAGE_CONTROL: ImageControl = { visible: true, opacity: 1 };
