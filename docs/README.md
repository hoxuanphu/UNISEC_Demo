# Tài liệu DEAR

## Tài liệu theo công việc

| Cần biết | Đọc tài liệu | Người dùng chính |
|---|---|---|
| Trình diễn bản hiện hành thế nào? | [Luồng trình diễn](operations/walkthrough.md) | Cả nhóm |
| Chạy gói offline thế nào? | [Gói offline](operations/offline.md) | SW, PO |
| Đưa web lên Vercel thế nào? | [Deploy Vercel](operations/vercel.md) | SW |
| Đích bàn giao SIC là gì? | [Yêu cầu sản phẩm](product/requirements.md) | Cả nhóm |
| Màn hình và thao tác thế nào? | [Thiết kế giao diện](product/interface.md) | Cả nhóm |
| Quy tắc màu, thành phần và bản đồ lấy từ đâu? | [Design system](product/design-system.md) | PO, SW |
| Ký hiệu, nhãn và mặt cắt theo quy tắc nào? | [Hiển thị bản đồ](product/cartography.md) | SW, RS, AI |
| Khi nào bàn giao, cần đầu vào gì? | [Kế hoạch SIC](plans/sic-2026.md) | Cả nhóm |
| Ai đang làm gì, còn thiếu gì? | [Danh sách công việc](tasks/sic-2026.md) | Cả nhóm |
| Thế nào là hoàn thành? | [Tiêu chí nghiệm thu](quality/acceptance.md) | Cả nhóm |
| Luồng ứng phó hiện tại đã ổn chưa? | [Rà soát giao diện](quality/workspace-review.md) | PO, SW, RS |
| Cần cải thiện gì về GIS, viễn thám và skill hỗ trợ? | [Đánh giá GIS và viễn thám](quality/gis-review.md) | PO, SW, RS, AI |
| Dùng công nghệ gì, chia phần mềm thế nào? | [Kiến trúc hệ thống](architecture/overview.md) | SW, AI |
| Source đã chia hợp lý chưa, sửa theo nguyên tắc nào? | [Cấu trúc mã](architecture/source-structure.md) | SW, AI |
| Từ demo lên platform viễn thám theo thứ tự nào? | [Lộ trình platform](plans/platform.md) | Cả nhóm |
| Công cụ GIS/viễn thám dài hạn dùng gì, quản lý CRS và nguồn ảnh thế nào? | [Nền tảng GIS và viễn thám](architecture/geospatial-platform.md) | SW, RS, AI, PO |
| Backend cần xây gì, chọn công nghệ và triển khai thế nào? | [Kế hoạch backend](plans/backend.md), chỉ nghiên cứu | SW, AI, RS, PO |
| Luồng nhập trên bản đồ/admin cần dữ liệu và API gì? | [Tiếp nhận và công bố dữ liệu](architecture/data-ingestion.md), thiết kế dự kiến | SW, AI, RS, PO |
| Mức ưu tiên và tuyến được tính từ đâu? | [Phân tích ứng phó](architecture/response-analysis.md) | Cả nhóm |
| Bản đồ và nhận định được lưu thế nào? | [Bản xuất đánh giá](architecture/decision-export.md) | SW, PO, RS |
| Dữ liệu bàn giao theo định dạng nào? | [Đặc tả dữ liệu](architecture/data-contract.md) | SW, AI, RS |
| Khi viết schema cần những trường nào? | [Danh mục trường](architecture/data-fields.md) | SW, AI |
| Sau SIC phát triển gì với QTT? | [Kế hoạch thử nghiệm thực tế](plans/pilot.md) | PO, RS |
| Thông tin lấy từ đâu, điểm nào cần sửa? | [Nguồn tham chiếu](sources.md), [rà soát nguồn](quality/source-review.md) | PO, RS, AI |

[Đánh giá prototype ngày 29/09](quality/dear-ux-review.md) là tài liệu lưu trữ. Quy tắc hiện hành nằm ở yêu cầu sản phẩm, thiết kế giao diện và design system.

## Thuật ngữ chung

| Tên dùng trong tài liệu | Nghĩa |
|---|---|
| PO / SW / AI / RS | Phụ trách sản phẩm / phần mềm / xử lý dữ liệu bằng AI / BA kiêm viễn thám |
| AOI | Khu vực được chọn để phân tích và trình diễn |
| Bộ dữ liệu, phiên bản | Các file dùng cho một tình huống; thay nội dung đã công bố thì tạo phiên bản mới |
| Nhận định / bằng chứng | Điều app kết luận / ảnh, báo cáo hoặc kết quả kiểm tra làm căn cứ |
| Biểu đồ độ cao dọc tuyến | Độ cao lấy mẫu theo chiều dài tuyến; tài liệu kỹ thuật gọi là `profile` |
| ETA | Thời gian di chuyển ước tính, kèm phương tiện và giả định |
| SAR / DEM | Ảnh radar vệ tinh / dữ liệu độ cao; phân biệt DSM và DTM trong đặc tả dữ liệu |
| Bản tóm tắt | Bản đồ, tuyến chọn, bằng chứng và điểm chưa rõ để bàn giao; giao diện gọi là `Briefing` |
| G1–G4 / Pxx / Dxx / Axx | Mốc kiểm tra / yêu cầu sản phẩm / công việc / tiêu chí nghiệm thu |

## Quy tắc cập nhật

- Mỗi file phụ trách một chủ đề. Kế hoạch ghi mốc; danh sách công việc ghi tiến độ; nghiệm thu ghi cách kiểm tra. Các file khác dẫn link, không chép lại.
- Viết tiếng Việt; giữ tên công nghệ và tên trường trong phần kỹ thuật. Mỗi dòng bảng hoặc gạch đầu dòng nêu một việc, một quy tắc hoặc một kết quả cần có.
- `Đề xuất`: chưa chốt. `Hiện hành`: đang dùng để phối hợp. Trạng thái tài liệu không phải trạng thái hoàn thành phần mềm.
- Giữ nguyên ID P/D/A khi sửa tên. Công việc hoàn thành phải có link đầu ra hoặc kết quả kiểm tra.
- Dùng ngày `YYYY-MM-DD`. Cập nhật ngày khi sửa nội dung; Git lưu lịch sử. Giữ nguyên tài liệu gốc trong [`references`](../references/).
- Ảnh/sơ đồ đặt trong `assets/` cạnh file sử dụng, có chú thích; phân biệt ảnh minh họa với dữ liệu thực.
- Chỉ commit ảnh tham chiếu được dẫn trong docs. Ảnh kiểm thử phát sinh đặt ở `references/SIC2026/DEAR-review-captures/` đã ignore, không cập nhật hàng loạt ảnh sau mỗi lần chỉnh CSS.
