import type { VectorGeometry } from '../../geo/vector/types';
import { GeometryError } from '../../geo/vector/types';

const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;

function readWkt(text: string): VectorGeometry {
  const match = /^(POINT|LINESTRING|POLYGON|MULTIPOLYGON)\s*(Z)?\s*/i.exec(text);
  if (!match) throw new GeometryError('wkt');
  let offset = match[0].length;
  let count = 0;
  const spaces = () => { while (/\s/.test(text[offset] ?? '') && offset < text.length) offset++; };
  const expect = (char: string) => { spaces(); if (text[offset++] !== char) throw new GeometryError('wkt'); };
  const position = (): number[] => {
    if (++count > 1500) throw new GeometryError('vertex-limit');
    spaces(); const values: number[] = [];
    for (let i=0; i<(match[2] ? 3 : 2); i++) {
      const token = numberPattern.exec(text.slice(offset));
      if (!token) throw new GeometryError('wkt');
      values.push(Number(token[0])); offset += token[0].length;
      if (i < (match[2] ? 2 : 1) && !/\s/.test(text[offset] ?? '')) throw new GeometryError('wkt');
      spaces();
    }
    return values;
  };
  function list<T>(read: () => T): T[] {
    expect('('); const result = [read()]; spaces();
    while (text[offset] === ',') { offset++; result.push(read()); spaces(); }
    expect(')'); return result;
  }
  let geometry: VectorGeometry;
  switch (match[1].toUpperCase()) {
    case 'POINT': expect('('); geometry={type:'Point',coordinates:position()}; expect(')'); break;
    case 'LINESTRING': geometry={type:'LineString',coordinates:list(position)}; break;
    case 'POLYGON': geometry={type:'Polygon',coordinates:list(()=>list(position))}; break;
    default: geometry={type:'MultiPolygon',coordinates:list(()=>list(()=>list(position)))};
  }
  spaces(); if (offset !== text.length) throw new GeometryError('wkt');
  return geometry;
}

export function parseWktBatch(input: string): Array<{ name: string; geometry: VectorGeometry }> {
  let text = input.trim();
  const srid = /^SRID\s*=\s*(\d+)\s*;/i.exec(text);
  if (srid) {
    if (srid[1] !== '4326') throw new GeometryError('crs');
    text = text.slice(srid[0].length).trim();
  }
  const output: Array<{name:string; geometry:VectorGeometry}> = [];
  while (text) {
    const start = /^(?:([^:()\n]{1,160}?)\s*:\s*)?(POINT|LINESTRING|POLYGON|MULTIPOLYGON)\s*(?:Z\s*)?\(/i.exec(text);
    if (!start) throw new GeometryError('wkt');
    const open = start[0].lastIndexOf('(');
    let depth=1, end=open+1;
    while (end < text.length && depth) { if (text[end] === '(') depth++; if (text[end] === ')') depth--; end++; }
    if (depth) throw new GeometryError('wkt');
    const prefixLength = start[1] ? text.indexOf(':')+1 : 0;
    output.push({ name:start[1]?.trim() ?? '', geometry:readWkt(text.slice(prefixLength,end).trim()) });
    text = text.slice(end).trim();
    if (text.startsWith(';')) text = text.slice(1).trim();
    if (output.length > 100) throw new GeometryError('feature-limit');
  }
  if (!output.length) throw new GeometryError('empty');
  return output;
}
