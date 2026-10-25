import type { AnalysisLayer } from './analysisImagery';

export type ComparisonKind = AnalysisLayer['kind'];
export type PreparedComparisonPair = { before: AnalysisLayer; after: AnalysisLayer };

export function preparedComparisonPair(layers: AnalysisLayer[], kind: ComparisonKind): PreparedComparisonPair | undefined {
  const day = (layer: AnalysisLayer) => layer.kind === 'sar' ? Date.parse(layer.acquired)
    : Math.max(...layer.parts.map(part => Date.parse(part.acquired)));
  // A new sensor or a single-polarisation product must not replace one date of
  // an existing time series. Prefer the widest compatible pair, then the latest.
  const scenes = layers.filter(layer => layer.kind === kind).sort((a, b) => day(a) - day(b));
  if (kind === 'sar') {
    const pairs: PreparedComparisonPair[] = [];
    for (let i=0;i<scenes.length;i++) for (let j=i+1;j<scenes.length;j++) {
      const pair = compatiblePair(scenes[i],scenes[j]);
      if (pair) pairs.push(pair);
    }
    return pairs.sort((a,b)=>(day(b.after)-day(b.before))-(day(a.after)-day(a.before))||day(b.after)-day(a.after))[0];
  }
  const before = scenes[0], after = scenes.at(-1);
  if (!before || !after || day(before) >= day(after)) return undefined;
  return {before,after};
}

function compatiblePair(before: AnalysisLayer, after: AnalysisLayer): PreparedComparisonPair | undefined {
  if(before.kind!=='sar'||after.kind!=='sar'||Date.parse(before.acquired)>=Date.parse(after.acquired))return undefined;
  if((before.sensor??before.source)!==(after.sensor??after.source))return undefined;
  // A per-date display stretch can manufacture apparent change. Use a shared
  // fixed stretch for visual comparison; these previews are not change analysis.
  if ((['vv', 'vh', 'ratio'] as const).some(band => {
        const a=before.rangesDb[band],b=after.rangesDb[band];
        return !!a !== !!b || !!a && a.some((value,i)=>value!==b?.[i]);
      })) return undefined;
  if ((['vv','vh','rgb'] as const).some(mode=>!!before.modes[mode]!==!!after.modes[mode]))return undefined;
  const a=before.modes.vv.web.latLngBounds,b=after.modes.vv.web.latLngBounds;
  if (Math.max(a[0][0],b[0][0])>=Math.min(a[1][0],b[1][0]) ||
      Math.max(a[0][1],b[0][1])>=Math.min(a[1][1],b[1][1])) return undefined;
  return { before, after };
}
