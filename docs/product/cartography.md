# Hiển thị bản đồ

Quy tắc cho bản đồ ứng phó DEAR, đối chiếu proposal trang 2–3.

## Góc nhìn và lớp mặc định

Điều phối mở ở 3D khi trình duyệt hỗ trợ WebGL; có thể chuyển sang 2D để đọc ranh sạt lở, địa bàn và đường tiếp cận. Khung nhìn đầu tiên bao gồm vùng đã khoanh và các điểm nghiệp vụ, không thu nhỏ toàn bộ chỉ vì một tuyến tham chiếu kéo dài ra ngoài khu vực. 3D lấy phạm vi vùng trên cả DEM chính và DEM ngữ cảnh.

Mặc định bật ảnh nền, vùng/điểm sạt lở, tình trạng đường, mạng đường, thôn bản, cầu và điểm tập kết. Mạng đường nền ở 65% độ rõ, nhãn tự động tránh chồng. AOI và bãi đáp đề xuất tắt lúc mở, có thể bật khi cần. Bản đồ khu vực bật khi trực tuyến; nguồn ảnh phân tích và các tùy chọn chuyên môn mở theo nhu cầu.

Mạng đường trong xã Chế Tạo hiện trên cả bản đồ chính 2D và 3D, giữ riêng khỏi các đoạn đường được đánh giá trong tình huống. Nét đường địa phương mảnh ở mức nhìn tổng thể, rõ dần khi phóng gần; không ghi tên cho từng nhánh. Đỏ chỉ đoạn bị chặn, vàng đứt là đoạn cần chú ý. Tuyến địa phương đang chọn dùng xanh liền, giữ viền vàng ở đoạn cần kiểm tra. Bật tắt và căn khung đường trong xã tại hàng tương ứng trong bảng lớp. Chạm đoạn để xem tên, chiều dài và tình trạng. Chỉ đường nằm cạnh ô tìm kiếm; các bản trong xã đứng đầu danh sách chọn điểm. Gợi ý dùng chung quy tắc điều kiện đường với bản người dân; có thể chọn tuyến khác trong kết quả. Khung nhìn chừa khoảng cho bảng chỉ đường và nhãn A/B, cả khi bảng đổi kích thước. Chỉ nối theo đồ thị đã có, không tạo đường thẳng giữa mạng địa phương và mạng ứng phó. Lớp này không tự thay đổi đánh giá, thứ tự ưu tiên hay đường tiếp cận đã công bố của tình huống.

Kiểm tra vùng sạt sát đường áp dụng cho toàn mạng địa phương, không giới hạn ở hành lang phía bắc. Điểm neo nằm trên đường tại vị trí gần polygon nhất trong ngưỡng 10 m, không kéo polygon về đường. Giữ cả các vòng trong của polygon: đường nằm trong phần khoét rỗng chỉ nhận cảnh báo khi sát biên vùng thực sự. Tình trạng chặn có sẵn và lớp điều kiện đóng đường được tác giả cung cấp giữ nguyên căn cứ; vùng khoanh chưa xác minh ở đường khác chỉ nâng cảnh báo, không tự đóng đường. Chia đoạn giữ đúng tổng chiều dài và các nút mạng. Chặn, nguy cơ và độ dài chưa rõ cùng tham gia lựa chọn tuyến; không bỏ qua vùng vàng để tạo một đường gợi ý có vẻ thuận lợi hơn.

Tắt lớp hoặc ẩn một hình học chỉ đổi hiển thị, không hủy cảnh báo đang dùng để tính đường. Gỡ/sửa nguồn vùng mới làm thay đổi liên kết cảnh báo. Việc xác nhận mở lại đường cần quyết định cập nhật tình trạng, không suy ra từ thao tác ẩn polygon.

Bảng lớp đặt **Ưu tiên ứng phó** lên đầu, có số vùng và nút đưa bản đồ tới các vùng. Bản đồ nền chọn riêng; ảnh phân tích, điểm hỗ trợ/tham chiếu, tùy chỉnh và phân tích 3D nằm trong các nhóm thu gọn. Khôi phục hiển thị chỉ đặt lại lớp và độ rõ, không sửa dữ liệu GIS.

Polygon đã lưu vẫn hiện khi cập nhật phiên bản mạng đường. Phiên bản mạng đường chỉ giới hạn các liên kết đánh giá đường; không dùng nó để ẩn hình học và bằng chứng vùng. Viền vàng sáng có viền tối mảnh để đọc được trên ảnh và nền sáng, tăng độ dày khi chọn và giữ phần tô trong suốt. Chú giải gọn trên desktop có mẫu vùng vàng; trên điện thoại thu gọn để dành chỗ cho bản đồ.

## Ký hiệu và tỷ lệ

| Đối tượng | Thể hiện | Điều kiện |
|---|---|---|
| Đường bị chặn | Đỏ, nét liền, biển tròn đỏ có vạch trắng | Có thông tin đoạn bị chặn |
| Đường có nguy cơ sạt lở | Vàng đứt, tam giác vàng | Có đánh giá nguy cơ trên đoạn đường, chưa xác nhận bị chặn |
| Đường chưa rõ | Vàng, nét đứt | Cần kiểm tra khả năng đi qua |
| Chưa ghi nhận tắc đường | Nét trung tính | Không suy ra là đường đi được |
| Tuyến đang xem / hành trình | Xanh liền, viền tối; viền vàng ở đoạn cần kiểm tra | Chỉ phần tuyến đã chọn; đoạn bị chặn luôn đỏ, không tô xanh |
| Cộng đồng | Đĩa xanh xám, hình ngôi nhà và viền trắng; khi chọn đổi thành ghim lớn | Có tọa độ địa bàn |
| Cộng đồng ưu tiên | Ký hiệu nâu trầm có viền sáng mảnh | Mức ưu tiên, không phải kết luận cô lập |
| Sạt lở được báo | Núi/đá màu đỏ | Báo cáo hiện trường có thời điểm |
| Nghi sạt lở | Núi/đá đỏ nhạt hơn điểm đã xác minh | Nhận định chưa kiểm chứng |
| Cầu, điểm vượt khe, điểm tập kết | Ký hiệu riêng | Không dùng cùng dấu chấm than cho mọi loại điểm |
| Bãi đáp H | Chữ H trong cùng khung POI trung tính | Vị trí mô phỏng ở trạng thái đề xuất, chưa khảo sát |
| Vùng nguy cơ sạt lở | Viền vàng, nét đứt dài, tô trong suốt | Khoanh vùng có căn cứ, lưu nguồn và mức rà soát; chưa phải xác suất sạt lở |
| Vết sạt lở đã xảy ra | Viền vàng liền, tô trong suốt | Ranh đã khoanh không đổi kiểu nét theo mức rà soát; nguồn và mức rà soát đọc trong hồ sơ vùng |
| Đường tham chiếu OSM | Nét kem mảnh, viền tối trên cả GIS và 2D/3D | Tư liệu tham chiếu, chưa xác minh khả năng đi qua; không phải hành trình đã chọn |
| AOI | Ranh giới nét đứt mảnh | Phạm vi đánh giá, không phải phạm vi ngập hoặc footprint DEM |

