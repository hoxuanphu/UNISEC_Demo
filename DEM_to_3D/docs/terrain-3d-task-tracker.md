# Task Tracker — Terrain 3D Viewer và Profile địa hình

Tài liệu này chuyển các quyết định trong [`terrain-3d-profile-plan.md`](terrain-3d-profile-plan.md) thành danh sách công việc có thể triển khai và theo dõi.

## Quy ước

- **Status**: `TODO`, `IN PROGRESS`, `BLOCKED`, `DONE`.
- **Priority**: `P0` bắt buộc cho MVP, `P1` quan trọng, `P2` cải tiến sau MVP.
- Chỉ chuyển task sang `DONE` khi đã có kiểm thử hoặc bằng chứng kiểm tra tương ứng.

## Tổng quan tiến độ

| Phase | Nội dung | Status |
|---|---|---|
| 1 | Asset contract v1 | DONE |
| 2 | Cập nhật Python exporter | DONE |
| 3 | Viewer 3D cơ bản | DONE |
| 4 | Surface profile | DONE |
| 5 | Vertex profile bổ sung | DONE |
| 6 | Phân tích extrema và slope | DONE |
| 7 | Kiểm thử, hiệu năng và hardening | IN PROGRESS |

---

## Phase 1 — Asset contract v1

| ID | Task | Priority | Depends on | Status |
|---|---|---:|---|---|
| AC-001 | Chốt `schema_version: 1` và tên các file asset: `.glb`, `.terrain.json`, `.grid.bin` | P0 | — | DONE |
| AC-002 | Chốt scene axes: `X=east`, `Y=up`, `Z=-north` | P0 | AC-001 | DONE |
| AC-003 | Chốt `world_origin` chỉ áp dụng cho hai trục ngang; không dùng `origin_z` | P0 | AC-002 | DONE |
| AC-004 | Định nghĩa `base_elevation`, `exaggeration`, `normalize_base` và công thức render/inverse | P0 | AC-003 | DONE |
| AC-005 | Định nghĩa `grid_transform` theo Rasterio/Affine với `pixel_reference: center` | P0 | AC-001 | DONE |
| AC-006 | Định nghĩa inverse affine tổng quát cho raster rotation/shear | P0 | AC-005 | DONE |
| AC-007 | Định nghĩa binary grid: Float32, little-endian, row-major, shape `[rows, cols]` | P0 | AC-001 | DONE |
| AC-008 | Chốt `NaN` là encoding nodata cho grid v1 | P0 | AC-007 | DONE |
| AC-009 | Định nghĩa `sampling_method`, `source_step`, `byte_length`, min/max elevation | P1 | AC-007 | DONE |
| AC-010 | Định nghĩa CRS gồm authority/code, Proj4 hoặc WKT và linear unit | P0 | AC-001 | DONE |
| AC-011 | Định nghĩa `analysis_supported` cho analysis asset và visual-only asset | P0 | AC-010 | DONE |
| AC-012 | Viết JSON Schema hoặc validator runtime cho metadata v1 | P0 | AC-001..AC-011 | DONE |
| AC-013 | Viết tài liệu asset contract và tạo một metadata fixture hợp lệ | P1 | AC-012 | DONE |

### Tiêu chí hoàn thành Phase 1

- Có schema/validator kiểm tra được metadata.
- Có fixture JSON v1 hợp lệ.
- Tất cả phép đổi `scene ↔ projected ↔ raster ↔ WGS84` đều có quy ước duy nhất.
- Không còn trường mơ hồ như `transform` không ghi convention hoặc `origin_z`.

**Bằng chứng triển khai (2026-09-23):** `terrain.schema.json`, validator runtime
`terrain_contract.py`, tài liệu `docs/terrain-asset-contract-v1.md` và fixture
`viewer/public/terrain.terrain.json` + `terrain.grid.bin`.

---

## Phase 2 — Cập nhật Python exporter

