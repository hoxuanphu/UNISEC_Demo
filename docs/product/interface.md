# Thiết kế giao diện

Cập nhật: 2026-10-07. Áp dụng cho web React tại `DEM_to_3D/viewer`.

## Luồng ứng phó

```mermaid
flowchart LR
    A[Sự kiện và thời điểm dữ liệu] --> B[Địa bàn ưu tiên]
    B --> C[Tình trạng tiếp cận]
    C --> D[So tuyến và kiểm tra đoạn cản trở]
    D -. Khi cần .-> E[Nguồn và địa hình dọc tuyến]
    D --> I[Lưu đánh giá và bản đồ]
    F[Xem nhanh tin mới] --> G[Đọc chi tiết]
    G --> H[Cập nhật bản đồ]
    H --> C
```

Luồng này phục vụ bước phân tích và bản đồ hỗ trợ quyết định trong proposal. Các giai đoạn xử lý ảnh không trở thành menu bắt buộc của người trực.

| Người trực cần trả lời | Màn hình và hành động |
|---|---|
| Cần xử lý ở đâu trước? | Sự kiện: địa bàn ưu tiên kèm lý do. Chọn địa bàn |
| Tiếp cận thế nào, vướng ở đâu? | Chi tiết địa bàn: phương án, đoạn bị chặn/chưa rõ. Mở tuyến hoặc đoạn cần kiểm tra |
| Căn cứ đã đủ chưa? | Bản ghi nguồn và mặt cắt khi cần. Tin mới phải được áp dụng trước khi lưu đánh giá mới |

