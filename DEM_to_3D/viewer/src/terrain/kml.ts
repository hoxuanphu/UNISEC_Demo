import { Inflate } from 'fflate';

export type KmlFeature = {
  name: string;
  kind: 'point' | 'line' | 'polygon';
  coordinates: [number, number][][];
};
export type KmlLayer = { name: string; features: KmlFeature[]; warnings: string[] };

const MAX_COMPRESSED = 32 * 1024 * 1024;
const MAX_EXTRACTED = 64 * 1024 * 1024;
const MAX_COORDINATES = 200_000;
const KML_NAMESPACES = new Set(['', 'http://www.opengis.net/kml/2.2', 'http://earth.google.com/kml/2.0', 'http://earth.google.com/kml/2.1']);
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value;
});
const isKml = (element: Element) => KML_NAMESPACES.has(element.namespaceURI ?? '');
const children = (element: Element, name: string) => Array.from(element.children).filter((child) => isKml(child) && child.localName === name);
const nameOf = (element: Element) => children(element, 'name')[0]?.textContent?.trim() ?? '';

function decodeXml(bytes: Uint8Array): string {
  let encoding = 'utf-8';
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0x3c && bytes[1] === 0)) encoding = 'utf-16le';
  if ((bytes[0] === 0xfe && bytes[1] === 0xff) || (bytes[0] === 0 && bytes[1] === 0x3c)) encoding = 'utf-16be';
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Invalid KML text encoding. Use UTF-8 or UTF-16.');
  }
}

// Inspect the directory before inflation, then stream only the selected KML. Never
// allocate an output buffer based on an untrusted ZIP uncompressed-size field.
function extractKmz(bytes: Uint8Array): Uint8Array {
  const fail = (message = 'Invalid or unsupported KMZ ZIP archive.'): never => { throw new Error(message); };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) return fail();
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)
    || view.getUint16(end + 8, true) !== count || count === 65535
    || directoryOffset + directorySize !== end) return fail();
  if (count > 10_000) return fail('KMZ has too many ZIP entries (limit 10000).');
  const entries: { name: string; size: number; compressed: number; method: number; offset: number; crc: number; flags: number }[] = [];
  let offset = directoryOffset;
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) return fail();
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const next = offset + 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    if (next > end || flags & 1 || view.getUint16(offset + 34, true) || local + 30 > directoryOffset) return fail();
    total += size;
    if (total > MAX_EXTRACTED) return fail('KMZ exceeds the 64 MiB extracted-size limit.');
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (/\.kml$/i.test(name)) entries.push({ name, size, compressed, method, offset: local, crc: view.getUint32(offset + 16, true), flags });
    offset = next;
  }
  if (offset !== end) return fail();
  const rootDocs = entries.filter((entry) => entry.name.toLowerCase() === 'doc.kml');
  const docs = rootDocs.length ? rootDocs : entries.filter((entry) => /(?:^|[\\/])doc\.kml$/i.test(entry.name));
  const candidates = docs.length ? docs : entries;
  if (!candidates.length) return fail('KMZ contains no KML file.');
  if (candidates.length !== 1) return fail('Ambiguous KMZ: multiple KML files; provide a unique doc.kml.');
  const entry = candidates[0];
  const local = entry.offset;
  if (view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 6, true) !== entry.flags
    || view.getUint16(local + 8, true) !== entry.method || ![0, 8].includes(entry.method)) return fail();
  const nameLength = view.getUint16(local + 26, true);
  const start = local + 30 + nameLength + view.getUint16(local + 28, true);
  if (start + entry.compressed > directoryOffset
    || new TextDecoder().decode(bytes.subarray(local + 30, local + 30 + nameLength)) !== entry.name) return fail();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let crc = 0xffffffff;
  const collect = (chunk: Uint8Array) => {
    length += chunk.length;
    if (length > MAX_EXTRACTED || length > entry.size) return fail('KMZ exceeds its extracted-size limit or declared size.');
    for (const byte of chunk) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 255];
    chunks.push(chunk.slice());
  };
  if (entry.method === 0) collect(bytes.subarray(start, start + entry.compressed));
  else {
    const inflate = new Inflate(collect);
    for (let position = 0; position < entry.compressed; position += 1024) {
      const next = Math.min(position + 1024, entry.compressed);
      inflate.push(bytes.subarray(start + position, start + next), next === entry.compressed);
    }
  }
  if (length !== entry.size || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) return fail('Corrupt KMZ: KML size or checksum mismatch.');
  const result = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) { result.set(chunk, position); position += chunk.length; }
  return result;
}