| ID | Task | Priority | Depends on | Status |
|---|---|---:|---|---|
| EXP-001 | Sửa `build_mesh()` để vertex dùng pixel-center convention | P0 | AC-005 | DONE |
| EXP-002 | Sửa `downsample()` với nearest subsampling và affine shift | P0 | AC-005 | DONE |
| EXP-003 | Kiểm tra mask/nodata sau downsample theo cùng grid convention | P0 | EXP-002, AC-008 | DONE |
| EXP-004 | Tính và chọn `world_origin` gần tâm vùng dữ liệu | P0 | AC-003 | DONE |
| EXP-005 | Đổi vertex sang scene coordinates trước `mesh.export()` | P0 | EXP-004, AC-002 | DONE |
| EXP-006 | Xuất `base_elevation` và các tham số elevation vào metadata | P0 | AC-004 | DONE |
| EXP-007 | Ghi transform cuối pipeline sau reprojection, crop và downsample | P0 | AC-005 | DONE |
| EXP-008 | Xuất elevation grid Float32 little-endian, row-major | P0 | AC-007, AC-008 | DONE |
| EXP-009 | Ghi `NaN` cho nodata trong grid xuất | P0 | EXP-003, AC-008 | DONE |
| EXP-010 | Ghi metadata cùng lần export với GLB và BIN | P0 | AC-001 | DONE |
| EXP-011 | Kiểm tra CRS projected và linear unit trước khi tạo analysis asset | P0 | AC-010, AC-011 | DONE |
| EXP-012 | Xử lý `--keep-geographic`: visual-only hoặc từ chối analysis asset | P1 | EXP-011 | DONE |
| EXP-013 | Ghi trạng thái `hole-mode fill/mask` vào metadata | P1 | AC-009 | DONE |
| EXP-014 | Tạo CLI/log rõ ràng cho số vertex, triangle, grid shape, transform và origin | P1 | EXP-010 | DONE |
| EXP-015 | Viết test exporter cho DEM north-up và DEM có nodata | P0 | EXP-001..EXP-010 | DONE |
| EXP-016 | Giữ dải overlap một pixel khi cắt theo ranh giới để các mesh kề nhau không tạo khe | P0 | EXP-003, EXP-013 | DONE |

### Tiêu chí hoàn thành Phase 2

- Export được một bộ asset gồm `.glb`, `.terrain.json`, `.grid.bin`.
- Tọa độ trong GLB là tọa độ local/recentered, không còn UTM lớn.
- Grid và mesh dùng cùng sampling/transform.
- Metadata đọc được bằng validator và byte length khớp file thực tế.
- `py_compile` và các test exporter chạy thành công.

**Bằng chứng triển khai (2026-09-23):** `dem_to_3d.py` ghi bộ asset v1 trong
một lần export; test DEM north-up có nodata nằm tại `tests/test_exporter.py`.

---

## Phase 3 — Viewer 3D cơ bản

| ID | Task | Priority | Depends on | Status |
|---|---|---:|---|---|
| VIEW-001 | Khởi tạo React + TypeScript + Vite viewer | P0 | AC-013 | DONE |
| VIEW-002 | Cài Three.js, GLTFLoader, OrbitControls và `three-mesh-bvh` | P0 | VIEW-001 | DONE |
| VIEW-003 | Tạo `terrain/types` cho metadata và asset contract | P0 | AC-012, VIEW-001 | DONE |
| VIEW-004 | Load song song GLB, JSON và BIN | P0 | EXP-010, VIEW-002 | DONE |
| VIEW-005 | Validate schema, shape, dtype, byte length và asset id | P0 | VIEW-003, VIEW-004 | DONE |
| VIEW-006 | Áp scene axes và world origin đúng contract | P0 | AC-002, AC-003, VIEW-005 | DONE |
| VIEW-007 | Khởi tạo camera, ánh sáng, material và OrbitControls | P0 | VIEW-002 | DONE |
| VIEW-008 | Tích hợp BVH cho raycast mesh lớn | P0 | VIEW-002, VIEW-004 | DONE |
| VIEW-009 | Throttle hover bằng `requestAnimationFrame` | P1 | VIEW-008 | DONE |
| VIEW-010 | Viết module `coordinate.ts` tập trung mọi phép đổi tọa độ | P0 | AC-002, AC-005, AC-010 | DONE |
| VIEW-011 | Raycast và hiển thị projected coordinate khi hover | P0 | VIEW-008, VIEW-010 | DONE |
| VIEW-012 | Tính row/column gần nhất bằng inverse affine | P0 | AC-006, VIEW-010 | DONE |
| VIEW-013 | Nội suy cao độ từ grid hoặc barycentric fallback | P0 | VIEW-004, VIEW-012 | DONE |
| VIEW-014 | Chuyển projected CRS sang WGS84 bằng Proj4 metadata | P0 | AC-010, VIEW-010 | DONE |
| VIEW-015 | Xây tooltip phân biệt điểm con trỏ và pixel gần nhất | P1 | VIEW-011..VIEW-014 | DONE |
| VIEW-016 | Dispose geometry/material/texture khi unload asset | P1 | VIEW-004 | DONE |

