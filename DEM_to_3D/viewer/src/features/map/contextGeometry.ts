import type {ResponsePriority} from '../landslides/responsePriority';
﻿/** Read-only reference geometry, separate from incident findings and routing state. */
export type ContextArea = {
  id: string;
  name: [vi: string, en: string];
  kind: 'water' | 'landslide';
  coordinates: number[][];
  center: { x: number; y: number };
  radius: number;
  source: 'demo';
  responsePriority?:ResponsePriority;
};
export type ContextClosure = { id: string; point: {x:number;y:number} };
export type MapContextGeometry = { areas: ContextArea[]; closures: ContextClosure[] };
