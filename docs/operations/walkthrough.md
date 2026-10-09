# Luồng trình diễn DEAR

Thời lượng: sáu phút. Dùng dữ liệu mô phỏng Chế Tạo.

Mở đầu tiếng Việt: “Đây là tình huống mô phỏng để trình diễn cách đánh giá tác động, ưu tiên địa bàn và kiểm tra phương án tiếp cận.”

Tiếng Anh: “This prepared incident demonstrates how an operator reviews impacts, prioritises communities and checks access routes.”

| Thời gian | Thao tác | Ý chính để trình bày bằng tiếng Anh |
|---|---|---|
| 00:00–00:40 | Mở Sự kiện, xem thời điểm và AOI | This is the assessment area and the information available at 09:31. |
| 00:40–01:30 | Chọn Nậm Khắt | A blocked road and lost contact make Nậm Khắt a priority for follow-up. |
| 01:30–02:30 | Trong Tiếp cận, mở **So sánh tuyến**, so đường chính với đường vòng | The main road is blocked. The bypass needs a crossing check. Its travel estimate assumes the crossing is passable. |
| 02:30–03:20 | Chọn đoạn vượt khe, mở bản ghi | Here is the observation behind the road status, including its source and time. |
| 03:20–04:20 | Chuông, Xem chi tiết, Cập nhật bản đồ | The new report blocks the crossing. Applying it updates roads, access and priorities together. No mapped route is now available, so there is no travel estimate. |
| 04:20–05:10 | Mở mốc dữ liệu, xem bản ban đầu rồi trở về bản mới | We can compare the situation before and after the report without losing the update. |
| 05:10–06:00 | Lưu đánh giá, xuất PNG hoặc in/lưu PDF | The output records the map, assessment, sources and data time for coordination. |

Người xem cần nắm được: **địa bàn nào cần xử lý, đường nào cản trở, cần kiểm tra gì, tin mới làm thay đổi phương án thế nào**. Giữ Tiếp cận làm màn hình chính. Mở So sánh tuyến tại chỗ, Căn cứ khi cần đối chiếu nguồn.

## Đối chiếu proposal

| Giai đoạn | Phần trình diễn | Phần chưa tích hợp |
|---|---|---|
| Chuẩn bị | Ảnh nền, địa hình, mạng đường | SAR tham chiếu, bản đồ nhạy cảm sạt lở |
| Kích hoạt | Sự kiện và thời điểm trigger | GPM, yêu cầu ảnh DMC |
| Phân tích | Tác động đường, ưu tiên, tuyến và căn cứ | Xử lý SAR/AI, Community Isolation Score |
| Quyết định | Bản đồ ưu tiên, H đề xuất, bản xuất online/offline | Dữ liệu duyệt, điểm số rủi ro/ưu tiên chuẩn hóa, GeoPackage |

Demo chứng minh luồng ứng phó trên web. Chưa chứng minh pipeline vệ tinh hoặc thời gian xử lý 3–6 giờ.

## Khi cần xem thêm

| Nội dung | Thao tác |
|---|---|
| Địa hình | Chọn đường hoặc địa bàn, mở mặt cắt, đọc độ cao/dốc tại vị trí rồi chuyển 3D/2D. Đây là độ dốc DEM, không phải khảo sát mặt đường |
| Nguồn dữ liệu | Trong Lớp bản đồ, mở thông tin của lớp. Phân biệt ngày ảnh với thời điểm tổng hợp |
| So ảnh | Chỉ trình diễn với cặp trước/sau đã được RS duyệt. Bỏ bước này nếu chưa có ảnh phù hợp |
| Bãi đáp | Tìm “bãi đáp”, mở H. Đây là vị trí đề xuất, chưa khảo sát |
| Dự phòng | Nếu 3D lỗi, dùng 2D. Nếu mất mạng, dùng gói offline |
| Lặp lại | Trong Cài đặt, chọn Đặt lại phiên làm việc |

Trước buổi demo: duyệt nội dung với RS/PO, thử đúng máy trình chiếu và URL Vercel, chuẩn bị gói offline/video. Xem [cách chạy offline](offline.md), [cách tính tuyến và ưu tiên](../architecture/response-analysis.md).

## Chuẩn bị và chạy

Cài/build theo [README](../../README.md), sau đó chạy `npm run serve:workspace` trong `DEM_to_3D/viewer` và mở `http://127.0.0.1:5212`. Có thể trình diễn gói prepared với `npm run dev` mà không có API riêng. Tập trên đúng máy/browser, thử mất mạng và lỗi 3D, xuất bản đánh giá rồi đặt lại phiên để chạy lượt thứ hai.

Mã NR-18/PR-7/T-5 là mã mô phỏng, không phải số hiệu đường chính thức. H là vị trí đề xuất chưa khảo sát. Nếu rút ngắn, giữ địa bàn, so tuyến, tin mới và bản xuất; chỉ mở mặt cắt/3D khi cần. So ảnh cần cặp được duyệt; GeoPackage chưa triển khai.

Trình diễn KML/AOI/catalog là phần mở rộng sau luồng ứng phó, tại [workspace GIS](../product/geodata-workspace.md). Import không sửa tình huống hoặc công bố kết quả phân tích. [Kế hoạch và công việc](../tasks/sic-2026.md) giữ các điều kiện bàn giao còn thiếu.
