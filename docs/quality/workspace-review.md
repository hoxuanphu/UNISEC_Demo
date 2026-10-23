# Kiểm tra workspace

Đây là phạm vi kiểm tra phần mềm bằng dữ liệu mô phỏng, không thay nghiệm thu dữ liệu hoặc thử với cán bộ trực.

## Kiểm tra tự động

[Workflow DEAR web](../../.github/workflows/dear-web.yml) là nguồn lệnh và cấu hình duy nhất. Kết quả từng commit ở [GitHub Actions](https://github.com/hoxuanphu/UNISEC_Demo/actions/workflows/dear-web.yml); kết quả local không thay xác nhận trên runner Linux.

- Mỗi push/PR: kiểm dữ liệu, unit/Python tests, audit, build, gói offline và các luồng browser chính: ứng phó, nhập GIS, duyệt bản nháp, vùng sạt lở, người dân mobile, nền bản đồ, ký hiệu, chọn bộ dữ liệu và mở gói offline. Kiểm tra chọn từng điểm và đồng bộ liên tab chạy với Vite.
- Khi thay đổi nhiều về giao diện hoặc trước bàn giao: chọn **Run workflow → Run extended UI and session checks**. Bộ mở rộng kiểm font/theme, bàn phím, khoảng cách, công cụ phụ và phiên 2D/3D. Có thể chạy riêng script liên quan khi sửa lỗi.
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


## Mạng đường địa phương và phim A–B

`test_local_network.py` kiểm tra gắn đầu đường, chia cạnh đích, giữ nguồn gốc và không nối giao cắt nội bộ. Vitest kiểm tra ba cặp làng, tuyến vòng tránh đường đỏ, giới hạn nối điểm, tỉ lệ khung và nội suy theo chiều dài đường. `check_local_route_film.py` kiểm tra canvas/MP4 dùng cùng khung 1920×1080, tuyến hiện dần, giữ đường đỏ, tốc độ, Anh/Việt và 320–1440 px. Kiểm tra bàn giao dùng tile offline thật và chặn mọi yêu cầu ngoài localhost; tùy chọn xuất MP4 giải mã ba khung từ file thực. CI chỉ thay ảnh nền ngoài bằng tile fixture, không thay graph hay thuật toán tuyến.
