# High-Resolution Tiled Texture Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream an independent high-resolution texture pyramid for every uploaded terrain model, while supporting an unbounded number of models through scene-level memory, request, priority, and eviction budgets.

**Architecture:** The exporter keeps the existing GLB, UVs, terrain metadata, and geographic placement contract. Each model owns one tile-pyramid source, a low-resolution full-model preview, and an optional moving-window detail atlas. A scene coordinator schedules detail windows across all models; models outside the budget remain correct because their preview texture continues to cover the complete model. The detail atlas is an overlay on `MeshStandardMaterial` through `onBeforeCompile`, so Three.js lighting, shadows, hemisphere light, and directional light remain intact without requiring a full custom lighting shader.

**Tech Stack:** Python 3, rasterio, NumPy, Pillow, React 18, TypeScript, Three.js `0.170.x`, Vitest, Vite.

**Spec:** `DEM_to_3D/docs/terrain-asset-contract-v1.md`, `DEM_to_3D/viewer/src/terrain/texture.ts`, and the requirements in this plan.

## Global Constraints

- Every model has its own texture source namespace; tile keys from different models must never collide.
- The supported scene size is `N` models, not a fixed limit of three; GPU detail is budgeted and prioritized rather than promised at full resolution for every model simultaneously.
- Tile generation must use `--terrain-json` or an explicit projected bounds input; it must never use the entire source-image bounds as the model texture bounds.
- The pyramid target CRS is the model CRS, and the output bounds equal the terrain grid outer bounds derived from `grid_transform` and `grid.shape`.
- The generator must warp one output tile at a time and must not allocate a full-resolution destination image.
- A model always retains a complete low-resolution preview; a moving-window detail atlas is an overlay, not the model's only texture.
- `MeshStandardMaterial` remains the base material. `onBeforeCompile` may add detail sampling, but the implementation must preserve Three.js lighting and shadow chunks.
- The default atlas is `2048x2048` with `512x512` logical tiles; `4096x4096` is allowed only when the scene GPU budget permits it.
- The coordinator owns a global request queue, CPU bitmap budget, GPU atlas budget, and source-aware LRU cache.
- Tile metadata and relative paths are validated strictly; no metadata value may be executed as code or used to escape the selected directory.
- Existing single-image texture loading remains the fallback when a model has no valid tile pyramid.
- A tile pyramid takes precedence over a huge fallback TIFF so the browser never decodes the original multi-gigabyte image when tiled data is available.
- Generated pyramids and source imagery remain untracked by Git; scripts and tests are tracked.
- Do not add a runtime npm dependency. Browser tile decoding uses `fetch` plus `createImageBitmap`.
- New terrain modules live under `DEM_to_3D/viewer/src/terrain/` and have adjacent Vitest files where pure behavior can be tested without WebGL.
- UI copy follows the Vietnamese `viCopy` pattern in `ModelUploadPanel.tsx`.

---

## 1. Data Contract and Pyramid Generator

### Task 1: Define the per-model tile-pyramid contract

**Files:**
- Create: `DEM_to_3D/tools/tile_texture.py`
- Create: `DEM_to_3D/tests/test_tile_texture.py`
- Modify: `DEM_to_3D/docs/terrain-asset-contract-v1.md`
- Modify: `README.md`
- Modify: `.gitignore`

**Interfaces:**
- CLI: `python DEM_to_3D/tools/tile_texture.py --input SOURCE --terrain-json MODEL.terrain.json --output MODEL_tiles --tile-size 512 --format webp --quality 88`
- Output sidecar: `MODEL.tiles.json` next to the model.
- Output directory: `MODEL_tiles/z<zoom>/<column>_<row>.webp`.
- Metadata function: `build_tile_metadata(source_path, terrain_json_path, tile_size, quality) -> dict`.
- Bounds function: `terrain_outer_bounds(metadata) -> {min_x, min_y, max_x, max_y}`.

