# Design system DEAR

Hiện hành, cập nhật 2026-10-07. Web React là bản triển khai chuẩn. Catalog HTML trong `references/` là bản tham khảo, chưa đồng bộ hoàn toàn.

## Nền tảng

| Thành phần | Quy tắc |
|---|---|
| Bố cục | Panel và bản đồ liền nhau, không bo góc hoặc chừa viền ngoài. Panel mặc định 384 px, kéo để đổi trong khoảng 320 đến 560 px và giới hạn theo cửa sổ. Mobile có hai chế độ Thông tin và Bản đồ |
| Chữ | Inter mặc định. Cài đặt có IBM Plex Sans và Space Grotesk/Be Vietnam Pro. Nhãn 12 px, nội dung 13 px, tên trong danh sách 14 px, tuyến và số liệu chính 17 px, tiêu đề panel 22 px. Số đo và giờ dùng chữ số đều độ rộng |
| Khoảng cách | Thang 4, 8, 12, 16, 20, 24, 32 px. Căn theo khối nội dung, không chèn khoảng trắng để căn nút |
| Màu | Mặc định tối: nền xanh than, panel xanh xám, nút chính xanh sáng. Chế độ sáng: panel trắng, header xám ấm, nút chính xanh đậm. Toolbar và cửa sổ công cụ theo cùng theme. Ưu tiên màu đồng, cần xác minh vàng đất, bị chặn màu đỏ. Dùng chữ và ký hiệu để phân biệt trạng thái |
| Icon và nút | [Lucide](https://lucide.dev/guide/react), qua `shared/ui/UiIcon`: lưới 24 px, hiển thị 18 px, nét 1,75 px. Nút toolbar 32 px, nút công cụ mobile 36 px. Lớp xanh lá, đo nâu đất, tra vị trí xanh lam, điều hướng trung tính. Nút đóng 28–36 px, không viền. Có tên truy cập và focus rõ |
| Khung GIS | Tab nghiệp vụ và toolbar cao 48 px khi bản đồ đủ rộng. Toolbar gắn vào khung, không bóng hoặc bo góc. Bản đồ rộng tối đa 600 px hoặc mobile dùng hai hàng công cụ cao 84 px. Canvas và cửa sổ công cụ ở bên dưới toolbar. Panel chính và bản đồ không bo góc |
| Hình khối | Nút, ô nhập, menu và cửa sổ công cụ bo 3 px. Hộp thoại lớn bo 5 px. Dùng token chung, không đặt bán kính riêng cho từng component. Panel và canvas không bo. Radio và ký hiệu bản đồ giữ hình dạng theo chức năng |
| Bề mặt nổi | Cửa sổ lớp/đo/vị trí, thông báo, cài đặt và hộp thoại dùng thanh tiêu đề theo màu toolbar, nội dung theo màu bề mặt của theme và viền mảnh. Bóng nhẹ cho công cụ, bóng rõ hơn cho hộp thoại |
| Header | Cao 56 px. Mốc tổng hợp là ngày và giờ, mở lịch sử dữ liệu khi bấm. Không dùng chấm trực tiếp cho dữ liệu snapshot. Các nút dùng nền trong suốt, cùng kích thước |
| Ảnh nền | Ảnh vệ tinh là bối cảnh, giảm bão hòa và độ sáng qua `--imagery-filter` để đường, điểm, nhãn nổi lên. Nền địa hình không lọc |
| Nhãn và ký hiệu | Nhãn dùng viền mềm `--pin-label-halo`, không dùng bóng cứng nhiều hướng. Ký hiệu viền trắng mảnh, bóng nhẹ. Đối tượng đang chọn có vòng trắng và vòng xanh cùng màu tuyến chọn |
| Phong cách | Tiết chế: không gradient trang trí, không viền phát sáng, không sọc màu cạnh trái cho khối cảnh báo, không lặp icon cho cùng một trạng thái. Chuyển động chỉ là hiện mờ 140 ms khi mở lớp nổi, tắt khi người dùng chọn giảm chuyển động |

Giá trị dùng chung nằm trong [tokens.css](../../DEM_to_3D/viewer/src/styles/tokens.css). Bố cục nằm trong [workspace.css](../../DEM_to_3D/viewer/src/styles/workspace.css).

## Quy tắc thành phần

| Thành phần | Quy tắc |
|---|---|
| Tab | Nghiệp vụ và công cụ đo dùng tab gắn vào bề mặt nội dung. Tab trong chi tiết địa bàn dùng gạch chân. Mỗi loại giữ cùng một cách trình bày, không dùng badge làm tab |
| Điều khiển biểu mẫu | Checkbox, radio, select, thanh trượt và thanh cuộn dùng style chung trong `workspace.css`, giữ phần tử gốc để bàn phím và trình đọc màn hình hoạt động. Không để kiểu mặc định của trình duyệt |
| Cài đặt | Hai lựa chọn dùng chung một khung, ngăn bằng đường mảnh. Font là danh sách có mẫu chữ và dấu chọn, không xếp nhiều thẻ. Focus nằm trong hàng, không bị khung cắt |
| Hàng nhãn/giá trị | Metadata dùng nhãn 12 px và giá trị 13 px. Thông số tuyến dùng hai cột, nhãn trên và số bên dưới. Chỉ kẻ đường khi cần phân tách mục |
| Tiêu đề mục trong panel | `h3` là nhãn 12 px đậm, màu chữ chính. Tên trong danh sách 14 px. Không dùng chữ hoa toàn bộ |
| Trạng thái | `StatusText`: chữ và ký hiệu nhỏ. Không chỉ dựa vào màu, không đóng hộp mọi trạng thái |
| Hàng danh sách | Tên trước, dữ kiện sau. Chữ thẳng lề 24 px của panel, nền hover tràn ra lề, đường phân cách ở độ rộng nội dung. Chọn bằng nền nhạt, không dùng sọc màu. Hàng đoạn đường có mẩu nét cùng màu và kiểu nét với bản đồ. Vùng hover chừa ít nhất 12 px hai bên, 16 px trên/dưới. Chọn không dịch chữ. Tên/trạng thái xuống hàng khi panel hẹp |
| Luồng panel | Sự kiện: vùng, giờ cảnh báo/tổng hợp, địa bàn ưu tiên và lý do, số đoạn bị chặn/cần xác minh. Địa bàn: tổng hợp khi có nhiều tuyến → tên và trạng thái tuyến chọn → khoảng cách/ETA có điều kiện → việc cần làm và nút kiểm tra → các điểm cản trở. So sánh và nguồn mở khi cần. Một tuyến không lặp trạng thái trong dòng tổng hợp. Không dùng thẻ tô màu hoặc số lớn trang trí |
| Panel chi tiết | Một tiêu đề, một trạng thái. Đường: ghi nhận → việc cần xử lý → báo cáo và mặt cắt → địa bàn liên quan. Địa bàn: Tiếp cận và Căn cứ. X đóng về ngữ cảnh mở |
| Mô tả và hành động | Cách ít nhất 12 px từ đoạn mô tả đến nút. Không dùng reset margin của paragraph làm khoảng cách mặc định |
| Số liệu và nguồn | Diện tích và đơn vị nằm cùng dòng. Metadata dài dùng hàng nhãn/giá trị, không dùng cột KPI lớn. Nguồn ranh giới mở khi cần |
| Tiếp cận và tuyến chọn | Tình trạng chung tính từ mọi tuyến đã biết. Chỉ đưa đoạn cản trở của tuyến đang chọn lên màn chính. So sánh tuyến và toàn bộ đoạn mở tại chỗ. Không gọi tuyến ngắn nhất là đường chính nếu dữ liệu không xác nhận |
| Thông tin lặp | Không lặp cùng kết luận trong các khối cùng vai trò. Thiếu tuyến: một trạng thái và việc cần bổ sung. Tab Căn cứ giữ lý do và nguồn, không lặp lại lý do ở header |
| Mặt cắt | Gắn sát đáy vùng bản đồ, không bọc thêm card hoặc bo góc ngoài. Nguồn bản đồ nằm trong vùng nhìn phía trên |
| Phương án tuyến | Dùng `RouteOption` trong một danh sách. Tên, khoảng cách/ETA và trạng thái thành các dòng riêng. Dấu chọn biểu thị lựa chọn, không biểu thị an toàn |
| Tìm kiếm bản đồ | Một ô chung cho địa bàn, đường và điểm. Kết quả có ký hiệu theo loại, tên với phần khớp in đậm, và loại đối tượng. Hỗ trợ Enter, mũi tên và Escape |
| Thanh bản đồ | Trái: nút panel trung tính, tìm kiếm, nhóm Lớp / Đo / Vị trí. Phải: phóng to/thu nhỏ, toàn khu vực, lựa chọn 2D/3D và trợ giúp. Nút panel không mang màu chế độ đang bật. Tên công cụ ẩn khi vùng bản đồ hẹp, giữ tooltip và tên truy cập. Kết quả tìm kiếm nằm trên hàng điều hướng |
| Đo bản đồ | Ba trạng thái: vẽ, xem kết quả, chỉnh sửa. Kết thúc bằng nút, Enter hoặc nhấp đúp điểm cuối. Chọn Chỉnh sửa trước khi kéo điểm. Phép đo hiện tại và kết quả trước đó ở hai mục riêng. Đóng khi đang chỉnh trả về kết quả trước chỉnh |
| Mở nội dung phụ | Chevron nét mảnh ở cuối hàng, toàn bộ hàng bấm được. Trạng thái mở có `aria-expanded`. Không lồng nhiều cấp hoặc giấu hành động chính |
| Không gian bản đồ | Panel trái chỉnh độ rộng hoặc thu gọn, giữ lựa chọn. Chú giải có thể thu về một nút. Mở lớp/đo/tọa độ tạm ẩn chú giải |
| Bản đồ tổng quan | Công cụ phụ trên 2D desktop, thu gọn mặc định. Hiển thị khung nhìn thật, click hoặc dùng bàn phím để di chuyển. Tạm ẩn khi đo, xem tọa độ, lớp hoặc mặt cắt |
| Cửa sổ công cụ | Header cố định, nội dung cuộn trong bảng. Không đổi vị trí khi nội dung tăng hoặc mở tùy chọn. Kéo tiêu đề trên desktop, phím mũi tên để dịch, Home/nhấp đúp để đặt lại. Giữ vị trí trong phiên; mobile dùng vị trí cố định |
| Thông tin vị trí | Dùng chung trên 2D và 3D. Chọn điểm để đọc tọa độ, độ cao, đổi WGS84/hệ tọa độ dữ liệu và sao chép. Không mở lại bảng thông số kỹ thuật đầy màn hình |
| Lưu đánh giá | Hành động phụ trong chi tiết địa bàn. Mở xem trước trước khi tải, không thêm trang báo cáo vào menu chính |
| Hộp xem nhanh | Tiêu đề, giờ, đối tượng, ghi nhận tối đa hai dòng và hành động xem chi tiết. Có nút đóng và Escape. Popover header nằm trên toolbar và công cụ bản đồ, không khóa bản đồ |
| Công cụ phụ | Độ rõ/lọc/nhãn trong Lớp bản đồ. Định dạng xuất phụ trong một menu. Không thêm trang hoặc card vào màn ứng phó |
| Lịch sử dữ liệu | Mốc trên header mở diễn biến. Xem bản cũ có một thông báo gọn trên bản đồ và nút về bản mới. Không đổi trạng thái tin đã áp dụng |
| So ảnh | Hộp thoại rộng, hai ảnh cùng bản đồ, ngày/nguồn rõ, pan/zoom đồng thời, thanh trượt hỗ trợ bàn phím |
| Hộp thoại | Thanh tiêu đề tối thiểu 48 px, chữ 14 px, nút đóng 28 px. Nội dung có lề 20 px và cuộn độc lập. Footer so ảnh/xuất đánh giá dùng cùng màu thanh tiêu đề. Focus vào khi mở, Tab giữ bên trong, Escape đóng và trả focus về nút mở |
| Câu chữ | Theo [thuật ngữ](terminology.md): phân biệt báo cáo, phân tích ảnh, nguồn và kết quả tính tuyến. Tên cụ thể, trạng thái nhất quán, câu ngắn. Không dùng chấm phẩy để ghép nhiều ý, mũi tên trang trí hoặc dấu gạch dài để ngăn dữ kiện |
| Giải thích kỹ thuật | Đặt trong tùy chọn hoặc nguồn nếu cần đối chiếu. Màn thao tác chỉ giữ dữ kiện, trạng thái và hướng dẫn cho bước hiện tại |
| Ghi nhận tại địa bàn | Mỗi mục có chủ đề và một nhận định. Giờ quan sát và nhận tin có nhãn riêng. Tên báo cáo đầy đủ nằm trong cửa sổ báo cáo. Tách dữ liệu nền và thông tin thiếu khỏi ghi nhận, không gắn tin cầu vào địa bàn chưa xác định tuyến |
| Cảnh báo tuyến | Một chỉ dẫn ngắn và ký hiệu trạng thái, không bọc thêm thẻ. Nêu rõ cầu, điểm vượt khe hoặc đoạn sạt lở trên tuyến đang xem. Khi bị chặn, không hiện ETA và không gọi tuyến là an toàn |
| Dữ liệu chưa có | Ghi ở nơi liên quan đến quyết định hoặc phân tích. Không rải ghi chú kỹ thuật trên mọi nhãn. Không dùng số 0 thay cho chưa xác định |
| Mã tham chiếu | Mã dùng cho tìm kiếm và đối chiếu dữ liệu, không tạo mục mở ra chỉ có một ID. Số hiệu đường chính thức chỉ hiện khi có nguồn xác nhận |
| Đổi độ rộng panel | Kéo đường phân cách hoặc dùng phím mũi tên. Nhấp đúp về mặc định. Lưu tùy chọn tại máy |
| Nguồn bản đồ | Nút thông tin nhỏ mở nguồn, trạng thái tải và license. Giữ credit tối thiểu trên map khi nhà cung cấp yêu cầu |
| Nguồn từng lớp | Nút thông tin cạnh lớp, mỗi lần mở một lớp. Phân biệt ngày thu nhận, quan sát và thời điểm tổng hợp. Metadata thiếu thì ghi chưa có, không lấy ngày snapshot thay ngày ảnh |

Bản đồ dùng chung [ký hiệu SVG](../../DEM_to_3D/viewer/src/terrain/mapSymbols.ts) và [màu đường](../../DEM_to_3D/viewer/src/terrain/roadStyle.ts). Quy tắc chuyên môn nằm tại [hiển thị bản đồ](cartography.md), luồng tại [thiết kế giao diện](interface.md).

Icon giao diện dùng Lucide. Ký hiệu chuyên môn dùng `MapSymbol`: thôn bản là nhóm người, sạt lở là sườn dốc có đá lăn, điểm vượt khe là đường bị dòng nước cắt ngang, cầu có mặt cầu và trụ, điểm tập kết là cờ, hạ cánh là chữ H. Màu ưu tiên không có nghĩa đã xác nhận cô lập. Subset Lucide và [giấy phép](../../DEM_to_3D/viewer/vendor/lucide/LICENSE) nằm trong repo, chạy offline.

Tham khảo: [QGIS](https://docs.qgis.org/3.40/en/docs/user_manual/introduction/qgis_gui.html) cho toolbar và panel, [Earth Engine](https://developers.google.com/earth-engine/guides/playground) cho tách công cụ tra dữ liệu/vẽ, [SkyFi](https://learn.skyfi.com/how-to/tasking-a-satellite-to-capture-a-new-image/) cho thao tác cạnh bản đồ. Ảnh UNOSAT Nepal do nhóm cung cấp định hướng chú giải, ký hiệu và tổng quan. Nghiệp vụ theo [proposal SIC 2026](../../references/SIC2026/VinSpace_SIC2026_proposal.pdf).

## Kiểm soát thay đổi

| Thay đổi | Cập nhật cùng nhau | Kiểm tra |
|---|---|---|
| Màu, chữ, khoảng cách | Token và component sử dụng | Sáng/tối, Việt/Anh |
| Thành phần hoặc tương tác | Component và quy tắc hiện hành | Desktop 1440/1024 px, mobile 390/320 px, bàn phím |
| Bản đồ và dữ kiện phân tích | Renderer, chú giải, tài liệu chuyên môn | Zoom, chọn đối tượng, bật lớp, đổi tuyến, thiếu dữ liệu |

PR cập nhật quy tắc cần kèm ảnh liên quan. Dùng lại component trước khi tạo thành phần mới. Chạy `npm run typecheck`, `npm test`, `npm run build` trong `DEM_to_3D/viewer`.
