import { describe, expect, it } from 'vitest';
import { drawnPolygon, geometryHistory, moveVertex, vertexHandles } from './geometryEditing';
import { validateGeometry } from '../../geo/vector/validateGeometry';

describe('Geometry drafts', () => {
  it('moves shared closing coordinates together and preserves Z and the original', () => {
    const original = validateGeometry({
      type: 'Polygon',
      coordinates: [
        [
          [104, 21, 7],
          [105, 21, 8],
          [105, 22, 9],
          [104, 21, 7]
        ]
      ]
    });
    const moved = moveVertex(original, [0, 0], [103.9, 20.9]);
    if (original.type !== 'Polygon') throw new Error('Expected polygon');
    expect(original.coordinates[0][0]).toEqual([104, 21, 7]);
    if (moved.type !== 'Polygon') throw new Error('Expected polygon');
    expect(moved.coordinates[0][0]).toEqual([103.9, 20.9, 7]);
    expect(moved.coordinates[0].at(-1)).toEqual(moved.coordinates[0][0]);
    expect(vertexHandles(moved)).toHaveLength(3);
    expect(() => validateGeometry(moved)).not.toThrow();
  });
  it('keeps hole and MultiPolygon vertex paths distinct', () => {
    const original = validateGeometry({
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [104, 21],
            [105, 21],
            [105, 22],
            [104, 22],
            [104, 21]
          ],
          [
            [104.2, 21.2],
            [104.3, 21.2],
            [104.3, 21.3],
            [104.2, 21.3],
            [104.2, 21.2]
          ]
        ],
        [
          [
            [106, 21],
            [107, 21],
            [107, 22],
            [106, 21]
          ]
        ]
      ]
    });
    const moved = moveVertex(original, [0, 1, 0], [104.21, 21.21]);
    expect(
      vertexHandles(moved).find((handle) => handle.path.join() === '0,1,0')?.coordinate
    ).toEqual([104.21, 21.21]);
    expect(() => validateGeometry(moved)).not.toThrow();
  });
  it('accepts both rectangle corner orders and rejects degenerate or self-crossing drafts', () => {
    for (const vertices of [
      [
        [104, 21],
        [105, 22]
      ],
      [
        [105, 22],
        [104, 21]
      ]
    ])
      expect(drawnPolygon(vertices, true).type).toBe('Polygon');
    expect(() =>
      drawnPolygon(
        [
          [104, 21],
          [104, 22]
        ],
        true
      )
    ).toThrow();
    expect(() =>
      drawnPolygon([
        [104, 21],
        [105, 22],
        [105, 21],
        [104, 22]
      ])
    ).toThrow();
  });
  it('undoes and redoes without changing a saved snapshot', () => {
    const undo = geometryHistory([1, 2], 3, [], 'undo');
    expect(undo).toEqual({ past: [1], present: 2, future: [3] });
    expect(geometryHistory(undo.past, undo.present, undo.future, 'redo')).toEqual({
      past: [1, 2],
      present: 3,
      future: []
    });
  });
});
