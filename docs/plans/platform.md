# Lộ trình nền tảng viễn thám

Cập nhật: 2026-10-08. Định hướng đã chọn, các đợt sau SIC chưa chốt lịch. [SIC](sic-2026.md) tiếp tục là bản bàn giao gần nhất. [Rà source](../architecture/source-structure.md) ghi việc cần sửa trong code.

Tiến độ demo ở [công việc SIC](../tasks/sic-2026.md), khả năng và cách dùng GIS ở [công cụ dữ liệu GIS](../product/geodata-workspace.md). Tài liệu này chỉ giữ thứ tự phát triển và điều kiện chuyển đợt.

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

Dữ liệu và CRS theo [kiến trúc GIS](../architecture/geospatial-platform.md), trường dữ liệu theo [data fields](../architecture/data-fields.md). Không duy trì bản đặc tả thứ hai trong kế hoạch.
