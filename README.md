# UNISEC_Demo

## Cài đặt toàn bộ repository

Các bước dưới đây dành cho Windows PowerShell và cài đủ môi trường cho cả
`MODFI`, pipeline `DEM_to_3D` và viewer React/Vite.

### Yêu cầu hệ thống

- Git.
- Python **3.10 trở lên** (khuyến nghị Python 3.12, 64-bit).
- Node.js **18 trở lên** và npm.
- Bộ nhớ và dung lượng đĩa tùy thuộc kích thước DEM/ảnh texture; các file dữ
  liệu lớn không được lưu trong Git.

Kiểm tra công cụ trước khi cài:

```powershell
git --version
python --version
node --version
npm --version
```

### 1. Tạo môi trường Python

Chạy tại thư mục gốc repository:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
```

Cài thư viện cho MODFI và các công cụ DEM/GeoTIFF:

```powershell
.\.venv\Scripts\python.exe -m pip install -r .\MODFI\requirements.txt
.\.venv\Scripts\python.exe -m pip install numpy rasterio affine pyshp trimesh pillow matplotlib
```

Nếu muốn kích hoạt môi trường cho phiên PowerShell hiện tại:

```powershell
.\.venv\Scripts\Activate.ps1
```

Nếu PowerShell chặn script kích hoạt, có thể tiếp tục dùng đường dẫn
`.\.venv\Scripts\python.exe` như các lệnh trong README; không cần thay đổi
chính sách hệ thống.

### 2. Cài viewer web

```powershell
Set-Location .\DEM_to_3D\viewer
npm install
```

Chạy kiểm tra frontend:

```powershell
npm test
npm run typecheck
npm run build
```

Khởi động viewer trong quá trình phát triển:

```powershell
npm run dev
```

Vite sẽ in URL local (thường là `http://localhost:5173`). Giữ terminal này
đang chạy khi mở viewer trên trình duyệt. Quay lại thư mục gốc bằng
`Set-Location ..\..` nếu cần chạy các lệnh Python tiếp theo.

### 3. Bổ sung dữ liệu ngoài Git

