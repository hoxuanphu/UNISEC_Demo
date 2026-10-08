# Lộ trình nền tảng viễn thám

Cập nhật: 2026-10-08. Định hướng đã chọn, các đợt sau SIC chưa chốt lịch. [SIC](sic-2026.md) tiếp tục là bản bàn giao gần nhất. [Rà source](../architecture/source-structure.md) ghi việc cần sửa trong code.

## Hiện tại tới đâu?

| Phần | Đã có | Còn thiếu |
|---|---|---|
| Workspace ứng phó | Sự kiện, đường ảnh hưởng, ưu tiên, tuyến, căn cứ, bản xuất, 2D/3D | Thử với cán bộ trực, dữ liệu và quy tắc được duyệt |
| Công cụ GIS | Tìm kiếm, sáu kiểu đo, tọa độ, mặt cắt, lớp/nhãn, so GeoTIFF; nhập KML/GeoJSON/WKT, AOI/footprint và độ phủ | Sửa/lưu lớp nghiệp vụ, catalog nhiều bộ dữ liệu, CRS được kiểm bằng điểm chuẩn |
| Kiến trúc frontend | Feature, repository, schema/checksum, snapshot độc lập, contract map chung, reducer điều hướng/công cụ, cấu hình dataset, module ghép panel/hộp thoại riêng | Tách geo/domain/renderer, phân tích địa hình và phần CSS còn chung. Catalog nhiều bộ dữ liệu thực |
| Nguồn và viễn thám | Metadata/manifest, kiểm file, cấu trúc dự kiến cho nguồn và phương pháp | Ảnh/DEM có nguồn và quyền dùng, SAR/quang học, job tái lập và QA chuyên môn |
| Backend | Kế hoạch NestJS/PostGIS/Python, contract ghi dự kiến | Chưa triển khai API ghi, lưu trữ, tài khoản, duyệt/công bố hoặc worker |
| Phát hành | CI kiểm dữ liệu/unit/browser, build và gói offline, cấu hình Vercel | Xác nhận GitHub Actions của bản phát hành, URL deploy và chạy trên máy trình chiếu |

Không tính phần mềm demo hoàn thành thành nghiệm thu dữ liệu thực. Tiến độ SIC chi tiết ở [danh sách công việc](../tasks/sic-2026.md).

## Thứ tự xây dựng

| Đợt | Công việc | Điều kiện qua đợt |
|---|---|---|
| 1. Chốt SIC | Duyệt dữ liệu/căn cứ, sửa lỗi chặn luồng, kiểm bản xuất, tập và deploy | Một luồng sáu phút chạy lặp lại được online/offline. Bản đồ, panel và bản xuất cùng bộ dữ liệu |
| 2. Nền frontend | Tách điều hướng/công cụ, geo/domain, cấu hình dataset, CSS theo feature. Kiểm hai bộ dữ liệu | Thay sự kiện qua repository, không sửa UI hoặc thuật toán. Chọn/đo/mặt cắt giữ trạng thái và không xung đột |
| 3. Contract và catalog | Chốt v2: Project, AOI, Dataset, Asset, Layer, Evidence, AnalysisRun, PublishedRevision. Seed nhỏ có metadata thực | Một asset được tìm, xem footprint/nguồn/chất lượng, dùng trong phân tích và truy ngược từ kết quả. Adapter v1 vẫn chạy SIC |
| 4. Nhập và công bố | Khi quyết định triển khai: NestJS/PostGIS, object storage, quyền ghi/duyệt, lịch sử và công bố nguyên tử | Gửi báo cáo, tải lại vẫn còn. Tin chưa duyệt không đổi bản công bố. Hai người xem cùng revision, xung đột không ghi đè |
| 5. Phân tích viễn thám | Worker Python/GDAL/PROJ, COG, job có trạng thái, input/output và method version. Tích hợp Copernicus rồi GEE theo nhu cầu | Chạy lại từ cùng đầu vào/phương pháp, kiểm mask/nodata/CRS/độ phân giải. Lỗi job giữ bản công bố trước |
| 6. Bản đồ platform | OpenLayers/Cesium qua adapter, dữ liệu lớn, projection, style/legend và quyền nguồn | Đo, chọn, nhãn, lớp, profile, export và fallback đạt kiểm tra tương đương trước khi bỏ engine cũ |
| 7. Vận hành thực | Sao lưu/khôi phục, audit log, giới hạn tài nguyên, giám sát, thử người dùng và phương pháp | Khôi phục được dự án, truy được quyết định và đầu vào, người sử dụng hoàn thành tác vụ thực tế |

