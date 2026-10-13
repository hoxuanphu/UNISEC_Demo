# Task Tracker — High-Resolution Tiled Texture Streaming

Tracker này chuyển `plan/feature-tiled-texture-streaming-1.md` thành các đầu việc có thể triển khai và nghiệm thu. Phạm vi là **N model**, trong đó mỗi model có texture pyramid riêng; tài nguyên detail được điều phối bằng ngân sách cấp scene.

## Quy ước

- **Status:** `TODO`, `IN PROGRESS`, `BLOCKED`, `DONE`.
- **Priority:** `P0` bắt buộc cho MVP, `P1` quan trọng để hoàn thiện, `P2` nâng cấp sau MVP.
- Chỉ chuyển task sang `DONE` khi có test hoặc artifact xác minh tương ứng.
- Không commit ảnh nguồn, tile pyramid sinh ra, hoặc file dữ liệu lớn.
- `N model` nghĩa là không đặt giới hạn cứng theo số model; chất lượng detail đồng thời vẫn phụ thuộc ngân sách GPU/CPU.

## Tổng quan tiến độ

| Phase | Nội dung | Status | Gate |
|---|---|---|---|
| 1 | Contract và generator pyramid | DONE | Contract tests, synthetic generator tests và Lao Chải pyramid đã xác minh |
| 2 | Validation, upload pairing, source ownership | DONE | Metadata/path validation, N-model pairing và inventory bounds tests đã pass |
| 3 | Cache, preview, moving-window detail atlas | DONE | Cache/queue/atlas/shader tests và viewer build đã pass |
| 4 | Scene coordinator và viewer/UI integration | IN PROGRESS | Runtime coordinator/frustum request đã nối; eviction và browser visual checks còn pending |
| 5 | Verification, benchmark và documentation | IN PROGRESS | Automated evidence đã có; manual browser metrics/visual acceptance còn pending |

## Phase 1 — Contract và pyramid generator

| ID | Task | Priority | Depends on | Status | Acceptance evidence |
|---|---|---:|---|---|---|
| TTS-001 | Định nghĩa `MODEL.tiles.json`, tile path, orientation, gutter, level dimensions và projected bounds | P0 | — | DONE | `test_tile_texture.py`, `tileMetadata.test.ts`, contract docs |
| TTS-002 | Viết generator windowed reprojection và downsample pyramid | P0 | TTS-001 | DONE | Synthetic GeoTIFF generation test + WebP validation |
| TTS-003 | Sinh và kiểm tra pyramid thực tế cho Lao Chải; thêm ignore rules | P1 | TTS-002 | DONE | Real run: 4,681 tiles z0-z7, 148 MB output, sidecar written and ignored |

### TTS-001 — Contract per-model

- [x] Tạo `DEM_to_3D/tools/tile_texture.py` và `DEM_to_3D/tests/test_tile_texture.py`.
- [x] Chốt sidecar `MODEL.tiles.json` và thư mục `MODEL_tiles/z<zoom>/<column>_<row>.webp`.
- [x] Bắt buộc `asset_id`, `schema_version`, `tile_size`, `gutter_px`, `min_zoom`, `max_zoom`, `bounds_projected`, `crs`, `orientation`, `levels`, `source`.
- [x] Ghi `columns`, `rows`, `width_px`, `height_px`, `pixel_size_x`, `pixel_size_y` cho từng level.
- [x] Tính outer bounds từ `grid_transform` và `grid.shape`, không dùng toàn bộ bbox ảnh nguồn.
- [x] Reject affine xoay/shear nếu generator chưa hỗ trợ được chính xác.
- [x] Cập nhật `DEM_to_3D/docs/terrain-asset-contract-v1.md`, `README.md` và `.gitignore`.

### TTS-002 — Generator

- [x] CLI nhận `--input`, `--terrain-json`, `--output`, `--tile-size`, `--format`, `--quality`.
- [x] Tính output resolution và `max_zoom` từ bounds model sau crop/reproject.
- [x] Reproject từng tile vào buffer giới hạn; không cấp phát destination full-resolution.
- [x] Đọc source window có padding hai pixel và tạo gutter hai pixel.
- [x] Tạo max level trước, sau đó downsample từ bốn child tile thành parent tile.
- [x] Kiểm tra tile interior, right-edge và bottom-edge ở mọi level trước khi ghi metadata.
- [x] Test yêu cầu full-image `read()` phải fail; mọi window phải nhỏ hơn source dimensions.

