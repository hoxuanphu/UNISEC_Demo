# Terrain 3D Phase 7 Design

> Historical design/implementation record. Not the current task list; see [SIC plan](../../tasks/sic-2026.md). Do not update this record for routine viewer changes.

## Goal

Complete the Phase 7 P0 verification and the reproducible offline portion of
the P1 performance/hardening work described in
`DEM_to_3D/docs/terrain-3d-task-tracker.md`. The result must provide evidence
for geometry correctness, nodata behavior, asset consistency, and profiling
without claiming browser FPS thresholds that cannot be measured reliably in the
current environment.

## Scope and decisions

- Add deterministic synthetic DEM fixtures based on an affine grid and the
  plane `z = a*x + b*y + c`.
- Exercise the existing Python exporter helpers and TypeScript terrain
  functions directly. Keep numerical tests independent of network, a browser,
  and the large checked-in DEM.
- Strengthen the browser loader contract checks so metadata, grid, and GLB URL
  identity mismatches fail before a scene is returned.
- Add a small offline benchmark command that measures profile generation,
  exporter asset sizes, and loader-independent binary/metadata validation. The
  benchmark emits JSON with machine-readable timings and environment details.
- Add a Three.js resource-disposal test around BVH and mesh resources using
  stubs/real CPU-side objects; browser WebGL is not required.
- Do not add Web Workers, full-resolution secondary grids, Meshopt, or Draco in
  this phase. TEST-015 remains a profiling decision rather than an
  implementation task.

## Acceptance thresholds

- Affine projected → raster → projected error: `< 0.25` pixel for double
  precision helper tests.
- Plane interpolation error: `< 1e-3 m`.
- Reference slope error: `< 0.1` percentage point and `< 0.1°`.
- Profile length error: `< 0.1%`, with an absolute `< 0.1 m` allowance for
  short lines.
- No segment or chart sample crosses a NaN hole.
- Offline profile benchmark records a typical profile under `200 ms` on the
  executing machine, or records the measured value as a visible failure.
- Browser hover `30 FPS` is reported only as `NOT MEASURED` unless a real
  browser/WebGL harness is available.

## Files and interfaces

- Python tests in `DEM_to_3D/tests/test_phase7.py` cover synthetic fixtures,
  exporter downsampling/fill/crop behavior, and contract mismatch cases.
- Viewer tests in `DEM_to_3D/viewer/src/terrain/phase7.test.ts` cover affine,
  interpolation, profiles, slopes, outside-grid behavior, and loader
  validation seams.
- `DEM_to_3D/viewer/src/terrain/validation.ts` exposes strict metadata/grid
  checks used by `loadTerrain`.
- `DEM_to_3D/viewer/src/terrain/raycast.ts` exposes a disposal-safe helper for
  CPU-side lifecycle tests.
- `DEM_to_3D/tools/phase7_benchmark.py` is the reproducible offline benchmark
  entry point and writes `phase7-benchmark.json` when an output path is given.
- `DEM_to_3D/docs/phase7-validation-report.md` records commands, measured
  values, environment, and explicit unmeasured thresholds.

## Error handling

Tests must fail with actionable messages when a contract field, file identity,
shape, byte length, or numerical threshold is wrong. Benchmarks return a
non-zero exit status only for malformed inputs or a failed required threshold;
they still write the measured report before exiting when possible.

## Verification

The full verification sequence is:

```text
python -m unittest discover -s DEM_to_3D/tests -v
npm --prefix DEM_to_3D/viewer test
npm --prefix DEM_to_3D/viewer run typecheck
npm --prefix DEM_to_3D/viewer run build
python DEM_to_3D/tools/phase7_benchmark.py --output DEM_to_3D/docs/phase7-benchmark.json
```

The tracker is updated only for IDs backed by these outputs. Browser-only FPS
and any unimplemented optimization remain explicitly marked `TODO` or
`BLOCKED`.
