import type { AnalysisLayer } from './analysisImagery';

export type ComparisonKind = AnalysisLayer['kind'];
export type PreparedComparisonPair = { before: AnalysisLayer; after: AnalysisLayer };

export function preparedComparisonPair(layers: AnalysisLayer[], kind: ComparisonKind): PreparedComparisonPair | undefined {
  const day = (layer: AnalysisLayer) => layer.kind === 'sar' ? Date.parse(layer.acquired)
    : Math.max(...layer.parts.map(part => Date.parse(part.acquired)));
  const scenes = layers.filter(layer => layer.kind === kind).sort((a, b) => day(a) - day(b));
  const before = scenes[0], after = scenes.at(-1);
  if (!before || !after || day(before) >= day(after)) return undefined;
  // A per-date display stretch can manufacture apparent change. Use a shared
  // fixed stretch for visual comparison; these previews are not change analysis.
  if (before.kind === 'sar' && after.kind === 'sar' &&
      (['vv', 'vh', 'ratio'] as const).some(band => before.rangesDb[band].some((value, i) => value !== after.rangesDb[band][i]))) return undefined;
  if (before.kind === 'sar' && after.kind === 'sar') {
    const a=before.modes.vv.web.latLngBounds,b=after.modes.vv.web.latLngBounds;
    if (Math.max(a[0][0],b[0][0])>=Math.min(a[1][0],b[1][0]) ||
        Math.max(a[0][1],b[0][1])>=Math.min(a[1][1],b[1][1])) return undefined;
  }
  return { before, after };
}
