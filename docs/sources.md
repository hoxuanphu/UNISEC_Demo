# Nguồn tham chiếu

> Trạng thái: Hiện hành · Phụ trách: PO / RS · Cập nhật: 2026-10-02

## Tài liệu gốc

`../references/` (tính từ gốc repo demo) là thư mục tham khảo cục bộ nằm cùng cấp hai repo, được cấp riêng và không nằm trong Git của demo. Các liên kết S01–S04 chỉ mở trên máy có tài liệu gốc; bản clone sử dụng nội dung đã đối chiếu trong docs.

| Mã | Tài liệu | Dùng để xác định |
|---|---|---|
| S01 | [VinSpace SIC2026 proposal](../../references/SIC2026/VinSpace_SIC2026_proposal.pdf), 5 trang | Mục tiêu dài hạn, người dùng, phương pháp dự kiến |
| S02 | [DEAR SIC2026](../../references/SIC2026/DEAR_SIC2026.docx), mục 1–6 | Phạm vi demo, đầu vào và hạn bàn giao |
| S03 | [WebApp direction](../../references/SIC2026/DEAR_SIC2026_WebApp.pdf), 12 trang | Giao diện, nhóm chức năng và mốc kiểm tra |
| S04 | [QTT1](../../references/QTT/QTT1.png), [QTT2](../../references/QTT/QTT2.png) | Cơ hội phát triển sau SIC; chưa xác nhận đơn vị ban hành/phê duyệt |

**Phạm vi SIC theo S02/S03.** Các năng lực dài hạn trong S01 không tự động trở thành việc phải xong trước 2026-10-20. S04 chưa phải phạm vi đối tác đã giao.

## Áp dụng proposal vào demo

| Nội dung S01 | Trang | Quyết định cho SIC |
|---|---|---|
| Cộng đồng cô lập sau thiên tai miền núi; người dùng là cơ quan ứng phó/chính quyền | 1–2 | Giữ làm bài toán chính |
| Chuẩn bị nền → kích hoạt → phân tích → sản phẩm hỗ trợ quyết định | 2 | Demo phần xem/so sánh/bàn giao từ dữ liệu chuẩn bị trước |
| SAR, ảnh quang học, GPM, AW3D30, OSM, dân cư, VDDMA | 3 | Chỉ dùng nguồn đã nhận, kiểm tra và có quyền sử dụng |
| Điểm cô lập, tối ưu tuyến, vùng đáp trực thăng | 2–3 | Hiện demo tuyến chuẩn bị trước. Tính tuyến/cô lập và bãi đáp cần dữ liệu đã kiểm tra |
| Bản đồ ưu tiên cứu trợ trong 3–6 giờ | 1–2 | Mục tiêu cần đo; chưa công bố là kết quả đạt |
| GeoPackage/PDF | 2–4 | SIC ưu tiên PNG; PDF làm thêm khi ổn định |
| Bản đồ minh họa và giới hạn phương pháp | 3–5 | Hình giả lập phải có nhãn; ghi giới hạn theo dữ liệu thực |

Kết quả đối chiếu thông số và trích dẫn: [rà soát nguồn](quality/source-review.md). Giữ nguyên PDF gốc.

## Bản đồ và ký hiệu

Đối chiếu lại ngày 02/10/2026: Hình 1 ở trang 2 là quy trình tạo sản phẩm; Hình 2 ở trang 3 là bản đồ ưu tiên cứu hộ bằng dữ liệu giả lập. Các giai đoạn xử lý không trở thành các menu bắt buộc của người trực.

| Tham chiếu | Áp dụng vào web | Phần chưa có dữ liệu |
|---|---|---|
| Proposal, Hình 2 | Ảnh nền, cộng đồng, mức ưu tiên, tình trạng đường và phương án tiếp cận trong một bản đồ | Cô lập được đánh giá, đường được xác nhận đi được, vùng sạt lở/ngập, bãi đáp trực thăng |
| Ảnh UNOSAT Nepal tháng 8/2026 do người dùng cung cấp; [trang sản phẩm](https://unosat.org/products/4256) | Ký hiệu theo loại đối tượng, nhãn có halo, thống kê tác động gọn, lớp và chú giải tập trung | Không đưa số liệu, ảnh hoặc hình học của Nepal vào dữ liệu Chế Tạo; trang web cần JavaScript nên chưa kiểm tra được đầy đủ tương tác |
| [UNOSAT Nepal, 01/10/2024](https://unosat.org/static/unosat_filesystem/3990/UNOSAT_A3_Natural_Protrait_FL20240928NPL_01Oct2024.pdf) | Tách nước thường xuyên và vùng nước phát hiện theo ngày; ghi phạm vi phân tích, nguồn, ngày ảnh và tình trạng kiểm chứng | Chỉ tham khảo phương pháp trình bày; đây là sản phẩm khác sự kiện năm 2026 |

Màu xanh lá của proposal dành cho đường đi được. Trạng thái `open` của bộ hiện tại chỉ có nghĩa **chưa có báo cáo tắc đường**, nên web dùng nét trung tính. Điểm nghi sạt lở không thay cho polygon vết sạt lở; cộng đồng ưu tiên không thay cho kết luận cô lập. Bãi đáp cần vị trí và đánh giá phù hợp trước khi hiển thị ký hiệu H.

## Nguồn còn thiếu hoặc cần xác nhận

| Nội dung | Người xử lý | Nơi theo dõi |
|---|---|---|
| Khu vực, ảnh, độ cao, hai tuyến và bằng chứng theo sự kiện | RS / AI / PO | [Công việc dữ liệu, nguồn và bằng chứng](tasks/sic-2026.md) |
| Quyền truy cập DMC/ALOS, cách tính điểm cô lập, phép đo 3–6 giờ | RS / AI | [Kế hoạch sau SIC](../../vsp-eo-platform/docs/plans/dear-pilot.md) |
| Đầu mối QTT và nguồn gốc S04 | PO / RS | [Kế hoạch sau SIC](../../vsp-eo-platform/docs/plans/dear-pilot.md) |
| `DEAR_SIC2026_WebApp_MVP_v8_Workstreams.pdf` được S02 nhắc tới | PO / RS | Chưa có trong `references` |

Lịch chung kết đã đối chiếu ngày 2026-09-24 với [UNISEC](https://unisec-global.org/sic.html). Nguồn kỹ thuật được dẫn ngay tại quy tắc hoặc kết luận sử dụng.

Quy tắc bản đồ, mặt cắt và đối chiếu từng yếu tố của Hình 2: [hiển thị bản đồ](product/cartography.md).