### TTS-003 — Real pyramid

- [x] Chạy generator với `DEM_to_3D/lao_chai_v2_tex.tif` và `lao_chai_v2_tex.terrain.json`.
- [x] Xác nhận `bounds_projected` bằng outer bounds của terrain grid.
- [x] Xác nhận không có tile rỗng, tile hỏng hoặc path ngoài schema.
- [x] Ghi output size và tile count; generation time/peak memory vẫn là metric cần bổ sung nếu chạy lại benchmark thực tế.
- [x] Không track `DEM_to_3D/*_tiles/`, source TIFF hoặc generated sidecar trong Git.

## Phase 2 — Validation, upload pairing và source ownership

| ID | Task | Priority | Depends on | Status | Acceptance evidence |
|---|---|---:|---|---|---|
| TTS-004 | Thêm type/validator cho tile metadata và source-aware key/path | P0 | TTS-001 | DONE | `tileMetadata.test.ts` pass |
| TTS-005 | Pair N model với N tile roots, loại tile khỏi legacy texture pairing | P0 | TTS-004 | DONE | `uploadTiles.test.ts` pass; inventory index bounds được kiểm tra theo metadata |

### TTS-004 — Metadata validation

- [x] Tạo `DEM_to_3D/viewer/src/terrain/tileMetadata.ts` và test cạnh file.
- [x] Validate exact root fields, finite bounds, CRS, orientation, contiguous levels và dimension formulas.
- [x] Reject unknown root fields, path separator trong `source`, zoom/index âm hoặc fractional.
- [x] Implement `tileLevel`, `logicalTilePath` và `tileKey(sourceId, zoom, column, row)`.
- [x] Đảm bảo hai model có cùng `zoom/column/row` vẫn có key khác nhau nhờ `sourceId`.

### TTS-005 — Upload pairing

- [x] Mở rộng `UploadedFilePair` với tile metadata file, root path và tile map.
- [x] Pair `MODEL.glb`, `MODEL.tiles.json` và `MODEL_tiles/` độc lập cho mọi model.
- [x] Chuẩn hóa `webkitRelativePath`; reject `..`, absolute path, backslash và file ngoài root.
- [x] Chỉ nhận path `z<number>/<number>_<number>.webp` và kiểm tra index theo metadata.
- [x] Loại pyramid WebP khỏi `findUniqueTexture` để không phát sinh lỗi multiple texture.
- [x] Nếu không có pyramid hợp lệ, giữ nguyên fallback PNG/JPG/WebP/TIFF hiện tại.
- [x] Khi có pyramid hợp lệ, không decode TIFF lớn trong lúc upload.
- [x] Test source isolation; inventory validator kiểm tra thêm zoom/column/row bounds.

## Phase 3 — Cache, preview và detail atlas

| ID | Task | Priority | Depends on | Status | Acceptance evidence |
|---|---|---:|---|---|---|
| TTS-006 | Cache `ImageBitmap`, queue request và cancellation theo source | P0 | TTS-004, TTS-005 | DONE | `tileTexture.test.ts`, global queue limit 6 |
| TTS-007 | Preview toàn model và moving-window detail atlas per model | P0 | TTS-006 | DONE | `tileAtlas.test.ts`, `tileTexture.test.ts`, shader overlay và z0 preview integration |

### TTS-006 — Cache và request queue

- [x] Tạo `tileTexture.ts` và test cạnh file.
- [x] Cache chỉ giữ `ImageBitmap`, không giữ `THREE.Texture` cho từng tile.
- [x] Tính byte estimate từ kích thước bitmap và gutter; có LRU eviction API.
- [x] Giới hạn tối đa sáu fetch/decode đồng thời trên toàn scene.
- [x] Deduplicate in-flight request theo source-aware key.
- [x] Retry tối đa hai lần rồi đánh dấu lỗi terminal.
- [x] Cancel request theo `sourceId`; stale completion không được vào cache.
- [x] Tạo/revoke object URL đúng cả success và failure; gọi `bitmap.close()` khi evict/dispose.

### TTS-007 — Preview và atlas

