import type { TerrainMetadata } from '../types/terrain';
import { pixelToProjected, projectedToScene } from './coordinate';

export type ContourBudget = { cells: number; segments: number; work: number };
export const createContourBudget = (): ContourBudget => ({ cells: 2_000_000, segments: 2_000_000, work: 8_000_000 });

export function validateContourInterval(interval: number): void {
  if (!Number.isFinite(interval) || interval <= 0) throw new Error('Khoảng cao độ phải là số hữu hạn lớn hơn 0 mét.');
}

// Match the exporter's NE–SW diagonal, including its all-four-corners nodata mask.
// A fixed triangulation resolves saddles without moving lines off the actual mesh.
export function* contourSteps(grid: Float32Array, metadata: TerrainMetadata, interval: number, budget = createContourBudget()): Generator<void, Float32Array> {
  validateContourInterval(interval);
  const [rows, columns] = metadata.grid.shape;
  if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(columns) || rows < 2 || columns < 2 || grid.length !== rows * columns) {
    throw new Error('Lưới DEM không hợp lệ hoặc không đủ ô để tạo đường đồng mức.');
  }
  const cells = (rows - 1) * (columns - 1);
  if (cells > budget.cells) throw new Error('DEM quá lớn để tạo đồng mức (tối đa 2 triệu ô). Hãy xuất lưới thưa hơn.');
  budget.cells -= cells;
  const chunks: Float32Array[] = [];
  let chunk = new Float32Array(65_532);
  let offset = 0;
  let length = 0;
  const append = (x: number, y: number, z: number): void => {
    if (offset === chunk.length) { chunks.push(chunk); chunk = new Float32Array(65_532); offset = 0; }
    chunk.set([x, y, z], offset);
    offset += 3;
    length += 3;
  };
  type Vertex = { column: number; row: number; elevation: number };
  let processed = 0;
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      if (++processed % 1024 === 0) yield;
      if (--budget.work < 0) throw new Error('Quá nhiều phép tính đồng mức. Hãy tăng khoảng cao độ hoặc xuất lưới thưa hơn.');
      const elevations = [grid[row * columns + column], grid[row * columns + column + 1], grid[(row + 1) * columns + column], grid[(row + 1) * columns + column + 1]];
      if (!elevations.every(Number.isFinite)) continue;
      const corners: Vertex[] = [
        { column, row, elevation: elevations[0] },
        { column: column + 1, row, elevation: elevations[1] },
        { column, row: row + 1, elevation: elevations[2] },
        { column: column + 1, row: row + 1, elevation: elevations[3] },
      ];
      for (const indices of [[0, 2, 1], [1, 2, 3]]) {
        const triangle = indices.map((index) => corners[index]);
        const low = Math.min(...triangle.map((v) => v.elevation));
        const high = Math.max(...triangle.map((v) => v.elevation));
        if (low === high) continue;
        const first = Math.ceil(low / interval);
        const last = Math.floor(high / interval);
        if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || last - first + 1 > budget.work) {
          throw new Error('Khoảng cao độ quá nhỏ cho DEM này. Hãy tăng khoảng cao độ.');
        }
        for (let levelIndex = first; levelIndex <= last; levelIndex += 1) {
          if (--budget.work < 0) throw new Error('Quá nhiều phép tính đồng mức. Hãy tăng khoảng cao độ.');
          if (budget.work % 2048 === 0) yield;
          const elevation = levelIndex * interval;
          const points: Array<{ column: number; row: number }> = [];
          for (let edge = 0; edge < 3; edge += 1) {
            const a = triangle[edge];
            const b = triangle[(edge + 1) % 3];
            // Half-open classification gives shared vertices a consistent owner.
            if ((a.elevation < elevation) === (b.elevation < elevation)) continue;
            const t = (elevation - a.elevation) / (b.elevation - a.elevation);
            points.push({ column: a.column + t * (b.column - a.column), row: a.row + t * (b.row - a.row) });
          }
          if (points.length !== 2 || (points[0].column === points[1].column && points[0].row === points[1].row)) continue;
          if (--budget.segments < 0) throw new Error('Quá nhiều đoạn đồng mức (tối đa 2 triệu). Hãy tăng khoảng cao độ.');
          for (const point of points) {
            const scene = projectedToScene(metadata, pixelToProjected(metadata, point.column, point.row), elevation);
            append(scene.x, scene.y, scene.z);
          }
        }
      }
    }
  }
  const positions = new Float32Array(length);
  chunks.forEach((part, index) => positions.set(part, index * 65_532));
  positions.set(chunk.subarray(0, offset), chunks.length * 65_532);
  return positions;
}

export async function buildContours(grid: Float32Array, metadata: TerrainMetadata, interval: number, signal: AbortSignal, budget = createContourBudget()): Promise<Float32Array> {
  const steps = contourSteps(grid, metadata, interval, budget);
  try {
    for (;;) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const step = steps.next();
      if (step.done) return step.value;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  } finally { steps.return(new Float32Array()); }
}
