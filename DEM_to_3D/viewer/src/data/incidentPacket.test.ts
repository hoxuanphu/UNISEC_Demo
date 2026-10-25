import { describe, expect, it, vi, afterEach } from 'vitest';
import imageryJson from '../../public/scenarios/che-tao/imagery/imagery.json';
import packetJson from '../../public/scenarios/che-tao/v0.3/incident.json';
import { validateIncidentPacket } from './incidentPacket';
import { apiRepository, preparedRepository } from './ScenarioRepository';

const packet = () => structuredClone(packetJson);
afterEach(() => { vi.unstubAllGlobals(); });

describe('incident data boundary', () => {
  it('accepts the prepared snapshot and links every observation', () => {
    const data = validateIncidentPacket(packet());
    expect(data.datasetVersion).toBe('che-tao-2026-09-12-v0.3');
    expect(data.evidence.every(item => data.hazards.some(hazard => hazard.id === item.hazardId))).toBe(true);
  });
  it('does not turn survey stations into dated Planet detections or invent a point footprint',()=>{
    const data=validateIncidentPacket(packet());
    expect(data.dataKind).toBe('synthetic');
    for(const hazard of data.hazards){
      expect(hazard.area).toBeUndefined();
      expect(hazard.src[0]).toContain('KML');
      const evidence=data.evidence.find(item=>item.hazardId===hazard.id)!;
      expect(evidence.source[0]).toContain('KML');
      expect(evidence.finding[0]).not.toMatch(/Thấy lần đầu|ha/);
    }
  });
  it('keeps the simulated image-review timestamp separate from its receipt', () => {
    const data = validateIncidentPacket(packet());
    const scene = imageryJson.layers.find(layer => layer.id === 'planet-post')!.parts!.find(part => part.id === 'planet-post-roadpart2')!;
    for (const hazard of data.hazards) {
      const record = data.evidence.find(item => item.hazardId === hazard.id)!;
      expect(record.type).toBe('image-analysis');
      expect(Date.parse(record.observedAt)).toBe(Date.parse(scene.acquired));
      expect(Date.parse(record.receivedAt)).toBeGreaterThan(Date.parse(record.observedAt));
    }
  });
  it('rejects unsupported CRS, malformed dates and duplicate object IDs', () => {
    const data = packet(); data.crs = 'EPSG:4326';
    expect(() => validateIncidentPacket(data)).toThrow('crs');
    const dated = packet(); dated.evidence[0].observedAt = '2026-02-30T07:40:00+07:00';
    expect(() => validateIncidentPacket(dated)).toThrow('date-time');
    const futureSource = packet(); futureSource.incident.sources[0].observedAt = '2026-09-29T10:00:00+07:00';
    expect(() => validateIncidentPacket(futureSource)).toThrow('source timestamp');
    const futureBoundary = packet(); futureBoundary.aoi.observedAt = '2026-09-29T10:00:00+07:00';
    expect(() => validateIncidentPacket(futureBoundary)).toThrow('reference timestamp');
    const duplicate = packet(); duplicate.communities.push(duplicate.communities[0]);
    expect(() => validateIncidentPacket(duplicate)).toThrow('duplicate community');
  });
  it('rejects dangling evidence, missing contact signals and stale lengths', () => {
    const data = packet(); data.roads[0].hazardIds = ['unknown'];
    expect(() => validateIncidentPacket(data)).toThrow('unknown road hazard');
    const signal = packet(); delete (signal.signals as Record<string, unknown>).CT;
    expect(() => validateIncidentPacket(signal)).toThrow('community signals');
    const length = packet(); length.roads[0].len += 1;
    expect(() => validateIncidentPacket(length)).toThrow('road length');
    const ring = packet(); ring.aoi.points[0].x += 1;
    expect(() => validateIncidentPacket(ring)).toThrow('AOI ring');
    const speed = packet(); speed.routingAssumptions.secondary.reverse();
    expect(() => validateIncidentPacket(speed)).toThrow('speed range');
  });
  it('rejects reports received before observation or joined to the wrong road', () => {
    const data = packet(); data.report.evidence.observedAt = '2026-09-29T09:50:00+07:00';
    expect(() => validateIncidentPacket(data)).toThrow('report timestamps');
    const link = packet(); link.report.roadId = 'E1';
    expect(() => validateIncidentPacket(link)).toThrow('report road/hazard link');
  });
  it('checks the source relationship and dates of community observations', () => {
    const data = validateIncidentPacket(packet());
    const finding = data.communities[0].facts[0];
    if (Array.isArray(finding)) throw new Error('Expected a structured finding');
    finding.hazardId = 'unknown';
    expect(() => validateIncidentPacket(data)).toThrow('unknown hazard in community finding');
    finding.hazardId = 'LS-02';
    finding.source = ['Nguồn', 'Source'];
    finding.observedAt = '2026-09-12T15:00:00+07:00';
    expect(() => validateIncidentPacket(data)).toThrow('community finding timestamp');
    finding.observedAt = '2026-09-12T12:11:00+07:00';
    finding.receivedAt = '2026-09-12T11:30:00+07:00';
    expect(() => validateIncidentPacket(data)).toThrow('community finding receipt');
  });
  it('accepts previous tuple snapshots while refusing untraceable field reports', () => {
    const data = validateIncidentPacket(packet());
    data.communities[0].facts = [['Ghi nhận', 'Observation', 'Nguồn', 'Source']];
    expect(validateIncidentPacket(data)).toBe(data);
    data.communities[0].facts = [{ kind: 'report', label: ['Cầu', 'Bridge'], value: ['Ngập', 'Flooded'] }];
    expect(() => validateIncidentPacket(data)).toThrow('community finding source');
  });
  it('verifies the prepared packet checksum before it enters the workspace', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(packet()));
    const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes)));
    const repository = preparedRepository({ url: '/incident.json', byteLength: bytes.byteLength, sha256 });
    expect((await repository.load()).incident.id).toBe(packetJson.incident.id);
    await expect(preparedRepository({ url: '/incident.json', byteLength: bytes.byteLength, sha256: '0'.repeat(64) }).load()).rejects.toThrow('checksum');
  });
  it('uses the same schema for API responses and propagates errors instead of substituting mock data', async () => {
    const fetch = vi.fn(async (_url: string, _options?: RequestInit) => Response.json(packet())); vi.stubGlobal('fetch', fetch);
    const repository = apiRepository('http://localhost:8000/', packetJson.incident.id);
    expect((await repository.load()).communities).toHaveLength(1);
    expect(fetch.mock.calls[0][0]).toBe('http://localhost:8000/api/v1/incidents/INC-2026-0412/workspace');
    fetch.mockImplementation(async () => new Response('', { status: 503 }));
    await expect(repository.load()).rejects.toThrow('503');
    fetch.mockImplementation(async () => Response.json({ ...packet(), hazards: [] }));
    await expect(repository.load()).rejects.toThrow('unknown hazard');
  });
});
