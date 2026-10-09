# Yêu cầu sản phẩm

Trạng thái: Chưa nghiệm thu. Đích bàn giao SIC ngày 20/10. Phụ trách: PO. Cập nhật: 2026-10-05.

## Mục tiêu demo

DEAR hỗ trợ cán bộ ứng phó và chính quyền địa phương đánh giá tác động sau lũ quét/sạt lở miền núi. Bản SIC dùng **một sự kiện, một khu vực, một cộng đồng trọng tâm và hai tuyến tiếp cận**, với dữ liệu chuẩn bị trước. Xem [luồng trình diễn](../operations/walkthrough.md) và [tiến độ hiện tại](../tasks/sic-2026.md).

| Bước | Câu hỏi cần trả lời | Kết quả người xem nhận được |
|---|---|---|
| Sự kiện | Điều gì xảy ra, ở đâu, khi nào? | Bản đồ, thời điểm và phạm vi theo dõi |
| Đường sá | Đoạn nào bị chặn, đoạn nào chưa rõ? | Trạng thái từng đoạn và căn cứ khi mở chi tiết |
| Địa bàn | Nơi nào cần chú ý trước, vì sao? | Lý do ưu tiên, dân số tham chiếu và khả năng tiếp cận |
| Tuyến trong chi tiết địa bàn | Đường chính và đường vòng khác nhau thế nào? | Tình trạng từng đoạn, điểm cần xác minh và nguồn khi cần |

Định hướng theo [proposal, trang 1–3](../../../references/SIC2026/VinSpace_SIC2026_proposal.pdf). QTT là đối tác/nhà tài trợ tiềm năng; vai trò cụ thể nằm trong [kế hoạch sau SIC](../../../vsp-eo-platform/docs/plans/dear-pilot.md).

## Chức năng cần bàn giao

| ID | Chức năng | Người dùng làm được |
|---|---|---|
| P01 | Mở tình huống | Xem tên sự kiện, ngày, ranh giới khu vực; đưa bản đồ về vị trí ban đầu |
| P02 | Bản đồ 2D/3D | Xem ảnh và địa hình; có chế độ 2D dùng được khi 3D/WebGL gặp lỗi |
| P03 | Lớp dữ liệu | Bật/tắt nguy cơ, tác động, cộng đồng, đường, điểm ứng phó; xem chú giải và nguồn/ngày |
| P04 | Bằng chứng tác động | So ảnh trước/sau đủ chất lượng; mở bằng chứng của một nhận định |
| P05 | Thông tin cộng đồng | Xem lý do cần ưu tiên, tình trạng tiếp cận, dân số có nguồn hoặc nhãn thiếu dữ liệu |
| P06 | So hai tuyến | Xem cùng điểm đầu/cuối; so chiều dài, ETA, tình trạng đường và biểu đồ độ cao |
| P07 | Xuất bản tóm tắt | Xem trước và lưu PNG cùng dữ liệu JSON khớp bản đồ, tuyến chọn, bằng chứng, nguồn/ngày và điểm chưa xác minh |

Phạm vi theo [S02](../../../references/SIC2026/DEAR_SIC2026.docx) và [S03](../../../references/SIC2026/DEAR_SIC2026_WebApp.pdf). Cách kiểm tra từng chức năng: [A01–A10](../quality/acceptance.md). Bố cục màn hình: [thiết kế giao diện](interface.md).

**Bản chạy 05/10:** có bản đồ 2D/3D, tuyến/ưu tiên theo quy tắc, ETA có điều kiện, bản ghi nguồn, cập nhật tin và xem dữ liệu cũ. Có xem trước và xuất PNG, JSON, GeoJSON, in/lưu PDF. Công cụ so GeoTIFF đã có, chưa có cặp ảnh thiên tai được duyệt. API hiện chỉ đọc snapshot, chưa phải backend vận hành.

## Chức năng nhập và phân tích