- [ ] **Step 1: Write failing Python contract tests.** Build a synthetic source GeoTIFF and terrain JSON. Assert that metadata includes `schema_version`, `asset_id`, `format`, `tile_size`, `gutter_px`, `min_zoom`, `max_zoom`, `bounds_projected`, `crs`, `orientation`, and a `levels` array containing `width_px`, `height_px`, `columns`, `rows`, and `pixel_size` for every zoom.
- [ ] **Step 2: Specify the JSON contract.** Use this shape and reject unknown root keys in the loader:

```json
{
  "schema_version": 1,
  "asset_id": "lao_chai_v2_tex",
  "format": "webp",
  "quality": 88,
  "tile_size": 512,
  "gutter_px": 2,
  "min_zoom": 0,
  "max_zoom": 6,
  "bounds_projected": {
    "min_x": 387043.90626054513,
    "min_y": 2405633.096479607,
    "max_x": 406024.1715949934,
    "max_y": 2420177.912858812
  },
  "crs": {"authority": "EPSG", "code": 32648, "linear_unit": "metre"},
  "orientation": {"origin": "top_left", "x": "east", "y": "north_to_south"},
  "levels": [
    {"zoom": 0, "width_px": 512, "height_px": 512, "columns": 1, "rows": 1, "pixel_size_x": 37.0, "pixel_size_y": 37.0},
    {"zoom": 1, "width_px": 1024, "height_px": 1024, "columns": 2, "rows": 2, "pixel_size_x": 18.5, "pixel_size_y": 18.5}
  ],
  "source": "lao_chai_v2_tex.tif"
}
```

- [ ] **Step 3: Implement `terrain_outer_bounds`.** For north-up affine metadata, compute `min_x = c`, `max_x = c + a * cols`, `min_y = f + e * rows`, and `max_y = f`. Reject rotated/sheared transforms until an explicit affine-bounds implementation is added.
- [ ] **Step 4: Run the focused contract test.** Run `python -m unittest DEM_to_3D.tests.test_tile_texture -v`. Expected: the contract test passes and the source file is not modified.
- [ ] **Step 5: Document pairing and ignore rules.** Document that `MODEL.tiles.json` identifies the model through `asset_id`, while tiles live under `MODEL_tiles/`; add `DEM_to_3D/*_tiles/` and generated `*.tiles.json` rules to `.gitignore`.

### Task 2: Implement windowed reprojection and pyramid generation

**Files:**
- Modify: `DEM_to_3D/tools/tile_texture.py`
- Modify: `DEM_to_3D/tests/test_tile_texture.py`

**Interfaces:**
- `generate_pyramid(source_path, terrain_json_path, output_dir, tile_size, quality) -> TileGenerationReport`.
- `render_max_level_tile(source, target_crs, target_transform, tile_window, gutter_px) -> Image`.
- `downsample_child_tiles(child_paths, target_size) -> Image`.

- [ ] **Step 1: Add a failing windowed-memory test.** Patch the rasterio dataset test double so a full-image `read()` raises an exception. Assert that generation calls only bounded windows whose width and height are less than the source dimensions.
- [ ] **Step 2: Derive output resolution and dimensions from the cropped target bounds.** Use the source CRS and transform to derive target pixel size through rasterio reprojection, then calculate output dimensions from the model bounds, not from the source image dimensions. Compute `max_zoom` from the resulting output dimensions: `ceil(log2(max(width_px, height_px) / tile_size))`, with a minimum of zero.
- [ ] **Step 3: Render only the maximum level from source windows.** For each output tile, transform its target bounds back to the source CRS, expand the source window by two source pixels, read only that window, and call `rasterio.warp.reproject` directly into the tile-sized RGB array. Add a two-pixel gutter by clamping edge samples; write logical tile content plus gutter as WebP.
- [ ] **Step 4: Build lower levels from already-written child tiles.** Read the four corresponding child tiles into a bounded mosaic, downsample to the parent tile, preserve orientation and gutters, and never reproject the entire source for every zoom.
- [ ] **Step 5: Write metadata only after validating output.** Reopen one interior tile, one right-edge tile, and one bottom-edge tile at every level. Assert nonzero dimensions, valid WebP decoding, expected logical tile size, and bounds-safe column/row names before writing `MODEL.tiles.json`.
- [ ] **Step 6: Run synthetic and real-data checks.** Run `python -m unittest DEM_to_3D.tests.test_tile_texture -v`. Then run the real command for Lao Chải using `--terrain-json DEM_to_3D/lao_chai_v2_tex.terrain.json`; assert the generated pyramid bounds equal the terrain outer bounds and record generation time, output size, and peak process memory.
- [ ] **Step 7: Commit the generator independently.** Use `git add DEM_to_3D/tools/tile_texture.py DEM_to_3D/tests/test_tile_texture.py DEM_to_3D/docs/terrain-asset-contract-v1.md README.md .gitignore` and commit with `feat: generate model-aligned texture pyramids`.

