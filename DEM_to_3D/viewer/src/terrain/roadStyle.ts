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
  selectedCasing: '#0d3a73',
  reference: '#eee5cf',
  referenceCasing: '#343c36',
  inspectedCasing: '#ffffff',
  neutralCasing: '#283a33'
} as const;

/** Screen pixels; wider transparent hit targets are defined independently. */
export const roadStroke = { normal: 1.8, emphasis: 3, casing: 1.2, inspectedCasing: 1.8 } as const;
/** All representations share the same display offset; selection must not move a road. */
export const roadSurfaceOffsetM = .8;
