# Tiled texture streaming validation report

Date: 2026-09-28

## Automated evidence

- Python suite: `python -m unittest discover -s DEM_to_3D/tests -v` — 20 tests passed.
- Viewer suite: `npm --prefix DEM_to_3D/viewer test` — 55 tests passed.
- Typecheck: npm --prefix DEM_to_3D/viewer run typecheck — passed.
- Production build: npm --prefix DEM_to_3D/viewer run build — passed.
- git diff --check — passed.
- Synthetic benchmark: 0.107 s, peak RSS 66,068,480 bytes (~63.0 MiB), 9 tiles, `z0`–`z2`; generated fixture/output was removed after verification.

## Implemented scope

- Contract and generator use terrain grid outer bounds, bounded source windows, two-pixel edge-clamped gutters, max-level reprojection, and child-tile downsampling.
- Tile metadata validation rejects unknown root fields, unsafe source paths, invalid CRS/orientation, non-contiguous levels, and dimension mismatches.
- Upload pairing keeps tile roots isolated by model, excludes pyramid WebP from legacy texture matching, validates z0 preview, and skips large TIFF decoding when a valid pyramid exists.
- Uploaded tile inventory validates every `z<zoom>/<column>_<row>.webp` index against the metadata level bounds before decoding the preview.
- ImageBitmap cache estimates CPU bytes, closes evicted bitmaps, retries fetch/decode up to three attempts, rejects unsafe separators, ignores stale completion after cancellation, and the global request queue defaults to six.
- Atlas swaps require every requested tile; partial windows keep the previous detail or preview active.
- UI accepts a separate webkitdirectory tile-root selection and combines it atomically with model files.
- Scene coordinator prioritizes visible pyramid sources by projected screen coverage under a global atlas budget; out-of-frustum models keep preview and do not receive new detail requests.
- Lao Chải real-data generation completed: 4,681 WebP tiles at `z0`–`z7`, 148,133,428 bytes (~148 MB), with sidecar `DEM_to_3D/lao_chai_v2_tex.tiles.json`.

## Remaining manual validation

- Browser-only visual checks for seams, orientation, projected-point mapping, hover/measurement/profile regression, and camera re-anchor still need a manual session.
- Exact first-preview, first-detail, frame-time, and VRAM measurements remain pending; GPU values are estimates, not `renderer.info` VRAM claims.
- TTS-008 still needs detail-atlas eviction and camera-distance/recent-interaction weighting before the coordinator phase can be marked complete; CPU bitmap budget and request budget enforcement are covered.
