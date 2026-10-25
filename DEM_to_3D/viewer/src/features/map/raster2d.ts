import proj4 from 'proj4';
import type { TerrainData } from '../../types/terrain';
import { pixelToProjected, projectedToPixel } from '../../terrain/coordinate';
import { sampleDisplayPixel } from './rasterSampling';

export type Raster2D = { url: string; bounds: [[number, number], [number, number]] };

type Point = { x: number; y: number };
export function rasterPosition(data: TerrainData, column: number, row: number): Point {
  const p = pixelToProjected(data.metadata, column, row);
  const crs = data.metadata.crs;
  const [x, y] = proj4(crs.proj4 || `${crs.authority}:${crs.code}`, 'EPSG:3857', [p.x, p.y]);
  return { x, y };
}

/** Reproject the prepared raster on the CPU. Nodata remains transparent. */
export async function createRaster2d(data: TerrainData, imageUrl: string | undefined, imagery: boolean, hillshade: boolean, signal: AbortSignal): Promise<Raster2D> {
  const [rows, columns] = data.metadata.grid.shape;
  const source = document.createElement('canvas'); source.width = columns; source.height = rows;
  const context = source.getContext('2d');
  if (!context) throw new Error('Canvas 2D unavailable');
  if (imagery && imageUrl) {
    const response = await fetch(imageUrl, { signal });
    if (!response.ok) throw new Error(`Raster request failed (${response.status})`);
    const bitmap = await createImageBitmap(await response.blob());
    context.drawImage(bitmap, 0, 0, columns, rows); bitmap.close();
  }
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const pixels = context.getImageData(0, 0, columns, rows);
  const { a, b, d, e } = data.metadata.grid_transform;
  const determinant = a * e - b * d;
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const index = row * columns + col, offset = index * 4;
    const elevation = data.grid[index];
    if (!Number.isFinite(elevation)) { pixels.data[offset + 3] = 0; continue; }
    let light = 1;
    if (hillshade && row > 0 && col > 0 && row < rows - 1 && col < columns - 1) {
      const columnGrade = (data.grid[index + 1] - data.grid[index - 1]) / 2;
      const rowGrade = (data.grid[index + columns] - data.grid[index - columns]) / 2;
      const dx = (e * columnGrade - d * rowGrade) / determinant;
      const dy = (-b * columnGrade + a * rowGrade) / determinant;
      if (Number.isFinite(dx) && Number.isFinite(dy)) {
        const relief = Math.max(0, (dx * 0.5 - dy * 0.5 + 0.707) / Math.hypot(dx, dy, 1));
        // Satellite imagery already contains shadows; keep additional relief subtle.
        light = imagery && imageUrl ? .88 + relief * .12 : .65 + relief * .35;
      }
    }
    if (!imagery || !imageUrl) {
      pixels.data[offset] = 201 * light; pixels.data[offset + 1] = 217 * light; pixels.data[offset + 2] = 202 * light;
    } else {
      pixels.data[offset] *= light; pixels.data[offset + 1] *= light; pixels.data[offset + 2] *= light;
    }
    pixels.data[offset + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const positions = [[-.5, -.5], [columns - .5, -.5], [-.5, rows - .5], [columns - .5, rows - .5]].map(([x, y]) => rasterPosition(data, x, y));
  const minX = Math.min(...positions.map(p => p.x)), maxX = Math.max(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y)), maxY = Math.max(...positions.map(p => p.y));
  const output = document.createElement('canvas'); output.width = columns; output.height = Math.round(columns * (maxY - minY) / (maxX - minX));
  const target = output.getContext('2d')!;
  const warped = target.createImageData(output.width, output.height);
  const crs = data.metadata.crs;
  const inverse = proj4('EPSG:3857', crs.proj4 || `${crs.authority}:${crs.code}`);
  for (let row = 0; row < output.height; row++) {
    if (row % 32 === 0) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    }
    for (let col = 0; col < output.width; col++) {
      const mercator = [minX + (col + 0.5) / output.width * (maxX - minX), maxY - (row + 0.5) / output.height * (maxY - minY)];
      const [x, y] = inverse.forward(mercator);
      const pixel = projectedToPixel(data.metadata, x, y);
      sampleDisplayPixel(pixels.data, columns, rows, pixel.column, pixel.row, warped.data, (row * output.width + col) * 4);
    }
  }
  target.putImageData(warped, 0, 0);
  const sw = proj4('EPSG:3857', 'EPSG:4326', [minX, minY]);
  const ne = proj4('EPSG:3857', 'EPSG:4326', [maxX, maxY]);
  return { url: output.toDataURL('image/png'), bounds: [[sw[1], sw[0]], [ne[1], ne[0]]] as [[number, number], [number, number]] };
}
