# Design system DEAR

Hiện hành, cập nhật 2026-10-06. Web React là bản triển khai chuẩn. Catalog HTML trong `references/` là bản tham khảo, chưa đồng bộ hoàn toàn.

## Nền tảng

| Thành phần | Quy tắc |
|---|---|
| Bố cục | Panel và bản đồ liền nhau, không bo góc hoặc chừa viền ngoài. Panel mặc định 384 px, kéo để đổi trong khoảng 320 đến 560 px và giới hạn theo cửa sổ. Mobile có hai chế độ Thông tin và Bản đồ |
| Chữ | Inter mặc định. Cài đặt có IBM Plex Sans và Space Grotesk/Be Vietnam Pro. Nội dung 13–14 px, tiêu đề panel 23 px. Dùng font mono cho tọa độ hoặc mã cần đối chiếu |
| Khoảng cách | Thang 4, 8, 12, 16, 20, 24, 32 px. Căn theo khối nội dung, không chèn khoảng trắng để căn nút |
| Màu | Mặc định sáng, header xanh đậm. Bề mặt trắng/xám, màu tương tác xanh lá. Màu giao diện tách khỏi màu tình trạng đường. Công cụ bản đồ dùng nền đặc, viền mảnh, bóng nhẹ |
| Icon và nút | [Lucide](https://lucide.dev/guide/react), qua `shared/ui/UiIcon`: lưới 24 px, hiển thị 18 px, nét 1,75 px. Nút bản đồ 40 × 40 px. Nút đóng 28–36 px theo bề mặt. Có tên truy cập và focus rõ |

Giá trị dùng chung nằm trong [tokens.css](../../DEM_to_3D/viewer/src/styles/tokens.css). Bố cục nằm trong [workspace.css](../../DEM_to_3D/viewer/src/styles/workspace.css).

## Quy tắc thành phần

| Thành phần | Quy tắc |
|---|---|
| Tab | Chữ đậm và gạch chân cho lựa chọn. Không dùng badge làm tab |
| Trạng thái | `StatusText`: chữ và ký hiệu nhỏ. Không chỉ dựa vào màu, không đóng hộp mọi trạng thái |
| Hàng danh sách | Tên trước, dữ kiện sau. Vùng hover chừa ít nhất 12 px hai bên, 16 px trên/dưới. Chọn không dịch chữ. Tên/trạng thái xuống hàng khi panel hẹp |
| Panel chi tiết | Một tiêu đề, một trạng thái. Đường: ghi nhận, việc cần xử lý, nguồn. Địa bàn: Tiếp cận và Căn cứ. X đóng về ngữ cảnh mở |
| Mô tả và hành động | Cách ít nhất 12 px từ đoạn mô tả đến nút. Không dùng reset margin của paragraph làm khoảng cách mặc định |
| Số liệu và nguồn | Diện tích và đơn vị nằm cùng dòng. Metadata dài dùng hàng nhãn/giá trị, không dùng cột KPI lớn. Nguồn ranh giới mở khi cần |
| Tiếp cận và tuyến chọn | Tình trạng chung tính từ mọi tuyến đã biết. Chỉ đưa đoạn cản trở của tuyến đang chọn lên màn chính. So sánh tuyến và toàn bộ đoạn mở tại chỗ. Không gọi tuyến ngắn nhất là đường chính nếu dữ liệu không xác nhận |
| Thông tin lặp | Không lặp cùng kết luận trong các khối cùng vai trò. Thiếu tuyến: một trạng thái và việc cần bổ sung. Tab Căn cứ giữ lý do và nguồn, không lặp lại lý do ở header |
| Mặt cắt | Gắn sát đáy vùng bản đồ, không bọc thêm card hoặc bo góc ngoài. Nguồn bản đồ nằm trong vùng nhìn phía trên |
| Phương án tuyến | Dùng `RouteOption` trong một danh sách có đường phân cách. Tên, khoảng cách/ETA và trạng thái thành các dòng riêng. Dấu chọn biểu thị lựa chọn, không biểu thị an toàn |
| Tìm kiếm bản đồ | Một ô chung cho địa bàn, đường và điểm. Kết quả ghi tên và loại đối tượng. Hỗ trợ Enter, mũi tên và Escape |
| Thanh bản đồ | Nút panel, tìm kiếm, lớp và đo cùng thanh trên trái. Điều hướng và thông tin vị trí ở nhóm trên phải |
| Đo bản đồ | Ba trạng thái: vẽ, xem kết quả, chỉnh sửa. Kết thúc bằng nút, Enter hoặc nhấp đúp điểm cuối. Chọn Chỉnh sửa trước khi kéo điểm. Phép đo hiện tại và kết quả trước đó ở hai mục riêng. Đóng khi đang chỉnh trả về kết quả trước chỉnh |
| Mở nội dung phụ | Chevron nét mảnh ở cuối hàng, toàn bộ hàng bấm được. Trạng thái mở có `aria-expanded`. Không lồng nhiều cấp hoặc giấu hành động chính |
| Không gian bản đồ | Panel trái chỉnh độ rộng hoặc thu gọn, giữ lựa chọn. Chú giải có thể thu về một nút. Mở lớp/đo/tọa độ tạm ẩn chú giải |
| Bản đồ tổng quan | Công cụ phụ trên 2D desktop, thu gọn mặc định. Hiển thị khung nhìn thật, click hoặc dùng bàn phím để di chuyển. Tạm ẩn khi đo, xem tọa độ, lớp hoặc mặt cắt |
| Cửa sổ công cụ | Header cố định, nội dung cuộn trong bảng. Không đổi vị trí khi nội dung tăng hoặc mở tùy chọn. Kéo tiêu đề trên desktop, phím mũi tên để dịch, Home/nhấp đúp để đặt lại. Giữ vị trí trong phiên; mobile dùng vị trí cố định |
| Thông tin vị trí | Dùng chung trên 2D và 3D. Chọn điểm để đọc tọa độ, độ cao, đổi WGS84/hệ tọa độ dữ liệu và sao chép. Không mở lại bảng thông số kỹ thuật đầy màn hình |
| Lưu đánh giá | Hành động phụ trong chi tiết địa bàn. Mở xem trước trước khi tải, không thêm trang báo cáo vào menu chính |
| Hộp xem nhanh | Nội dung ngắn và hành động xem chi tiết. Không khóa bản đồ |
| Công cụ phụ | Độ rõ/lọc/nhãn trong Lớp bản đồ. Định dạng xuất phụ trong một menu. Không thêm trang hoặc card vào màn ứng phó |
| Lịch sử dữ liệu | Mốc trên header mở diễn biến. Xem bản cũ có một thông báo gọn trên bản đồ và nút về bản mới. Không đổi trạng thái tin đã áp dụng |
| So ảnh | Hộp thoại rộng, hai ảnh cùng bản đồ, ngày/nguồn rõ, pan/zoom đồng thời, thanh trượt hỗ trợ bàn phím |
| Hộp thoại | Focus vào khi mở. Tab giữ bên trong, Escape đóng và trả focus về nút mở |
| Câu chữ | Theo [thuật ngữ](terminology.md): phân biệt báo cáo, phân tích ảnh, nguồn và kết quả tính tuyến. Tên cụ thể, trạng thái nhất quán, câu ngắn. Không dùng chấm phẩy để ghép nhiều ý, mũi tên trang trí hoặc dấu gạch dài để ngăn dữ kiện |
| Giải thích kỹ thuật | Đặt trong tùy chọn hoặc nguồn nếu cần đối chiếu. Màn thao tác chỉ giữ dữ kiện, trạng thái và hướng dẫn cho bước hiện tại |
| Ghi nhận tại địa bàn | Mỗi mục có chủ đề và một nhận định. Nguồn, giờ quan sát và nhận tin có nhãn riêng. Tách thông tin thiếu khỏi ghi nhận, không gắn tin cầu vào địa bàn chưa xác định tuyến |
| Cảnh báo tuyến | Vàng cho việc cần kiểm tra, đỏ khi tuyến bị chặn. Chỉ dẫn theo tuyến chọn, nêu rõ cầu/điểm vượt khe/đoạn sạt lở. Hành động chính nằm trước thông tin bổ trợ |
| Dữ liệu chưa có | Ghi ở nơi liên quan đến quyết định hoặc phân tích. Không rải ghi chú kỹ thuật trên mọi nhãn. Không dùng số 0 thay cho chưa xác định |
| Mã tham chiếu | Mã dùng cho tìm kiếm và đối chiếu dữ liệu, không tạo mục mở ra chỉ có một ID. Số hiệu đường chính thức chỉ hiện khi có nguồn xác nhận |
| Đổi độ rộng panel | Kéo đường phân cách hoặc dùng phím mũi tên. Nhấp đúp về mặc định. Lưu tùy chọn tại máy |
| Nguồn bản đồ | Nút thông tin nhỏ mở nguồn, trạng thái tải và license. Giữ credit tối thiểu trên map khi nhà cung cấp yêu cầu |
| Nguồn từng lớp | Nút thông tin cạnh lớp, mỗi lần mở một lớp. Phân biệt ngày thu nhận, quan sát và thời điểm tổng hợp. Metadata thiếu thì ghi chưa có, không lấy ngày snapshot thay ngày ảnh |

Bản đồ dùng chung [ký hiệu SVG](../../DEM_to_3D/viewer/src/terrain/mapSymbols.ts) và [màu đường](../../DEM_to_3D/viewer/src/terrain/roadStyle.ts). Quy tắc chuyên môn nằm tại [hiển thị bản đồ](cartography.md), luồng tại [thiết kế giao diện](interface.md).

Icon giao diện dùng Lucide. Ký hiệu chuyên môn dùng `MapSymbol`, có chú giải và điều kiện dữ liệu. Không thay sạt lở, cầu hoặc bãi đáp bằng icon trang trí. Subset Lucide và [giấy phép](../../DEM_to_3D/viewer/vendor/lucide/LICENSE) nằm trong repo, chạy offline.

## Kiểm soát thay đổi

| Thay đổi | Cập nhật cùng nhau | Kiểm tra |
|---|---|---|
| Màu, chữ, khoảng cách | Token và component sử dụng | Sáng/tối, Việt/Anh |
| Thành phần hoặc tương tác | Component và quy tắc hiện hành | Desktop 1440/1024 px, mobile 390/320 px, bàn phím |
| Bản đồ và dữ kiện phân tích | Renderer, chú giải, tài liệu chuyên môn | Zoom, chọn đối tượng, bật lớp, đổi tuyến, thiếu dữ liệu |

PR cập nhật quy tắc cần kèm ảnh liên quan. Dùng lại component trước khi tạo thành phần mới. Chạy `npm run typecheck`, `npm test`, `npm run build` trong `DEM_to_3D/viewer`.
