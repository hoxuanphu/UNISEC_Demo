# Thuật ngữ giao diện

Cập nhật: 2026-10-06. Áp dụng cho bản đồ, panel, thông báo và bản xuất Việt/Anh.

## Phân biệt thông tin

| Khái niệm | Cách dùng |
|---|---|
| Báo cáo hiện trường / Field report | Thông tin ghi nhận tại khu vực: đất đá, nước ngập, khả năng phương tiện đi qua. Có báo cáo chưa đồng nghĩa đã xác minh |
| Phân tích ảnh vệ tinh / Satellite image analysis | Nhận định từ ảnh. Tách thời điểm thu nhận ảnh và nhận kết quả phân tích |
| Nguồn dữ liệu / Data source | Người, đơn vị, nhà cung cấp hoặc bộ dữ liệu. Không gọi mã phiên bản hay phương án tính tuyến là nguồn |
| Báo cáo / Report | Tên bản báo cáo được dùng cho nhận định. Không thay thế danh tính người/đơn vị báo tin |
| Tổng hợp lúc / Data as of | Mốc của bản dữ liệu đang xem. Không phải thời điểm tất cả đối tượng được khảo sát hay ngày ảnh vệ tinh |
| Tuyến gợi ý / Suggested route | Kết quả tính trên mạng đường hiện có, chưa phải lệnh điều phối hoặc tuyến đã xác nhận an toàn |

`IncidentEvidence.source` hiện lưu tên báo cáo/tài liệu phân tích, chưa có người hoặc đơn vị cung cấp. Giao diện dùng nhãn **Báo cáo** hoặc **Tài liệu phân tích** cho trường này. Không bổ sung danh tính hoặc trạng thái xác minh từ nội dung mô phỏng.

## Nhãn nhất quán

| Vị trí | Nhãn |
|---|---|
| Thời gian báo cáo | Ghi nhận / Observed; Tiếp nhận / Received |
| Thời gian phân tích | Thu nhận ảnh / Image acquired; Nhận kết quả / Result received |
| Mở căn cứ | Xem báo cáo / View report; Xem phân tích / View analysis |
| Đường chưa rõ khả năng đi qua | Cần xác minh; chi tiết ghi Chưa xác minh khả năng đi qua |
| Đường có chướng ngại đã được báo | Bị chặn / Blocked |
| Đường chưa có báo cáo chặn | Chưa ghi nhận chặn / No blockage reported. Không đổi thành An toàn hoặc Đi được |
| Khu dân cư | Thôn, bản ở lớp/chú giải; Địa bàn ở danh sách xử lý |
| Ranh giới tổng hợp | Vùng đánh giá. Phạm vi sạt lở/ngập cần dữ liệu riêng |
| Điều khiển | Phóng to, Thu nhỏ, Xem toàn khu vực, Mở/Ẩn bảng thông tin |
| Mặt cắt | Độ cao tăng, Độ cao giảm, Tỷ lệ tuyến có DEM, Độ dốc địa hình |

Tên đối tượng → tình trạng → ghi nhận → việc cần làm. Nguồn và phương pháp mở khi cần. Hướng dẫn phải chỉ đúng đoạn đường hoặc đối tượng, không dùng “chưa rõ” khi chưa rõ điều gì. Giữ thuật ngữ chuyên môn như DEM, SAR, hệ tọa độ và phương vị tại nơi phân tích liên quan.

## Căn cứ đối chiếu

- [ArcGIS Damage Assessment](https://doc.arcgis.com/en/arcgis-solutions/latest/reference/use-damage-assessment.htm): tách gửi báo cáo, giao khảo sát và quản lý đánh giá.
- [ArcGIS Emergency Management Operations](https://doc.arcgis.com/en/arcgis-solutions/latest/reference/use-emergency-management-operations.htm): sự kiện → đánh giá ảnh hưởng → thông tin ứng phó; thông báo ngắn và rõ hành động.
- [UNOSAT, Kham, 02/08/2025](https://unosat.org/static/unosat_filesystem/4166/UNOSAT_A3_Natural_Landscape_TC20250722LAO_KhamDistrict_2Aug2025.pdf): phân biệt nguồn ảnh, ngày thu nhận, đơn vị phân tích, vùng phân tích và phạm vi sạt lở. Phân tích sơ bộ chưa được kiểm chứng tại hiện trường.

Các nhãn tiếng Việt trên là quy ước của DEAR dựa trên cách phân loại thông tin trong các nguồn này.