Hướng dẫn dân tới nơi an toàn cần nơi trú được xác nhận và tuyến sơ tán theo phương thức. Đây là phần chưa có trong demo, không thay bằng H đề xuất. Phạm vi mở rộng ở [nền tảng GIS](../architecture/geospatial-platform.md#ứng-phó-và-hướng-dẫn-tới-nơi-an-toàn).

## Màn hình và thông tin

| Vị trí | Thông tin chính | Mở khi cần |
|---|---|---|
| Sự kiện | Sự kiện, giờ kích hoạt, dữ liệu đến, địa bàn ưu tiên, số đoạn bị chặn/chưa rõ | Diễn biến phân tích, nguồn dữ liệu |
| Chi tiết địa bàn | Tình trạng tiếp cận, tên/trạng thái tuyến, khoảng cách/ETA có điều kiện, việc cần kiểm tra | So tuyến, lý do ưu tiên và nguồn trong Căn cứ, dân số tham chiếu |
| Tuyến | Danh sách so sánh phương án, khoảng cách, ETA có điều kiện, tình trạng từng đoạn | Địa hình dọc tuyến, nguồn của đoạn đường |
| Đường sá | Tên, trạng thái, chiều dài. Đoạn bị chặn xếp trước | Ghi nhận, việc cần xử lý, bản ghi nguồn |
| Bản đồ | AOI, nền, mạng đường, tình trạng đường, điểm ảnh hưởng, địa bàn, điểm tập kết | Thanh tìm/lớp/đo trên trái, chú giải dưới trái, nguồn sau nút thông tin |
| Lưu đánh giá | Xem trước bản đồ 2D và nhận định theo tuyến đang chọn | PNG; PDF, GeoJSON và JSON trong Định dạng khác |
| Chuông thông báo | Hộp xem nhanh tin mới | Chi tiết tin, cập nhật bản đồ, lịch sử thông báo |
| Cài đặt | Ngôn ngữ, sáng/tối, font | Quản lý mô hình địa hình, đặt lại phiên |
| Thời điểm dữ liệu trên header | Mốc bản đồ đang xem | Diễn biến và chọn bản dữ liệu trước/sau tin đã áp dụng |
| Lớp bản đồ | Nền và nhóm lớp nghiệp vụ | Độ rõ, lọc đường, nhãn địa danh, so ảnh trước/sau |

Panel bên trái chỉnh độ rộng hoặc thu gọn bằng nút đầu toolbar. Giữ tab, đối tượng và tuyến khi thu gọn. Chọn đối tượng sẽ mở lại panel. Ba tab **Sự kiện / Đường sá / Địa bàn** nằm trên panel, cùng hàng với thanh công cụ bản đồ. Mobile chuyển giữa **Thông tin** và **Bản đồ**.

Toolbar cố định: tìm kiếm và **Lớp / Đo / Vị trí** bên trái, điều hướng và **2D / 3D** bên phải. Canvas ở bên dưới. Các cửa sổ công cụ nằm trong workspace để không dịch theo canvas khi mở mặt cắt.

## Hành vi

| Thao tác | Kết quả |
|---|---|
| Đo trên bản đồ | Chuyển sang 2D, đóng lớp/mặt cắt và ẩn chú giải. Có 6 kiểu đo, bắt điểm, chỉnh đỉnh, đổi đơn vị và giữ kết quả. Không đổi tuyến hoặc căn cứ. Quy tắc tại [hiển thị bản đồ](cartography.md#đo-trên-bản-đồ) |
| Thông tin vị trí | **Vị trí** trên toolbar mở công cụ trên 2D/3D. Chọn điểm, đọc tọa độ và độ cao. Có đổi hệ tọa độ và sao chép |
| Sắp xếp công cụ | Kéo tiêu đề bảng lớp/đo/tọa độ trên desktop. Thu gọn chú giải, tắt lớp hoặc đổi chế độ nhãn trong Lớp bản đồ. Không di chuyển tọa độ đối tượng nghiệp vụ |
| Chọn địa bàn mới | Mở chi tiết và tuyến mặc định của địa bàn |
| Đổi tuyến | Đổi tuyến trên bản đồ và thông tin tuyến đang xem. Tình trạng tiếp cận chung của địa bàn vẫn dựa trên tất cả tuyến đã biết |
| Chọn số đoạn bị chặn/chưa rõ | Xóa từ khóa tìm kiếm, mở nhóm đường tương ứng, kể cả khi đang xem điểm ảnh hưởng |
| Tìm trên bản đồ | Tìm tên/mã hoặc tiếng Việt không dấu. Enter chọn khi danh sách mở. Escape đóng, phím lên/xuống mở lại. Chọn kết quả bật lớp tương ứng và đưa đối tượng vào vùng nhìn |
| Bấm lại địa bàn đang xem | Giữ tab và tuyến đã chọn |
| Chọn đoạn đường hoặc điểm ảnh hưởng | Thay nội dung trong cùng panel. Đưa điểm vào vùng nhìn nếu đang ngoài màn hình hoặc sau điều khiển |
| Xem mặt cắt một đoạn đường | Chọn đường → Mặt cắt địa hình. Lấy mẫu chính hình đoạn đường, không cần chọn địa bàn/tuyến trước |
| Đóng chi tiết | Trở về nơi mở chi tiết, giữ tìm kiếm, bộ lọc và vị trí cuộn |
| Đọc tin hoặc xem đoạn đường từ tin | Không đổi dữ liệu bản đồ |
| Cập nhật bản đồ | Áp dụng tin và cập nhật đánh giá tiếp cận |
| Mở Lớp bản đồ | Đóng mặt cắt, tạm ẩn chú giải. Click ngoài hoặc Escape đóng lớp |
| Điều chỉnh hiển thị | Không thay kết quả đánh giá. Lọc đường vẫn giữ đoạn bị ảnh hưởng và tuyến đang chọn. Độ rõ không làm mờ cảnh báo |
| Xem lại thời điểm | Đường, căn cứ, tuyến và ưu tiên cùng một bản dữ liệu. Không hủy tin đã áp dụng. Có nút về dữ liệu mới nhất |
| So ảnh | Chọn hai GeoTIFF có ngày, nguồn và vùng chung. Pan/zoom cùng bản đồ, kéo thanh để so. Vùng thiếu ảnh để trống. Không tự xác nhận sạt lở |
| Đặt lại phiên | Về dữ liệu ban đầu, bỏ lựa chọn/bộ lọc/hình đo và cặp ảnh tạm. Giữ font, theme và chiều rộng panel |
| Đổi tuyến khi mở mặt cắt | Lấy mẫu tuyến mới, đặt vị trí đọc về đầu tuyến |
| Nhiều điểm quá gần nhau | Số đếm cho nhóm cùng loại trên 2D. Nhóm khác loại hoặc 3D có danh sách chọn. Giữ tên địa bàn ưu tiên và đối tượng đang xem khi có chỗ. Xem khu vực để tách các điểm |
| GLB hoặc GPU lỗi | Chuyển về 2D, giữ lựa chọn. 2D không tải mô hình GLB |
| Lưu đánh giá | Chụp snapshot khi mở xem trước. Mọi định dạng dùng cùng snapshot. Đóng và mở lại sau khi đổi tuyến hoặc cập nhật tin để lấy đánh giá mới |

Không có nút điều động, giao nhiệm vụ hay xác nhận cứu hộ khi chưa có quy trình và dữ liệu tương ứng. Dữ liệu mô phỏng được ghi trong **Nguồn dữ liệu**, không gắn nhãn cuộc thi lên màn thao tác.

Quy tắc tính ưu tiên và tuyến: [phân tích ứng phó](../architecture/response-analysis.md). Thành phần: [design system](design-system.md). Ký hiệu và mặt cắt: [hiển thị bản đồ](cartography.md). Luồng trình diễn: [walkthrough](../operations/walkthrough.md).
