/** Shared by 2D/WebGL road strokes and their HTML legend swatches. */
export const roadColors = {
  networkImagery: '#d3d0c4',
  networkTerrain: '#76857e',
  // Route blue, as in web maps: red stays reserved for blocked sections.
  selected: '#2f80ed',
  alternative: '#b4bdc5',
  alternativeCasing: '#52636d',
  blocked: '#d96552',
  uncertain: '#d7a34c',
  blockedSymbol: '#bb3028',
  riskSymbol: '#ae7412',
  // A rim one shade darker than the line it edges, never a second colour around it.
  selectedCasing: '#1b5cc2',
  uncertainRim: '#9c6a14',
  reference: '#eee5cf',
  referenceCasing: '#343c36',
  inspectedCasing: '#ffffff',
  neutralCasing: '#283a33'
} as const;

/** Screen pixels; wider transparent hit targets are defined independently. */
export const roadStroke = { normal: 2.2, emphasis: 3.5, blocked: 4.2, caution: 3.4, casing: 1.2, inspectedCasing: 1.8 } as const;
/** The suggested route as web maps draw it: one line with a thin rim of its own darker
 * shade. A section to verify keeps that shape in amber, as traffic shows on a route. */
export const guidedRouteStyle = (caution: boolean) => caution
  ? { line: roadColors.uncertain, rim: roadColors.uncertainRim, width: 5, rimWidth: 7 }
  : { line: roadColors.selected, rim: roadColors.selectedCasing, width: 5, rimWidth: 7 };
/** All representations share the same display offset; selection must not move a road. */
export const roadSurfaceOffsetM = .8;
