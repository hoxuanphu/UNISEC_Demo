# Rà soát giao diện và luồng ứng phó

Cập nhật: 2026-10-07. Phạm vi: web React, gói Chế Tạo v0.2, fixture kiểm chọn dataset và API snapshot cục bộ. Chưa thử với người trực thực tế.

## Sửa sau phản hồi sử dụng

| Vấn đề | Thay đổi |
|---|---|
| Tổng quan sự kiện dàn trải, tiêu đề/nút lệch hàng | Bỏ margin trên nút Tất cả, rút nhãn và giữ tên truy cập đầy đủ. Tách hai nhóm bằng thanh tiêu đề cùng nền toolbar. Hai mốc giờ cùng dòng, lề nội dung 24 px, hàng đệm 12 px, tra cứu chia hai cột. Style chuyển về `incident-panel.css`. Kiểm tra căn hàng, ranh giới, khoảng đệm trên Việt/Anh, hai theme và ba bộ chữ |
| Nút tiêu đề công cụ thành các ô trắng, tab tiếng Anh sát viền | Nút tiêu đề dùng nền trong suốt, cách nhau 4 px, chỉ đổi nền khi hover hoặc bật tùy chọn. Tab chia theo nội dung. Kiểm tra panel 320 px, bốn viewport, ba font và hai theme. Tách nền hàng kiểu đo khỏi thanh tab |
| Bộ lọc đường vượt khung ở mobile 320 px | Giảm đệm ngang mobile, cho xuống hàng khi không đủ chỗ. Kiểm tra cả ba font và hai theme |
| Hàng đường trong báo cáo sát nền hover | Bỏ rule xóa đệm ngang trong hộp thoại. Giữ đệm 12 px, tiêu đề theo màu chữ chính khi hover. Kiểm tra trên bốn kích thước cửa sổ và hai theme |
| Tông nền và đường phân cách tab/toolbar lệch nhau | Chung màu nền/viền. Hàng tìm kiếm desktop giữ cao 48 px cả khi map hẹp. Chữ phụ trên nền sáng tăng tương phản, placeholder theo theme. Chú giải không che toolbar khi cửa sổ thấp |
| Chú giải thu gọn trải ngang, CSS rải nhiều nơi | Giữ bề mặt nhẹ như panel hiện tại. Bố trí hai cột trong khung tối đa 340 px, co lại khi map hẹp. Gom style chú giải vào một file, kiểm tra cả thu gọn/mở đầy đủ với tổng quan đang mở |
| Nhãn đường cụt, thông tin và trạng thái lặp | Dùng “Chưa ghi nhận tắc đường” thống nhất. Tuyến duy nhất không lặp trạng thái. Ẩn mô tả trống, giữ yêu cầu kiểm tra. Giờ liên lạc nằm trong hàng thời gian. Không lặp nhận định đã có ở tiêu đề. Tắt lớp tình trạng thì chú giải chỉ ghi “Mạng đường” |
| Hộp thoại và cài đặt khác đường nét với bộ công cụ | Góc 3 px cho điều khiển/cửa sổ nhỏ, 5 px cho hộp thoại. Chung màu thanh tiêu đề và viền. Font chuyển thành danh sách có dấu chọn, thêm nút đóng cài đặt |
| Thông báo bị toolbar che tiêu đề | Tách thứ tự hiển thị của workspace và header. Cửa sổ thông báo có nút đóng, giờ và tên không chèn nhau |
| Panel rộng ép tìm kiếm, kết quả bị che | Toolbar chuyển hai hàng theo chiều rộng bản đồ. Kiểm tra vùng bấm thật của kết quả, nút và popup ở 1366/1024/390/320 px |
| Chú giải đè bản đồ tổng quan, cửa sổ kéo lên toolbar | Chừa khoảng cho tổng quan khi bản đồ hẹp. Cửa sổ giữ vị trí và nằm dưới chiều cao toolbar thực tế |
| Lý do ưu tiên chung chung, thời gian ghép thành đoạn dài | Nêu đường bị chặn/mất liên lạc hoặc đối tượng có báo cáo. Tách giờ cảnh báo/dữ liệu đến và giờ ghi nhận/tiếp nhận thành hàng có nhãn |
| Dark mode còn toolbar và cửa sổ trắng | Đồng bộ nền xanh than, chữ xanh xám và trạng thái dịu. Kiểm tra tương phản chữ tối thiểu 4,5:1 tại panel, toolbar và lớp bản đồ trên cả hai theme |
| Mô tả dính nút, diện tích xuống dòng | Khoảng cách tối thiểu 12 px, diện tích/đơn vị cùng dòng. Metadata bãi đáp dùng hàng nhãn/giá trị |
| Panel vùng đánh giá dài và chung chung | Giữ diện tích, số thôn/bản, mở danh sách. Nguồn ranh giới thu gọn |
| Lẫn tiếp cận chung với tuyến đang chọn | Chung một cách tổng hợp tại sự kiện, danh sách và chi tiết. Tuyến chọn có trạng thái riêng |
| Mô tả cũ sau tin mới | Danh sách địa bàn dùng trạng thái tuyến của snapshot đang xem |
| Không rõ căn cứ ưu tiên | Danh sách sự kiện ghi lý do ưu tiên. Tiếp cận giữ tuyến và việc cần làm; Căn cứ chứa báo cáo và phương pháp |
| Mất tên địa bàn ưu tiên khi gom điểm | Giữ tên/ký hiệu địa bàn và dấu nhóm. Không gọi điểm gần nhau là cùng vị trí |
| Số tổng đường không khớp danh sách do giữ từ khóa cũ | Chọn số tổng sẽ xóa tìm kiếm và mở đúng nhóm đường. Không đánh dấu bộ lọc đường khi đang xem điểm ảnh hưởng |
| Tìm không dấu không nhất quán | Tìm đường/địa bàn trong panel và bản đồ dùng cùng phép chuẩn hóa |
| Enter chọn kết quả sau khi đã đóng tìm kiếm | Chỉ chọn khi danh sách mở. Phím xuống mở lại ở kết quả đầu tiên, phím lên ở kết quả cuối |
| Thiếu tuyến được nhắc lại ở nhiều khối | Tiếp cận giữ một kết luận, việc cần bổ sung và nút mở thông tin địa bàn. Không tạo tab Tuyến trống |
| Khó biết cần kiểm tra đoạn nào | Tiếp cận chỉ liệt kê đoạn cản trở trên tuyến đang xem. So tuyến và toàn bộ các đoạn mở khi cần |
| Dữ kiện và nguồn dính thành nhiều câu | Ghi nhận có chủ đề, nguồn và thời gian riêng. Tách thiếu dữ liệu khỏi báo cáo. Bỏ liên hệ cầu với địa bàn chưa xác định tuyến |
| Lẫn báo cáo hiện trường, nguồn và kết quả tính toán | Chung nhãn theo loại báo cáo/phân tích. Tách thu nhận ảnh, ghi nhận và tiếp nhận. Không gọi tên báo cáo hoặc mã phiên bản là đơn vị cung cấp. Kết quả tính tuyến có phần riêng. Quy ước ở [thuật ngữ](../product/terminology.md) |
| Cảnh báo và bước xử lý còn chung chung | Tên/trạng thái tuyến, khoảng cách và ETA đứng trước nút kiểm tra. Chỉ dẫn nêu cầu/điểm vượt khe. Tuyến bị chặn không được gọi là gợi ý, không có ETA |
| Lý do không khớp tuyến bị chặn khi thiếu báo cáo ảnh hưởng | Đọc trạng thái tuyến độc lập với bản ghi hazard. Giữ mất liên lạc trong căn cứ ưu tiên khi đường còn chưa rõ |
| CI đọc ảnh trước khi tải xong | Chờ ảnh giải mã thành công có timeout. Kiểm tra với request ảnh bị giữ lại, rồi cho tải tiếp. Chờ HTTP sẵn sàng trước khi chạy browser |
| Ký hiệu còn nhận tương tác khi vừa bật đo/tọa độ | Khóa trước khi vẽ khung hình và trước khi gắn lớp mới vào DOM. Kiểm tra đổi chế độ, tạo lại lớp và mở khóa khi đóng công cụ |
| Panel nhảy khi mở tùy chọn hoặc có kết quả | Giữ header tại vị trí đã chọn, cuộn nội dung bên trong. Kiểm tra sát đáy: không dịch vị trí khi đổi nội dung |
| Vẽ và kết thúc đo thiếu rõ ràng | Tách vẽ/xem/chỉnh sửa. Nhấp đúp điểm cuối, Enter hoặc nút Kết thúc. Đóng tạm dừng bản vẽ; Hủy chỉnh sửa khôi phục kết quả cũ |
| Mục mở rộng và hàng lớp bị lệch | Chevron nét mảnh ở cuối hàng. Căn giữa checkbox, tên lớp và nút nguồn |
| Không chọn được kiểu đo khi chỉnh sửa | Bỏ khóa bộ chọn. Đổi kiểu giữ kết quả hợp lệ trước khi bắt đầu phép đo mới. Kiểm tra bằng click thật và bàn phím |
| Hàng địa bàn sát nền hover/chọn | Khoảng đệm 12/16 px, giữ nguyên vị trí chữ khi chọn. Tên và trạng thái xuống hàng khi thiếu chiều rộng |
| Bề mặt và điều khiển chưa đồng bộ | Toolbar GIS cố định, canvas riêng bên dưới, tab nghiệp vụ gắn vào panel. Điều khiển 32 px/icon 18 px, cửa sổ công cụ bo 3 px với thanh tiêu đề chung. 2D/3D hiện cả hai lựa chọn và trạng thái. Công cụ đo nằm ngoài canvas, giữ vị trí khi mở mặt cắt |
| Nhãn và metadata không đúng nội dung | Đổi Độ cao thành Dữ liệu địa hình khi nói về DEM coverage. CRS/bước lưới đọc từ metadata. Bỏ chấm trực tiếp trên timestamp snapshot. Ký hiệu thôn bản dùng nhóm người |
| Đổi công cụ khi đang sửa hình đo | Đóng công cụ trả về hình đã áp dụng. Bản vẽ chưa kết thúc vẫn còn khi mở lại. Nút 3D dùng được và tự đóng đo trên 2D |
| Gỡ mô hình để bản đồ trống hoặc còn ảnh cũ | Khôi phục địa hình Chế Tạo; dọn raster và điểm của mô hình vừa gỡ. Danh sách tệp chỉ ghi mô hình do người dùng nạp |
| Thiếu định hướng khi xem gần | Tổng quan 2D thu gọn được, đồng bộ khung nhìn, click và bàn phím. Không tải thêm tile |
| Ảnh nền tối và bậc màu khi đổi hệ tọa độ | Giảm bóng trên ảnh, lấy mẫu màu song tuyến tính, giữ nodata. Texture 3D dùng anisotropic filtering theo GPU |
| Xem đường rồi quay lại mất ngữ cảnh địa bàn | Reducer điều hướng giữ địa bàn, tuyến và tab căn cứ. Mỗi tab có đối tượng và nơi quay về riêng |
| Công cụ nhận callback sau khi đóng | Một trạng thái sở hữu tương tác. Bỏ qua close/hover của công cụ không còn hoạt động |
| Bộ dữ liệu lỗi vẫn có thông tin sự kiện mẫu | Chỉ mở workspace khi packet/địa hình hợp lệ. Tải/lỗi không có sự kiện, timestamp hoặc marker mẫu |
| Đường dẫn và tên sự kiện gắn cứng với Chế Tạo | Cấu hình manifest dùng chung cho runtime, kiểm trước build, server và đóng gói. Fixture thứ hai kiểm AOI/đường/panel/JSON |
| Tìm cầu/bãi đáp nhưng kết quả dùng ký hiệu khác | Kết quả tìm kiếm giữ loại đối tượng, dùng cùng ký hiệu với bản đồ. Đường thiếu điểm ảnh hưởng chỉ hiển thị tình trạng, không tự gán sạt lở |
| Offline tải tile trước khi tắt nền mạng | Khởi tạo lớp theo cấu hình offline trước khi mount map. CI thử gói giải nén và kiểm không có request ngoài |

