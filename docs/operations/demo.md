# Demo ứng phó

Cập nhật: 2026-10-07.

Dùng bộ dữ liệu mô phỏng Chế Tạo. Mở đầu nói rõ phạm vi này. Mục tiêu trình diễn là đánh giá địa bàn và phương án tiếp cận, chưa phải điều phối thực địa.

| Thời gian | Thao tác | Điều cần thể hiện |
|---|---|---|
| 00:00–00:40 | Sự kiện, mở vùng đánh giá nếu cần | Mưa kích hoạt đánh giá sạt lở. AOI khác phạm vi DEM. Dữ liệu đến 09:31 |
| 00:40–01:30 | Chọn **Nậm Khắt** trong danh sách ưu tiên | Ưu tiên cao do báo cáo chặn đường và mất liên lạc. Việc tiếp theo là kiểm tra phương án tiếp cận |
| 01:30–02:30 | **Tiếp cận → So sánh tuyến**, chọn đường chính và đường vòng | Đường chính bị chặn. Đường vòng cần xác minh điểm vượt khe. Thời gian là ước tính với giả định đi qua được |
| 02:30–03:20 | Chọn đoạn vượt khe, mở **Xem bản ghi** | Phân biệt quan sát, nhận tin, ảnh hưởng và điều chưa xác minh. X đóng về đúng ngữ cảnh |
| 03:20–04:15 | Chuông, **Xem chi tiết**, **Cập nhật bản đồ** | Đọc tin không đổi bản đồ. Áp dụng tin 09:45 tính lại tuyến và đánh giá. Hai tuyến đã biết có đoạn bị chặn, ETA bị bỏ |
| 04:15–05:10 | Mặt cắt, thử 3D khi cần | Đọc độ cao và vị trí tương ứng trên bản đồ. Độ dốc DEM không phải độ dốc mặt đường đã khảo sát |
| 05:10–06:00 | **Lưu đánh giá**, xem trước và tải PNG/JSON | Bản xuất giữ tuyến đang chọn, trạng thái sau tin 09:45 và căn cứ. Tuyến bị chặn không có ETA |

Nguồn và phương pháp: [phân tích ứng phó](../architecture/response-analysis.md). Mã NR-18/PR-7/T-5 là mã mô phỏng, không đọc chúng như số hiệu đường chính thức. Ký hiệu H là vị trí hạ cánh đề xuất, chưa khảo sát.

Nếu cần rút ngắn, giữ địa bàn, tuyến và tin mới. So ảnh cần cặp GeoTIFF được duyệt, chưa có sẵn trong gói. PDF dùng bản in trình duyệt; GeoPackage chưa triển khai.

## Chuẩn bị

```powershell
cd DEM_to_3D/viewer
npm ci
npm test
npm run test:dataset
npm run test:api
npm run build
npm run serve:workspace
```

Mở `http://127.0.0.1:5212`. Lệnh cuối chạy web cùng API đọc snapshot tại máy. `npm run dev` dùng gói prepared, không cần API riêng.

- Tập trên đúng máy và trình duyệt trình chiếu. Thử một lượt khi ngắt Internet và một lượt cập nhật bản tin.
- 2D mặc định không cần WebGL. GLB/GPU lỗi chuyển về 2D và giữ địa bàn đang xem.
- Tải lại để trở về snapshot 09:31. Giữ ảnh/video cùng phiên bản cho lỗi ngoài phạm vi đã thử.

[Tiến độ SIC](../tasks/sic-2026.md) tách chức năng mô phỏng đã chạy khỏi dữ liệu và nghiệm thu còn thiếu.
