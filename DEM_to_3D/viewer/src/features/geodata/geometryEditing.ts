import type { VectorGeometry } from '../../geo/vector/types';
import { validateGeometry } from '../../geo/vector/validateGeometry';

export type VertexHandle = { path: number[]; coordinate: number[] };

/** Closing coordinates are represented by the first handle, not a second draggable vertex. */
export function vertexHandles(geometry: VectorGeometry): VertexHandle[] {
  const ring = (coordinates: number[][], prefix: number[]) =>
    coordinates.slice(0, -1).map((coordinate, index) => ({ path: [...prefix, index], coordinate }));
  switch (geometry.type) {
    case 'Point':
      return [{ path: [], coordinate: geometry.coordinates }];
    case 'LineString':
      return geometry.coordinates.map((coordinate, index) => ({
        path: [index],
        coordinate
      }));
    case 'Polygon':
      return geometry.coordinates.flatMap((coordinates, index) => ring(coordinates, [index]));
    case 'MultiPolygon':
      return geometry.coordinates.flatMap((polygon, p) =>
        polygon.flatMap((coordinates, r) => ring(coordinates, [p, r]))
      );
  }
}

export function moveVertex(
  original: VectorGeometry,
  path: number[],
  position: number[]
): VectorGeometry {
  const geometry = structuredClone(original);
  if (geometry.type === 'Point') {
    geometry.coordinates = [...position.slice(0, 2), ...geometry.coordinates.slice(2)];
  } else {
    let coordinates: unknown = geometry.coordinates;
    for (const index of path.slice(0, -1)) coordinates = (coordinates as unknown[])[index];
    const ring = coordinates as number[][],
      index = path.at(-1)!;
    ring[index] = [...position.slice(0, 2), ...ring[index].slice(2)];
    if (index === 0 && geometry.type !== 'LineString') ring[ring.length - 1] = [...ring[0]];
  }
  return geometry;
}

export function drawnPolygon(vertices: number[][], rectangle = false): VectorGeometry {
  if (rectangle && vertices.length >= 2) {
    const [[x1, y1], [x2, y2]] = vertices;
    return validateGeometry({
      type: 'Polygon',
      coordinates: [
        [
          [x1, y1],
          [x2, y1],
          [x2, y2],
          [x1, y2],
          [x1, y1]
        ]
      ]
    });
  }
  return validateGeometry({
    type: 'Polygon',
    coordinates: [[...vertices, vertices[0]]]
  });
}

export function geometryHistory<T>(past: T[], present: T, future: T[], action: 'undo' | 'redo') {
  if (action === 'undo' && past.length)
    return {
      past: past.slice(0, -1),
      present: past.at(-1)!,
      future: [present, ...future]
    };
  if (action === 'redo' && future.length)
    return {
      past: [...past, present].slice(-25),
      present: future[0],
      future: future.slice(1)
    };
  return { past, present, future };
}
