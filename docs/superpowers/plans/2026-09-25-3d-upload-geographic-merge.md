# 3D Upload and Geographic Terrain Merge Implementation Plan

> Historical design/implementation record. Not the current task list; see [SIC plan](../../tasks/sic-2026.md). Do not update this record for routine viewer changes.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-model and multi-model upload modes with accurate `.terrain.json` geographic placement for DEM terrain tiles.

**Architecture:** Preserve the existing single-terrain analysis path while introducing a `LoadedModel` collection for rendering. A pure placement module converts each exporter-local GLB coordinate system into the first model's local projected CRS using `world_origin`, `base_elevation`, and `exaggeration`; an upload loader pairs sidecars and resolves glTF dependencies from selected files.

**Tech Stack:** React 18, TypeScript, Three.js/GLTFLoader, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-09-25-3d-upload-geographic-merge-design.md`

## Global Constraints

- Geographic merge requires schema v1, projected metre-compatible metadata and the same CRS authority/code for every model.
- Preserve the exporter scene axes `X=east`, `Y=up`, `Z=negative_north`.
- Apply each model's `world_origin` exactly once; never position tiles by file order or bounding-box adjacency.
- The single-model analysis path requires metadata and a matching grid; visual-only uploads must not fabricate elevation samples.
- Release Three.js resources and upload object URLs when models are replaced or discarded.
- Do not modify unrelated exporter behavior.

---

### Task 1: Geographic placement and upload pairing contracts

**Files:**
- Create: `DEM_to_3D/viewer/src/terrain/geographic.ts`
- Create: `DEM_to_3D/viewer/src/terrain/geographic.test.ts`
- Create: `DEM_to_3D/viewer/src/terrain/upload.ts`
- Modify: `DEM_to_3D/viewer/src/types/terrain.ts`
- Modify: `DEM_to_3D/viewer/src/terrain/loadTerrain.ts`
- Modify: `DEM_to_3D/viewer/src/terrain/validation.ts` only if the shared type guard needs an exported seam

**Interfaces:**
- `createGeographicPlacements(models, referenceIndex?)` returns deterministic
  placement records or throws an actionable `TerrainAssetError`.
- `pairUploadedFiles(files)` groups model, metadata, grid, and glTF dependency
  files without reading network URLs.
- `loadUploadedModels(files)` returns disposable `LoadedModel[]`.

- [ ] **Step 1: Write failing tests** for exact `world_origin` x/z translation,
  vertical base/exaggeration conversion, same-CRS acceptance, incompatible
  CRS/unit rejection, and filename sidecar pairing.
- [ ] **Step 2: Run the focused Vitest file** and confirm it fails because the
  new interfaces do not exist.
- [ ] **Step 3: Implement the pure geographic module** and extend loaded model
  types without changing existing analysis signatures.
- [ ] **Step 4: Implement upload pairing and parsing**, including optional grid
  loading, exact metadata filename checks, GLTF dependency URL mapping, and
  idempotent disposal.
- [ ] **Step 5: Run focused tests** and confirm all contract cases pass.

### Task 2: Multi-model rendering and hit testing

**Files:**
- Modify: `DEM_to_3D/viewer/src/components/TerrainViewer.tsx`
- Modify: `DEM_to_3D/viewer/src/terrain/raycast.ts` only if disposal needs a
  shared idempotent helper

**Interfaces:**
- `TerrainViewer` accepts `models: LoadedModel[]`, an optional geographic
  placement mode, and keeps the existing measurement/profile callbacks.

- [ ] **Step 1: Add a rendering test seam** for placement records or a pure
  helper test that confirms every model root receives the intended transform.
- [ ] **Step 2: Build one wrapper group per model**, apply geographic transforms
  from the shared module, and fit the camera to all model bounds.
- [ ] **Step 3: Associate every raycast mesh with its source model**, convert
  hits back to that model's local GLB coordinates, and retain accurate
  projected/WGS84/elevation hover values.
- [ ] **Step 4: Dispose all roots, overlays, materials, and upload URLs** during
  effect cleanup; keep local preview behavior explicit.
- [ ] **Step 5: Run viewer tests and typecheck.**

### Task 3: Upload controls and application state

**Files:**
- Create: `DEM_to_3D/viewer/src/components/ModelUploadPanel.tsx`
- Modify: `DEM_to_3D/viewer/src/App.tsx`
- Modify: `DEM_to_3D/viewer/src/styles.css`

**Interfaces:**
- The panel exposes the two requested modes and a geographic-placement toggle
  for multi-model uploads.
- App state replaces the current model collection atomically only after all
  requested validation succeeds; failed uploads leave the current scene intact.

- [ ] **Step 1: Add the panel and state tests/seams** for single versus multiple
  selection and geographic-join error reporting.
- [ ] **Step 2: Implement upload state**, deriving the single analysis terrain
  only when one loaded model has a complete grid pair.
- [ ] **Step 3: Render the upload panel, model count, sidecar guidance, and
  visual-only/analysis status without disrupting the existing viewer.
- [ ] **Step 4: Add responsive styles** consistent with the existing dark UI.
- [ ] **Step 5: Run the full viewer test suite, typecheck, and build.**

### Task 4: Documentation and final verification

**Files:**
- Modify: `README.md`
- Modify: `DEM_to_3D/docs/terrain-asset-contract-v1.md` if upload pairing
  guidance belongs there

- [ ] **Step 1: Document file naming and the exact geographic placement rule.**
- [ ] **Step 2: Run `npm --prefix DEM_to_3D/viewer test`.**
- [ ] **Step 3: Run `npm --prefix DEM_to_3D/viewer run typecheck`.**
- [ ] **Step 4: Run `npm --prefix DEM_to_3D/viewer run build`.**
- [ ] **Step 5: Run `git diff --check` and inspect the final diff.**