## 2. Viewer Validation, Pairing, and Source Ownership

### Task 3: Add strict tile metadata types and validation

**Files:**
- Modify: `DEM_to_3D/viewer/src/types/terrain.ts`
- Create: `DEM_to_3D/viewer/src/terrain/tileMetadata.ts`
- Create: `DEM_to_3D/viewer/src/terrain/tileMetadata.test.ts`

**Interfaces:**
- `TilePyramidMetadata` mirrors the JSON contract without accepting unknown values.
- `validateTilePyramidMetadata(value: unknown): TilePyramidMetadata`.
- `tileLevel(metadata, zoom): TileLevelMetadata`.
- `logicalTilePath(zoom, column, row): string`.
- `tileKey(sourceId, zoom, column, row): string`.

- [ ] **Step 1: Write failing validation tests.** Cover missing levels, invalid CRS, non-integer columns/rows, mismatched dimensions, unsafe values, unsupported format, invalid orientation, tile sizes other than positive finite values, and out-of-range zooms.
- [ ] **Step 2: Implement validation.** Require exact root fields, finite bounds with `min < max`, unique contiguous zoom levels, `columns = ceil(width_px / tile_size)`, `rows = ceil(height_px / tile_size)`, and safe `source` text. Reject extra root fields and all path separators in `source`.
- [ ] **Step 3: Implement source-aware keys and paths.** Return keys in the form `${sourceId}/${zoom}/${column}/${row}` and paths in the form `z${zoom}/${column}_${row}.webp`; reject negative, fractional, or out-of-range indexes before constructing a path.
- [ ] **Step 4: Run `npm --prefix DEM_to_3D/viewer test -- tileMetadata.test.ts`.** Expected: all validation and key/path tests pass.

### Task 4: Pair N model sources without colliding file names

**Files:**
- Modify: `DEM_to_3D/viewer/src/terrain/upload.ts`
- Modify: `DEM_to_3D/viewer/src/types/terrain.ts`
- Modify: `DEM_to_3D/viewer/src/terrain/geographic.test.ts`
- Create: `DEM_to_3D/viewer/src/terrain/uploadTiles.test.ts`

**Interfaces:**
- `UploadedTileSource = { metadataFile: File; rootPath: string; files: Map<string, File> }`.
- `UploadedFilePair.tilePyramid?: UploadedTileSource`.
- `pairUploadedFiles(files: readonly File[]): UploadedFilePair[]` pairs each model with at most one matching `<model>.tiles.json` and `<model>_tiles/` source.
- `releaseUploadedModels` revokes on-demand tile object URLs as well as existing GLTF URLs.