Ảnh tham chiếu giữ ba màn: tiếp cận, mặt cắt và công cụ đo. Ảnh kiểm thử phát sinh nằm trong thư mục review đã ignore. Bộ kiểm tra CI gồm panel trên 1366, 1024, 390, 320 px, các địa bàn thiếu tuyến và tiếng Anh.

## Kết quả nghiệp vụ

| Người dùng cần biết | Đã có | Cần bổ sung |
|---|---|---|
| Sự kiện và phạm vi đánh giá | Trigger, snapshot, AOI và số địa bàn trong vùng | AOI và nguồn sự kiện được duyệt |
| Địa bàn cần ưu tiên | Quy tắc từ ảnh hưởng, liên lạc, nhu cầu khẩn cấp. Có lý do và việc cần xử lý | Duyệt chính sách, Community Isolation Score |
| Đường cản trở tiếp cận | Trạng thái đoạn, bản ghi nguồn, giờ quan sát và nhận tin | Bằng chứng gốc, kiểm tra hiện trường |
| Phương án tiếp cận | Dijkstra trên mạng đường, khoảng cách, ETA có điều kiện | Mạng đường đủ vùng, tốc độ và phương tiện được kiểm chứng |
| Tin mới thay đổi gì | Đọc không đổi dữ liệu. Áp dụng tin tạo lại đường, tuyến và ưu tiên. Có lịch sử tin và xem bản dữ liệu cũ | Feed, duyệt công bố, lưu lịch sử trên server |
| Địa hình dọc tuyến | Mặt cắt theo hình tuyến, vị trí nối bản đồ, độ dốc DEM, khoảng thiếu | Nguồn DEM, vertical datum, kiểm chứng độ cao |
| Ký hiệu theo proposal | Địa bàn, đường, điểm ảnh hưởng, tập kết, H đề xuất | Polygon sạt lở/ngập, xác nhận đi được hoặc cô lập |
| Chia sẻ nhận định | Xem trước, PNG, in/lưu PDF, JSON và GeoJSON cùng snapshot | GeoPackage theo proposal, duyệt dữ liệu/nguồn, thử trên máy trình chiếu |
| So ảnh trước/sau | Đọc GeoTIFF hiển thị, kiểm ngày/nguồn/CRS/vùng chung, so bằng thanh trượt | Cặp ảnh RS duyệt, mask mây và chất lượng phân tích |

