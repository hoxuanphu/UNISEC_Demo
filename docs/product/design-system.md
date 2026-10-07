# Design system DEAR

Hiện hành, cập nhật 2026-10-06. Web React là bản triển khai chuẩn. Catalog HTML trong `references/` là bản tham khảo, chưa đồng bộ hoàn toàn.

## Nền tảng

| Thành phần | Quy tắc |
|---|---|
| Bố cục | Panel và bản đồ liền nhau, không bo góc hoặc chừa viền ngoài. Panel mặc định 384 px, kéo để đổi trong khoảng 320 đến 560 px và giới hạn theo cửa sổ. Mobile có hai chế độ Thông tin và Bản đồ |
| Chữ | Inter mặc định. Cài đặt có IBM Plex Sans và Space Grotesk/Be Vietnam Pro. Panel chỉ dùng 12 px cho nhãn và phụ chú, 13 px cho nội dung, 14 px cho tên đối tượng, 22 px cho tiêu đề panel. Số đo và giờ dùng chữ số đều độ rộng. Dùng font mono cho tọa độ hoặc mã cần đối chiếu |
| Khoảng cách | Thang 4, 8, 12, 16, 20, 24, 32 px. Căn theo khối nội dung, không chèn khoảng trắng để căn nút |
| Màu | Mặc định tối, lựa chọn sáng/tối lưu tại máy. Tối theo bậc L*: header 14, panel 18, lớp nổi `--ws-raised` 23, đường kẻ 30, không hạ nền dưới L* 14. Tương phản đến từ điểm sáng: nút chính nền trắng chữ tối và các control bản đồ nền trắng. Sáng: header xanh đậm, nút chính xanh đậm chữ trắng. Ưu tiên cứu hộ màu đồng, cần xác minh vàng đất, đỏ chỉ cho bị chặn. Chữ trạng thái tối thiểu 4,5:1 |
| Icon và nút | [Lucide](https://lucide.dev/guide/react), qua `shared/ui/UiIcon`: lưới 24 px, hiển thị 18 px, nét 1,75 px. Nút bản đồ 40 × 40 px. Nút đóng 28–36 px theo bề mặt, không viền. Nút và ô nhập bo 8 px. Có tên truy cập và focus rõ |
| Bề mặt nổi | Lớp trên bản đồ luôn dùng token sáng, kể cả ở chế độ tối: nền trắng, chữ tối, bóng đậm hơn trên ảnh tối. Danh sách lớp áp dụng nằm cùng khối `[data-theme="light"]` trong `tokens.css`. Mọi lớp trên bản đồ cùng nền đặc, viền `--map-control-line` và bóng `--shadow-float`. Thanh công cụ, cột điều hướng, chú giải, tổng quan bo 10 px. Bảng công cụ, popover, kết quả tìm kiếm bo 12 px với `--shadow-overlay`. Hộp thoại bo 14 px. La bàn là viên dọc cùng kiểu |
| Header | Cao 56 px, nền `--header-bg`: xanh đậm ở chế độ sáng, xám đậm ở chế độ tối. Mốc dữ liệu là viên trạng thái có chấm `--live`. Các nút còn lại là nút ghost cùng kích thước. Logo là icon trơn màu `--header-brand` cạnh chữ DEAR |
| Ảnh nền | Ảnh vệ tinh là bối cảnh, giảm bão hòa và độ sáng qua `--imagery-filter` để đường, điểm, nhãn nổi lên. Nền địa hình không lọc |
| Nhãn và ký hiệu | Nhãn dùng viền mềm `--pin-label-halo`, không dùng bóng cứng nhiều hướng. Ký hiệu viền trắng mảnh, bóng nhẹ. Đối tượng đang chọn có vòng trắng và vòng xanh cùng màu tuyến chọn |
| Phong cách | Tiết chế: không gradient trang trí, không viền phát sáng, không sọc màu cạnh trái cho khối cảnh báo, không lặp icon cho cùng một trạng thái. Chuyển động chỉ là hiện mờ 140 ms khi mở lớp nổi, tắt khi người dùng chọn giảm chuyển động |

Giá trị dùng chung nằm trong [tokens.css](../../DEM_to_3D/viewer/src/styles/tokens.css). Bố cục nằm trong [workspace.css](../../DEM_to_3D/viewer/src/styles/workspace.css).

## Quy tắc thành phần

| Thành phần | Quy tắc |
|---|---|
| Tab | Chữ đậm và gạch chân cho lựa chọn, dùng cho cả điều hướng chính và tab trong panel. Không dùng badge hoặc viên tô nền làm tab |
| Điều khiển biểu mẫu | Checkbox, radio, select, thanh trượt và thanh cuộn dùng style chung trong `workspace.css`, giữ phần tử gốc để bàn phím và trình đọc màn hình hoạt động. Không để kiểu mặc định của trình duyệt |
| Hàng nhãn/giá trị | Nhãn 12 px màu phụ trong cột `--meta-label` (120 px), giá trị bên phải. Không xếp nhãn chồng lên giá trị |
| Tiêu đề mục trong panel | `h3` là nhãn 12 px đậm, màu phụ. Tên đối tượng 15 px giữ vai trò nổi bật. Không dùng chữ hoa toàn bộ |
| Trạng thái | `StatusText`: chữ và ký hiệu nhỏ. Không chỉ dựa vào màu, không đóng hộp mọi trạng thái |
| Hàng danh sách | Tên trước, dữ kiện sau. Chữ thẳng lề 24 px của panel, nền hover tràn ra lề, đường phân cách ở độ rộng nội dung. Chọn bằng nền nhạt, không dùng sọc màu. Hàng đoạn đường có mẩu nét cùng màu và kiểu nét với bản đồ. Vùng hover chừa ít nhất 12 px hai bên, 16 px trên/dưới. Chọn không dịch chữ. Tên/trạng thái xuống hàng khi panel hẹp |
| Luồng panel | Sự kiện: tiêu đề, vùng và mốc giờ trên một khối, sau đó danh sách ưu tiên (tên và việc cần làm) và hai hàng Bị chặn/Cần xác minh có số đoạn. Chi tiết địa bàn: một câu Việc cần làm có icon trạng thái và một nút, sau đó hàng nhãn/giá trị Tiếp cận, Tuyến, Quãng đường, Thời gian, rồi Cần kiểm tra. Không dùng thẻ tô màu, số lớn trang trí hoặc dải màu. Tên đoạn bỏ phần lặp tên tuyến đang xem. Ký hiệu chỉ dùng khi nối dòng trong panel với điểm trên bản đồ |
| Panel chi tiết | Một tiêu đề, một trạng thái. Đường: ghi nhận, việc cần xử lý, nguồn. Địa bàn: Tiếp cận và Căn cứ. X đóng về ngữ cảnh mở |
| Mô tả và hành động | Cách ít nhất 12 px từ đoạn mô tả đến nút. Không dùng reset margin của paragraph làm khoảng cách mặc định |
| Số liệu và nguồn | Diện tích và đơn vị nằm cùng dòng. Metadata dài dùng hàng nhãn/giá trị, không dùng cột KPI lớn. Nguồn ranh giới mở khi cần |
| Tiếp cận và tuyến chọn | Tình trạng chung tính từ mọi tuyến đã biết. Chỉ đưa đoạn cản trở của tuyến đang chọn lên màn chính. So sánh tuyến và toàn bộ đoạn mở tại chỗ. Không gọi tuyến ngắn nhất là đường chính nếu dữ liệu không xác nhận |
| Thông tin lặp | Không lặp cùng kết luận trong các khối cùng vai trò. Thiếu tuyến: một trạng thái và việc cần bổ sung. Tab Căn cứ giữ lý do và nguồn, không lặp lại lý do ở header |
| Mặt cắt | Gắn sát đáy vùng bản đồ, không bọc thêm card hoặc bo góc ngoài. Nguồn bản đồ nằm trong vùng nhìn phía trên |
| Phương án tuyến | Dùng `RouteOption` trong một danh sách có đường phân cách. Tên, khoảng cách/ETA và trạng thái thành các dòng riêng. Dấu chọn biểu thị lựa chọn, không biểu thị an toàn |
| Tìm kiếm bản đồ | Một ô chung cho địa bàn, đường và điểm. Kết quả có ký hiệu theo loại, tên với phần khớp in đậm, và loại đối tượng. Hỗ trợ Enter, mũi tên và Escape |
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
| Cảnh báo tuyến | Khối nền nhạt có viền mảnh cùng tông, bo 8 px. Vàng cho việc cần kiểm tra, đỏ khi tuyến bị chặn. Chỉ dẫn theo tuyến chọn, nêu rõ cầu/điểm vượt khe/đoạn sạt lở. Hành động chính nằm trước thông tin bổ trợ |
| Dữ liệu chưa có | Ghi ở nơi liên quan đến quyết định hoặc phân tích. Không rải ghi chú kỹ thuật trên mọi nhãn. Không dùng số 0 thay cho chưa xác định |
| Mã tham chiếu | Mã dùng cho tìm kiếm và đối chiếu dữ liệu, không tạo mục mở ra chỉ có một ID. Số hiệu đường chính thức chỉ hiện khi có nguồn xác nhận |
| Đổi độ rộng panel | Kéo đường phân cách hoặc dùng phím mũi tên. Nhấp đúp về mặc định. Lưu tùy chọn tại máy |
| Nguồn bản đồ | Nút thông tin nhỏ mở nguồn, trạng thái tải và license. Giữ credit tối thiểu trên map khi nhà cung cấp yêu cầu |
| Nguồn từng lớp | Nút thông tin cạnh lớp, mỗi lần mở một lớp. Phân biệt ngày thu nhận, quan sát và thời điểm tổng hợp. Metadata thiếu thì ghi chưa có, không lấy ngày snapshot thay ngày ảnh |

Bản đồ dùng chung [ký hiệu SVG](../../DEM_to_3D/viewer/src/terrain/mapSymbols.ts) và [màu đường](../../DEM_to_3D/viewer/src/terrain/roadStyle.ts). Quy tắc chuyên môn nằm tại [hiển thị bản đồ](cartography.md), luồng tại [thiết kế giao diện](interface.md).

Icon giao diện dùng Lucide. Ký hiệu chuyên môn dùng `MapSymbol`, có chú giải và điều kiện dữ liệu. Thôn bản là mái nhà, sạt lở là sườn dốc có đá lăn, điểm vượt khe là đường bị dòng nước cắt ngang, cầu là mặt cầu có trụ và vòm, điểm tập kết là cờ, hạ cánh là chữ H. Không thay sạt lở, cầu hoặc bãi đáp bằng icon trang trí. Subset Lucide và [giấy phép](../../DEM_to_3D/viewer/vendor/lucide/LICENSE) nằm trong repo, chạy offline.

## Kiểm soát thay đổi

| Thay đổi | Cập nhật cùng nhau | Kiểm tra |
|---|---|---|
| Màu, chữ, khoảng cách | Token và component sử dụng | Sáng/tối, Việt/Anh |
| Thành phần hoặc tương tác | Component và quy tắc hiện hành | Desktop 1440/1024 px, mobile 390/320 px, bàn phím |
| Bản đồ và dữ kiện phân tích | Renderer, chú giải, tài liệu chuyên môn | Zoom, chọn đối tượng, bật lớp, đổi tuyến, thiếu dữ liệu |

PR cập nhật quy tắc cần kèm ảnh liên quan. Dùng lại component trước khi tạo thành phần mới. Chạy `npm run typecheck`, `npm test`, `npm run build` trong `DEM_to_3D/viewer`.