- [ ] **Step 1: Write failing N-model pairing tests.** Create fake files for `lao_chai_v2_tex.glb`, `che_tao_v2_tex.glb`, and `pung_luong_v2_tex.glb`, each with its own `.tiles.json` and relative `z0/0_0.webp`; assert each pair owns only its own tile and identical tile names do not collide.
- [ ] **Step 2: Normalize browser paths safely.** Read `webkitRelativePath` when present, strip exactly one selected root folder, normalize `/`, reject `..`, backslashes, absolute paths, and files outside the matching `<model>_tiles` root.
- [ ] **Step 3: Exclude pyramid tiles from legacy texture matching.** Update `isTextureFile`/pairing so files recognized as pyramid members never enter `findUniqueTexture`; a directory with thousands of WebP tiles must not trigger “multiple texture files match model”.
- [ ] **Step 4: Validate folder membership and tile inventory.** Match `MODEL.tiles.json` to `asset_id`, require all tile paths to satisfy `z<number>/<number>_<number>.webp`, reject duplicate logical paths, and reject files whose indexes are outside metadata level dimensions.
- [ ] **Step 5: Preserve fallback behavior.** If no valid tile source exists, keep the current PNG/JPG/WebP/TIFF path. If a valid pyramid exists, do not decode its huge TIFF fallback during upload; retain only the tile source for the viewer.
- [ ] **Step 6: Run upload and existing geographic tests.** Run `npm --prefix DEM_to_3D/viewer test -- geographic.test.ts uploadTiles.test.ts`. Expected: legacy pairing and N-model tile pairing both pass.

## 3. Per-Model Preview, Detail Atlas, and Scene Coordinator

### Task 5: Implement source-aware tile cache and request scheduling

**Files:**
- Create: `DEM_to_3D/viewer/src/terrain/tileTexture.ts`
- Create: `DEM_to_3D/viewer/src/terrain/tileTexture.test.ts`
- Modify: `DEM_to_3D/viewer/src/types/terrain.ts`

**Interfaces:**
- `TileCacheEntry = { key: string; bitmap: ImageBitmap; byteEstimate: number; lastUsed: number }`.
- `TileTextureCache.get(key): ImageBitmap | undefined`.
- `TileTextureCache.load(key, url): Promise<ImageBitmap>`.
- `TileTextureCache.evictToBudget(maxBytes): void`.
- `TileTextureCache.dispose(): void`.
- `TileRequestQueue` accepts at most six global concurrent fetch/decode operations and supports cancellation by `sourceId`.

- [ ] **Step 1: Write failing cache tests.** Cover source namespace isolation, LRU order, byte-budget eviction, bitmap `.close()`, duplicate in-flight requests, retry twice then terminal failure, and cancellation that prevents stale completion from entering the cache.
- [ ] **Step 2: Implement the cache with ImageBitmap only.** Do not store a `THREE.Texture` per tile; the atlas owns GPU textures. Estimate bitmap memory as `width * height * 4`, include gutter dimensions, and evict until the global CPU budget is satisfied.
- [ ] **Step 3: Implement URL ownership.** Create object URLs only when a tile is requested, cache the URL until decode settles, then revoke it in both success and failure paths. A released model cancels its pending requests and closes its bitmaps.
- [ ] **Step 4: Run focused tests.** Run `npm --prefix DEM_to_3D/viewer test -- tileTexture.test.ts`. Expected: no more than six active requests and no cross-model key collision.

### Task 6: Implement full-model preview and moving-window detail atlas

**Files:**
- Create: `DEM_to_3D/viewer/src/terrain/tileAtlas.ts`
- Create: `DEM_to_3D/viewer/src/terrain/tileAtlas.test.ts`
- Modify: `DEM_to_3D/viewer/src/types/terrain.ts`

**Interfaces:**
- `ModelTileState` owns one source ID, preview texture, front/back atlas, active window, and per-material shader bindings.
- `createModelTileState(source, rendererCapabilities, budget): ModelTileState`.
- `updateModelDetail(state, requestedTiles): Promise<void>`.
- `setModelDetailWindow(state, window): void`.
- `disposeModelTileState(state): void`.