- POI thường có vùng bấm 28 × 28 px, khung đầu tròn thuôn về mũi ngắn, nền trắng, viền màu trầm mảnh và glyph khoảng 16 px. Cả POI và pin đỏ khi chọn đều neo mũi vào tọa độ. Hover dùng chính ký hiệu và nhãn hiện có. Không thêm vòng hover, màu nền sặc sỡ hoặc hiệu ứng nảy. Glyph được lưu kèm nguồn tại `viewer/vendor/material/ROUNDED_SOURCE.json`; icon công cụ ngoài bản đồ giữ nguyên.
- Nhãn ưu tiên đối tượng đang chọn, cộng đồng ưu tiên, điểm tập kết, rồi địa danh khác. Đo độ rộng theo font thực, thử nhiều vị trí, ẩn nhãn khi không còn chỗ. Tránh đè marker, nhãn và điều khiển.
- Điểm chồng nhau dùng glyph của đối tượng đại diện và số nhỏ khi đủ điều kiện đếm; nhóm điểm GIS nhập dùng nét xếp lớp không nền tròn. Ký hiệu nhóm neo tại tọa độ một thành viên. Không dời từng điểm sang vị trí giả. Với điểm tình huống, bấm phóng tới các thành viên để tách điểm; chỉ mở danh sách ngắn khi các tọa độ gần trùng nhau hoặc đã tới mức phóng lớn nhất. Danh sách dùng đúng glyph/màu của đối tượng, có số lượng và nút đóng. Tham chiếu hành vi [cụm điểm Google Maps](https://developers.google.com/maps/documentation/javascript/marker-clustering); không biến các điểm khác loại thành một loại sự cố mới.
- Gom theo loại: điểm cùng loại gộp khi ký hiệu chạm nhau. Khác loại chỉ gộp khi một ký hiệu che tâm ký hiệu kia. Còn lại cả hai cùng hiện, có thể chồng một phần, điểm nguy hiểm vẽ trên và tâm từng ký hiệu vẫn bấm được.
- Đại diện nhóm theo thứ tự: đang chọn, nguy hiểm đã báo cáo, cộng đồng ưu tiên, nguy hiểm nghi ngờ, điểm tập kết, rồi điểm khác. Sạt lở đã báo cáo không bị gộp dưới cộng đồng. Nhóm hỗn hợp còn chứa điểm nguy hiểm đã báo cáo dùng chấm nhóm màu đỏ, tên đọc cho trình đọc màn hình ghi rõ điều này.
- Số đếm chỉ dùng trên 2D, khi zoom nhỏ hơn mức 14 và nhóm cùng loại. Nhóm khác loại hoặc trong 3D không hiện tổng số. Đối tượng đang chọn giữ ký hiệu và dấu nhóm. Nếu điểm chọn nằm sau điều khiển, không gắn tên của nó lên điểm khác. Nhóm này xử lý chồng hình trên màn hình, không tính số địa bàn trong vùng hành chính.
- Polygon phải bám hình học thật. Chỉ có tọa độ điểm thì không vẽ vòng tròn/ellipse giả làm phạm vi sạt lở hoặc ngập.
- Vùng sườn dốc có thể đe dọa đường ở ngoài polygon. Liên kết với đường là nhận định có căn cứ, không chỉ là phép giao hình học. Phân biệt vùng phát sinh, lan truyền và bồi tích khi tư liệu cho phép; không tự tính runout từ polygon thủ công. Quy trình tại [GIS](geodata-workspace.md#vùng-nguy-cơ-và-vết-sạt-lở).
- Nút panel, tìm kiếm, lớp và đo nằm cùng thanh trên trái. Chú giải thu gọn được và tạm ẩn khi mở công cụ. Khung lớp/đo/tọa độ có thể kéo, không che nhóm điều hướng. Vị trí địa lý không đổi.
- Rê hoặc focus tên đối tượng trong danh sách làm rõ đúng tọa độ trên bản đồ; khi điểm nằm ngoài màn hình, bản đồ đưa điểm vào vùng nhìn. Bấm tên chọn chính đối tượng đó và hiển thị pin đỏ. Nhãn trên bản đồ là vùng bấm của điểm tương ứng.
- Nhãn có ba chế độ: tự động, chỉ đối tượng đang xem, tắt. Bật lại lớp giữ nguyên tọa độ. Đỉnh hình đo là dữ liệu người dùng vẽ, có thể chỉnh riêng.
- 2D dùng Bắc địa lý và thước khoảng cách ngang tại tâm bản đồ theo zoom. 3D dùng Bắc lưới, xoay theo camera. Không dùng thước phẳng cho góc nhìn nghiêng.
- Đường, vùng và neo điểm 3D lấy độ cao hiển thị trên đúng tam giác của DEM xuất, không dùng mặt nội suy song tuyến tính thay cho mesh. Đường được cắt ở cạnh ô và đường chéo tam giác, giữ nguyên XY và ngắt tại NoData. Các cách biểu diễn đường và tuyến chọn dùng cùng độ nâng hiển thị, không đẩy tuyến lên cao khi chọn. Phép đo độ cao vẫn giữ phương pháp nội suy phân tích đã công bố.
- Đoạn được kiểm tra giữ màu tình trạng; đoạn bị chặn dùng viền tối để không thành hai nét đỏ/trắng cạnh tranh. Phần tuyến đang xem dùng xanh liền, viền vàng ở đoạn cần kiểm tra. Biển cấm đỏ và tam giác nguy cơ dùng cùng SVG, cùng điểm neo trên đường trong bản người dân, điều phối 2D và 3D. Các đoạn nối điểm A/B vào mạng đường giữ nét chấm xanh để phân biệt với đường hành trình thực sự.
- Nguồn đầy đủ mở từ nút thông tin dưới phải. Credit tối thiểu của nền ngoài vẫn hiện theo yêu cầu của nhà cung cấp.

Phạm vi và cách kiểm tra nằm trong [kiểm tra workspace](../quality/workspace-review.md).

Chú giải dùng đúng khung POI trắng và nét của marker, không dùng huy hiệu tròn màu thay thế. Các vùng khoanh chỉ có trong chú giải khi lớp tương ứng đang hiện và có dữ liệu. Màu và độ rộng đường được dùng chung giữa GIS, bản đồ 2D/3D và bản xuất; dung sai bấm không phụ thuộc độ mảnh của nét.

## Ảnh nền và bản đồ tổng quan

Thứ tự hiện hành từ dưới lên: nền khu vực → ảnh/DEM cục bộ → ranh AOI → mạng đường → tuyến chọn → tình trạng đường → điểm đọc/chọn → hình đo và ký hiệu → nhãn/điều khiển. Nét cảnh báo không bị tuyến đang xem che. Bật/tắt lớp không thay thứ tự này. Hằng số dùng chung ở `features/map/mapLayerOrder.ts`, 2D dùng panes, 3D dùng render order.

Chọn đường tách khỏi độ dày nét vẽ: vùng bấm 2D rộng 16 px bằng chuột, 24 px khi cảm ứng. 3D có dung sai bắt nét theo pixel. Rê chuột làm rõ đoạn, bấm mở chi tiết và nút mặt cắt. Đây là lựa chọn UX của DEAR, không phải kích thước bắt buộc của một tiêu chuẩn.

| Thành phần | Hiện hành |
|---|---|
| Ảnh nền cục bộ | PNG 840 × 502, ô lưới khoảng 28,8 m. Lấy mẫu màu song tuyến tính để hiển thị, giữ nodata trong suốt. Ranh giới ảnh bao gồm nửa pixel ngoài tâm ô biên |
| Bóng địa hình | Nhẹ trên ảnh vệ tinh để giữ màu và chi tiết ảnh. Lớp địa hình vẫn có bóng riêng |
| Texture 3D | Anisotropic filtering tối đa 8× trong khả năng GPU, giảm mờ ở góc nhìn nghiêng |
| Giới hạn độ nét | Cải thiện render không bổ sung chi tiết mới. Muốn đọc vật thể nhỏ cần ảnh nguồn độ phân giải cao hơn, có nguồn và quyền sử dụng phù hợp |
| Tổng quan 2D | Khung 176 × 142 px ở dưới phải, thu gọn mặc định. Dùng lại raster cục bộ, không tải thêm tile. Ranh AOI nét đứt, khung nhìn chính nét liền |
| Điều hướng | Khung nhìn đổi theo pan/zoom. Click tổng quan chuyển tâm bản đồ chính, giữ mức zoom. Phím mũi tên dịch tâm, Enter về tâm vùng tổng quan |
| Không gian | Nhãn/marker tránh khung tổng quan. Ẩn trên mobile, cửa sổ thấp hoặc khi mở công cụ. Chưa hiển thị footprint camera 3D |

[ArcGIS: Overview map](https://developers.arcgis.com/javascript/latest/sample-code/overview-map/) dùng bản đồ phụ và vùng nhìn thật để giữ bối cảnh. DEAR triển khai trước trên 2D. [EOxCloudless](https://cloudless.eox.at/products/viewing) cung cấp nền Web Mercator tới zoom 14; tăng mức zoom không tạo thêm chi tiết ảnh.

## Địa hình dọc tuyến

| Đại lượng | Phương pháp |
|---|---|
| Khoảng cách | Cộng chiều dài các đoạn của hình tuyến trong CRS theo mét. Panel và mặt cắt dùng cùng hình học |
| Độ cao | Lấy mẫu DEM dọc hình tuyến bằng nội suy song tuyến tính trong vùng hợp lệ. Bước lấy mẫu theo kích thước ô lưới |
| Độ dốc dọc DEM | `100 × chênh cao / khoảng cách ngang` giữa hai mẫu hợp lệ liền nhau. Có dấu lên/xuống, đơn vị % |
| Tổng lên/xuống | Cộng chênh cao dương/âm. Chỉ trình bày tổng toàn tuyến khi có đủ DEM |
| Thiếu dữ liệu | Để trống đoạn biểu đồ, không nối qua nodata hoặc ngoại suy ngoài DEM. Không tính độ dốc qua khoảng thiếu |
| Tương tác | Rê chuột lên biểu đồ hoặc dùng thanh vị trí. Biểu đồ, dữ kiện tại vị trí và điểm trên bản đồ cùng đọc một mẫu |
| Chọn đoạn đường | Mở mặt cắt ngay từ chi tiết. Tên và chiều dài thuộc đoạn được chọn, không thay bằng toàn tuyến tiếp cận |

Biểu đồ có trục độ cao (m), khoảng cách (km), vùng dưới đường và vạch vị trí. Mở mặt cắt không vẽ thêm đường xanh che tình trạng đường. Độ dốc DEM không phải độ dốc mặt đường đã khảo sát. Nguồn gốc DEM hiện chưa được xác nhận trong metadata.

## Đo trên bản đồ

| Nội dung | Quy tắc |
|---|---|
| Khoảng cách | Cộng đoạn thẳng trên mặt phẳng EPSG:32648, đơn vị m/km. Không dùng pixel hoặc khoảng cách trên mặt phẳng Web Mercator |
| Diện tích | Đa giác từ ít nhất 3 điểm, đơn vị m²/ha/km². Hiển thị chu vi. Không nhận vùng tự cắt hoặc suy biến |
| Bán kính | Tâm và điểm trên đường tròn, tính bán kính và diện tích. Đây là hình đo, không phải vùng an toàn hoặc phạm vi ảnh hưởng |
| Phương vị / góc | Phương vị từ Bắc lưới UTM, 0–360°. Góc giữa 3 điểm, điểm thứ 2 là đỉnh, 0–180° |
| Tọa độ | Vĩ độ/kinh độ WGS84. Mở chi tiết để xem E/N UTM 48N |
| Thông tin vị trí 2D/3D | Công cụ riêng đọc WGS84 hoặc hệ tọa độ của mô hình, độ cao và sao chép. 2D lấy độ cao từ DEM, ngoài DEM không có giá trị. 3D lấy điểm trên địa hình, không dùng độ cao đã phóng đại |
| Phạm vi | Múi UTM 48N, 102° đến 108° Đông. Phép đo ngang, không cộng chiều dài theo sườn dốc |
| Vẽ và chỉnh | Rê chuột xem trước, nhãn cạnh con trỏ ghi đoạn đang kéo và tổng. Bấm thêm điểm; đỉnh đánh số. Chọn đỉnh trên bản đồ hoặc hàng trong bảng điểm; Delete/Backspace xóa đỉnh đang chọn. Tay nắm giữa đoạn chèn đỉnh khi bấm hoặc kéo. Sửa tọa độ trong bảng. Sửa một kết quả đã xong tự mở chỉnh sửa: Áp dụng để lưu, Hủy/Escape để khôi phục. Bắt điểm vào lớp đang hiện trong ngưỡng 10 px; giữ Alt khi bấm để đặt điểm tự do |
| Hình học có sẵn | Đo trực tiếp đoạn đường, tuyến đang chọn hoặc AOI để giữ đúng đường gấp khúc/ranh giới |
| Kết thúc | Nút Kết thúc, Enter/F2 hoặc nhấp đúp điểm cuối. Vùng có thể đóng bằng điểm đầu. Ctrl+Z/Ctrl+Y hoạt động khi vẽ hoặc chỉnh. Chuột phải không kết thúc phép đo |
| Giữ kết quả | Phép đo vào Kết quả ngay khi hoàn tất (Kết thúc, nhấp đúp, Enter hoặc điểm cuối của kiểu đo cố định số điểm). Phép đo đang xem có nhãn Đang xem; nhãn trên bản đồ dùng cùng số thứ tự. Chỉnh sửa rồi Áp dụng cập nhật đúng kết quả đó, không tạo bản sao. Đo mới bắt đầu phép đo tiếp theo. Có thể ẩn/xóa từng hình và sao chép kết quả; xóa kết quả đang xem cũng bỏ hình đó khỏi bản đồ. Đóng công cụ tạm dừng bản vẽ; mở lại để tiếp tục. Hủy/Escape bỏ bản vẽ chưa hoàn tất |
| Đổi kiểu khi chỉnh sửa | Luôn chọn được kiểu đo. Giữ kết quả chỉnh hợp lệ theo kiểu cũ, rồi bắt đầu phép đo mới. Nếu chỉnh chưa hợp lệ, giữ kết quả trước khi chỉnh. Bản vẽ chưa kết thúc không được lưu khi đổi kiểu |
| Vòng đời | Hình đo tồn tại trong phiên, hiện trên 2D và giữ khi đổi qua 3D. Tải lại trang hoặc Đặt lại phiên xóa hình đo. Phép đo chưa lưu thành lớp; dùng Vẽ để tạo đối tượng GIS |
| Diện tích màn hình | Kiểu đo là nhóm lựa chọn hiện sẵn. Bảng điểm (tọa độ, đoạn, cộng dồn, cạnh đóng vùng) luôn hiện khi có điểm và cuộn trong khung cao cố định. Thu gọn công cụ vẫn đo được. Mobile dùng khung đáy cao tối đa 48% vùng bản đồ |
| Nhãn đo | Chỉ giá trị và đơn vị, diện tích ở tâm hình. Khi công cụ mở, kết quả đang xem có thêm độ dài từng đoạn. Ưu tiên phép đo hiện tại, tránh công cụ và đối tượng nghiệp vụ. Không đủ chỗ thì ẩn nhãn, kết quả vẫn có trong panel |
| Vẽ đối tượng | Lệnh Vẽ cạnh Đo: điểm, đường, vùng, chữ nhật, hình tròn, ghi chú. Cùng thao tác đỉnh như đo. Lưu vào GIS thành bản ghi tham chiếu; hình tròn và chữ nhật là Polygon kèm `shape`, `center`, `radius_m`, `corners`. Ghi chú giữ chữ trên bản đồ. Đề xuất và lộ trình: [Đo và vẽ](../../../vsp-eo-platform/docs/product/measure-and-draw.md) |

Đo không tạo vùng ảnh hưởng, thay tình trạng đường hoặc tính lại mức ưu tiên.

Độ chính xác phụ thuộc dữ liệu nền. Đo trên ellipsoid, chiều dài bề mặt DEM, thể tích và chỉnh sửa lớp nghiệp vụ chưa thuộc bộ công cụ này. Mặt cắt dọc tuyến dùng công cụ địa hình riêng.

Mở rộng tiếp theo: mặt cắt theo đường tự vẽ và lưu/xuất hình đo thành lớp dữ liệu.

Điểm sạt lở biểu thị vị trí sự cố; đoạn đường liên quan biểu thị phần mạng đường chịu ảnh hưởng. Quan hệ giữa hai đối tượng phải được gắn bằng ID và được người quản lý rà soát. Có điểm sạt lở gần đường không tự động biến cả đường thành “bị chặn”. Tình trạng đường cần bằng chứng và thời điểm riêng. Tương tự, một tọa độ ngập không đủ để vẽ phạm vi ngập.

Các thay đổi trong GIS hiện được xem trước trong bản nháp. Nhiều thao tác trên lớp nhập và đối tượng ứng phó được áp dụng cùng một lần sau khi kiểm tra; hủy giữ nguyên dữ liệu đang dùng. Cơ chế này chỉ dành cho phiên demo trong trình duyệt, chưa thay thế quản trị phiên bản và quyền biên tập trên máy chủ.

## Đối chiếu Hình 2 của proposal

| Yếu tố | Hiện tại | Dữ liệu cần bổ sung |
|---|---|---|
| Ảnh nền, cộng đồng, ưu tiên, đường, phương án | Có | Xác minh tên và tọa độ trước sử dụng thực tế |
| Đường xanh lá đi được | Chưa có xác nhận | Kiểm tra hiện trường, phương tiện, thời điểm |
| Đường vàng khó đi nhưng đi được | Chưa có trạng thái này | Tách khỏi chưa rõ, có bằng chứng về khả năng đi qua |
| Vùng sạt lở và ngập | Chỉ có điểm ảnh hưởng | Polygon, vùng quan sát hợp lệ, ngày ảnh và nguồn |
| Khu cô lập | Chưa kết luận | Đủ mạng đường và điều kiện tiếp cận. Hai tuyến có đoạn bị chặn chưa chứng minh hoàn toàn cô lập |
| Bãi đáp trực thăng H | Có một vị trí mô phỏng, trạng thái đề xuất | Khảo sát độ phẳng, vật cản, hướng tiếp cận và đánh giá chuyên môn |
| AOI và phạm vi phân tích | Có AOI của bộ mô phỏng | Ranh giới phân tích cho dữ liệu thực, footprint ảnh và vùng hợp lệ. AOI hiện không phải địa giới hành chính |

## Căn cứ

CRS, datum, dữ liệu ảnh và định hướng engine: [nền tảng GIS và viễn thám](../../../vsp-eo-platform/docs/architecture/geospatial-platform.md). Demo chưa có nhập VN2000 hoặc pipeline phân tích ảnh được kiểm chứng, không ghi là đã đạt chuẩn vận hành.

| Nguồn | Phạm vi áp dụng |
|---|---|
| [ArcGIS: cấu hình clustering](https://doc.arcgis.com/en/arcgis-online/create-maps/configure-clustering-mv.htm) | Nhóm điểm thay đổi theo tỷ lệ, có ngưỡng zoom, số đếm và truy cập thành viên. Là mẫu tương tác GIS phổ biến, không phải quy định bắt buộc |
| [PROJ: UTM](https://proj.org/en/stable/operations/projections/utm.html) | Chuyển tọa độ địa lý sang mặt phẳng trong múi phù hợp trước khi đo |
| [ArcGIS Pro: Measure](https://doc.esri.com/en/arcgis-pro/latest/help/mapping/navigation/measure.html), [QGIS: Measuring](https://documentation.qgis.org/3.44/en/docs/user_manual/map_views/map_view.html#measuring) | Đơn vị, đoạn/tổng, bắt điểm, tọa độ, sao chép kết quả và phân biệt phương pháp đo |
| [QCVN 70:2022/BTNMT, bản hợp nhất có sửa đổi 2025](https://datafiles.chinhphu.vn/cpp/files/vbpq/2026/01/96-vbhn-bnnmt.pdf) | Quy chuẩn cho bản đồ địa hình quốc gia 1:50.000 và 1:100.000. Phân biệt ký hiệu theo tỷ lệ, nửa theo tỷ lệ và không theo tỷ lệ. Không coi đây là chứng nhận cho web ứng phó |
| [Mapbox: bố trí nhãn](https://docs.mapbox.com/help/dive-deeper/optimize-map-label-placement/) | Thứ tự ưu tiên, nhiều vị trí nhãn, tránh chồng lấn. Áp dụng chung cho 2D và 3D |
| [ArcGIS: nhãn](https://doc.arcgis.com/en/arcgis-online/create-maps/configure-labels-mv.htm), [thông tin vị trí](https://doc.arcgis.com/en/arcgis-online/get-started/scene-find-location-information.htm) | Kiểm soát mật độ nhãn và công cụ đọc tọa độ/độ cao khi cần |
| [Leaflet reference](https://leafletjs.com/reference), [EOX maps](https://maps.eox.at/) | Lớp 2D, ảnh, thước và attribution |
| [Google Earth: mặt cắt theo đường](https://support.google.com/earth/answer/148134?hl=en) | Độ cao theo khoảng cách, đọc vị trí tương ứng trên đường |
| [UNOSAT Nepal, 01/10/2024](https://unosat.org/static/unosat_filesystem/3990/UNOSAT_A3_Natural_Protrait_FL20240928NPL_01Oct2024.pdf) | Phân biệt vùng nước theo ngày, nước thường xuyên, phạm vi phân tích, nguồn và kiểm chứng. Đây là sản phẩm khác ảnh Nepal 2026 do người dùng cung cấp |

Chưa có cơ sở xác nhận tuân thủ toàn bộ quy chuẩn Việt Nam hoặc tiêu chuẩn quốc tế. Nghiệm thu bản đồ cần kiểm tra dữ liệu, hệ tọa độ, độ chính xác và mục đích công bố, bên cạnh chất lượng giao diện.

Nền 3D tải trước một số tile ngữ cảnh, sau đó bổ sung lớp chi tiết quanh footprint DEM, tối đa 224 tile mỗi kiểu nền; giữ tile đã tải khi bổ sung chi tiết. Ảnh vệ tinh 2D/3D dùng cùng nguồn XYZ cấu hình, giới hạn zoom gốc và attribution; mặc định Esri World Imagery, DEAR yêu cầu tile tới zoom 19. Texture nền 3D có lọc anisotropic tối đa 8×. Ảnh trực tuyến được phủ lên DEM theo cùng tọa độ; chỉ thay texture dự phòng khi đã tải đủ toàn bộ phạm vi ở một mức zoom. Không nội suy thêm chi tiết địa hình. Muốn đọc địa vật nhỏ cần ảnh độ phân giải cao hơn với thời điểm/nguồn/giấy phép phù hợp; đổi thư viện bản đồ không thay độ phân giải dữ liệu. [Nguồn ảnh nền và cấu hình](../operations/vercel.md#nguồn-ảnh-nền-chi-tiết) sở hữu thông tin provider/attribution.


## Chiều sâu và chuyển động

Giữ bố cục danh sách/bản đồ/chi tiết. Three.js dựng bề mặt từ DEM và cùng hệ ký hiệu với 2D. Nền công cụ trung tính ấm, chữ và biểu đồ dùng màu mực; màu cảnh báo dành cho dữ liệu có ý nghĩa. Không đổi sắc ảnh theo theme. Ánh sáng trung tính dùng chung cho DEM và nền khu vực; ảnh phủ chuyển nguyên phạm vi từ mức thô sang chi tiết, không ghép từng mảng với texture dự phòng. Nét đường kiểm tra độ sâu để không xuyên qua sườn núi; đường và ranh giới 3D ngắt tại NoData, không thay độ cao thiếu bằng mặt phẳng đáy. Khi tắt nền khu vực, điểm ngoài DEM cũng không được đặt lên một độ cao giả. Không thêm bloom, hạt hoặc vách địa hình giả. Thông tin nguồn ghi hệ số phóng đại độ cao. Bộ dữ liệu chuẩn hiển thị ở 1,15× qua transform chung của mô hình, điểm, vùng và mặt cắt; không sửa GLB hay độ cao phân tích. Ánh sáng nền 0,54π và nắng xiên 0,60π được điều chỉnh cùng hệ số này.

Nền 3D ngoài phạm vi DEM dùng [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) dạng Terrarium, tối đa 48 tile quanh bộ dữ liệu, 4 yêu cầu đồng thời. Nội suy qua tâm pixel liên tục giữa các tile; mẫu thiếu không thay bằng độ cao 0. Lớp lót thấp hơn bề mặt 8 m để giảm giao nhau khi hiển thị, không tham gia raycast đo đạc, mặt cắt hay kết luận nghiệp vụ. Nếu nguồn ngoài chưa tải được, giữ DEM cục bộ, để trống vùng thiếu và cho thử lại từ thông tin nguồn. Ghi nguồn/attribution tại cùng popover; không tự tải dữ liệu này khi vào bản đồ 2D.


Chọn tuyến hoặc đoạn đường đưa toàn hình học vào phần bản đồ còn nhìn được. Chọn điểm chuyển tâm trong khoảng nửa giây; kéo, cuộn hoặc lệnh mới ngắt chuyển động hiện tại. Tôn trọng giảm chuyển động của hệ điều hành. Không chạy dải sáng trên tuyến hoặc mô phỏng vùng sạt lở phát triển khi chưa có dữ liệu theo thời gian.

3D chỉ vẽ khi camera, lớp, ảnh hoặc vị trí đọc thay đổi; dừng khi đứng yên và khi tab ẩn. Nhãn vùng được chọn ghi loại vùng và diện tích tính từ polygon; không suy diện tích từ điểm ảnh chụp. Công cụ lớp có mẫu nét/ký hiệu trùng với bản đồ.

Timeline phân biệt bản đánh giá đã công bố với thời điểm nhận báo cáo; nhận báo cáo không tự đổi bản đánh giá. Giờ chỉ nằm trên timeline, ngày nằm trên tiêu đề và thời gian đầy đủ trong thông tin sự kiện. Attribution đầy đủ ở menu nguồn bản đồ, không lặp thêm dải chữ bên ngoài.


## Khảo sát Chế Tạo – Lao Chải

Đồng mức 3D là đường cắt lưới DEM ở cao độ thực, giữ cùng cách chia tam giác của
mesh và không nối qua NoData. Khoảng cao độ điều khiển mật độ nét, không nâng
độ phân giải nguồn. Nhãn cao độ tránh che khuất địa hình và nhãn đã có. Bật/tắt
lớp hoặc đổi khoảng cao độ giữ nguyên camera và cơ chế render khi có thay đổi.

SAR GeoTIFF là lớp hiển thị riêng theo CRS/geotransform và kênh nguồn. Giãn
tương phản không thay giá trị gốc, NoData trong suốt; đây không phải lớp hazard
hay kết quả phân loại sạt lở. SAR có thể kết hợp với ảnh trực tuyến hoặc tile
cục bộ mà không thay material hay dữ liệu gốc của mô hình sau mỗi lượt vẽ.

Ảnh Planet chuẩn bị từ GeoTIFF giữ pixel/alpha hợp lệ ở EPSG:32648 bằng WebP không mất dữ liệu; bản EPSG:3857 tái chiếu một lần để đặt ảnh 2D theo cạnh pixel. Lưới 3 m không thay chi tiết gốc khoảng 3,8–3,9 m được ghi trong metadata. Không coi phóng vượt tỷ lệ ảnh là thêm chi tiết, và không dịch OSM hay polygon KML để ép khớp một cảnh ảnh khác ngày.

Ba dải Planet được ghép trên cùng lưới thành một lớp hiển thị; vùng chồng nối chuyển tiếp trong 60 m, chỉ dùng pixel có dữ liệu. Giữ ngày chụp từng dải, không lấp mây hay mở rộng vùng phủ. Khung chữ nhật bao ngoài không đồng nghĩa có ảnh ở mọi pixel; phần ngoài vùng phủ dùng nền khu vực. Mỗi dải gốc và checksum được giữ để truy nguồn.

Tên tuyến dùng địa danh hai đầu “Mù Cang Chải – Chế Tạo”, đoạn được đánh số trong tuyến. Các khoảng cách là ước tính dọc hình học đường từ điểm xuất phát, không phải lý trình cột mốc được xác nhận. Vết sạt 01–03 liên kết mã khảo sát Scar 1–3, không dùng khoảng cách làm danh tính đối tượng. Tên hành lang đánh giá không thể hiện ranh giới hành chính.

Trong 3D, ảnh phân tích là lớp phủ riêng dùng chung hình học DEM, có NoData trong suốt, ở trên cả ảnh nền và ảnh nền chi tiết nhưng dưới vector. Lớp này dùng màu sản phẩm ảnh hiển thị, không trộn UV hoặc thay vật liệu DEM. Hệ tọa độ và nguồn được đối chiếu từ dữ liệu chuẩn bị; xác nhận sai số thực địa cần điểm kiểm chứng.

`CheTao-Landslide-Scars.kml` cung cấp 47 vùng khoanh và 3 điểm khảo sát. Giữ nguyên tọa độ, Z và tên nguồn; tên polygon trống được đánh số để dễ tìm. Ngày khảo sát, sai số ranh giới và liên hệ với đường chưa được cung cấp, nên không suy diễn từ giờ trong tên điểm hoặc thời điểm nhập file. Các vùng ở trạng thái chưa rà soát và không tự đổi tình trạng đường.

Hai DEM có sẵn của Chế Tạo và Lao Chải được ghép theo CRS và gốc tọa độ. Polygon Z=0 trong KML được phủ lên DEM khi hiển thị; dữ liệu gốc vẫn được giữ để xuất lại. Các lớp ảnh trong KML chỉ chứa GIF trong suốt và liên kết tile riêng của Google Earth, không chứa raster để đưa lên bản đồ.

Ảnh trực tuyến thay thế theo từng mức phủ đầy đủ; ảnh chi tiết phủ vùng camera đang nhìn, không phụ thuộc đối tượng được chọn. Cửa sổ ảnh có một hàng tile đệm ngoài vùng nhìn, tối đa 256 tile (64 trên thiết bị cảm ứng), 4 yêu cầu đồng thời; giới hạn kích thước texture theo GPU. Cùng một ảnh hoàn chỉnh được dùng cho các DEM và địa hình nền. Trong lúc tải hoặc khi lỗi mạng, ảnh mức trước vẫn được giữ. Mức zoom tile không phải độ phân giải hay độ chính xác đo đạc. Xoay địa hình do người xem chủ động bật, dừng khi kéo/cuộn/chọn vị trí và tôn trọng thiết lập giảm chuyển động.


Khi mở hồ sơ sạt lở, tình trạng ở đầu, ảnh hiện trường ngay bên dưới, tiếp theo là việc cần làm và ảnh hưởng. Nguồn/phân tích mở khi cần; ngày chụp đi cùng ảnh, không dùng ngày nhận báo cáo làm ngày chụp. Điểm khảo sát không có diện tích; diện tích vùng được tính từ polygon nguồn, không gán một diện tích kịch bản cho điểm.

Cân màu trình bày chỉ tác động **nền** theo màu Planet, dùng đường cong gamma RGB đơn điệu. Ảnh Planet, SAR, ảnh đối chiếu và raster nguồn giữ nguyên màu. Mẫu ghép cặp theo tọa độ chỉ lấy thảm xanh ở cả hai ảnh; loại pixel quá sáng/tối và vùng KML có đệm. Đây là lọc RGB thực dụng cho trình bày, không thay mặt nạ mây đa phổ hay chuẩn hóa phản xạ bề mặt. Tham số và checksum nguồn ở `basemap-tone.json`, công cụ chuẩn bị ở `prepare_basemap_tone.py`; nguồn nền tùy chỉnh không áp thông số Esri. Bật/tắt trong bảng lớp. Tham khảo [ArcGIS color balance](https://doc.esri.com/en/arcgis-pro/latest/tool-reference/data-management/color-balance-mosaic-dataset.html) và [Planet Visual/SR](https://docs.planet.com/data/imagery/planetscope/).

Đối chiếu trước/sau chọn riêng PlanetScope hoặc Sentinel-1 SAR trên **một** bản đồ, có thanh quét và nhấp nháy; ranh KML giữ nguyên hình học. SAR dùng hai ngày 11/10 và 18/10/2026, chọn cùng kênh VV/VH hoặc tổ hợp trên cả hai phía, cùng thang dB cố định và mỗi ảnh giữ vùng phủ thật. Đổi kênh giữ nguyên khung; khi mở SAR, căn vùng phủ chung để đối chiếu. Hai ngày SAR đều sau mốc đánh giá tháng 9, nhãn trước/sau chỉ thứ tự ngày chụp. Chưa xác nhận cùng quỹ đạo tương đối/góc tới, nên đây là đối chiếu trực quan, không phải phát hiện biến động hay xác nhận sạt lở. Tham khảo [Earth Engine Sentinel-1](https://developers.google.com/earth-engine/guides/sentinel1). GIF xuất theo cùng khung, ngày ảnh và nguồn đang chọn. NoData của mỗi phía để trống, không lấy ảnh bên kia lấp vào. Hiển thị ngày chụp của mỗi dải; ranh chưa có ngày tư liệu không được gắn ngầm vào ngày ảnh đang mở.

`resources/kml/MuCangChai_CheTao_roadPath.kml` là đường tham chiếu 397 đỉnh, không chứa ngày ảnh. `activity_24686163702.kml` là track GPS ngày 09/10/2026, ở phía nam tuyến demo; không phải ranh sạt lở hay thời điểm chụp vệ tinh. Không dùng hai tệp này để xác nhận ngày khoanh ranh trong `CheTao-Landslide-Scars.kml`. Kịch bản ứng phó có vị trí từ nguồn thật nhưng trạng thái đường/báo cáo vẫn là mô phỏng; không coi đó là kiểm chứng hiện trạng.

Mặt cắt 2D/3D dùng cả lưới Chế Tạo và Lao Chải ngay khi mở bộ dữ liệu; không cần tải GLB để có cao độ. Ở vùng chồng lấn, ưu tiên mẫu hợp lệ, bỏ qua NoData của tile trước. Khoảng ngoài tất cả DEM vẫn để trống, không nội suy kéo dài cao độ. Khi mở mặt cắt, việc đọc vị trí giữ con trỏ trong phần bản đồ không bị bảng chi tiết che.

Hành trình mặc định khoảng 25 giây, dừng ngắn để xem ảnh từng điểm khảo sát. Cuối phim kéo ra trong 3 giây rồi giữ góc nhìn toàn tuyến và vùng quan tâm. Tốc độ phát 0,75×–1,5× chỉ đổi lúc xem; MP4 giữ nhịp phim chuẩn.


Mép DEM và địa hình nền được nối bằng các dải tam giác theo đúng cạnh ô DEM hợp lệ và mặt tam giác nền. Dải nối chỉ phục vụ hiển thị, không mở rộng vùng đo, không thay đổi cao độ DEM và không bắc qua NoData của địa hình nền. Không cắt bỏ dải nối bằng mặt nạ XY của DEM vì sẽ làm lộ nền cảnh ở góc nhìn xiên.

Đường quay và khoảng hở địa hình được tính trước ở 30 mẫu/giây; phát, tua và xuất dùng cùng một đường quay. Ảnh chi tiết tại các điểm dừng được chuẩn bị hình học và nạp vào GPU trước khi phát. Khi kết thúc, giải phóng các ảnh chuẩn bị trước khi thu hồi canvas nguồn.

Ảnh đối chiếu ngày 1/9/2026 giữ riêng hai dải thực có trong bộ nguồn; không lấy ảnh ngày khác để lấp dải phía nam còn thiếu hoặc vùng mây. Cảnh này rõ hơn tại khu vực Vết sạt 03; tại Vết sạt 01–02, cảnh 12/9/2026 phù hợp hơn. Lớp mặc định vẫn là bộ ảnh mới nhất đã chọn theo dải. Ranh KML chưa có ngày giải đoán đã xác nhận: chênh lệch phạm vi đất trống giữa các ngày không phải căn cứ để co giãn hoặc dịch ranh. Pixel hiển thị 3 m không thay thế độ phân giải gốc khoảng 3,8–3,9 m hay xác nhận độ chính xác vị trí.


Cấu hình cân màu thuộc về từng renderer ảnh nền, không suy ra từ tên nhóm scene. Các lớp ảnh chi tiết và ảnh chuẩn bị cho hành trình phải nhận cùng cấu hình kể cả khi được tạo sau lần tải ban đầu. Không áp đường cong này lên pixel Planet. Label bản đồ dùng Roboto được đóng gói cùng app, độc lập với font giao diện; nguồn và giấy phép tại `viewer/public/fonts/LICENSE-Roboto.txt` ([Google Fonts](https://github.com/google/fonts/tree/main/ofl/roboto)). Kích thước và điểm neo của ký hiệu được dùng chung cho WebGL, Leaflet và bố trí tránh chồng lấn.

Máy quay theo vùng đệm của tuyến thay vì bám từng khúc cua của marker. Khung hành trình rộng hơn để đọc được đường đã đi và các vết sạt bên cạnh; lúc hiện ảnh chỉ siết khung nhẹ, cuối phim vẫn bao quát toàn vùng quan tâm. Khi hủy lúc đang chuẩn bị, kết quả tải muộn không được tự khởi động lại phim. Tài nguyên hình học, ảnh bitmap và canvas riêng của phim được giải phóng khi thay hoặc đóng viewer.

Dùng `tools/audit_planet_sources.py` để kiểm kê đủ bốn thư mục Planet theo thời gian UTC, CRS, lưới pixel, vùng alpha hợp lệ và cảnh đã chọn. Cảnh cùng ngày nhưng khác strip phải được chọn rõ, không lấy tệp đầu tiên theo glob. Thư mục bổ sung RoadPart1 ngày 12/4 có cùng khung RoadPart1, không làm vùng Planet rộng hơn. Ảnh Visual là RGB, không phải chuỗi DEM; chênh lệch dấu sạt hoặc màu giữa ngày ảnh không tự thay đổi mô hình cao độ. Mở rộng góc xem ngoài ảnh Planet dùng nền ngữ cảnh có nguồn riêng, không kéo giãn ảnh Planet hay lấp NoData bằng một ngày khác mà không ghi nhận.

Khi tìm đường trên bản đồ ghép nhiều mạng, điểm được chọn từ danh sách nguồn giữ phạm vi các đường của nguồn đó khi gán vào đường. Bãi đáp và các bản trong KMZ Chế Tạo không tự gán vào tuyến hành lang khác chỉ vì đường đó gần hơn vài mét. Điểm do người dùng chọn trên bản đồ vẫn dùng đường hợp lệ gần nhất; không tự tạo nút nối giữa các mạng hoặc bỏ qua đoạn bị chặn.


Thứ tự chồng lớp dùng chung giữa 2D/3D, lưu theo trình duyệt với khóa phiên bản `dear.map-drawing-order.v1`. Bảng lớp đọc từ trên xuống; người dùng đổi vị trí mạng đường, dữ liệu tham chiếu, vùng sạt và ranh đánh giá. Ảnh nền/phân tích luôn ở dưới, tuyến đang xem, tình trạng đường, ký hiệu và công cụ luôn ở trên. Thứ tự chỉ ảnh hưởng vẽ, không đổi tọa độ, cao độ, độ sâu địa hình hay điều kiện tuyến.

Chỉ đường dùng nhãn điểm xuất phát/điểm đến, dấu chấm đầu tuyến và ghim đích. Người dùng chọn đường ngắn nhất, ưu tiên điều kiện đường trong giới hạn vòng thêm 25%, hoặc cứu hộ đi bộ ưu tiên giảm phơi nhiễm nguy cơ. Chọn trực tiếp một đường giữ định danh đường đó để không gán sang mạng sát bên; điểm chọn trên nền vẫn dùng đường hợp lệ gần nhất. Đoạn nối chưa xác minh hiện riêng, không cộng vào chiều dài mạng đường. Mở công cụ giữ nguyên chế độ 2D/3D và khung tuyến chừa chỗ cho bảng điều khiển.


Chuyển động người dân trên tuyến dùng một đồng hồ demo riêng, không ghi đè GPS của thiết bị và không gửi tọa độ giả vào báo cáo. Trên giao diện chỉ hiện tên người, dấu vị trí, phát/dừng, tốc độ phát và vị trí trên tuyến theo yêu cầu trình diễn. Nội suy theo mét dọc hình học đường, không chia đều theo số đỉnh và không chạy qua đoạn nối nét đứt chưa xác minh. Tuyến có đoạn bị chặn không được phát; đổi tuyến, đảo chiều hay cập nhật hình học tạo lại vị trí đầu. Đóng công cụ, đổi vai trò hoặc ẩn tab sẽ dừng đồng hồ. Hai renderer đăng ký cùng trạng thái, chỉ cập nhật dấu vị trí, không tạo lại terrain/camera mỗi frame. Mũi tên trang trí dọc tuyến được bỏ.

Bảng chỉ đường chừa chiều cao mặt cắt, thu gọn khi mở mặt cắt. Xem một vùng sạt địa phương tạm thay bảng chỉ đường bằng bảng ảnh, giữ hình học tuyến trên map; đóng vùng sạt trở lại tuyến đã chọn. Ảnh thu nhỏ mở được bản đầy đủ và giữ chú thích phân biệt ảnh khảo sát minh họa với xác nhận tại vùng.


Lớp thiết bị định vị điều phối dùng dữ liệu kịch bản cục bộ, tách khỏi GPS thật và báo cáo người dân. UI hiện mã/tên thiết bị, trạng thái, đường và thời điểm tín hiệu, không hiện nhãn giả lập theo yêu cầu trình diễn. Người dân dùng chấm xanh dương 11 px, cứu hộ dùng chấm xanh lá 13 px, cùng viền trắng mảnh; bỏ hình người/khiên và vòng cảnh báo quanh điểm. Bảng lớp và chú giải dùng cùng ký hiệu. Tên chỉ hiện khi hover/focus, trạng thái đầy đủ nằm trong thẻ được chọn. Một đồng hồ dùng chung cho 2D/3D, không tự đổi camera hay điều kiện đường. Hai chuỗi hỗ trợ: người dân đi đến điểm chờ cách đầu đoạn chặn 8 m trên đường liền kề còn đi được, dừng chờ; sau năm giây đội cứu hộ xuất phát từ phía đường tiếp cận, gặp người dân, dừng hỗ trợ 12 giây rồi cùng quay về điểm tập kết trên chính đường đó. Giữ nguyên topology và mọi đoạn chặn. Nếu không có đường tiếp cận nối thật, chỉ đặt người chờ trước điểm tiếp xúc vùng sạt 40 m, không tạo đường cứu hộ giả. Kịch bản chạy một lần rồi giữ trạng thái đã tới, không lặp hay dịch chuyển về đầu. Chấm nằm đúng vị trí chiếu của tọa độ trong mọi mức zoom, không tránh vật cản bằng cách dịch chấm và không có đường nối trắng. Các thiết bị cách nhau dưới 18 px gộp tại tọa độ thật của một thành viên, xem/chọn được từng người hoặc đội trong cùng thẻ. Điểm đại diện giữ màu đúng vai trò: cứu hộ luôn xanh lá, người dân luôn xanh dương; không chia đôi màu khi cụm có nhiều vai trò. Thành viên vẫn xem được trong thẻ và tách tự nhiên khi phóng to. Vòng tín hiệu mờ và nhịp phồng nhẹ ở đúng tâm chạy chu kỳ 3,2 giây, không làm chấm chính nhấp nháy mất đi; tắt khi giảm chuyển động. Trong 2D, vị trí đồng bộ với phép biến đổi zoom của Leaflet. Lớp vị trí ở dưới công cụ/chú giải; các lớp nền/ảnh và vector giữ quy tắc thứ tự hiện có.
