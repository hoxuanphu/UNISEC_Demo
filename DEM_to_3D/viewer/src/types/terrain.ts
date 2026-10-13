export type SceneAxes = {
  x: 'east';
  y: 'up';
  z: 'negative_north';
};

export type CRSMetadata = {
  authority: string;
  code: number;
  proj4?: string;
  wkt?: string;
  linear_unit: string;
};

export type GridMetadata = {
  file: string;
  shape: [number, number];
  shape_order: 'rows_cols';
  dtype: 'float32';
  byte_order: 'little_endian';
  layout: 'row_major';
  nodata_encoding: 'nan';
  elevation_unit: 'metre';
  sampling_method: 'nearest_subsample';
  source_step: number;
  byte_length: number;
};

export type GridTransform = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  convention: 'rasterio_affine';
  pixel_reference: 'center';
};

export type ElevationMetadata = {
  base_elevation: number;
  exaggeration: number;
  normalize_base: boolean;
  min: number;
  max: number;
};

export type AdministrativeUnit = {
  commune_code?: string;
  commune_name?: string;
  province_code?: string;
  province_name?: string;
  headquarters?: string;
  type?: string;
  area_km2?: number;
  population?: number;
  density_per_km2?: number;
};

export type AdministrativeMetadata = AdministrativeUnit & {
  source?: string;
  units?: AdministrativeUnit[];
};

export type MeshMetadata = {
  file: string;
  vertex_count: number;
  triangle_count: number;
};

export type TerrainMetadata = {
  schema_version: 1;
  asset_id: string;
  crs: CRSMetadata;
  scene_axes: SceneAxes;
  world_origin: { x: number; y: number };
  grid: GridMetadata;
  grid_transform: GridTransform;
  elevation: ElevationMetadata;
  analysis_supported: boolean;
  hole_mode?: 'mask' | 'fill';
  mesh?: MeshMetadata;
  administrative?: AdministrativeMetadata;
};

export type LoadedTerrain = {
  metadata: TerrainMetadata;
  grid: Float32Array;
  gridBuffer: ArrayBuffer;
  gltf: import('three/examples/jsm/loaders/GLTFLoader.js').GLTF;
};

export type LoadedModel = {
  id: string;
  name: string;
  metadata?: TerrainMetadata;
  grid?: Float32Array;
  gridBuffer?: ArrayBuffer;
  gltf: import('three/examples/jsm/loaders/GLTFLoader.js').GLTF;
  objectUrls: string[];
  released?: boolean;
  bvhDisposed?: boolean;
  preserveResources?: boolean;
  tilePyramid?: import('../terrain/tileMetadata').TilePyramidMetadata;
  tileFiles?: Map<string, File>;
  tileObject?: import('three').Object3D;
};

export type HoverInfo = {
  scene: { x: number; y: number; z: number };
  projected: { x: number; y: number };
  longitude?: number;
  latitude?: number;
  elevation: number;
  row: number;
  column: number;
  interpolated: boolean;
};

export type TerrainPoint = {
  scene: { x: number; y: number; z: number };
  projected: { x: number; y: number };
  elevation: number;
  row: number;
  column: number;
  interpolated: boolean;
};