- [ ] **Step 1: Write failing pure atlas tests.** Assert tile placement in a moving window, logical content versus gutter coordinates, UV-window conversion, out-of-window mask behavior, and that a model A update never mutates model B's atlas or uniforms.
- [ ] **Step 2: Implement the low-resolution preview.** Load the single z0 tile as the complete model base texture, configure `flipY = false`, `colorSpace = SRGBColorSpace`, `generateMipmaps = false`, and keep it active while detail tiles load or are evicted.
- [ ] **Step 3: Implement front/back atlas rebuilds.** Draw each requested tile into its geographic position inside the window, including gutters. Keep the front atlas and its window active until every required tile for the replacement window is ready; then swap front and back together and update the detail uniforms.
- [ ] **Step 4: Add the detail overlay to `MeshStandardMaterial`.** Clone materials per model where necessary, preserve the base `map` preview, and use `onBeforeCompile` to add `terrainDetailMap`, `terrainDetailWindow`, and `terrainDetailReady`. Blend the detail sample only when model UV lies inside the active window; outside the window use the full-model preview. Preserve the existing lighting and shadow chunks.
- [ ] **Step 5: Define UV and orientation precisely.** Convert projected tile bounds to the model's normalized UV domain, account for the existing `flipY = false` convention, and use a two-pixel gutter so linear filtering never samples an unrelated tile. Do not change shared material `offset` or `repeat`; all state is per-model and per-detail overlay.
- [ ] **Step 6: Run atlas tests.** Run `npm --prefix DEM_to_3D/viewer test -- tileAtlas.test.ts`. Expected: outside-window fragments remain preview-correct and atlas swaps are atomic.

### Task 7: Coordinate N models under one scene-level budget

**Files:**
- Modify: `DEM_to_3D/viewer/src/terrain/tileTexture.ts`
- Create: `DEM_to_3D/viewer/src/terrain/tileCoordinator.test.ts`
- Modify: `DEM_to_3D/viewer/src/types/terrain.ts`

**Interfaces:**
- `SceneTileCoordinator.update(models, camera, viewport, now): Promise<void>`.
- `SceneTileCoordinator.getStats(): TileStreamingStats`.
- `SceneTileCoordinator.dispose(): void`.
- `TileStreamingStats = { activeSources, queuedRequests, loadedTiles, cpuBytes, gpuBytes, perModel }`.

- [ ] **Step 1: Write failing coordinator tests.** Use N synthetic models with separate source IDs. Assert that visible screen area and recency determine priority, off-frustum models stop new requests, each model retains a preview, and total CPU/GPU estimates never exceed configured budgets.
- [ ] **Step 2: Implement projected screen priority.** Project each model's world-space bounds into the current viewport; rank by visible pixel area, camera distance, and recent interaction. Request higher LOD only for models that have budget and enough screen coverage; use parent tiles for lower-priority models.
- [ ] **Step 3: Implement bounded atlas allocation.** Default to `2048x2048` detail atlases and reserve one front plus one back texture per active model. Compute the active-model limit from `gpuBudgetBytes`; never allocate three fixed `4096x4096` atlases merely because three models are loaded. Permit N models to remain preview-only when the budget is exhausted.
- [ ] **Step 4: Implement global eviction.** Evict detail atlases and CPU bitmaps by lowest priority and least recent use, while preserving each model's z0 preview. Eviction must cancel no longer relevant requests and must not dispose another model's texture.
- [ ] **Step 5: Add runtime budget reporting.** Report estimated GPU bytes as atlas dimensions times four bytes per pixel, plus a documented mip factor only when mipmaps are enabled. Use `renderer.capabilities.maxTextureSize` and reduce atlas size to `1024` or `2048` when the device cannot support the configured size.
- [ ] **Step 6: Run coordinator tests.** Run `npm --prefix DEM_to_3D/viewer test -- tileCoordinator.test.ts`. Expected: N-model isolation, priority, eviction, and budget tests pass.

## 4. Viewer and UI Integration

### Task 8: Integrate per-model streaming into `TerrainViewer`

**Files:**
- Modify: `DEM_to_3D/viewer/src/components/TerrainViewer.tsx`
- Modify: `DEM_to_3D/viewer/src/terrain/upload.ts`
- Modify: `DEM_to_3D/viewer/src/terrain/raycast.ts` to expose the idempotent disposal seam required by tile-state cleanup

