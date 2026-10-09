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

Đối chiếu thông số và trích dẫn ở phần dưới. Giữ nguyên PDF gốc.

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

## Đối chiếu nguồn kỹ thuật

Kết quả rà ngày 24/09/2026; chưa tái lập nghiên cứu hoặc xác nhận chất lượng trên tình huống demo.

### Dữ liệu và phương pháp

| Nội dung | Đối chiếu nguồn | Áp dụng cho DEAR |
|---|---|---|
| AW3D30 | Là DSM, có ảnh hưởng cây/công trình. [JAXA](https://www.eorc.jaxa.jp/ALOS/en/dataset/aw3d30/aw3d30_e.htm) | Ghi loại mô hình độ cao; không suy độ dốc mặt đường/khả năng xe đi từ DSM |
| “SAR khoảng 10 m” | Sentinel-1 IW GRD HR có pixel 10 × 10 m, độ phân giải khoảng 20 × 22 m. [ESA](https://sentiwiki.copernicus.eu/web/s1-products) | Ghi riêng pixel và độ phân giải; không dùng ngưỡng 500 m² chung cho mọi nguồn |
| Chu kỳ vệ tinh | Sentinel-1: 12 ngày/vệ tinh; phối hợp vệ tinh và lịch chụp ảnh hưởng lượt quan sát. ALOS-2: 14 ngày. [ESA](https://sentiwiki.copernicus.eu/web/s1-mission), [JAXA](https://www.eorc.jaxa.jp/ALOS-2/en/about/overview.htm) | Kiểm tra lịch chụp và thời gian nhận ảnh tại khu vực; chu kỳ không bảo đảm ảnh sẵn sau thiên tai |
| Mưa GPM | IMERG Early có độ trễ tối thiểu khoảng 4 giờ, lưới 0,1°, bước nửa giờ. [NASA](https://gpm.nasa.gov/data/imerg), [latency](https://gpm.nasa.gov/taxonomy/term/1357) | Chốt sản phẩm cụ thể; chưa coi là cảnh báo tức thời cấp thôn/xã |
| DMC / Sentinel Asia | Yêu cầu chụp khẩn cấp qua đầu mối đủ điều kiện trong mạng lưới JPT. [Sentinel Asia](https://sentinel-asia.org/e-learning/Emergency_Observation_Request.html) | Xác định DMC và quyền truy cập; chưa coi là API sẵn dùng |
| Bản đồ offline | Máy chủ tiles OSM công cộng không cho tải để dùng offline. [OSMF](https://operations.osmfoundation.org/policies/tiles/) | Tự tạo tiles hoặc dùng nguồn cho phép lưu; kiểm tra riêng ảnh và 3D |
| Khác biệt sản phẩm | Copernicus EMS đã có bản đồ thiệt hại và giao thông. [CEMS](https://mapping.emergency.copernicus.eu/about/rapid-mapping-portfolio/) | Tập trung vào cộng đồng, bằng chứng, so tuyến và bàn giao; không mô tả hệ thống khác là chỉ cung cấp ảnh thô |

### Trích dẫn cần hiệu chỉnh

| Mục trong proposal | Thông tin đối chiếu | Xử lý |
|---|---|---|
| Nava 2025, NHESS 25, 2371–2381 | Trang đúng **2371–2377**; DOI `10.5194/nhess-25-2371-2025`. [Bài gốc](https://nhess.copernicus.org/articles/25/2371/2025/) | Sửa số trang; thời gian trong bài tính từ ảnh được thu nhận, không từ lúc thiên tai xảy ra |
| Ganerød 2025, “Understanding Landslide Expression…” | Tác giả đầu **Erin Lindsay**; Remote Sensing 17(19), 3313; DOI `10.3390/rs17193313`. [Nhà xuất bản](https://www.mdpi.com/2072-4292/17/19/3313) | Sửa tác giả đầu |
| Mondini 2025, “A progressive learning approach” | **Prakash, Manconi & Mondini**; Applied Computing and Geosciences **25, 100224**; DOI `10.1016/j.acags.2025.100224`. [ETH Zürich](https://www.research-collection.ethz.ch/items/b065b005-aa2b-48e3-858e-c5bf3a237cb6) | Sửa tác giả/tạp chí; phương pháp cần nhãn ban đầu, chưa hoàn toàn tự động |
| Isya 2020, “CNN-Based Semantic Change Detection…”, CVPR Workshops | Bài gần tên nhất: **Gupta, Welburn, Watson & Yin**, ICANN **2019**; DOI `10.1007/978-3-030-30493-5_61`. [University of Manchester](https://research.manchester.ac.uk/en/publications/cnn-based-semantic-change-detection-in-satellite-imagery/) | Tác giả proposal xác nhận có đúng nguồn định trích dẫn trước khi thay |
| Hasegawa 2025, “Automatic Extraction of Road Networks…”, IEEE Access | Chưa tìm được bản ghi khớp tên/tác giả/nơi xuất bản | Cần DOI/bản gốc; chưa dùng làm căn cứ kỹ thuật |

Các mục có bản ghi phù hợp: [Coluzzi 2025](https://www.nature.com/articles/s41598-025-89542-8), [Nava 2022](https://kclpure.kcl.ac.uk/portal/en/publications/improving-landslide-detection-on-sar-data-through-deep-learning/), [Bai 2023](https://www.frontiersin.org/journals/earth-science/articles/10.3389/feart.2023.1287577/full), [Petricola 2022](https://link.springer.com/article/10.1186/s12942-022-00315-2). Petricola là tập 21, bài 14. Đây là kiểm tra trích dẫn, chưa tái lập kết quả nghiên cứu.

### Chưa đủ căn cứ

| Nội dung | Cần bổ sung |
|---|---|
| Sự kiện/khu vực demo | Bản tin và dữ liệu theo ngày/sự kiện; link chung tới ReliefWeb/VDDMA chưa đủ |
| Mục tiêu 3–6 giờ | Định nghĩa điểm bắt đầu/kết thúc; số đo thời gian chờ ảnh, xử lý và duyệt |
| QTT và các hợp phần S04 | Xác nhận đầu mối, đơn vị ban hành và phạm vi hợp tác; [Vingroup](https://vingroup.net/vi/linh-vuc-hoat-dong/thien-nguyen-br-xa-hoi/2476/quy-thien-tam) xác nhận hoạt động cứu trợ, chưa xác nhận vai trò vận hành cảnh báo |