Sau khi clone, đặt DEM, ảnh texture/SAR và đủ 5 file shapefile (`.shp`, `.shx`,
`.dbf`, `.prj`, `.cpg`) vào đúng vị trí được mô tả trong mục
[Dữ liệu lớn không commit vào git](#dữ-liệu-lớn-không-commit-vào-git). Không đổi
 tên hoặc đường dẫn nếu muốn dùng các lệnh mẫu có sẵn. Bộ asset mẫu
`che_tao_v2_tex` đã được commit nên có thể kiểm tra viewer mà chưa cần DEM
nguồn.

### 4. Kiểm tra cài đặt

Từ thư mục gốc repository:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s .\MODFI -p "test_photo_azimuth.py"
.\.venv\Scripts\python.exe -m unittest discover -s .\DEM_to_3D\tests -p "test_*.py"
Set-Location .\DEM_to_3D\viewer
npm test
npm run typecheck
npm run build
```

Nếu chỉ dùng một phần của repository, có thể cài tương ứng: MODFI cần
`MODFI\requirements.txt`, còn các script DEM cần nhóm thư viện Python ở trên;
viewer chỉ cần Node.js và `npm install` trong `DEM_to_3D\viewer`.

## MODFI — Đọc góc phương vị camera từ ảnh

Script [`MODFI/photo_azimuth.py`](MODFI/photo_azimuth.py) đọc `GPSImgDirection`
và `GPSImgDirectionRef` từ EXIF của ảnh HEIC/HEIF hoặc JPEG/TIFF có EXIF.
Không suy ra hướng từ nội dung ảnh, tọa độ GPS, hướng di chuyển hoặc hướng đến đích.

```powershell
.\.venv\Scripts\python.exe -m pip install -r .\MODFI\requirements.txt
# Mặc định đọc MODFI\IMG_0724.HEIC; có thể chạy từ thư mục bất kỳ:
.\.venv\Scripts\python.exe .\MODFI\photo_azimuth.py
# Hoặc truyền ảnh khác:
.\.venv\Scripts\python.exe .\MODFI\photo_azimuth.py "C:\images\photo.HEIC"
# Kiểm thử:
.\.venv\Scripts\python.exe -m unittest discover -s .\MODFI -p "test_photo_azimuth.py"
```

Kết quả JSON chứa `azimuth_deg` (độ theo chiều kim đồng hồ: Bắc = 0, Đông = 90,
Nam = 180, Tây = 270), `north_reference` (`true` = Bắc thật, `magnetic` = Bắc từ),
hướng la bàn 8 vùng và thông tin camera. Hướng Bắc từ được giữ nguyên, không tự
hiệu chỉnh độ lệch từ. Góc là hướng camera được thiết bị ghi nhận, không phải
phép đo mới hay góc nghiêng; xoay ảnh để hiển thị không thay đổi phương vị.
Nếu thiếu hướng hoặc tham chiếu Bắc hợp lệ, script báo lỗi và trả mã thoát 1.

## DEM_to_3D — Chuyển DEM thành mô hình 3D

Chạy trong `DEM_to_3D/`:

```powershell
# Cơ bản: xuất obj/stl/ply/glb
python dem_to_3d.py --input dem.tif --output terrain

# Tô màu theo cao độ, chỉ xuất glb
python dem_to_3d.py --input dem.tif --output terrain --colormap terrain --formats glb
```

### Asset contract v1 và viewer

Exporter hiện tạo đồng bộ ba file cho viewer: `terrain.glb`,
`terrain.terrain.json` và `terrain.grid.bin`. GLB dùng trục `X=east, Y=up,
Z=-north` và được recenter trước khi ghi; grid là Float32 little-endian,
row-major, `NaN` là nodata.

```powershell
# Kiểm tra metadata + byte length của grid
python DEM_to_3D/terrain_contract.py DEM_to_3D/viewer/public/terrain.terrain.json

# Chạy viewer (sau khi npm install)
cd DEM_to_3D/viewer
npm run dev
```

Viewer React/Vite tải song song GLB/JSON/BIN, kiểm tra schema/shape/byte
length, dựng OrbitControls + BVH raycast, và hiển thị projected/WGS84, cao độ
thực cùng pixel gần nhất khi hover. Xem chi tiết contract tại
[`DEM_to_3D/docs/terrain-asset-contract-v1.md`](DEM_to_3D/docs/terrain-asset-contract-v1.md).

#### Upload và ghép nhiều mảnh terrain

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

### Cắt theo địa giới hành chính xã/phường

Shapefile sẵn có: `DEM_to_3D/Shapefile_PX_VN_34/` (3321 xã/phường toàn quốc, WGS84).

```powershell
cd DEM_to_3D

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

Để tách **GeoTIFF DEM** riêng cho từng xã/phường (không xuất model 3D):

```powershell
python DEM_to_3D/split_dem_by_commune.py
# Thử một mã xã trước khi chạy hàng loạt:
python DEM_to_3D/split_dem_by_commune.py --code 04489
# Hoặc chọn theo tên xã (trùng tên thì thêm tên tỉnh sau dấu |):
python DEM_to_3D/split_dem_by_commune.py --name "Chế Tạo"
python DEM_to_3D/split_dem_by_commune.py --name "Chế Tạo|Lào Cai"
```

Script mặc định đọc `LaoCai_34Tinh_DEM_SRTM_30m.tif` và shapefile trong `DEM_to_3D/`,
ghi vào `DEM_to_3D/commune_dem/<ten_xa>_<ma_xa>.tif` (ví dụ `Chế_Tạo_04489.tif`). Có thể đổi bằng `--dem`, `--shp`,
`--output-dir`; thêm `--overwrite` để ghi đè file đã có. `--name` khớp tên đầy đủ,
không phân biệt hoa/thường và không dùng chung với `--code`. Chỉ xuất xã có pixel
DEM hợp lệ; vùng ngoài ranh giới là NoData, giữ nguyên CRS và độ phân giải gốc.

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

Mở viewer (`cd DEM_to_3D/viewer && npm run dev`), chọn chế độ `Single model` rồi
tải cả 3 file trên vào panel upload.

### Tái tạo asset cho xã khác

```powershell
cd DEM_to_3D
python dem_to_3d_v2.py --input .\LaoCai_34Tinh_DEM_SRTM_30m.tif `
    --output <ten_xa>_v2_tex `
    --commune-shp "Shapefile_PX_VN_34\Việt Nam (phường xã) - 34.shp" `
    --commune "<Tên xã>|<Tỉnh>" --formats glb --step 1 `
    --texture .\sentinel2_VN15_2024-11-27_2025-07-26_raw_rgb321_geo.tif `
    --texture-crop-bbox <ten_xa>_v2_tex.texture.tif
```


### Chồng ảnh SAR GeoTIFF

Nạp `name.glb` và `name.terrain.json`, sau đó chọn GeoTIFF trong ô
`GeoTIFF SAR overlay`; `name.grid.bin` chỉ cần cho phân tích cao độ, không
bắt buộc để hiển thị SAR. Chọn band VV/VH (nếu có tên trong metadata),
bật/tắt `Show SAR overlay` và chỉnh `Opacity` để so sánh với texture nền.
SAR hiển thị thang xám trực tiếp trên các tam giác có sẵn của mọi model có
metadata, không tạo mesh cao độ riêng nên không z-fight với terrain.
Nút `Tắt color texture` trộn SAR với nền xám trung tính; `Bật color texture`
trộn với màu/texture gốc, kể cả tile chi tiết. Tắt SAR hoặc opacity 0 giữ
nguyên nền đã chọn. NoData và vùng ngoài raster để lộ nền, không xóa tam giác.
Tọa độ dùng origin của từng model, transform GeoTIFF (kể cả ảnh xoay) và
chuyển CRS trước khi tạo UV. Hỗ trợ CRS có sẵn trong proj4 và WGS84 UTM;
CRS thiếu/không hỗ trợ báo lỗi thay vì mặc định là kinh/vĩ độ. Model thiếu
metadata không nhận SAR. Stretch percentile 2–98% chỉ phục vụ hiển thị;
không hiệu chỉnh hay ghi lại giá trị SAR nguồn.

### Lớp đường đồng mức cao độ

Nạp model cùng `name.terrain.json` và `name.grid.bin`, bật **Đường đồng mức**
(mặc định tắt). Chọn khoảng cao độ **10 m / 20 m / 40 m** hoặc nhập số dương,
hữu hạn ở **Khoảng tùy chỉnh (m)**. Đây là chênh lệch cao độ giữa các đường,
không phải độ dày nét; các mức là bội số của khoảng tính từ cao độ tuyệt đối 0 m.
Lớp dùng cao độ DEM thật, không dùng độ sáng SAR hay màu texture. Bật/tắt lớp
hoặc đổi khoảng không dựng lại scene/camera và độc lập với SAR/color texture.
Model thiếu metadata/lưới không nhận đồng mức; nếu tất cả thiếu thì điều khiển bị vô hiệu hóa.

Đường nội suy trên hai tam giác mỗi ô theo đường chéo NE–SW giống exporter,
xử lý saddle xác định, bỏ ô có bất kỳ góc NoData và bỏ tam giác phẳng. Tọa độ
qua affine tâm pixel, world origin, base elevation, exaggeration và placement
của từng model khi ghép địa lý. Nét có depth bias nhỏ để tránh z-fight nhưng vẫn
bị địa hình phía trước che khuất. Mesh ngoài không theo triangulation/lưới trong
contract có thể không khớp; độ chi tiết phụ thuộc lưới DEM đã xuất, không phải ảnh SAR.

Tính toán chia lượt để giao diện phản hồi và hủy kết quả cũ khi đổi khoảng/tắt lớp.
Ngân sách toàn lớp: tối đa 2 triệu ô, 2 triệu đoạn và 8 triệu bước xử lý
(buffer tọa độ tối đa khoảng 48 MB, chưa tính GPU và buffer ghép tạm).
Nếu vượt giới hạn, lớp bị xóa và hiện thông báo tăng khoảng hoặc xuất lưới thưa hơn,
không âm thầm đổi khoảng/truncate. Mức trùng biên model overlap có thể chồng nét.

Nhãn chỉ ghi số cao độ (đơn vị **m**, như điều khiển khoảng cao độ), nằm tại trung
điểm theo chiều dài polyline nối liên tục; đường dài trên 100 đoạn có thêm ứng
viên tại 1/4 và 3/4 đường. Nhãn đọc cao độ DEM tuyệt đối, không phải scene Y đã
phóng đại. Chữ trắng **12 CSS px** viền xám mảnh, không nền/thẻ; xoay theo tiếp
tuyến cục bộ sau phép chiếu màn hình, chuẩn hóa góc từ −90° đến 90° để không lộn
ngược. Kích thước chữ và khung CSS **64 × 18 px** cố định khi zoom (bounding box
đã xoay thay đổi theo góc); vị trí/góc cập nhật khi orbit/pan/zoom/resize, kể cả
placement khi ghép model. Tối đa 256 ứng viên toàn lớp
(ưu tiên đường dài, chia ngân sách cho các model), 48 nhãn hiện; bỏ nhãn chồng nhau,
ngoài màn hình, sau camera hoặc bị mesh địa hình che tại điểm neo. Không phải mọi
đường đều có nhãn ở mọi góc nhìn; chỉ kiểm tra che khuất tại điểm neo, không toàn
bộ khung chữ. Tắt lớp/đổi khoảng/đổi model sẽ hủy và xóa nhãn cũ, không dựng lại
scene vì thay đổi khoảng. SAR và color texture vẫn điều khiển độc lập.

Kiểm tra: trong `DEM_to_3D/viewer`, chạy `npm test -- src/terrain/contours.test.ts src/terrain/contourLabels.test.ts`,
`npm run typecheck` và `npm run build`.

### Texture pyramid độ phân giải cao

Tạo pyramid riêng cho từng model bằng lệnh trong DEM_to_3D/docs/terrain-asset-contract-v1.md. Khi upload, chọn model files và thư mục <model>_tiles tương ứng; viewer hiển thị preview trước rồi phân bổ detail theo viewport coverage và ngân sách scene. Tile output và source imagery được ignore bởi Git.
