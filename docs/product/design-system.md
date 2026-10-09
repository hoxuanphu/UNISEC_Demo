# Design system DEAR

Quy tắc thiết kế dùng chung. Giá trị màu, font, kích thước và breakpoint lấy từ code; tài liệu không chép lại từng thông số CSS.

## Phong cách

| Nội dung | Quy tắc |
|---|---|
| Bố cục | Panel và bản đồ liền nhau, không bo góc ngoài. Panel đổi độ rộng; mobile tách Thông tin/Bản đồ |
| Màu | Tối dùng xanh than/xanh xám, sáng dùng trắng/xám ấm. Trạng thái có cả chữ hoặc ký hiệu, không chỉ dựa vào màu |
| Chữ | Phân biệt tiêu đề, nội dung và metadata. Số đo/giờ dùng chữ số đều độ rộng. Tránh số lớn khi không giúp đọc quyết định |
| Đường nét | Viền mảnh, góc nhỏ, bóng nhẹ trên lớp nổi. Không gradient trang trí, viền phát sáng hoặc nhiều thẻ lồng nhau |
| Bản đồ | Nền làm bối cảnh, dữ liệu tình huống nổi bật. Ký hiệu và nhãn theo [cartography](cartography.md) |
| Câu chữ | Theo [thuật ngữ](terminology.md). Tách nhận định, nguồn, thời gian và dữ liệu thiếu; không lặp cùng thông tin ở nhiều khối |

## Thành phần

| Thành phần | Hành vi cần giữ |
|---|---|
| Tab | Nghiệp vụ/công cụ dùng tab gắn với nội dung; chi tiết dùng gạch chân. Chừa đệm quanh nhãn, kể cả tiếng Anh |
| Nút | Hành động có nhãn cụ thể. Copy/đóng/điều hướng có thể dùng icon với tên truy cập. Không áp cùng nền hover cho mọi loại nút |
| Biểu mẫu | Giữ phần tử native và khả năng dùng bàn phím. Checkbox/select/slider nhất quán giữa workspace, modal và GIS mở riêng |
| Hàng mở rộng | Chevron ở cuối, cả hàng bấm được, có đệm và focus rõ. Chỉ thu gọn thông tin phụ; giữ trạng thái và hành động chính |
| Danh sách | Tên và trạng thái rõ, metadata nhỏ hơn. Hover không dịch chữ hoặc làm mất khoảng đệm |
| Cửa sổ công cụ | Header cố định, nội dung cuộn. Thay nội dung không làm nhảy vị trí. Desktop kéo/đặt lại được, mobile giữ vị trí cố định |
| Hộp thoại | Chung thanh tiêu đề và nút đóng. Cuộn nội dung, giữ focus khi mở, Escape đóng và trả focus |
| Nguồn/phương pháp | Mở từ lớp hoặc công cụ liên quan. Màn thao tác chỉ hiện giới hạn ảnh hưởng trực tiếp đến quyết định |
| Chuyển động | Chỉ dùng để phản hồi trạng thái; không thay đổi hình học dưới con trỏ. Tôn trọng tùy chọn giảm chuyển động |

## Nơi triển khai

| Cần sửa | Nơi sở hữu |
|---|---|
| Màu, font, giá trị dùng chung | [tokens.css](../../DEM_to_3D/viewer/src/styles/tokens.css) |
| Form và hàng mở rộng | [workspace-controls.css](../../DEM_to_3D/viewer/src/styles/workspace-controls.css), [DisclosureTrigger](../../DEM_to_3D/viewer/src/shared/ui/DisclosureTrigger.tsx) |
| Shell | [workspace.css](../../DEM_to_3D/viewer/src/styles/workspace.css); CSS thành phần ở cạnh feature |
| Icon/ký hiệu | `shared/ui/UiIcon`, `terrain/mapSymbols.ts`, `terrain/roadStyle.ts` |

Tham khảo: [QGIS](https://docs.qgis.org/3.40/en/docs/user_manual/introduction/qgis_gui.html), [Earth Engine](https://developers.google.com/earth-engine/guides/playground), [SkyFi](https://learn.skyfi.com/how-to/tasking-a-satellite-to-capture-a-new-image/) và ảnh UNOSAT do nhóm cung cấp. Luồng nghiệp vụ nằm ở [interface](interface.md).

Chỉ sửa tài liệu này khi đổi nguyên tắc hoặc hành vi dùng chung. Chỉnh màu, đệm, cỡ chữ hoặc sửa lỗi một component chỉ cần code và kiểm tra liên quan.

## Căn cứ thao tác

| Câu hỏi | Quyết định cho DEAR | Căn cứ |
|---|---|---|
| Dấu cộng để mở rộng có sai chuẩn GIS? | Không. Dùng chevron nét mảnh để phân biệt mở nội dung với zoom/thêm hình | [Calcite Accordion](https://developers.arcgis.com/calcite-design-system/components/accordion/) hỗ trợ chevron, caret và plus-minus. [W3C Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) quy định hành vi và trạng thái, không bắt buộc một hình icon |
| Cái gì được thu gọn? | Từng đoạn đo, nguồn và tùy chọn. Kết quả, trạng thái đường và hành động tiếp theo luôn thấy | [Calcite Block](https://developers.arcgis.com/calcite-design-system/components/block/) tổ chức nhóm điều khiển trong panel và khuyến cáo không giấu thông tin thiết yếu |
| Kết thúc phép đo thế nào? | Nhấp đúp, Enter hoặc nút Kết thúc. Kéo bản đồ không kết thúc phép đo | [ArcGIS Map Viewer](https://doc.arcgis.com/en/arcgis-online/get-started/measure-mv.htm) dùng click để thêm đỉnh, nhấp đúp để kết thúc và vẫn cho pan |
| Có cần ghi mọi giới hạn trên bản đồ? | Chỉ hiện cảnh báo ảnh hưởng trực tiếp tới thao tác/kết luận. CRS, cách tính và nguồn ở thông tin công cụ/lớp | Quyết định thiết kế của DEAR. Không xóa nguồn hoặc giới hạn khỏi metadata/bản xuất |
| Có cần bản đồ nhỏ? | Có trên 2D desktop, thu gọn mặc định. Giúp định hướng khi xem gần, hiển thị đúng khung nhìn, ẩn khi mở công cụ | [ArcGIS Overview map](https://developers.arcgis.com/javascript/latest/sample-code/overview-map/) là mẫu tham khảo. Đây là lựa chọn thiết kế, không phải yêu cầu bắt buộc của GIS |