**Interfaces:**
- `TerrainViewer` receives `models: LoadedModel[]` and optional `onTileStats: (stats: TileStreamingStats) => void`.
- Every model entry owns its own geographic placement, `ModelTileState`, meshes, labels, and cleanup handles.

- [ ] **Step 1: Add a render integration seam.** Test the pure model-entry setup so every loaded model gets its own source ID, preview, geographic placement, detail uniforms, and raycast association.
- [ ] **Step 2: Create one tile state per pyramid model.** Keep models without pyramids on the existing texture/material path. Do not share a texture, atlas, UV transform, or detail uniform object between models.
- [ ] **Step 3: Update streaming only after camera changes.** Use controls target, camera position, camera projection, viewport size, and model bounds to invalidate the coordinator; do not recompute visible tiles every animation frame. Keep rendering and hover responsive while requests run asynchronously.
- [ ] **Step 4: Preserve hover, measurement, geographic merge, and profile behavior.** Detail texture changes must not modify mesh transforms, grid sampling, projected coordinates, raycast ownership, or existing analysis eligibility.
- [ ] **Step 5: Dispose deterministically.** On effect cleanup or model replacement, cancel coordinator requests, remove shader hooks, dispose preview/detail textures, close bitmaps, dispose atlases, dispose BVHs and renderer resources, and revoke all object URLs exactly once.
- [ ] **Step 6: Run the viewer suite and typecheck.** Run `npm --prefix DEM_to_3D/viewer test` and `npm --prefix DEM_to_3D/viewer run typecheck`. Expected: existing analysis/geographic tests and all tile tests pass.

### Task 9: Add multi-model tile upload controls and status

**Files:**
- Modify: `DEM_to_3D/viewer/src/components/ModelUploadPanel.tsx`
- Modify: `DEM_to_3D/viewer/src/App.tsx`
- Modify: `DEM_to_3D/viewer/src/styles.css`
- Modify: `DEM_to_3D/viewer/src/terrain/upload.ts`

**Interfaces:**
- The existing model input keeps support for one or many GLB/GLTF files and sidecars.
- A second input uses `webkitdirectory` for one or more `<model>_tiles` roots.
- `App` combines selected model files and tile-directory files before calling `loadUploadedModels`.
- `onTileStats` displays aggregate and per-model counts without exposing raw file paths.

- [ ] **Step 1: Add the failing UI/state test seam.** Assert that selecting N models and N tile roots preserves all roots, reports unmatched roots as an actionable error, and does not change the fallback single-texture path.
- [ ] **Step 2: Add the tile-directory input.** Use a typed local cast for `webkitdirectory`; clear the input value after selection, retain relative paths, and show that the folder belongs to a model only after metadata validation succeeds.
- [ ] **Step 3: Render aggregate streaming status.** Show active model count, active detail sources, current loaded tile count, CPU estimate, GPU estimate, queue count, and a compact per-model status such as `Lao Chải · preview`, `Chế Tạo · z5 · 12 tiles`, or `Púng Luông · waiting for budget`.
- [ ] **Step 4: Keep upload replacement atomic.** Parse and validate every requested model/pyramid first; on any error release only the newly loaded resources and leave the current scene unchanged.
- [ ] **Step 5: Add responsive styles and Vietnamese guidance.** Explain that each model needs its own `MODEL.tiles.json` and `MODEL_tiles/` directory, and that detail quality is prioritized by viewport coverage when many models are visible.
- [ ] **Step 6: Run `npm --prefix DEM_to_3D/viewer run build`.** Expected: the UI compiles with the `webkitdirectory` cast and no new dependency.

## 5. Verification, Benchmark, and Documentation

### Task 10: Verify correctness, performance, and fallback behavior

**Files:**
- Modify: `README.md`
- Create: `DEM_to_3D/docs/tiled-texture-validation-report.md`
- Create: `DEM_to_3D/tools/tiled_texture_benchmark.py` to capture reproducible generator timing and peak-memory measurements