Nhập KML/GeoJSON/WKT và AOI/footprint đã có trong [công cụ dữ liệu GIS](geodata-workspace.md), chạy tại trình duyệt. Tiếp nhận, lưu và công bố dữ liệu dùng chung vẫn là phần cần xây.

| Chức năng | Hiện tại | Phần cần xây |
|---|---|---|
| Vẽ đo trên bản đồ | Hình đo tạm trong phiên | Giữ là công cụ đo, không tự đưa vào lớp nghiệp vụ |
| Chọn/vẽ vùng phân tích | AOI bản nháp, nhập polygon và tính độ phủ footprint. AOI ứng phó vẫn theo gói | Catalog ảnh theo AOI, yêu cầu phân tích và kết quả có phiên bản |
| Nhập tin tại vị trí/đoạn đường | Tin cố định trong kịch bản | Form hiện trường, lưu server, kiểm tra và công bố |
| Nhập lớp của admin/chuyên viên | Chuẩn bị file trong repo | Quản lý dữ liệu theo sự kiện, upload/metadata, xem trước và lỗi kiểm tra |
| Nạp địa hình / cặp ảnh | Nạp để xem trong phiên | Nhập vào kho dữ liệu có phiên bản khi cần dùng chung hoặc phân tích |
| Chạy phân tích | Tính tuyến/ưu tiên trong trình duyệt | Yêu cầu phân tích, kết quả theo version đầu vào, trạng thái và lỗi |
| Nhập kết quả AI/viễn thám | Chưa có pipeline | Nhập sản phẩm có nguồn/phương pháp, kiểm tra rồi đưa vào đánh giá |
| Duyệt và lịch sử | Hai mốc mô phỏng | Bản nháp, người duyệt, revision bất biến, lịch sử và nhiều người dùng |

Luồng và dữ liệu dự kiến: [tiếp nhận và công bố dữ liệu](../../../vsp-eo-platform/docs/architecture/response-publication.md). Thứ tự triển khai và lựa chọn công nghệ: [kế hoạch backend](../../../vsp-eo-platform/docs/plans/roadmap.md#backend-và-worker).

## Phạm vi SIC

| Phạm vi | Quyết định |
|---|---|
| Phải có | Luồng 2D đầy đủ, bằng chứng, hai tuyến đã kiểm tra, xuất PNG |
| Chốt tại G2 | 3D và so ảnh trước/sau; nếu không đạt chất lượng thì ghi rõ phần rút gọn |
| Đã triển khai, cần thử máy trình chiếu | In/lưu PDF từ trình duyệt, gói chạy offline |
| Sau SIC | Nhận/xử lý ảnh tự động, điểm cô lập được kiểm chứng, routing theo điều kiện phương tiện và dữ liệu thực, bãi đáp được khảo sát, dự báo ngập, GeoPackage, nhiều sự kiện/tài khoản |

## Chọn dữ liệu và diễn giải kết quả

Chọn một sự kiện lịch sử miền núi và một tình huống dự phòng. RS/PO kiểm tra bốn điều kiện:

- Có bằng chứng liên hệ **tác động thiên tai → đường/cộng đồng → phương án tiếp cận**.
- Có ảnh, dữ liệu độ cao, đường/cộng đồng và hai tuyến cùng điểm đầu/cuối; xác định người kiểm tra nội dung.
- Có quyền trình diễn, xuất ảnh và lưu bộ dữ liệu trên máy demo.
- Biết nguồn, ngày và chất lượng dữ liệu; dùng ranh giới hành chính phù hợp thời điểm sự kiện.

App phân biệt **quan sát, suy luận, báo cáo và xác minh thực địa**. Đường giao vùng nghi tác động chưa đủ kết luận bị chặn; độ cao địa hình chưa đủ kết luận xe đi được. Quy tắc tính và gắn nhãn nằm trong [đặc tả dữ liệu](../architecture/data-contract.md).

Mục tiêu tạo bản đồ trong 3–6 giờ của proposal cần đo trên quy trình thực. Bản demo dùng dữ liệu chuẩn bị trước chưa chứng minh được mục tiêu này.
