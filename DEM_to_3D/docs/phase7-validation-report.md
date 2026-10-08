# Phase 7 validation report

Generated from the Phase 7 verification sequence on 2026-09-24 (Windows 11,
Python 3.12.4, Node 24.19.0).

## Deterministic correctness

- Python Phase 7 suite: `python -m unittest tests.test_phase7 -v` — **7/7
  passed** (14/14 in the complete Python discovery suite).
  - Synthetic plane `z = a*x + b*y + c` uses a rotated/sheared affine.
  - Projected/raster round-trip remains below `0.25` pixel.
  - Nearest downsample checks steps `1`, `2`, and `4` and verifies affine
    centre mapping.
  - Mask mode removes faces across NaN holes; fill mode fills a local void and
    preserves a distant hole.
  - Contract validator rejects binary-size and mesh metadata mismatches; the
    crop helper verifies affine translation after a valid-bbox crop.
- Viewer Phase 7 suite: `npm --prefix DEM_to_3D/viewer test -- --run
  src/terrain/phase7.test.ts` — **10/10 passed** (23/23 in the complete
  Vitest suite).
  - Affine round-trip, plane interpolation (`<1e-3 m`), reference slope
    (`<0.1` percentage point and degree), horizontal/vertical/diagonal/short
    lines, outside-grid lines, and NaN segment splitting.
  - Unsafe asset filenames, wrong binary lengths, URL basename mismatches,
    GLB geometry counts, early mismatch rejection before binary fetches, and
    repeated resource disposal are covered.

## Offline benchmark

Command:

```text
python DEM_to_3D/tools/phase7_benchmark.py --output DEM_to_3D/docs/phase7-benchmark.json --profile-samples 2000
```

Recorded values:

- Profile generation: **6.0508 ms** for 2,000 samples (`<200 ms` target:
  PASS).
- Metadata validation: **0.1189 ms**.
- Offline GLB/grid/metadata load: **10.2554 ms**, with matching shape and face
  counts verified by the benchmark.
- Asset sizes: GLB `731,112` bytes, grid `81,920` bytes, metadata `879`
  bytes, total `813,911` bytes.
- Browser hover FPS: **NOT_MEASURED**. This offline command has no browser or
  WebGL context, so it does not claim the `30 FPS` target.

The machine-readable raw output is in
[`phase7-benchmark.json`](phase7-benchmark.json).

## Full verification commands

```text
python -m unittest discover -s DEM_to_3D/tests -v
npm --prefix DEM_to_3D/viewer test
npm --prefix DEM_to_3D/viewer run typecheck
npm --prefix DEM_to_3D/viewer run build
python DEM_to_3D/tools/phase7_benchmark.py --output DEM_to_3D/docs/phase7-benchmark.json
```

The production build retains the existing advisory about the large Three.js
chunk. WebGL hover FPS (TEST-011) is blocked because this environment has
Chrome/Edge executables but no installed browser automation or WebGL benchmark
harness; TEST-015 remains deferred until that measurement is available.

## Refresh — 2026-09-26

- Complete Python discovery: **16/16 passed**; Phase 7 focused coverage is
  **10/10 passed**, including adjacent-tile boundary overlap.
- Complete Vitest suite: **31/31 passed** across 7 test files; TypeScript
  typecheck and production build both exit successfully.
- Refreshed benchmark: profile **7.6851 ms** for 2,000 samples, metadata
  validation **0.0958 ms**, offline asset load **14.7334 ms**, total asset
  size **813,911 bytes**. The `<200 ms` profile target is PASS.
- Browser hover FPS remains **NOT_MEASURED**; TEST-011 and TEST-015 stay
  BLOCKED/deferred until a browser/WebGL harness is available.
