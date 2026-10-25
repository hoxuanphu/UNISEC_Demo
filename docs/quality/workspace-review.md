# Kiểm tra workspace

Đây là phạm vi kiểm tra phần mềm bằng dữ liệu mô phỏng, không thay nghiệm thu dữ liệu hoặc thử với cán bộ trực.

## Kiểm tra tự động

[Workflow DEAR web](../../.github/workflows/dear-web.yml) là nguồn lệnh và cấu hình duy nhất. Kết quả từng commit ở [GitHub Actions](https://github.com/hoxuanphu/UNISEC_Demo/actions/workflows/dear-web.yml); kết quả local không thay xác nhận trên runner Linux.

- Mỗi push/PR: kiểm dữ liệu, unit/Python tests, audit, build, gói offline và các luồng browser chính: ứng phó, nhập GIS, duyệt bản nháp, vùng sạt lở, người dân mobile, nền bản đồ, ký hiệu, chọn bộ dữ liệu và mở gói offline. Kiểm tra chọn từng điểm và đồng bộ liên tab chạy với Vite.
- Khi thay đổi nhiều về giao diện hoặc trước bàn giao: chọn **Run workflow → Run extended UI and session checks**. Bộ mở rộng kiểm font/theme, bàn phím, khoảng cách, công cụ phụ và phiên 2D/3D. Có thể chạy riêng script liên quan khi sửa lỗi.
- Điều hướng người dân, chọn tuyến thay thế, cảnh báo đường, EXIF/GPS khi chụp và ảnh đã duyệt được kiểm trên bản production. Mạng đường trong xã được kiểm riêng ở 2D/3D, gồm chọn đoạn và tìm tuyến. Bộ kiểm tra gói Windows chạy lại các luồng này bằng runtime đi kèm với Internet bị chặn.
- Kiểm tra nghiệp vụ giữ riêng vùng nguy cơ/vết đã sạt, AOI, điểm báo cáo và tình trạng đường. Khoanh polygon không tự kết luận đường bị chặn. Thay đổi GIS chỉ áp dụng sau khi duyệt toàn bộ bản nháp.

## Tài liệu và ảnh

Chỉ sửa tài liệu sản phẩm khi thay đổi quy tắc, hợp đồng dữ liệu hoặc cách sử dụng. Không ghi lại log, số lượng test, danh sách lỗi theo ngày hay phiên bản dependency vào docs.

Ảnh hướng dẫn đang dùng nằm tại `viewer/public/guide`; chỉ thay khi hướng dẫn không còn đúng. Ảnh kiểm thử tùy chọn qua `--captures` lưu ở thư mục tạm, log/build/gói offline ở `viewer/dist-release` đã được Git bỏ qua. Không lưu ảnh kiểm chứng lặp hoặc báo cáo mỗi task trong docs/src.

## Giới hạn cần nghiệm thu

- Dữ liệu demo chưa chứng minh độ chính xác của ranh sạt lở, tuyến, DEM/ảnh hay thời gian xử lý thiên tai.
- Catalog prepared và mây toàn cảnh không thay chất lượng pixel hoặc tỷ lệ mây trong AOI. Ảnh nền không phải bằng chứng hiện trạng.
- Lưu cục bộ và đồng bộ các tab cùng trình duyệt không phải dịch vụ chia sẻ nhiều người dùng. Chưa có feed cảnh báo công khai hoặc chuỗi xử lý SAR/AI được nghiệm thu.
- Fixture ảnh, tọa độ và polygon chỉ để kiểm phần mềm; thử trên máy trình chiếu và dữ liệu thực vẫn cần RS/PO xác nhận.

Chi tiết bền vững nằm ở [bản đồ](../product/cartography.md), [GIS](../product/geodata-workspace.md), [hợp đồng dữ liệu](../architecture/data-contract.md) và [nghiệm thu](acceptance.md). Đối chiếu proposal tại [walkthrough](../operations/walkthrough.md#đối-chiếu-proposal), nguồn tại [tài liệu gốc](../sources.md#tài-liệu-gốc).


## Ảnh quang học và SAR

`check_map_performance.py` kiểm tra vị trí vẫn cập nhật khi camera đứng yên nhưng không tính lại nhãn hoặc dựng terrain liên tục; sau đó kéo và zoom để xác nhận map vẫn cập nhật. Chạy cùng bản production và gói offline. Không dùng ngưỡng FPS theo máy làm điều kiện CI. `coverageFeather.test.ts` so sánh từng pixel giữa xử lý liên tục và chia đợt, kiểm tra nhường luồng và hủy ảnh cũ; kiểm thử terrain giữ tọa độ, UV, vùng NoData và ngân sách tile.

Kiểm tra nhóm lớp đọc từ trên xuống như thứ tự vẽ, độ rõ ảnh phủ độc lập với độ rõ nền, đổi nền không đổi raster và bộ chọn GIS giữ đúng nguồn/ngày/kênh. `check_terrain_overlays.py` giữ FileReader đang chờ, chọn nguồn mới hoặc tắt ảnh rồi mới cho đọc tiếp để xác nhận kết quả cũ không bật lại raster; tắt ảnh cũng phải tắt GeoTIFF riêng đã đọc. Raster riêng được quản lý trong nhóm ảnh phủ, đường đồng mức nằm riêng trong phân tích địa hình.

`check_strix_imagery.py` kiểm tra ảnh STRIX VV thật, pixel NoData trong suốt, chọn lớp theo nhóm/ngày, đổi từ VH về VV khi nguồn chỉ có VV, attribution, căn vùng phủ, chuyển 2D/3D, nền sáng/tối và bố cục 320 px. Bộ kiểm tra portable chạy cùng luồng này khi chặn Internet. `analysisImagery.test.ts` và `preparedComparison.test.ts` giữ cặp Sentinel-1 riêng với STRIX, không tạo VH/RGB khi thiếu kênh nguồn. `tests/test_strix_sar.py` chạy bằng Python có GDAL/NumPy để kiểm tra công thức công suất sang dB, loại NoData khỏi trung bình, georeferencing và giữ nguyên byte TIFF nguồn.

## Mạng đường địa phương và phim A–B

`check_map_inspector_layout.py` tái hiện thẻ đường dưới hai hàng công cụ ở 2D/3D, kiểm tra tiêu đề và nút đóng bằng hit test thực. Kiểm tra nút công cụ không tràn khỏi hàng ở map hẹp, menu video không che thẻ cũ, giới hạn cửa sổ cao 480 px và màn rộng 320 px. Luồng mở **Video toàn cảnh Chế Tạo** phải đi từ menu trong app, tới đúng bản A/bản C và phát được hành trình, không chỉ kiểm tra một URL trực tiếp. Bộ portable dùng lại kiểm tra này.

`test_local_network.py` kiểm tra gắn đầu đường, chia cạnh đích, giữ nguồn gốc và không nối giao cắt nội bộ. Vitest kiểm tra ba cặp làng, tuyến vòng tránh đường đỏ, giới hạn nối điểm, khung 3D, bờ nước mềm và liên kết polygon với ảnh minh họa. `check_local_route_film.py` kiểm tra bản đồ/phim 3D, polygon vàng dùng chung không có icon tâm, timeline luôn hiện, tua/tốc độ, ảnh minh họa, cảnh cuối toàn mạng đường, Anh/Việt và 320–1440 px. Kiểm tra bàn giao dùng tile offline thật và chặn mọi yêu cầu ngoài localhost; tùy chọn xuất MP4 giải mã năm khung từ file 1920×1080 thực để kiểm địa hình, vùng vàng và đường đỏ. CI chỉ thay ảnh nền ngoài bằng tile fixture, không thay graph, DEM hay thuật toán tuyến.


`check_map_layer_order.py` kiểm tra các nhóm lớp theo thứ tự Điểm → Đường → Vùng → Tham chiếu → Ảnh phủ → Nền; thứ tự pane thực, cảnh báo trên tuyến, chọn đường trực tiếp và bố cục chỉ đường 2D/3D ở 320–1440 px khi chặn Internet.


`check_route_person.py` kiểm tra thiết bị dùng chung khi đổi tuyến hoặc chuyển 2D/3D, không sinh thêm người phát lại trong chế độ điều phối, giữ renderer, tách panel khỏi mặt cắt, mở ảnh/Escape và bố cục 320–1440 px.


`deviceDotGroups.test.ts` kiểm tra tám điểm trùng tọa độ, điểm đại diện trùng tọa độ thật, đủ mọi thành viên, tách/gộp ổn định theo zoom và không đẩy điểm ở mép map. `check_live_devices.py` kiểm tra chấm xanh lá/xanh dương dưới 14 px, pixel hiển thị đúng điểm chiếu qua nhiều lần zoom 2D/3D, không có đường nối trắng, chọn từng thiết bị trong cụm và tắt pulse khi giảm chuyển động. Giao diện cài đặt dùng trạng thái chọn rõ, hover/focus tách biệt; thẻ thiết bị dùng cùng viền, góc và khoảng cách với workspace. `deviceFeed.test.ts` kiểm tra thiết bị bám dữ liệu đường, người đến trước rồi đứng yên, điều động sau khi họ chờ, hai đối tượng gặp đúng vị trí, dừng hỗ trợ, cùng quay về, giữ đường chặn và không nối mạng rời/giao cắt. `check_live_devices.py` chặn Internet và kiểm tra hai loại ký hiệu, mã/trạng thái/tín hiệu, người gần đoạn chặn, bật tắt riêng lớp, renderer 2D/3D được giữ, xem đường và màn hình 320–1440 px.

Rà soát tích hợp: giữ test hồi quy cho ảnh SAR, NoData/CRS, tuyến chặn, hộ bị cô lập, chuyển động cứu hộ và bố cục bản đồ. Ảnh chụp browser tạm nằm trong TEMP, không nằm trong source. Chuỗi cứu hộ hộ bị cô lập đưa người dân tới xe, nghỉ rồi chạy xe về điểm đầu trước chu kỳ mới, không nhảy tọa độ; nút xem đội đọc vị trí mới nhất khi bấm. Ctrl/pinch chỉ do bản đồ nhận trong vùng map, không chặn page zoom ngoài map. Kiểm tra GDAL đầy đủ của STRIX chạy bằng Python QGIS; CI kiểm tra phần sigma0/NoData bằng NumPy và ghi rõ khi thiếu GDAL binding cho kiểm tra tích hợp.
