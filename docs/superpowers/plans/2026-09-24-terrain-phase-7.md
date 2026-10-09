# Terrain 3D Phase 7 Implementation Plan

> Historical design/implementation record. Not the current task list; see [SIC plan](../../tasks/sic-2026.md). Do not update this record for routine viewer changes.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic Phase 7 tests, offline performance evidence, and asset/lifecycle hardening for the Terrain 3D exporter and viewer.

**Architecture:** Keep numerical correctness in the existing Python and TypeScript terrain modules. Add one focused Python benchmark/report tool and tighten the existing viewer validation seams instead of introducing a browser framework. Record measured and unmeasured acceptance criteria explicitly in the tracker/report.

**Tech Stack:** Python 3, unittest, NumPy, Rasterio, trimesh; TypeScript, Vitest, Three.js, three-mesh-bvh, Vite.

**Spec:** `docs/superpowers/specs/2026-09-24-terrain-phase-7-design.md`

## Global Constraints

- Affine round-trip error must be `< 0.25` pixel for double-precision helper tests.
- Plane interpolation error must be `< 1e-3 m`.
- Slope error must be `< 0.1` percentage point and `< 0.1°`.
- Profile length error must be `< 0.1%`, with `< 0.1 m` absolute allowance for short lines.
- Profiles and chart/polyline segments must not cross NaN holes.
- Offline typical profile generation target is `< 200 ms`; measured failures remain visible.
- Browser hover `30 FPS` is not claimed without a real browser/WebGL measurement.
- TEST-015 optimizations are deferred until profiling demonstrates a need.

---

### Task 1: Python synthetic DEM and exporter correctness suite

**Files:**
- Create: `DEM_to_3D/tests/test_phase7.py`
- Modify: `DEM_to_3D/dem_to_3d.py` only if a failing test exposes a contract bug

**Interfaces:**
- Consume: `downsample`, `fill_small_voids`, `build_mesh`, `serialize_transform`, `write_contract_grid`, `validate_metadata`.
- Produce: deterministic tests for TEST-001, TEST-005, TEST-006 and Python-side portions of TEST-002/003/004/007/008/010.

- [x] **Step 1: Write failing tests** for a rotated/sheared affine plane, `step=1/2/4` nearest sampling, hole fill/mask, short/horizontal/vertical/diagonal profiles, and contract mismatch rejection.
- [x] **Step 2: Run** `python -m unittest DEM_to_3D/tests/test_phase7.py -v`; confirm failures identify missing behavior or incorrect assertions.
- [x] **Step 3: Implement only the minimal exporter/contract fixes exposed by the tests.** Preserve nearest-subsample semantics and NaN encoding.
- [x] **Step 4: Run the focused suite and then the existing Python suite; record counts and threshold values.

### Task 2: Viewer affine/profile/validation hardening tests

**Files:**
- Create: `DEM_to_3D/viewer/src/terrain/phase7.test.ts`
- Modify: `DEM_to_3D/viewer/src/terrain/validation.ts`
- Modify: `DEM_to_3D/viewer/src/terrain/loadTerrain.ts`
- Modify: `DEM_to_3D/viewer/src/terrain/raycast.ts`

**Interfaces:**
- Consume: `projectedToPixel`, `pixelToProjected`, `bilinearElevation`, `createSurfaceProfile`, `calculateSegmentSlopes`, `validateMetadata`, `validateGridBuffer`, `loadTerrain` seams.
- Produce: tests for TEST-002/003/004/007/008/009/010/014 and strict file identity/byte checks.

- [x] **Step 1: Write failing Vitest cases** for affine round-trip, plane interpolation, slope reference, outside-grid/no-crossing behavior, malformed metadata, grid mismatch, URL basename mismatch, and BVH disposal.
- [x] **Step 2: Run** `npm --prefix DEM_to_3D/viewer test -- src/terrain/phase7.test.ts`; verify red failures are feature-related.
- [x] **Step 3: Implement minimal validation/disposal changes** with explicit error types and no broad UI refactor.
- [x] **Step 4: Run** the focused suite, all Vitest tests, and typecheck.

### Task 3: Reproducible offline benchmark and report

**Files:**
- Create: `DEM_to_3D/tools/phase7_benchmark.py`
- Create: `DEM_to_3D/docs/phase7-validation-report.md`
- Modify: `DEM_to_3D/docs/terrain-3d-task-tracker.md`

**Interfaces:**
- Consume: the synthetic plane fixture and existing profile/exporter APIs.
- Produce: JSON benchmark fields `profile_ms`, `asset_bytes`, `metadata_validation_ms`, `browser_hover_fps.status`, and environment details.

- [x] **Step 1: Write a failing benchmark smoke test** that expects a JSON report with stable field names and a `NOT_MEASURED` browser FPS status.
- [x] **Step 2: Run** the benchmark smoke test and confirm the command/report is absent or invalid.
- [x] **Step 3: Implement** the benchmark with deterministic data, `time.perf_counter`, `platform`/Python/Node metadata where available, and optional `--output`.
- [x] **Step 4: Run** the benchmark, inspect JSON, and write the validation report with exact commands/results and threshold status.
- [x] **Step 5: Update tracker statuses** only for IDs with evidence; leave TEST-011 and TEST-015 explicitly unmeasured/deferred when applicable.

### Task 4: Full verification and consistency review

**Files:**
- Modify: `DEM_to_3D/docs/terrain-3d-task-tracker.md` if final evidence/counts differ

- [x] **Step 1:** Run Python suite, Vitest, typecheck, build, and benchmark from a clean command sequence.
- [x] **Step 2:** Check report/tracker IDs against actual artifacts and scan for placeholders or unsupported completion claims.
- [x] **Step 3:** Run `git diff --check` and inspect the final diff for unrelated changes.
