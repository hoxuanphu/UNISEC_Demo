import { describe, expect, it } from 'vitest';
import { anchoredPanel, constrainPanel } from './useFloatingPanel';

describe('floating map panels', () => {
  it('keeps navigation and bottom credits accessible when dragged past an edge', () => {
    expect(constrainPanel({ x: -50, y: -20 }, 1000, 700, 280, 400)).toEqual({ x: 8, y: 64 });
    expect(constrainPanel({ x: 2000, y: 2000 }, 1000, 700, 280, 400)).toEqual({ x: 656, y: 268 });
  });
  it('anchors the heading without using variable content height', () => {
    expect(anchoredPanel({ x: 130, y: 400 }, 1000, 700, 304)).toEqual({ x: 130, y: 400, maxHeight: 268 });
    expect(anchoredPanel({ x: 130, y: 900 }, 1000, 700, 304)).toEqual({ x: 130, y: 428, maxHeight: 240 });
  });
  it('repositions a tool when the viewport becomes smaller', () => {
    expect(constrainPanel({ x: 600, y: 250 }, 640, 600, 280, 400)).toEqual({ x: 296, y: 168 });
  });
  it('keeps a restored heading below a toolbar that now occupies two rows', () => {
    expect(anchoredPanel({ x: 16, y: 64 }, 480, 700, 304, 100)).toEqual({ x: 16, y: 100, maxHeight: 568 });
  });
});
