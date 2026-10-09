# Hợp đồng dữ liệu

Cập nhật: 2026-10-07. Gói mặc định: [Chế Tạo v0.2](../../DEM_to_3D/viewer/public/scenarios/che-tao/v0.2/manifest.json), dữ liệu mô phỏng ở trạng thái `draft`.

## Gói hiện hành

| File | Trách nhiệm |
|---|---|
| `manifest.json` | Phiên bản, sự kiện, snapshot, CRS, số đối tượng, URL, kích thước và SHA-256 |
| `incident.json` | Sự kiện, AOI, địa bàn, đường, điểm ảnh hưởng, nguồn, liên lạc, điểm ứng phó, báo cáo mới và giả định di chuyển |
| `incident-v1.schema.json` | JSON Schema draft-07 kiểm tra cấu trúc. Prepared và API dùng chung |
| GLB, grid, metadata | Mô hình 3D, lưới độ cao và phép biến đổi tọa độ |
| PNG nền cục bộ | Trích từ texture GLB đã kiểm tra, dùng cho bản đồ 2D độc lập |

[Schema thực thi](../../DEM_to_3D/viewer/public/scenarios/incident-v1.schema.json) và [validator](../../DEM_to_3D/viewer/src/data/incidentPacket.ts) là chuẩn cho gói đang chạy. Ajv kiểm tra schema và định dạng thời gian theo [tài liệu chính thức](https://ajv.js.org/guide/formats.html).

| Quy ước hiện tại | Giá trị |
|---|---|
| Tọa độ | `{x, y}` theo EPSG:32648, đơn vị m |
| Hình học | Đường gồm ít nhất hai điểm, AOI là vòng kín có diện tích. Đầu mút trùng tọa độ tạo kết nối mạng |
| Chiều dài | `len` và `lengthKm` là km, tính từ hình học. Độ cao m, độ dốc % |
| Thời gian nguồn | ISO 8601 có múi giờ. `detected` là chuỗi hiển thị cũ; bản ghi evidence giữ giờ quan sát và nhận tin |
| Dữ liệu thiếu | Bỏ trường tùy chọn hoặc không có tuyến. Không dùng 0 thay cho giá trị chưa biết |
| Phiên bản | `schemaVersion` là định dạng, `datasetVersion` là nội dung. Không ghép gói nghiệp vụ và manifest khác phiên bản |
| Loại dữ liệu | `synthetic`, `historical`, `operational`. Mô phỏng không tự chuyển thành dữ liệu vận hành |

Ưu tiên, tuyến và ETA được tính từ gói, không lưu sẵn như kết luận cố định trong JSON. Phương pháp tại [phân tích ứng phó](response-analysis.md).

## Chọn bộ dữ liệu

`public/workspace-config.json` chọn manifest trước khi build. Bản tĩnh trên Vercel không cần API:

```json
{
  "dataSource": "prepared",
  "manifestUrl": "/scenarios/che-tao/v0.2/manifest.json"
}
```

| Trường | Quy tắc |
|---|---|
| `dataSource` | `prepared` đọc packet từ manifest; `api` đọc endpoint theo ID sự kiện trong manifest |
| `manifestUrl` | Đường dẫn cục bộ `/scenarios/.../manifest.json`. Không nhận URL ngoài, query hoặc đường dẫn vượt thư mục. Bỏ trường chỉ để tương thích bản cấu hình cũ |
| `offline` | Boolean tùy chọn. Gói offline đặt `true` và tắt nền mạng mặc định |
| `incident.title` | Tên sự kiện tùy chọn `[vi, en]`. Thiếu thì dùng “Sự kiện”/“Incident”; không lấy tên sự kiện mẫu |

Loader, kiểm dữ liệu trước build, server thử và đóng gói đều đọc cùng lựa chọn. Khi sửa JSON phải cập nhật kích thước/SHA-256 trong manifest. Cấu hình chọn bộ hợp lệ trong contract v1, chưa phải catalog nhiều CRS hoặc lịch sử công bố. Bộ được chọn lỗi phải báo lỗi, không tự đổi về Chế Tạo.

## Kiểm tra và tham chiếu

| Kiểm tra | Điều kiện |
|---|---|
| ID | Không trùng trong từng loại. Đường, báo cáo và bằng chứng tham chiếu đến đối tượng tồn tại |
| Thời gian | Quan sát trước nhận tin. Nguồn nền không vượt snapshot. Báo cáo mới thuộc snapshot tiếp theo |
| Đường | Chiều dài khớp hình học. Đoạn bị chặn phải có điểm ảnh hưởng liên quan |
| AOI | Vòng kín, diện tích khác 0. Địa bàn ngoài AOI không vào tổng hợp ưu tiên |
| Liên lạc | Mỗi địa bàn có bản ghi tín hiệu, kể cả giá trị `unknown` |
| Giả định ETA | Tốc độ dương, khoảng min/max hợp lệ. Đoạn bị chặn không có ETA thực thi |
| File | Kích thước và checksum khớp manifest. Nghiệp vụ và địa hình cùng CRS |

Liên hệ cần truy được: **địa bàn, tuyến, đoạn đường, điểm ảnh hưởng, bản ghi nguồn**. Nghi sạt lở gần đường không tự chứng minh đường bị chặn. Dân số tham chiếu không phải số người bị ảnh hưởng.

## API snapshot

| Endpoint | Kết quả |
|---|---|
| `GET /api/v1/incidents/{id}/workspace` | Cùng cấu trúc `incident.json` |
| `GET /api/v1/schema/incident-v1` | Schema của gói |
| `GET /api/health` | Trạng thái và phiên bản dữ liệu |

Chạy bằng `npm run serve:workspace` sau build. Đây là dịch vụ cục bộ chỉ đọc. Chưa có tiếp nhận tin, xử lý ảnh, phân quyền hoặc lưu thay đổi. `workspace-config.json` chọn nguồn `prepared` hoặc `api`; API lỗi phải báo lỗi, không lấy bộ mô phỏng thay thế.

Luồng ghi sản phẩm cần contract riêng cho nhiều báo cáo và assessment có phiên bản, xem [tiếp nhận dữ liệu](../../../vsp-eo-platform/docs/architecture/response-publication.md). Đây là thiết kế dự kiến, thuộc [kế hoạch nghiên cứu backend](../../../vsp-eo-platform/docs/plans/roadmap.md#backend-và-worker), không triển khai trong đợt demo hiện tại. Không thêm báo cáo tùy ý vào packet v1 hoặc đổi cờ `updated` rồi coi là đã lưu backend.

## Mở rộng cho dữ liệu thực

[Danh mục trường dự kiến](../../../vsp-eo-platform/docs/architecture/response-publication.md#trường-dữ-liệu) bổ sung GeoJSON WGS84, sensor/ngày ảnh, footprint, mây/nodata, provenance DEM và hệ độ cao, quyền dùng, trạng thái duyệt, người kiểm tra và điều kiện phương tiện. Đường được xác nhận đi được cần nguồn, thời điểm và loại phương tiện. AOI, vùng quan sát và vùng ảnh hưởng là ba hình học khác nhau.

RS/PO duyệt nội dung trước công bố. Kiểm tra schema không thay cho kiểm chứng dữ liệu hoặc nghiệm thu nghiệp vụ.