Ưu tiên cứu hộ không đồng nghĩa cô lập. Chưa ghi nhận tắc đường không đồng nghĩa đã xác nhận đi được. H là vị trí mô phỏng chưa khảo sát. Quy tắc và giả định ở [phân tích ứng phó](../architecture/response-analysis.md).

[Đánh giá GIS và viễn thám](gis-review.md) nêu ưu tiên cải thiện, căn cứ UI và các skill đã khảo sát.

## Thiết kế hiện hành

| Thành phần | Cách tổ chức |
|---|---|
| Panel | Bên trái, rộng 320–560 px. Nút đầu thanh tìm kiếm thu gọn và giữ lựa chọn. Khung lớp/đo/tọa độ kéo bằng tiêu đề, nhấp đúp hoặc Home để đặt lại |
| Địa bàn | Hai phần Tiếp cận và Căn cứ. Màn chính giữ trạng thái chung, tuyến đang xem, thời gian có điều kiện và đoạn cần kiểm tra |
| Đoạn đường | Tình trạng, chiều dài, quan sát, việc cần kiểm tra và địa bàn liên quan. Bỏ phần tham chiếu chỉ có mã |
| Nguồn | Nhận định, nguồn, giờ quan sát/nhận tin, ảnh hưởng và giới hạn. Đoạn liên quan mở được từ bản ghi |
| Bản đồ | 2D mặc định, 3D tải khi cần. Nhóm cùng loại mới có số đếm trên 2D. Nhóm khác loại/3D mở chọn đối tượng. Nhãn tránh chồng, chú giải tách lớp. 2D chỉ Bắc thật, 3D chỉ Bắc lưới |
| Tổng quan | Dùng lại raster, khung nhìn thật của 2D. Thu gọn mặc định, không tạo thêm thông tin nghiệp vụ. Chưa có footprint camera 3D |
| Công cụ đo | 6 kiểu đo ngang UTM trên 2D. Xem trước, bắt điểm, kết thúc, chỉnh sửa có áp dụng/hủy, hoàn tác/làm lại và giữ hình trong phiên. Tùy chọn và danh sách kết quả thay nội dung trong bảng |
| Tọa độ | Nút tâm ngắm mở bảng vị trí trên 2D/3D. Có WGS84, hệ tọa độ mô hình, độ cao và sao chép. Không hiển thị độ cao ngoài DEM trên 2D |
| Attribution | Nút thông tin mở nguồn và giấy phép. Giữ dòng credit tối thiểu khi dùng nền ngoài |
| Nguồn lớp | Nút thông tin cạnh từng lớp, mở một lớp mỗi lần. Tách ngày thu nhận, quan sát và tổng hợp. Metadata thiếu được ghi rõ |
| Tìm kiếm | Tên/mã hoặc tiếng Việt không dấu, chọn kết quả bằng bàn phím, mở chi tiết và đưa vào vùng nhìn |
| Chọn đường | Vùng bấm rộng hơn nét vẽ, viền sáng giữ màu tình trạng. Mặt cắt mở trực tiếp theo đoạn đường được chọn |
| Bản xuất | Snapshot được sao chép khi mở xem trước. PNG không phụ thuộc GPU hoặc Internet |

