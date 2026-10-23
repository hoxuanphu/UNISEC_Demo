import type { RoadSegment } from '../../types/dear';
import { readResponse } from '../../shared/http/readResponse';
export type NetworkPlace = {
    id: string;
    name: string;
    kind: 'village' | 'hlz';
    longitude: number;
    latitude: number;
    projected: {
        x: number;
        y: number;
    };
    placemarkIndex: number;
};
export type LocalNetwork = {
    schemaVersion: 1;
    crs: 'EPSG:32648';
    dataKind: 'schematic-demo';
    source: {
        file: string;
        sha256: string;
        observedAt: null;
        statusBasis: string;
    };
    topology: {
        method: 'endpoint-to-line';
        toleranceM: number;
        crossingsConnected: false;
        excluded: Array<{
            placemarkIndex: number;
            reason: string;
        }>;
    };
    sourceRoads: Array<{
        placemarkIndex: number;
        sourceName: string;
        color: string;
        coordinates: number[][];
    }>;
    roads: RoadSegment[];
    places: NetworkPlace[];
    areas: Array<{
        id: string;
        kind: 'water' | 'landslide';
        coordinates: number[][];
    }>;
};
const point = (p: {
    x: number;
    y: number;
}) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > 380000 && p.x < 430000 && p.y > 2390000 && p.y < 2430000;
export function validateLocalNetwork(value: unknown): LocalNetwork {
    const d = value as LocalNetwork;
    if (!d || d.schemaVersion !== 1 || d.crs !== 'EPSG:32648' || d.dataKind !== 'schematic-demo' ||
        !d.source || !/^[a-f0-9]{64}$/.test(d.source.sha256) || d.topology?.crossingsConnected !== false ||
        !Array.isArray(d.roads) || !d.roads.length || d.roads.length > 500 ||
        !d.roads.every(r => typeof r.id === 'string' && ['open', 'uncertain', 'blocked'].includes(r.status) && Array.isArray(r.points) && r.points.length >= 2 && r.points.length < 50000 && r.points.every(point)) ||
        new Set(d.roads.map(r => r.id)).size !== d.roads.length ||
        !Array.isArray(d.places) || !d.places.every(p => typeof p.name === 'string' && point(p.projected) && Number.isFinite(p.longitude) && Number.isFinite(p.latitude)) ||
        !Array.isArray(d.areas) || !d.areas.every(a => ['water', 'landslide'].includes(a.kind) && a.coordinates.length >= 3 && a.coordinates.every(p => p.length === 2 && p.every(Number.isFinite) && p[0] > 104 && p[0] < 104.12 && p[1] > 21.65 && p[1] < 21.79)))
        throw new Error('Invalid Chế Tạo road network');
    return d;
}
export async function loadLocalNetwork(signal: AbortSignal): Promise<LocalNetwork> {
    return validateLocalNetwork(await (await readResponse('/scenarios/che-tao/local-network.json', signal)).json());
}
