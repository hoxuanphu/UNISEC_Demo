import type { ScenarioEdit } from '../access/scenarioEdits';
import { useMemo } from 'react';
import type { IncidentPacket } from '../../data/incidentPacket';
import { deriveIncidentWorkspace } from './deriveIncidentWorkspace';
import type { SurveyConditionArea } from '../routes/surveyRoadConditions';

export function useIncidentWorkspace(packet: IncidentPacket, updated: boolean, edits?: ScenarioEdit[], reportAt: string | null = null, surveyAreas?: SurveyConditionArea[]) {
  return useMemo(() => deriveIncidentWorkspace(packet, updated, edits, reportAt, surveyAreas), [packet, updated, edits, reportAt, surveyAreas]);
}