- [x] Tạo `tileAtlas.ts` và test pure behavior.
- [x] Dùng tile z0 làm preview phủ toàn model; giữ preview khi detail chưa sẵn sàng hoặc bị evict.
- [x] Mỗi model sở hữu preview texture, front atlas, back atlas, active window và shader bindings riêng.
- [x] Mặc định atlas `2048x2048`, logical tile `512x512`; chỉ dùng `4096x4096` khi budget cho phép.
- [x] Vẽ tile đúng vị trí projected trong moving window, gồm gutter.
- [x] Chỉ swap front/back khi các tile bắt buộc của window mới đã sẵn sàng.
- [x] Giữ preview hoặc window cũ trong lúc loading/re-anchor.
- [x] Overlay detail qua `MeshStandardMaterial.onBeforeCompile`, không thay lighting/shadow chunks.
- [x] Detail chỉ blend trong window hợp lệ; ngoài window luôn lấy preview để tránh kéo pixel biên.
- [x] Không dùng shared `map.offset/repeat`; uniforms và transform phải per model.
- [x] Có test placement/gutter/window; browser seam/orientation checks vẫn pending.

## Phase 4 — Scene coordinator và viewer/UI integration

| ID | Task | Priority | Depends on | Status | Acceptance evidence |
|---|---|---:|---|---|---|
| TTS-008 | Điều phối N model theo screen coverage và global budgets | P0 | TTS-006, TTS-007 | IN PROGRESS | `tileCoordinator.test.ts` priority/budget/frustum pass; runtime request gating đã nối; CPU eviction và camera-distance/recent-interaction weighting còn pending |
| TTS-009 | Tích hợp streaming vào viewer, upload panel và App | P0 | TTS-005, TTS-008 | DONE | Tile folder, z0 preview, atlas shader, camera update, atomic load, suite/typecheck/build pass |

### TTS-008 — `SceneTileCoordinator`

- [x] Tạo coordinator và `tileCoordinator.test.ts`.
- [x] API chính: `update(models, camera, viewport, now)`, `getStats()`, `dispose()`.
- [x] Xếp priority theo projected screen area; camera-distance/recent-interaction weighting còn pending.
- [x] Model ngoài frustum dừng request mới; model ngoài coverage giữ preview.
- [x] Không giới hạn cứng số model; mọi model vẫn giữ preview riêng.
- [x] Áp dụng global CPU bitmap budget, GPU atlas budget và request budget.
- [ ] Evict detail atlas/bitmap theo priority và LRU nhưng không evict preview cuối cùng của model.
- [x] Không cấp phát ba atlas `4096x4096` cố định chỉ vì có ba model.
- [x] Tính GPU estimate từ atlas dimensions × 4 bytes/pixel và mip factor khi có mipmap.
- [x] Runtime hạ atlas xuống `1024` hoặc `2048` nếu `maxTextureSize`/budget không đủ.
- [x] Stats gồm active sources, queued requests, loaded tiles, CPU bytes, GPU bytes và per-model state.

### TTS-009 — Viewer và UI

- [x] Tích hợp một `ModelTileState` riêng cho mỗi model có pyramid trong `TerrainViewer`.
- [x] Giữ nguyên geographic placement, raycast ownership, hover, measurement, profile và analysis eligibility trong automated regression scope.
- [x] Camera change và detail target invalidate streaming; threshold optimization còn pending.
- [x] Cleanup idempotent: cancel request, restore shader materials, dispose atlas/BVH và revoke URL.
- [x] Thêm `webkitdirectory` input cho tile roots.
- [x] App kết hợp model files và tile-directory files trước `loadUploadedModels`.
- [x] Hiển thị aggregate status và per-model status nhưng không lộ raw paths.
- [x] Upload replacement atomic; lỗi pyramid mới không làm mất scene hiện tại.
- [x] Cập nhật copy và responsive styles bằng pattern `viCopy`.
- [x] Chạy viewer tests, typecheck và production build.

## Phase 5 — Verification, benchmark và documentation

| ID | Task | Priority | Depends on | Status | Acceptance evidence |
|---|---|---:|---|---|---|
| TTS-010 | Kiểm thử toàn diện, benchmark, báo cáo và docs | P1 | TTS-003, TTS-009 | IN PROGRESS | Python 20 tests, viewer 55 tests, typecheck/build, synthetic benchmark và validation report; browser visual/metric checks còn pending |