### Tiêu chí hoàn thành Phase 3

- Load được asset fixture.
- Orbit, pan, zoom hoạt động.
- Hover hiển thị projected coordinate, WGS84, cao độ và pixel gần nhất.
- Raycast không làm giảm trải nghiệm dưới mục tiêu hiệu năng đã đặt.

**Bằng chứng triển khai (2026-09-23):** viewer trong `viewer/` có tải song song,
runtime validation, `three-mesh-bvh`, raycast throttle bằng animation frame,
transform/inverse affine tổng quát, Proj4 WGS84 và dispose khi unload. TypeScript
đã typecheck; đo FPS thực tế sẽ thuộc Phase 7.

---

## Phase 4 — Surface profile

| ID | Task | Priority | Depends on | Status |
|---|---|---:|---|---|
| PROF-001 | Tạo chế độ `Measure profile` tách khỏi OrbitControls | P0 | VIEW-007 | DONE |
| PROF-002 | Chọn điểm đầu/cuối bằng raycast | P0 | VIEW-008, VIEW-011 | DONE |
| PROF-003 | Tính chiều dài tuyến trong projected CRS | P0 | VIEW-010, PROF-002 | DONE |
| PROF-004 | Tính phương vị từ `delta_easting`, `delta_northing` | P1 | PROF-002 | DONE |
| PROF-005 | Sinh sample cách đều theo `sample_interval_m` | P0 | PROF-003 | DONE |
| PROF-006 | Chuyển sample projected → raster bằng inverse affine | P0 | AC-006, VIEW-010 | DONE |
| PROF-007 | Nội suy bilinear từ elevation grid | P0 | VIEW-004, PROF-006 | DONE |
| PROF-008 | Đánh dấu sample nodata khi vùng nội suy chứa NaN | P0 | AC-008, PROF-007 | DONE |
| PROF-009 | Tách profile thành các segment liên tục | P0 | PROF-008 | DONE |
| PROF-010 | Vẽ polyline 3D bám địa hình từ các sample | P0 | VIEW-006, PROF-007 | DONE |
| PROF-011 | Tách polyline khi profile gặp nodata | P0 | PROF-009, PROF-010 | DONE |
| PROF-012 | Tạo dữ liệu chart raw profile | P0 | PROF-009 | DONE |
| PROF-013 | Đồng bộ sample/chart marker với marker trên 3D | P1 | PROF-010, PROF-012 | DONE |

### Tiêu chí hoàn thành Phase 4

- Chọn được hai điểm trên terrain.
- Có thông tin chiều dài và phương vị.
- Chart có trục khoảng cách–cao độ thực.
- Polyline bám bề mặt, không nối xuyên qua nodata.
- Chart và polyline dùng cùng sample/segment index.

---

## Phase 5 — Vertex profile bổ sung

| ID | Task | Priority | Depends on | Status |
|---|---|---:|---|---|
| VERT-001 | Trích xuất vị trí vertex trong scene/projected coordinates | P1 | EXP-005, VIEW-010 | DONE |
| VERT-002 | Tính `t` và khoảng cách vuông góc tới tuyến | P1 | PROF-002, VERT-001 | DONE |
| VERT-003 | Tính tolerance theo kích thước cell sau downsample | P1 | EXP-002, VERT-002 | DONE |
| VERT-004 | Lọc vertex trong đoạn tuyến và sort theo khoảng cách | P1 | VERT-002, VERT-003 | DONE |
| VERT-005 | Gộp/lọc vertex trùng, bỏ `delta_s <= epsilon` | P1 | VERT-004 | DONE |
| VERT-006 | Map vertex về row/column bằng inverse affine | P1 | AC-006, VERT-004 | DONE |
| VERT-007 | Hiển thị vertex profile riêng trên chart | P1 | VERT-005, PROF-012 | DONE |
| VERT-008 | Thêm tùy chọn xuất `vertex_grid_index` cho debug | P2 | EXP-008, VERT-006 | TODO |

### Tiêu chí hoàn thành Phase 5

- Vertex mode đáp ứng yêu cầu “tuyến cắt qua vertex nào”.
- Không phụ thuộc vào thứ tự vertex trong GLB.
- Các điểm trùng không gây `delta_s = 0`.
- Vertex profile được phân biệt với surface profile trên UI/chart.