- [ ] **Step 1: Run all Python tests.** Run `python -m unittest discover -s DEM_to_3D/tests -v`. Expected: existing exporter/contract tests and tile-generator tests pass.
- [ ] **Step 2: Run all viewer tests, typecheck, and build.** Run `npm --prefix DEM_to_3D/viewer test`, `npm --prefix DEM_to_3D/viewer run typecheck`, and `npm --prefix DEM_to_3D/viewer run build`. Expected: all commands exit zero.
- [ ] **Step 3: Verify N-model isolation manually.** Load Lao Chải, Chế Tạo, Púng Luông, then add a fourth synthetic model with its own pyramid. Confirm that equal tile coordinates do not share content, each model retains its own preview, and removing one model leaves the others intact.
- [ ] **Step 4: Verify fallback manually.** Load `che_tao_v2_tex.glb`, matching `.grid.bin`, `.terrain.json`, and the current TIFF without a pyramid. Confirm texture, hover, profile, slope, and administrative labels behave as before.
- [ ] **Step 5: Measure generator and viewer budgets.** Record source size, generated size, generation time, peak process memory, first preview time, first detail time, frame time while orbiting, estimated GPU bytes, CPU bitmap bytes, active detail sources, and request concurrency. Do not claim exact VRAM from `renderer.info`; label the value as an estimate.
- [ ] **Step 6: Verify quality and seams.** Compare a known projected point against the source and max-zoom tile, inspect all four tile boundaries, test north/south and east/west orientation, and pan across a moving-window re-anchor without preview loss or a full-model color smear.
- [ ] **Step 7: Record acceptance criteria.** Pass only if: preview appears before detail work completes; no full source TIFF is decoded in tiled mode; no unbounded request burst occurs; no model shows another model's texture; memory estimates stay inside configured budgets; N-model fallback remains correct; and camera re-anchor swaps are atomic.
- [ ] **Step 8: Document the operational workflow.** Add generator command, pairing layout, browser upload steps, budget policy, N-model behavior, known limitation that full native-resolution detail for every model is not guaranteed simultaneously, and the future virtual-texture/page-table upgrade trigger.
- [ ] **Step 9: Run `git diff --check` and inspect the final diff.** Commit the viewer integration, UI, tests, and documentation as separate logical commits; do not commit generated source imagery or tile output.

## 6. Deferred Upgrade

The moving-window detail overlay is the MVP for N models. It preserves the complete preview for every model and allocates high-resolution windows only where screen coverage justifies them. If future requirements demand native-resolution detail for dozens of simultaneously visible models, replace per-model moving windows with a shared virtual-texture page pool and page-table lookup. That upgrade is outside this plan and must preserve the same tile metadata, source-aware keys, fallback preview, and scene-level budget interfaces.

## 7. Risks and Mitigations

- **Atlas window does not cover the whole model:** the full-model z0 preview remains the base map; detail is blended only inside the valid window, so fragments outside it do not sample an atlas edge.
- **Multiple models have identical tile coordinates:** every cache and request key includes `sourceId`; tile files are owned by their model root and never merged by basename alone.
- **Camera crosses a window boundary:** front/back atlases swap only after required tiles are ready; the previous detail window or preview remains active during loading.
- **Too many visible models:** the coordinator lowers LOD or releases detail atlases by projected screen priority while preserving one preview texture per model.
- **Reprojection seams:** source windows include padding, output tiles include gutters, and adjacent levels are checked at generation time.
- **Browser path ambiguity:** normalized relative paths are validated against the matching model root and logical tile regex before object URLs are created.
- **GPU differences:** runtime `maxTextureSize` and configured byte budgets select atlas size and active detail count; the preview path works without detail support.
- **Shader compatibility:** the detail extension uses `MeshStandardMaterial.onBeforeCompile` and retains Three.js standard lighting chunks; models without a compatible standard material keep preview/fallback rendering.