### TTS-010 — Acceptance checklist

- [x] Chạy `python -m unittest discover -s DEM_to_3D/tests -v` — 20 tests passed.
- [x] Chạy `npm --prefix DEM_to_3D/viewer test` — 55 tests passed.
- [x] Chạy `npm --prefix DEM_to_3D/viewer run typecheck`.
- [x] Chạy `npm --prefix DEM_to_3D/viewer run build`.
- [ ] Kiểm tra N-model isolation với Lao Chải, Chế Tạo, Púng Luông và một model thứ tư synthetic.
- [ ] Xác nhận tile có cùng tọa độ nhưng khác source không bị chia sẻ nội dung.
- [ ] Xác nhận xóa một model không dispose texture/atlas của model còn lại.
- [ ] Regression fallback với GLB + grid + terrain JSON + TIFF không có pyramid.
- [ ] Đo first preview, first detail, frame time, CPU bytes, GPU estimate và request concurrency.
- [ ] Kiểm tra tile seams, orientation, projected-point mapping và moving-window re-anchor.
- [ ] Xác nhận tiled mode không decode full source TIFF.
- [x] Ghi `DEM_to_3D/docs/tiled-texture-validation-report.md` và cập nhật `README.md`.
- [x] Chạy `git diff --check`; không commit source imagery hoặc generated tile output.

## Ngưỡng nghiệm thu MVP

- Preview toàn model xuất hiện trước khi detail tiles tải xong.
- Không có full-image decode trong tiled mode.
- Request đồng thời không vượt quá `6`.
- Không có texture source bị trộn giữa hai model.
- Mọi model ngoài detail budget vẫn render đúng preview của chính nó.
- Front/back atlas swap không làm trắng model hoặc kéo pixel atlas ra ngoài window.
- CPU/GPU estimates không vượt global budgets đã cấu hình.
- Hover, measurement, profile, slope, geographic merge và administrative labels không regression.
- Không tuyên bố full native-resolution đồng thời cho mọi model; detail được phân bổ theo viewport coverage.

## Backlog sau MVP

| ID | Task | Priority | Status |
|---|---|---:|---|
| TTS-BL-001 | Shared virtual-texture page pool và page-table lookup cho hàng chục model cùng full detail | P2 | TODO |
| TTS-BL-002 | ZIP tile package thay cho `webkitdirectory` | P2 | TODO |
| TTS-BL-003 | Worker/off-main-thread cho decode và atlas preparation | P2 | TODO |
| TTS-BL-004 | GPU byte query thực tế bằng backend/profiling chuyên dụng | P2 | TODO |

## Quy tắc cập nhật tracker

1. Khi bắt đầu task, đổi `Status` thành `IN PROGRESS` và ghi ngày bắt đầu trong commit hoặc issue.
2. Khi gặp blocker, đổi thành `BLOCKED` và ghi nguyên nhân cùng task phụ thuộc.
3. Khi hoàn thành, ghi test hoặc artifact xác minh vào cột `Acceptance evidence` hoặc phần evidence bên dưới.
4. Không đánh dấu phase `DONE` nếu còn task P0 chưa hoàn tất.
5. Nếu thay đổi contract hoặc interface, cập nhật plan và tracker trong cùng một change.

## Evidence log

| Date | Task | Evidence | Result |
|---|---|---|---|
| 2026-09-28 | — | Plan v2 đã chốt kiến trúc N model, per-model texture source, preview fallback và scene-level coordinator | Design ready; implementation chưa bắt đầu |

| 2026-09-28 | TTS-001/TTS-002/TTS-004/TTS-005/TTS-006/TTS-007/TTS-009/TTS-010 | Python 20 tests, Vitest 55 tests, typecheck/build pass; Lao Chải 4,681-tile pyramid; synthetic benchmark 0.107 s / ~63.0 MiB peak RSS; inventory bounds and frustum gating regressions covered | Automated evidence complete; browser visual/metric acceptance, detail-atlas eviction and priority weighting remain pending |

| 2026-09-28 | TTS-006/TTS-007/TTS-008/TTS-010 follow-up | Vitest 55 tests; stale cancellation, unsafe separator rejection, atlas readiness, CPU bitmap budget and request budget regressions pass. | Detail-atlas eviction, priority weighting and browser visual/metric checks remain pending |