---

## Phase 6 — Phân tích extrema và slope

| ID | Task | Priority | Depends on | Status |
|---|---|---:|---|---|
| ANA-001 | Thêm cấu hình `profile_sample_interval_m` | P0 | PROF-005 | DONE |
| ANA-002 | Thêm smoothing window theo mét | P1 | PROF-012 | DONE |
| ANA-003 | Tạo và lưu `rawElevation`/`smoothedElevation` | P1 | ANA-002 | DONE |
| ANA-004 | Phát hiện ứng viên cực đại/cực tiểu cục bộ | P1 | ANA-003 | DONE |
| ANA-005 | Lọc theo prominence và minimum distance | P1 | ANA-004 | DONE |
| ANA-006 | Xử lý plateau, đầu/cuối tuyến và segment ngắn | P1 | ANA-005 | DONE |
| ANA-007 | Tìm lại vị trí/cao độ cực trị trên raw profile | P1 | ANA-005 | DONE |
| ANA-008 | Tính slope từng đoạn theo phần trăm và góc | P0 | PROF-012 | DONE |
| ANA-009 | Bỏ đoạn nodata hoặc `delta_s <= epsilon` khi tính slope | P0 | ANA-008 | DONE |
| ANA-010 | Tính `approach_slope` bằng hồi quy tuyến tính | P1 | ANA-007 | DONE |
| ANA-011 | Tính `departure_slope` bằng hồi quy tuyến tính | P1 | ANA-007 | DONE |
| ANA-012 | Trả `null` khi cửa sổ regression không đủ sample | P1 | ANA-010, ANA-011 | DONE |
| ANA-013 | Đồng bộ marker extrema giữa chart và 3D | P1 | ANA-007, PROF-013 | DONE |
| ANA-014 | Xây bảng chi tiết đỉnh/đáy và độ dốc hai phía | P1 | ANA-010..ANA-013 | DONE |

### Tiêu chí hoàn thành Phase 6

- Có raw/smoothed profile.
- Đỉnh/đáy không bị đánh dấu do nhiễu nhỏ ngoài ngưỡng.
- Vị trí/cao độ báo cáo lấy lại từ profile gốc.
- Có slope từng đoạn và slope hai phía tại cực trị.
- Không tính slope qua nodata hoặc khoảng cách bằng 0.

---

## Phase 7 — Kiểm thử, hiệu năng và hardening

| ID | Task | Priority | Depends on | Status |
|---|---|---:|---|---|
| TEST-001 | Tạo DEM tổng hợp mặt phẳng `z = a*x + b*y + c` | P0 | EXP-015 | DONE |
| TEST-002 | Test round-trip projected ↔ raster ↔ projected | P0 | TEST-001, VIEW-010 | DONE |
| TEST-003 | Test cao độ nội suy trên mặt phẳng | P0 | TEST-001, PROF-007 | DONE |
| TEST-004 | Test slope tham chiếu theo hướng tuyến | P0 | TEST-001, ANA-008 | DONE |
| TEST-005 | Test nearest downsample và affine shift với `step=1,2,4` | P0 | EXP-002 | DONE |
| TEST-006 | Test nodata, hole, crop xã/phường và `hole-mode fill` | P0 | EXP-003, EXP-013, PROF-008 | DONE |
| TEST-007 | Test tuyến ngang, dọc, chéo và tuyến rất ngắn | P0 | PROF-005 | DONE |
| TEST-008 | Test tuyến nằm ngoài mesh | P1 | PROF-002, PROF-009 | DONE |
| TEST-009 | Test GLB/JSON/BIN mismatch và validator | P0 | AC-012, VIEW-005 | DONE |
| TEST-010 | Đo sai số chiều dài tuyến và phương vị | P1 | PROF-003, PROF-004 | DONE |
| TEST-011 | Đo FPS hover với mesh khoảng 1 triệu triangle | P1 | VIEW-008, VIEW-009 | BLOCKED |
| TEST-012 | Đo thời gian tạo profile tuyến điển hình | P1 | PROF-012 | DONE |
| TEST-013 | Đo asset size và thời gian load | P1 | VIEW-004 | DONE |
| TEST-014 | Kiểm tra dispose khi đổi asset nhiều lần | P1 | VIEW-016 | DONE |
| TEST-015 | Chỉ cân nhắc Web Worker, full-res grid, Meshopt hoặc Draco sau profiling | P2 | TEST-011..TEST-014 | BLOCKED |
| TEST-016 | Regression test hai mảnh địa giới kề nhau có dải vertex/mặt overlap, không tạo khe đen khi ghép | P0 | EXP-016 | DONE |

