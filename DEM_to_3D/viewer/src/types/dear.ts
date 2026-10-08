export type Locale = 'vi' | 'en';
export type FontChoice = 'modern' | 'plex' | 'classic';

export type IncidentTimelineItem = [
  time: string,
  viTitle: string,
  enTitle: string,
  viDesc: string,
  enDesc: string
];

export type IncidentSource = {
  id: string;
  name: [vi: string, en: string];
  observedAt: string;
  observedAtUpdated?: string;
  note: [vi: string, en: string];
};

export type IncidentModel = {
  id: string;
  title?: [vi: string, en: string];
  mode: string;
  schemaVersion: string;
  triggeredAt: string;
  asOf: string;
  asOfUpdated: string;
  timeline: IncidentTimelineItem[];
  sources: IncidentSource[];
};

export type CommunityFinding = {
  kind: 'report' | 'gap' | 'context';
  label: [vi: string, en: string];
  value: [vi: string, en: string];
  hazardId?: string;
  source?: [vi: string, en: string];
  observedAt?: string;
  receivedAt?: string;
};

/** Tuple records are accepted for compatibility with earlier snapshot packets. */
export type CommunityFact = CommunityFinding | [vi: string, en: string, viSource: string, enSource: string];

export type Community = {
  id: string;
  name: string;
  commune: string;
  prio: 1 | 2 | 3;
  pop: number;
  hh: number;
  desc: [vi: string, en: string];
  facts: CommunityFact[];
  projected: { x: number; y: number };
};

export type RoadStatus = 'open' | 'blocked' | 'uncertain';

export type RoadSegment = {
  id: string;
  name: [vi: string, en: string];
  scenarioRoadCode?: string;
  cls: 'primary' | 'secondary' | 'track';
  len: number;
  status: RoadStatus;
  hz?: string;
  note?: [vi: string, en: string];
  fromKm?: number;
  toKm?: number;
  points: Array<{ x: number; y: number }>;
};

export type HazardKind = 'landslide' | 'flood' | 'bridge' | 'crossing';

export type Hazard = {
  id: string;
  name: [vi: string, en: string];
  kind: HazardKind;
  observation: 'suspected' | 'reported';
  area?: number;
  src: [vi: string, en: string];
  detected: string;
  projected: { x: number; y: number };
};

export type ResponseSite = {
  id: string;
  kind: 'staging' | 'hlz';
  name: [vi: string, en: string];
  projected: { x: number; y: number };
  assessment: 'candidate' | 'assessed' | 'unavailable';
  observedAt: string;
  source: [vi: string, en: string];
};

export type IncidentEvidence = {
  id: string;
  hazardId: string;
  type: 'field-report' | 'image-analysis';
  observedAt: string;
  receivedAt: string;
  source: [vi: string, en: string];
  finding: [vi: string, en: string];
  limitation: [vi: string, en: string];
};

export type AnalysisArea = {
  id: string;
  name: [vi: string, en: string];
  points: Array<{ x: number; y: number }>;
  observedAt: string;
  source: [vi: string, en: string];
};

export type RoutingAssumptions = Record<RoadSegment['cls'], [minKmh: number, maxKmh: number]>;

export type ScenarioRoute = {
  id: string;
  type: 'candidate' | 'direct';
  communityId: string;
  name: [vi: string, en: string];
  lengthKm: number;
  status: RoadStatus;
  segs: RoadSegment[];
  points: Array<{ x: number; y: number }>;
  eta?: { minMinutes: number; maxMinutes: number; mode: 'pickup' | 'foot' };
};

export type ScenarioRoutePair = {
  candidate: ScenarioRoute | null;
  direct: ScenarioRoute | null;
};

export type WorkspaceView = 'incident' | 'impact' | 'priority';
export type DetailTab = 'decision' | 'evidence';
export type RoadFilter = 'all' | 'blocked' | 'uncertain';
export type ImpactTab = 'roads' | 'hazards';
export type CommunityFilter = 'all' | 'priority' | 'monitor';

export type ActiveDialog =
  | null
  | 'timeline'
  | 'data'
  | 'layers'
  | 'geodata'
  | 'alerts'
  | 'notificationCenter'
  | 'responseWork'
  | 'comparison'
  | 'evidence'
  | 'exportDecision';