function parseKml(xml: string, fallbackName: string): KmlLayer {
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('KML DTDs and entity declarations are not supported.');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagNameNS('*', 'parsererror').length) throw new Error('Malformed KML XML.');
  const root = document.documentElement;
  if (!root || root.localName !== 'kml' || !isKml(root)) throw new Error('Expected a KML document with a supported namespace.');
  const layer: KmlLayer = { name: nameOf(children(root, 'Document')[0] ?? root) || nameOf(children(root, 'Folder')[0] ?? root) || fallbackName, features: [], warnings: [] };
  const warnings = new Set<string>();
  let coordinateCount = 0;
  const coordinates = (geometry: Element): [number, number][] => {
    const elements = children(geometry, 'coordinates');
    if (elements.length !== 1) throw new Error(`Invalid ${geometry.localName}: expected one coordinates element.`);
    const result: [number, number][] = [];
    for (const match of (elements[0].textContent ?? '').matchAll(/\S+/g)) {
      if (++coordinateCount > MAX_COORDINATES) throw new Error('KML exceeds the 200000 coordinate limit.');
      const tuple = match[0].split(',');
      const lon = Number(tuple[0]);
      const lat = Number(tuple[1]);
      if (tuple.length < 2 || tuple.length > 3 || !NUMBER.test(tuple[0]) || !NUMBER.test(tuple[1])
        || !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) {
        throw new Error('Invalid KML coordinate: expected finite WGS84 longitude [-180,180] and latitude [-90,90].');
      }
      result.push([lon, lat]);
    }
    return result;
  };
  const polygonRing = (boundary: Element): [number, number][] => {
    const rings = children(boundary, 'LinearRing');
    if (rings.length !== 1) throw new Error('Invalid polygon boundary: expected one LinearRing.');
    const ring = coordinates(rings[0]);
    if (ring.length < 4 || ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]
      || new Set(ring.map(([lon, lat]) => `${lon},${lat}`)).size < 3) {
      throw new Error('Invalid polygon ring: expected at least three distinct vertices and a closed ring.');
    }
    return ring;
  };
  const stack: { element: Element; name: string; geometry: boolean; depth: number }[] = [{ element: root, name: '', geometry: false, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const { element, name, geometry, depth } = stack.pop()!;
    if (++nodes > 1_000_000 || depth > 128) throw new Error('KML document is too complex or deeply nested.');
    const tag = element.localName;
    if (!isKml(element)) { warnings.add(`Unsupported extension ${element.tagName} ignored.`); continue; }
    if (geometry && (tag === 'Point' || tag === 'LineString' || tag === 'Polygon')) {
      let rings: [number, number][][];
      if (tag === 'Polygon') {
        const outer = children(element, 'outerBoundaryIs');
        if (outer.length !== 1) throw new Error('Invalid polygon: expected one outer boundary.');
        rings = [polygonRing(outer[0]), ...children(element, 'innerBoundaryIs').map(polygonRing)];
      } else {
        const points = coordinates(element);
        if ((tag === 'Point' && points.length !== 1) || (tag === 'LineString' && points.length < 2)) throw new Error(`Invalid ${tag} coordinate count.`);
        rings = [points];
      }
      layer.features.push({ name: name || 'Unnamed placemark', kind: tag === 'Point' ? 'point' : tag === 'LineString' ? 'line' : 'polygon', coordinates: rings });
      continue;
    }
    if (['kml', 'Document', 'Folder', 'Placemark', 'MultiGeometry'].includes(tag)) {
      const placemark = tag === 'Placemark';
      const descendants = Array.from(element.children);
      if (placemark && !descendants.some((child) => isKml(child) && ['Point', 'LineString', 'Polygon', 'MultiGeometry'].includes(child.localName))) {
        warnings.add(`Placemark "${nameOf(element) || 'Unnamed placemark'}" has no supported geometry.`);
      }
      for (let i = descendants.length - 1; i >= 0; i--) {
        stack.push({ element: descendants[i], name: placemark ? nameOf(element) : name, geometry: placemark || (geometry && tag === 'MultiGeometry'), depth: depth + 1 });
      }
    } else if (['NetworkLink', 'Link', 'Url', 'Icon', 'href', 'styleUrl', 'SchemaData'].includes(tag)) {
      warnings.add('Network links and external resources are ignored; no external requests are made.');
    } else if (['Style', 'StyleMap'].includes(tag)) {
      warnings.add('KML styling is ignored; geometry is draped on the terrain.');
    } else if (!['name', 'description', 'visibility', 'open', 'address', 'phoneNumber', 'Snippet', 'snippet', 'ExtendedData', 'Schema', 'TimeSpan', 'TimeStamp', 'LookAt', 'Camera', 'Region', 'atom:author'].includes(tag)) {
      warnings.add(`Unsupported KML content ${tag} ignored.`);
    }
  }
  if (!layer.features.length) throw new Error('KML contains no supported geometry (Points, LineStrings or Polygons).');
  layer.warnings = [...warnings];
  return layer;
}

/** Import local KML/KMZ only. Altitudes and styling are ignored for terrain draping.
 * Invalid geometry fails the import; unsupported content is reported in warnings.
 * Limits: 32 MiB KMZ, 64 MiB XML/extracted ZIP entries, 200000 coordinates.
 */
export async function readKmlFile(file: File): Promise<KmlLayer> {
  const kmz = /\.kmz$/i.test(file.name);
  if (!kmz && !/\.kml$/i.test(file.name)) throw new Error('Expected a .kml or .kmz file.');
  const limit = kmz ? MAX_COMPRESSED : MAX_EXTRACTED;
  if (file.size > limit) throw new Error(`${kmz ? 'KMZ exceeds the 32 MiB compressed' : 'KML exceeds the 64 MiB XML'}-size limit.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > limit) throw new Error('KML/KMZ file exceeds its size limit.');
  return parseKml(decodeXml(kmz ? extractKmz(bytes) : bytes), file.name.replace(/\.(?:kml|kmz)$/i, ''));
}