### Ngưỡng nghiệm thu MVP

- Round-trip projected → raster → projected: dưới `0.25 pixel` trong test affine; tối đa `1 pixel` khi qua raycast/float32.
- Cao độ trên mặt phẳng tổng hợp: sai số tuyệt đối dưới `1e-3 m` trong phép tính grid double-precision.
- Slope: sai số tuyệt đối dưới `0.1 percentage point` hoặc `0.1°` so với tham chiếu.
- Chiều dài: sai số tương đối dưới `0.1%`, kèm ngưỡng tuyệt đối `0.1 m` cho tuyến ngắn.
- Không nối chart/polyline qua nodata.
- Hover đạt tối thiểu `30 FPS` trên cấu hình phần cứng mục tiêu.
- Tạo profile điển hình dưới `200 ms` trên cấu hình mục tiêu.

---

## Backlog sau MVP

| ID | Task | Priority | Status |
|---|---|---:|---|
| BL-001 | Profile từ full-resolution grid riêng | P2 | TODO |
| BL-002 | Resample bilinear/average thay cho nearest subsampling | P2 | TODO |
| BL-003 | Xuất `terrain.mask.bin` phân loại nodata | P2 | TODO |
| BL-004 | Web Worker cho profile/extrema nếu profiling cần | P2 | TODO |
| BL-005 | Meshopt/Draco compression cho GLB | P2 | TODO |
| BL-006 | Hỗ trợ nhiều asset và chuyển terrain không reload trang | P2 | TODO |
| BL-007 | Export báo cáo profile/slope CSV hoặc JSON | P2 | TODO |
| BL-008 | Hiển thị tên xã/phường tại vị trí hover | P2 | TODO |

## Quy tắc cập nhật tracker

1. Khi bắt đầu task, đổi `Status` thành `IN PROGRESS` và ghi người thực hiện/ngày bắt đầu trong commit hoặc issue tương ứng.
2. Khi gặp blocker, đổi thành `BLOCKED` và ghi nguyên nhân cùng task phụ thuộc.
3. Khi hoàn thành, ghi test hoặc artifact xác minh trong commit/PR.
4. Không đánh dấu task cha hoàn thành nếu còn task con P0 chưa hoàn tất.
**Implementation evidence (2026-09-26, refreshed):** Phase 7 deterministic coverage is in `tests/test_phase7.py` (10 Phase 7 tests; 16 Python tests total) and `viewer/src/terrain/phase7.test.ts` (10 Phase 7 tests; 31 Vitest tests total across 7 files). The suites cover synthetic affine planes, projected/raster round-trip, plane interpolation, reference slope, nearest downsample steps 1/2/4, nodata/hole/fill/crop, horizontal/vertical/diagonal/short/outside profiles, GLB/JSON/BIN mismatch seams, URL identity, early sidecar rejection, GLB geometry counts, schema declarations, malformed metadata, repeated resource disposal, and adjacent-tile boundary overlap. The complete Python suite passes `16/16`; the complete Vitest suite passes `31/31`; TypeScript typecheck and production build both exit successfully. `tools/phase7_benchmark.py` (run 2026-09-26) produced profile `7.6851 ms` for 2,000 samples, metadata validation `0.0958 ms`, offline asset load `14.7334 ms`, and total asset size `813,911` bytes; profile target `<200 ms` is PASS. Raw output is `docs/phase7-benchmark.json` and interpretation is in `docs/phase7-validation-report.md`. `TEST-011` remains `BLOCKED` because this environment has no browser/WebGL benchmark harness; therefore `TEST-015` remains blocked/deferred and no FPS claim is made. The production build retains only the existing large Three.js chunk advisory. Earlier P2 debug export `VERT-008` remains deferred.

**Implementation evidence (2026-09-26):** Fixed the adjacent-tile boundary gap in `dem_to_3d.py`. Commune rasterization now supports `boundary_pixels`, and `load_commune_mask()` uses a one-pixel dilation so independently exported meshes share a boundary band. Added `TEST-016` in `tests/test_phase7.py`; the focused regression test and the complete Python suite pass (`16/16`). Existing assets must be re-exported to receive the corrected topology.
