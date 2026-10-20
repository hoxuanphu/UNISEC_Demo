// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { readKmlFile } from './kml';

const wrap = (body: string) => `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${body}</Document></kml>`;
const point = '<Placemark><Point><coordinates>105,21,999</coordinates></Point></Placemark>';
const ring = '0,0 4,0 4,4 0,0';
// jsdom's File has no arrayBuffer method; exercise the same bytes via a File shim.
function file(data: string | Uint8Array, name = 'test.kml'): File {
  const bytes = typeof data === 'string' ? strToU8(data) : data;
  const result = new File([bytes.slice().buffer], name);
  Object.defineProperty(result, 'arrayBuffer', { configurable: true, value: async () => bytes.slice().buffer });
  return result;
}
const kmz = (entries: Record<string, string>, level: 0 | 6 = 6) => file(zipSync(Object.fromEntries(Object.entries(entries).map(([name, value]) => [name, strToU8(value)])), { level }), 'test.kmz');
afterEach(() => { vi.unstubAllGlobals(); });

describe('KML geometry import', () => {
  it('imports nested folders and MultiGeometry in source order, with holes and ignored altitudes', async () => {
    const layer = await readKmlFile(file(wrap(`<name>Terrain annotations</name><Folder><Folder><Placemark><name>Mixed</name><MultiGeometry>
      <Point><coordinates>105,21,NaN</coordinates></Point><MultiGeometry><LineString><coordinates>105,21,100 106,22,-10</coordinates></LineString>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs>
      <innerBoundaryIs><LinearRing><coordinates>1,1 2,1 2,2 1,1</coordinates></LinearRing></innerBoundaryIs></Polygon>
      </MultiGeometry></MultiGeometry></Placemark></Folder></Folder>`)));
    expect(layer.name).toBe('Terrain annotations');
    expect(layer.features.map(({ name, kind }) => [name, kind])).toEqual([['Mixed', 'point'], ['Mixed', 'line'], ['Mixed', 'polygon']]);
    expect(layer.features[0].coordinates).toEqual([[[105, 21]]]);
    expect(layer.features[1].coordinates).toEqual([[[105, 21], [106, 22]]]);
    expect(layer.features[2].coordinates).toEqual([[[0, 0], [4, 0], [4, 4], [0, 0]], [[1, 1], [2, 1], [2, 2], [1, 1]]]);
    expect(layer.warnings).toEqual([]);
  });

  it.each(['', 'http://www.opengis.net/kml/2.2', 'http://earth.google.com/kml/2.1', 'http://earth.google.com/kml/2.0'])('supports namespace %s', async (namespace) => {
    const prefix = namespace ? 'k:' : '';
    const xml = `<${prefix}kml ${namespace ? `xmlns:k="${namespace}"` : ''}><${prefix}Placemark><${prefix}name>A &amp; B</${prefix}name><${prefix}Point><${prefix}coordinates>-180,90</${prefix}coordinates></${prefix}Point></${prefix}Placemark></${prefix}kml>`;
    const layer = await readKmlFile(file(xml, 'Example.KML'));
    expect(layer.name).toBe('Example');
    expect(layer.features[0]).toEqual({ name: 'A & B', kind: 'point', coordinates: [[[-180, 90]]] });
  });

  it('uses direct document/placemark names, not descendant names', async () => {
    const layer = await readKmlFile(file(wrap(`<Folder><name>Child</name>${point}</Folder>`), 'fallback.kml'));
    expect(layer.name).toBe('fallback');
    expect(layer.features[0].name).toBe('Unnamed placemark');
  });

  it('warns about unsupported content and never requests external resources', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const xml = wrap(`<NetworkLink><Link><href>https://example.invalid/a.kml</href></Link></NetworkLink>
      <GroundOverlay/><Style><IconStyle><Icon><href>https://example.invalid/icon.png</href></Icon></IconStyle></Style>
      <Placemark><name>Empty</name></Placemark><Placemark><gx:Track xmlns:gx="http://www.google.com/kml/ext/2.2"/></Placemark>${point}`);
    const layer = await readKmlFile(file(xml));
    expect(layer.features).toHaveLength(1);
    expect(layer.warnings.join(' ')).toMatch(/external resources.*ignored/);
    expect(layer.warnings.join(' ')).toMatch(/GroundOverlay/);
    expect(layer.warnings.join(' ')).toMatch(/gx:Track/);
    expect(layer.warnings.join(' ')).toMatch(/Empty.*no supported geometry/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['<kml><Placemark></kml>', '<kml>&missing;</kml>', '<kml><x:a/></kml>', '<kml/><kml/>'])('rejects malformed XML: %s', async (xml) => {
    await expect(readKmlFile(file(xml))).rejects.toThrow(/Malformed.*XML/);
  });
  it.each(['<kml/>', wrap('<NetworkLink/>'), wrap('<Placemark><MultiGeometry/></Placemark>')])('explicitly rejects no geometry', async (xml) => {
    await expect(readKmlFile(file(xml))).rejects.toThrow(/no supported geometry/);
  });
  it.each(['<notKml/>', '<kml xmlns="urn:other"/>'])('rejects non-KML roots', async (xml) => {
    await expect(readKmlFile(file(xml))).rejects.toThrow(/Expected a KML/);
  });
  it('rejects DTD/entity declarations before XML parsing', async () => {
    await expect(readKmlFile(file(`<!DOCTYPE kml [<!ENTITY x SYSTEM "https://example.invalid/">]>${wrap(point)}`))).rejects.toThrow(/DTD/);
  });
  it.each(['NaN,21', 'Infinity,21', '181,21', '105,-91', ',21', '105,', '105', '0x10,21', '105,21,0,1', '1e999,21'])('rejects invalid WGS84 tuple %s', async (tuple) => {
    await expect(readKmlFile(file(wrap(`<Placemark><Point><coordinates>${tuple}</coordinates></Point></Placemark>`)))).rejects.toThrow(/WGS84/);
  });
  it.each([
    '<Point/>', '<Point><coordinates/></Point>', '<Point><coordinates>0,0 1,1</coordinates></Point>',
    '<Point><coordinates>0,0</coordinates><coordinates>1,1</coordinates></Point>',
    '<LineString><coordinates>0,0</coordinates></LineString>', '<Polygon/>',
    '<Polygon><outerBoundaryIs/></Polygon>',
    '<Polygon><outerBoundaryIs><LinearRing><coordinates>0,0 1,1 2,2</coordinates></LinearRing></outerBoundaryIs></Polygon>',
    '<Polygon><outerBoundaryIs><LinearRing><coordinates>0,0 1,1 0,0 0,0</coordinates></LinearRing></outerBoundaryIs></Polygon>',
    `<Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs><innerBoundaryIs><LinearRing><coordinates>0,0</coordinates></LinearRing></innerBoundaryIs></Polygon>`,
  ])('rejects invalid geometry rather than partially importing', async (geometry) => {
    await expect(readKmlFile(file(wrap(`${point}<Placemark>${geometry}</Placemark>`)))).rejects.toThrow(/Invalid/);
  });
  it('enforces the total coordinate limit across geometries', async () => {
    const line = `<Placemark><LineString><coordinates>${'0,0 '.repeat(100000)}</coordinates></LineString></Placemark>`;
    expect((await readKmlFile(file(wrap(line + line)))).features).toHaveLength(2);
    await expect(readKmlFile(file(wrap(line + line + point)))).rejects.toThrow(/200000/);
  });
  it('rejects excessive nesting without recursive traversal', async () => {
    await expect(readKmlFile(file(wrap('<Folder>'.repeat(130) + point + '</Folder>'.repeat(130))))).rejects.toThrow(/deeply nested/);
  });
  it('rejects oversized inputs before reading them', async () => {
    for (const [name, size] of [['big.kmz', 32 * 1024 * 1024 + 1], ['big.kml', 64 * 1024 * 1024 + 1]] as const) {
      const input = file('', name); Object.defineProperty(input, 'size', { value: size });
      const read = vi.spyOn(input, 'arrayBuffer');
      await expect(readKmlFile(input)).rejects.toThrow(/size limit/);
      expect(read).not.toHaveBeenCalled();
    }
    await expect(readKmlFile(file(wrap(point), 'bad.zip'))).rejects.toThrow(/\.kml or \.kmz/);
  });
  it('reads UTF-16 XML and rejects invalid UTF-8', async () => {
    const xml = wrap(point); const bytes = new Uint8Array(2 + xml.length * 2);
    bytes.set([0xff, 0xfe]); const view = new DataView(bytes.buffer);
    for (let i = 0; i < xml.length; i++) view.setUint16(2 + 2 * i, xml.charCodeAt(i), true);
    expect((await readKmlFile(file(bytes))).features).toHaveLength(1);
    await expect(readKmlFile(file(new Uint8Array([0xff])))).rejects.toThrow(/encoding/);
  });
});

describe('bounded KMZ import', () => {
  it.each([0, 6] as const)('reads stored/deflated KML with compression level %i', async (level) => {
    expect((await readKmlFile(kmz({ 'nested/example.KML': wrap(point), 'image.png': 'ignored' }, level))).features).toHaveLength(1);
  });
  it('prefers root doc.kml, or a unique nested doc.kml', async () => {
    for (const path of ['doc.kml', 'nested/doc.kml']) {
      const layer = await readKmlFile(kmz({ [path]: wrap(`<name>Selected</name>${point}`), 'other.kml': 'not XML' }));
      expect(layer.name).toBe('Selected');
    }
    expect((await readKmlFile(kmz({ 'doc.kml': wrap(point), 'nested/doc.kml': 'ignored' }))).features).toHaveLength(1);
  });
  it.each<Record<string, string>>([{ 'a.kml': wrap(point), 'b.kml': wrap(point) }, { 'a/doc.kml': wrap(point), 'b/doc.kml': wrap(point) }])('rejects ambiguous archives', async (entries) => {
    await expect(readKmlFile(kmz(entries))).rejects.toThrow(/Ambiguous/);
  });
  it('rejects empty, missing-KML, non-ZIP and truncated archives', async () => {
    await expect(readKmlFile(kmz({}))).rejects.toThrow(/no KML/);
    await expect(readKmlFile(kmz({ 'readme.txt': 'hello' }))).rejects.toThrow(/no KML/);
    await expect(readKmlFile(file('not ZIP', 'bad.kmz'))).rejects.toThrow(/ZIP/);
    const bytes = zipSync({ 'doc.kml': strToU8(wrap(point)) });
    await expect(readKmlFile(file(bytes.slice(0, -5), 'bad.kmz'))).rejects.toThrow(/ZIP/);
  });
  it('rejects oversized declared extraction totals including unused entries', async () => {
    const bytes = zipSync({ 'doc.kml': strToU8(wrap(point)), 'unused.bin': new Uint8Array([0]) });
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < bytes.length - 46; i++) if (view.getUint32(i, true) === 0x02014b50) view.setUint32(i + 24, 40 * 1024 * 1024, true);
    await expect(readKmlFile(file(bytes, 'big.kmz'))).rejects.toThrow(/64 MiB/);
  });
  it('bounds actual inflation even when ZIP metadata lies about output size', async () => {
    const bytes = zipSync({ 'doc.kml': strToU8('x'.repeat(2 * 1024 * 1024)) });
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < bytes.length - 46; i++) if (view.getUint32(i, true) === 0x02014b50) view.setUint32(i + 24, 1, true);
    await expect(readKmlFile(file(bytes, 'bomb.kmz'))).rejects.toThrow(/extracted-size limit/);
  });
  it('rejects corrupted KML bytes using ZIP CRC', async () => {
    const bytes = zipSync({ 'doc.kml': strToU8(wrap(point)) }, { level: 0 });
    const view = new DataView(bytes.buffer);
    const start = 30 + view.getUint16(26, true) + view.getUint16(28, true);
    bytes[start] ^= 1;
    await expect(readKmlFile(file(bytes, 'corrupt.kmz'))).rejects.toThrow(/checksum/);
  });
  it('does not fetch external KML named in a NetworkLink', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(readKmlFile(kmz({ 'doc.kml': wrap('<NetworkLink><Link><href>https://example.invalid/real.kml</href></Link></NetworkLink>'), 'real.kml': wrap(point) }))).rejects.toThrow(/no supported geometry/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