Các đợt có thể nghiên cứu song song, nhưng không thêm màn admin hoặc backend vào demo khi chưa quyết định triển khai. Phạm vi API và phương án deploy ở [kế hoạch backend](backend.md).

## UI theo công việc

| Workspace | Người sử dụng | Luồng chính |
|---|---|---|
| Ứng phó | Cán bộ trực và điều phối | Nhận sự kiện, xem ảnh hưởng, chọn địa bàn, kiểm tuyến/căn cứ, lập đánh giá |
| Phân tích | Chuyên viên GIS/viễn thám | Chọn AOI và ảnh, kiểm chất lượng, chạy phương pháp, so kết quả, chuyển duyệt |
| Dữ liệu | Người quản lý và người duyệt | Nhập nguồn/lớp, kiểm metadata, xem thay đổi, duyệt và công bố |

Dùng chung project, catalog, hệ lớp và revision. Màn ứng phó giữ thông tin cần quyết định. Tham số xử lý ảnh và metadata chuyên sâu nằm trong phân tích hoặc chi tiết nguồn. UI bám [design system](../product/design-system.md) và [cartography](../product/cartography.md), kiểm thao tác/bàn phím/spacing bằng browser trước khi chốt.

## Dữ liệu cần chuẩn hóa từ đầu

| Nhóm | Quy tắc |
|---|---|
| Dataset/Asset | ID ổn định, version, provider, license, footprint, thời gian thu nhận, checksum và file gốc. Tách asset khỏi lớp hiển thị |
| Hệ tọa độ | Lưu CRS gốc, trục, đơn vị, phép chuyển và độ chính xác. VN2000 cần tham số đúng khu vực. Kiểm bằng điểm chuẩn trước khi hỗ trợ |
| Raster/DEM | Band, nodata, pixel spacing, resolution, processing level, quality mask. DEM có DSM/DTM, đơn vị và vertical datum |
| Kết quả | Input IDs/revisions, method/config version, thời gian xử lý, output assets, chất lượng và người duyệt |
| Lớp bản đồ | Nhóm/thứ tự, phạm vi zoom, style, legend, nguồn và thời gian từ layer registry dùng chung cho map/export |
| Công bố | Revision bất biến chứa bộ dữ liệu và kết quả khớp nhau. Draft tách published. Map, panel và bản xuất tham chiếu cùng revision |

Catalog ảnh định hướng theo [OGC STAC](https://www.ogc.org/standards/stac/), raster truy cập từng phần theo [GDAL COG](https://gdal.org/en/stable/drivers/raster/cog.html). Đây là chuẩn áp dụng khi triển khai catalog/raster, chưa phải chứng nhận tương thích của demo. Trường dữ liệu dự kiến ở [data fields](../architecture/data-fields.md), quy tắc khoa học ở [kiến trúc GIS](../architecture/geospatial-platform.md).

Đợt nền frontend đã có điều hướng/công cụ và cấu hình dataset. Fixture thứ hai kiểm tên sự kiện, AOI, tình trạng đường, quay lại địa bàn và JSON xuất; vẫn dùng địa hình Chế Tạo, chưa chứng minh hỗ trợ nhiều CRS hoặc khu vực thực.

Đã tách panel/hộp thoại khỏi composition và có `geo/vector` độc lập renderer cho kiểm hình học/phần giao/độ phủ. [Công cụ dữ liệu GIS](../product/geodata-workspace.md) mở riêng không cần DEM hoặc API tình huống. Tiếp theo: catalog adapter theo AOI, contract v2 bằng metadata một bộ ảnh thực, rồi QA mây/nodata và phương pháp phân tích. Tách địa hình khỏi renderer và duyệt dữ liệu SIC vẫn cần làm. Backend tiếp tục ở mức kế hoạch.
