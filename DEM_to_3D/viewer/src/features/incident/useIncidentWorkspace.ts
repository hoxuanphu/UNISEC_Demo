import { useMemo } from 'react';
import type { IncidentPacket } from '../../data/incidentPacket';
import { deriveIncidentWorkspace } from './deriveIncidentWorkspace';

export function useIncidentWorkspace(packet: IncidentPacket, updated: boolean) {
  return useMemo(() => deriveIncidentWorkspace(packet, updated), [packet, updated]);
}
