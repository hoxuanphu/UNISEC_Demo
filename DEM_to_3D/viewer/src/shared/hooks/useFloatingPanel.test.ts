import { describe, expect, it } from 'vitest';
import { anchoredPanel, constrainPanel, fittedPanel } from './useFloatingPanel';

describe('floating map panels', () => {
  it('fits growing content below the same dragged heading instead of jumping upward',()=>{
    expect(fittedPanel({x:130,y:400},1000,700,304,34)).toEqual({x:130,y:400,maxWidth:858,maxHeight:244});
    expect(fittedPanel({x:130,y:610},1000,700,304,34)).toEqual({x:130,y:610,maxWidth:858,maxHeight:34});
    expect(fittedPanel({x:130,y:400},1000,500,304,34)).toEqual({x:130,y:400,maxWidth:858,maxHeight:44});
  });
  it('shrinks a widened map at its dragged heading instead of moving it sideways',()=>{
    expect(fittedPanel({x:700,y:400},1000,700,248,34)).toEqual({x:700,y:400,maxWidth:288,maxHeight:244});
    expect(fittedPanel({x:700,y:400},1000,700,600,34)).toEqual({x:700,y:400,maxWidth:288,maxHeight:244});
  });
  it('keeps navigation and bottom credits accessible when dragged past an edge', () => {
    expect(constrainPanel({ x: -50, y: -20 }, 1000, 700, 280, 400)).toEqual({ x: 12, y: 64 });
    // Low on the map the panel may reach the right edge; near the top it keeps clear of the map buttons.
    expect(constrainPanel({ x: 2000, y: 2000 }, 1000, 700, 280, 400)).toEqual({ x: 708, y: 244 });
    expect(constrainPanel({ x: 2000, y: 100 }, 1000, 700, 280, 400)).toEqual({ x: 656, y: 100 });
    // A collapsed panel goes down to the bottom edge.
    expect(constrainPanel({ x: 2000, y: 2000 }, 1000, 700, 248, 34)).toEqual({ x: 740, y: 610 });
  });
  it('anchors the heading without using variable content height', () => {
    expect(anchoredPanel({ x: 130, y: 400 }, 1000, 700, 304)).toEqual({ x: 130, y: 400, maxHeight: 268 });
    expect(anchoredPanel({ x: 130, y: 900 }, 1000, 700, 304)).toEqual({ x: 130, y: 404, maxHeight: 264 });
  });
  it('repositions a tool when the viewport becomes smaller', () => {
    expect(constrainPanel({ x: 600, y: 250 }, 640, 600, 280, 400)).toEqual({ x: 296, y: 144 });
  });
  it('keeps a restored heading below a toolbar that now occupies two rows', () => {
    expect(anchoredPanel({ x: 16, y: 64 }, 480, 700, 304, 100)).toEqual({ x: 16, y: 100, maxHeight: 568 });
  });
});