![Tiếp cận Nậm Khắt](assets/workspace-summary.png)

![Mặt cắt địa hình](assets/workspace-profile.png)

[Xem bản xuất PNG](assets/decision-map.png). Ảnh có cùng tuyến, thời điểm và nhận định với bản xem trước trong ứng dụng.

[Công cụ đo bản đồ](assets/workspace-measurement.png). Hình đo tạm giữ lớp tình huống để người trực đối chiếu.

Ảnh từ đợt kiểm tra trước khi chỉnh bề mặt và bố cục panel ngày 07/10. [Design system](../product/design-system.md) mô tả giao diện hiện hành. Khoảng trống ngoài ảnh địa hình là vùng thiếu nền cục bộ, không phải vùng đã xác nhận không có thiên tai.

## Kiểm tra kỹ thuật

| Kiểm tra | Kết quả |
|---|---|
| TypeScript và build | Đạt. Chia chunk app, React, Leaflet và validation. 2D không tải Three.js/GLB, 3D còn chunk lớn hơn 500 KB |
| TypeScript unit tests | 190 kiểm thử đạt. Có snapshot độc lập React, giữ ngữ cảnh điều hướng, một công cụ nhận input, callback cũ, chọn manifest, dataset khác và lỗi không đổi về mặc định. Các kiểm tra nguồn/thời gian, tuyến/ưu tiên, đo, tọa độ, so ảnh, GeoJSON, timeout và checksum vẫn đạt |
| Python | 18 kiểm thử đạt: dữ liệu, API đọc, đóng gói, chờ HTTP và cấu hình manifest |
| Chrome: prepared và API | Sự kiện, AOI, địa bàn, tuyến, nguồn, đọc/áp dụng tin và mặt cắt đạt |
| Chrome: lỗi dữ liệu và GPU | Chặn Internet, lỗi GLB, không có WebGL, mất context 3D: 2D tiếp tục dùng được. API lỗi không hiện dữ liệu mô phỏng thay thế |
| Chrome: thao tác và bố cục | Kéo/đổi độ rộng bằng bàn phím, khôi phục độ rộng, nhóm điểm, nhãn. Tổng quan theo pan/zoom, click, bàn phím và mở/đóng không tạo bản đồ trùng. Khoảng đệm hàng địa bàn đạt, hover không dịch chữ. Desktop 1440/1366/1024 px và mobile 390/320 px không tràn ngang |
| Chrome: đường và mặt cắt | Bấm lệch tâm nét đường 6 px vẫn chọn được. Mặt cắt mở trực tiếp, tên đúng đoạn đường. Canvas không đè toolbar hoặc mặt cắt ở 1366/390/320 px. Kiểm thứ tự nền/đường/tuyến/cảnh báo, ảnh xem trước và đo/lấy tọa độ |
| Chrome: báo cáo và phân tích ảnh | Việt/Anh, panel 1366/1024/390/320 px đạt. Báo cáo giữ giờ ghi nhận/tiếp nhận riêng. Phân tích giữ đúng giờ thu nhận ảnh 06:12 và nhận kết quả 07:05, không gắn nhãn giờ khảo sát |
| Chrome: tìm kiếm và bản xuất | Tìm không dấu và mã đường, xem trước, tải PNG/JSON, thời điểm và tuyến khớp trước/sau tin mới |
| Chrome: công cụ và biến thể | 6 kiểu đo, xem trước, kéo đỉnh, hoàn tác/làm lại, đơn vị, sao chép, giữ/ẩn/xóa hình, đo trực tiếp tuyến/AOI, thu gọn và 12 vòng đóng/mở. Đổi tối/Anh/font và qua 3D về 2D giữ phép đo. Mobile 390/320 px không tràn hoặc đè hướng Bắc |
| Chrome: công cụ phụ | Thông báo, xem dữ liệu cũ/về bản mới, độ rõ/lọc/nhãn, so GeoTIFF có tọa độ, mở lại cặp ảnh, GeoJSON, bản in và đặt lại phiên |
| Chrome: static delivery | Luồng chính và công cụ phụ đạt qua server tĩnh, không cần API. Lỗi CRS khi so ảnh cho phép chọn lại và thử tiếp |
| Chrome: nguồn lớp | Đạt: nguồn/ngày theo bản dữ liệu cũ/mới, ngày ảnh chưa có, giới hạn H, nguồn riêng cho Imagery/Terrain Light, bàn phím và chiều rộng 320–1366 px |
| Chrome: dataset khác | Fixture riêng thay ID/tên sự kiện, địa bàn, AOI và trạng thái đường. Panel, lựa chọn, quay lại và JSON xuất khớp. Manifest lỗi không hiện bộ mặc định. Dùng lại địa hình cục bộ, chưa phải thử khu vực/CRS khác |
| Chrome: gói offline | Giải nén thư mục mới, checksum, luồng ứng phó, PNG, 3D/2D và đặt lại đạt. Không phát sinh request mạng ngoài |
| Vòng đời 3D | Sửa gỡ listener trước khi React tháo canvas. Giải phóng tài nguyên GPU của renderer cũ, giữ dữ liệu để mở lại. 25 vòng thử nhanh không tăng DOM/listener |
| Phiên 30 phút | Đạt: 58 vòng chọn địa bàn/tuyến, mặt cắt, 3D/2D, áp dụng tin và đặt lại. 20 PNG, không lỗi JavaScript. Sau vòng 10: DOM/listener không tăng, JS heap tăng 0,70 MB |
| Lặp phiên trên build cuối | Linux sau sửa bố cục: 5 vòng trong 39,4 giây, DOM/listener giữ nguyên. Thử dài 30 phút ở hàng trên là kết quả của build trước |
| Kiểm workflow trên Linux | Container Ubuntu 24.04, Node 22.23.2, Python 3.12.3, Playwright 1.63.0 đạt: cài sạch, 190 unit/18 Python tests, audit, build, đóng gói và tám bộ browser checks gồm chọn dataset/gói offline. Panel kiểm cả chữ, metadata và bề mặt sáng/tối. Kết quả bản làm việc cục bộ không thay xác nhận GitHub Actions của commit mới |
| GitHub Actions | Đã sửa ảnh xem trước tải chậm và khoảng trễ khóa ký hiệu. Browser kiểm tra trạng thái ngay khi đổi chế độ/tạo lớp, trước khung hình tiếp theo. [Theo dõi workflow](https://github.com/hoxuanphu/UNISEC_Demo/actions/workflows/dear-web.yml) |
| Source dùng khi deploy | Import kiểm đúng chữ hoa/thường. Thư mục sạch với file được Git theo dõi chuẩn bị đủ dữ liệu, kiểm checksum đạt |
| Dependency audit | Vite 7.3.6, plugin React 5.2.0, Vitest 4.1.11. `source-map-js` cập nhật riêng lên 1.2.2 theo [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). `npm audit`: 0 cảnh báo, gồm cả công cụ phát triển |

CI chạy tám bộ kiểm tra: workspace, đo, tương tác bản đồ, nguồn lớp, panel, chọn dataset, gói offline và vòng lặp phiên. Script nằm trong `scripts/`, tên `check_*.py`. Bộ công cụ phụ/so ảnh có script riêng. Cài Playwright từ `scripts/requirements-browser.txt`, dùng Chromium hoặc `--chrome` trỏ đến Chrome đã cài.

Bước in PDF trong kiểm tra Chrome tự động có một lần timeout. Hai lần chạy lại đạt, chưa xác định nguyên nhân. Cần kiểm tra bản in trên máy trình chiếu.

Đã kiểm tra trên Windows và Linux. Cấu hình và [hướng dẫn Vercel](../operations/vercel.md) đã có. Chưa xác nhận bản deploy Vercel.

[Log phiên 30 phút](assets/session-30min.json): Chrome 154 headless, 1366×768, localhost và chặn Internet. Mở 2D đến khi ảnh hiện: 0,67 giây. Mở canvas/marker 3D lần đầu: 0,44 giây. Xuất PNG: 0,49–1,41 giây. Hash bản build nằm trong log; sửa nội dung nguồn nền sau phiên đã được kiểm tra riêng trên build cuối. Chưa đo FPS/GPU hoặc tốc độ trên máy trình chiếu.

Đã đối chiếu bốn giai đoạn tại proposal trang 2–3. Luồng web đạt trên dữ liệu mô phỏng; còn GPM/DMC, xử lý SAR/AI, Community Isolation Score, điểm số rủi ro/ưu tiên và GeoPackage. Chưa nghiệm thu dữ liệu, đo mục tiêu 3–6 giờ hoặc thử trên máy trình chiếu. Backend hiện chỉ có kế hoạch. PDF dùng bản in của trình duyệt. Xem [luồng demo sáu phút](../operations/walkthrough.md), [công việc SIC](../tasks/sic-2026.md), [gói offline](../operations/offline.md).
