# Công cụ DEM và asset địa hình

Chạy các lệnh exporter tại thư mục `DEM_to_3D/` sau khi cài các thư viện Python mà exporter sử dụng. Hướng dẫn chạy web ở [README demo](../README.md).

```powershell
# Cơ bản: xuất obj/stl/ply/glb
python dem_to_3d.py --input dem.tif --output terrain

# Tô màu theo cao độ, chỉ xuất glb
python dem_to_3d.py --input dem.tif --output terrain --colormap terrain --formats glb
```

## Asset contract v1 và viewer

Exporter hiện tạo đồng bộ ba file cho viewer: `terrain.glb`,
`terrain.terrain.json` và `terrain.grid.bin`. GLB dùng trục `X=east, Y=up,
Z=-north` và được recenter trước khi ghi; grid là Float32 little-endian,
row-major, `NaN` là nodata.

```powershell
# Kiểm tra metadata + byte length của grid
python terrain_contract.py che_tao_v2_tex.terrain.json

# Chạy viewer từ DEM_to_3D (sau khi npm ci trong viewer)
cd viewer
npm run dev
```

Viewer React/Vite kiểm tra metadata, tải GLB/BIN, kiểm tra schema/shape/byte
length và dựng MapControls + BVH raycast. Web DEAR hiển thị địa hình, đường,
địa bàn và tuyến trên bản đồ; thông tin chi tiết mở khi chọn đối tượng. Xem contract tại
[`DEM_to_3D/docs/terrain-asset-contract-v1.md`](docs/terrain-asset-contract-v1.md).

### Upload và ghép nhiều mảnh terrain

Viewer hỗ trợ hai chế độ trong panel `Upload terrain models`: `Single model`
và `Merge models`. Có thể chọn `.glb`/`.gltf` cùng các tài nguyên `.bin`,
texture và sidecar `.terrain.json`. Để ghép đúng các mảnh DEM, giữ cùng basename:

```text
tile-a.glb
tile-a.terrain.json
tile-a.grid.bin
```

Bật `Auto-place by geographic coordinates` để viewer dùng `crs`,
`world_origin`, `elevation.base_elevation` và `elevation.exaggeration` từ từng
sidecar. Các model phải dùng cùng CRS projected và đơn vị mét; viewer từ chối
ghép nếu CRS khác nhau hoặc thiếu metadata thay vì đặt cạnh theo thứ tự file.
GLB/GLTF không có sidecar vẫn xem được ở chế độ visual-only; phân tích profile
chỉ bật khi có đủ metadata và grid.

## Cắt theo địa giới hành chính xã/phường

Shapefile sẵn có: `DEM_to_3D/Shapefile_PX_VN_34/` (3321 xã/phường toàn quốc, WGS84).

```powershell
# Chạy từ thư mục DEM_to_3D

# 1) Liệt kê các xã nằm trong khu vực DEM
python dem_to_3d.py --input dem.tif --output terrain `
    --commune-shp "Shapefile_PX_VN_34\Việt Nam (phường xã) - 34.shp" --commune list

# 2) Cắt theo 1 xã (khớp theo TÊN hoặc MÃ xã)
python dem_to_3d.py --input dem.tif --output tam_dao `
    --commune-shp "Shapefile_PX_VN_34\Việt Nam (phường xã) - 34.shp" `
    --commune "Tam Đảo" --colormap terrain --formats glb

# 3) Ghép nhiều xã (dấu phẩy) + đệm 200m quanh ranh giới
#    Xã trùng tên giữa các tỉnh: ghi rõ "Tên xã|Tên tỉnh"
python dem_to_3d.py --input dem.tif --output terrain `
    --commune-shp "Shapefile_PX_VN_34\Việt Nam (phường xã) - 34.shp" `
    --commune "Tân Lập|Điện Biên, Thanh Bình" --commune-buffer 200
```

Vùng **ngoài** ranh giới xã sẽ thành lỗ (hole) trên mesh — dùng `--hole-mode mask` (mặc định). Kết hợp được với `--texture`, `--colormap`, `--exaggeration` như thường lệ.

Khi xuất các xã thành các model riêng để ghép trong viewer, exporter tự giữ thêm một dải pixel overlap quanh biên. Dải này giúp các mesh kề nhau có mặt chồng tại đường ranh, tránh khe đen do hai mesh chỉ kết thúc ở tâm các pixel kế cận.

## Dữ liệu lớn không commit vào git

Repo cố tình **không track** các file dữ liệu nguồn và asset sinh ra (xem `.gitignore`).
Sau khi clone, cần đặt lại các file sau vào đúng vị trí trước khi chạy:

| File / thư mục | Vị trí | Ghi chú |
|---|---|---|
| Shapefile địa giới 34 tỉnh | `DEM_to_3D/Shapefile_PX_VN_34/` | 5 file `.shp .shx .dbf .prj .cpg` (~114 MB) — nguồn nội bộ, không phân phối lại (truy cập: https://gis.vn/ban-do-hanh-chinh-viet-nam) |
| DEM nguồn | `DEM_to_3D/*.tif` | VD `LaoCai_34Tinh_DEM_SRTM_30m.tif` (SRTM 30m, tải từ nguồn công khai) (truy cập: https://gis.vn/dem-viet-nam-srtm-30m-v3-nasa-usgs)|
| Ảnh vệ tinh texture | `DEM_to_3D/*.tif` | VD `sentinel2_..._raw_rgb321_geo.tif` (Sentinel-2) |
| Asset terrain sinh ra | `DEM_to_3D/*.glb .grid.bin .terrain.json` | Tái tạo bằng `dem_to_3d_v2.py` (lệnh mẫu bên dưới) |

Danh mục xã/phường tham chiếu: `DEM_to_3D/danh_sach_xa.csv` (đã track trong git).

### Asset mẫu chính (đã commit)

Bộ mẫu `che_tao_v2_tex` trong `DEM_to_3D/` là asset chuẩn để kiểm tra nhanh viewer
(schema v1 đầy đủ: `.glb` + `.grid.bin` + `.terrain.json`):

```text
DEM_to_3D/che_tao_v2_tex.glb            # mesh 3D xã Chế Tạo, Lào Cai (có texture)
DEM_to_3D/che_tao_v2_tex.grid.bin       # lưới cao độ Float32 LE row-major
DEM_to_3D/che_tao_v2_tex.terrain.json   # metadata: CRS, world_origin, shape grid
```

Web tự mở bộ Chế Tạo khi khởi động. Để đổi mô hình, mở **Cài đặt hiển thị**, chọn
**Mô hình địa hình**, chọn chế độ `Single model` rồi tải cả ba file của mô hình mới.

### Tái tạo asset cho xã khác

```powershell
# Chạy từ thư mục DEM_to_3D
python dem_to_3d_v2.py --input .\LaoCai_34Tinh_DEM_SRTM_30m.tif `
    --output <ten_xa>_v2_tex `
    --commune-shp "Shapefile_PX_VN_34\Việt Nam (phường xã) - 34.shp" `
    --commune "<Tên xã>|<Tỉnh>" --formats glb --step 1 `
    --texture .\sentinel2_VN15_2024-11-27_2025-07-26_raw_rgb321_geo.tif `
    --texture-crop-bbox <ten_xa>_v2_tex.texture.tif
```
