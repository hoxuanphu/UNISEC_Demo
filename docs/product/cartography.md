# Hiển thị bản đồ

Cập nhật: 2026-10-07. Quy tắc cho bản đồ ứng phó DEAR, đối chiếu proposal trang 2–3.

## Ký hiệu và tỷ lệ

| Đối tượng | Thể hiện | Điều kiện |
|---|---|---|
| Đường bị chặn | Đỏ, nét liền | Có báo cáo đoạn bị chặn |
| Đường chưa rõ | Vàng, nét đứt | Cần kiểm tra khả năng đi qua |
| Chưa ghi nhận tắc đường | Nét trung tính | Không suy ra là đường đi được |
| Tuyến đang xem | Xanh dương | Đoạn bị chặn/chưa rõ vẫn giữ màu cảnh báo, viền trung tính |
| Cộng đồng | Nhóm người màu xanh | Có tọa độ địa bàn |
| Cộng đồng ưu tiên | Nhóm người màu nâu vàng | Mức ưu tiên, không phải kết luận cô lập |
| Sạt lở được báo | Núi/đá màu đỏ | Báo cáo hiện trường có thời điểm |
| Nghi sạt lở | Núi/đá viền đỏ nét đứt | Nhận định chưa kiểm chứng |
| Cầu, điểm vượt khe, điểm tập kết | Ký hiệu riêng | Không dùng cùng dấu chấm than cho mọi loại điểm |
| Bãi đáp H | Chữ H trong vòng tròn nét đứt | Vị trí mô phỏng ở trạng thái đề xuất, chưa khảo sát |
| AOI | Ranh giới nét đứt mảnh | Phạm vi đánh giá, không phải phạm vi ngập hoặc footprint DEM |

- Điểm dùng biểu tượng 28 px, không mô tả kích thước thật. Zoom làm thay đổi vị trí và mật độ nhãn, không phóng icon theo địa hình.
- Nhãn ưu tiên đối tượng đang chọn, cộng đồng ưu tiên, điểm tập kết, rồi địa danh khác. Đo độ rộng theo font thực, thử nhiều vị trí, ẩn nhãn khi không còn chỗ. Tránh đè marker, nhãn và điều khiển.
- Điểm chồng nhau dùng ký hiệu nhóm 34 px tại tọa độ một thành viên. Không dời từng điểm sang vị trí giả. Bấm mở danh sách chọn hoặc chọn **Xem khu vực này** để tách điểm. Nhóm điểm gần nhau không có nghĩa là các điểm trùng tọa độ.
- Số đếm chỉ dùng trên 2D, khi zoom nhỏ hơn mức 14 và nhóm cùng loại. Khác loại hoặc trong 3D không hiện tổng số, giữ ký hiệu/tên địa bàn ưu tiên làm điểm đại diện khi có chỗ. Đối tượng đang chọn giữ ký hiệu và dấu nhóm. Nếu điểm chọn nằm sau điều khiển, không gắn tên của nó lên điểm khác. Nhóm này xử lý chồng hình trên màn hình, không tính số địa bàn trong vùng hành chính.
- Polygon phải bám hình học thật. Chỉ có tọa độ điểm thì không vẽ vòng tròn/ellipse giả làm phạm vi sạt lở hoặc ngập.
- Nút panel, tìm kiếm, lớp và đo nằm cùng thanh trên trái. Chú giải thu gọn được và tạm ẩn khi mở công cụ. Khung lớp/đo/tọa độ có thể kéo, không che nhóm điều hướng. Vị trí địa lý không đổi.
- Nhãn có ba chế độ: tự động, chỉ đối tượng đang xem, tắt. Bật lại lớp giữ nguyên tọa độ. Đỉnh hình đo là dữ liệu người dùng vẽ, có thể chỉnh riêng.
- 2D dùng Bắc địa lý và thước khoảng cách ngang tại tâm bản đồ theo zoom. 3D dùng Bắc lưới, xoay theo camera. Không dùng thước phẳng cho góc nhìn nghiêng.
- Đoạn được kiểm tra có viền sáng, vẫn giữ màu tình trạng. Màu xanh đánh dấu phần tuyến đang xem, không che đoạn đỏ hoặc vàng.
- Nguồn đầy đủ mở từ nút thông tin dưới phải. Credit tối thiểu của nền ngoài vẫn hiện theo yêu cầu của nhà cung cấp.

## Ảnh nền và bản đồ tổng quan

Thứ tự hiện hành từ dưới lên: nền khu vực → ảnh/DEM cục bộ → ranh AOI → mạng đường → tuyến chọn → tình trạng đường → điểm đọc/chọn → hình đo và ký hiệu → nhãn/điều khiển. Nét cảnh báo không bị tuyến xanh che. Bật/tắt lớp không thay thứ tự này. Hằng số dùng chung ở `features/map/mapLayerOrder.ts`, 2D dùng panes, 3D dùng render order.

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
| Vẽ và chỉnh | Rê chuột xem trước, bấm thêm điểm. Sau khi kết thúc, chọn Chỉnh sửa để kéo đỉnh, Áp dụng để lưu, Hủy/Escape để khôi phục. Bắt điểm vào lớp đang hiện trong ngưỡng 10 px |
| Hình học có sẵn | Đo trực tiếp đoạn đường, tuyến đang chọn hoặc AOI để giữ đúng đường gấp khúc/ranh giới |
| Kết thúc | Nút Kết thúc, Enter/F2 hoặc nhấp đúp điểm cuối. Vùng có thể đóng bằng điểm đầu. Ctrl+Z/Ctrl+Y hoạt động khi vẽ hoặc chỉnh. Chuột phải không kết thúc phép đo |
| Giữ kết quả | Đo mới hoặc đổi kiểu giữ phép đo đã hoàn tất. Có thể ẩn/xóa từng hình và sao chép kết quả. Đóng công cụ tạm dừng bản vẽ; mở lại để tiếp tục. Hủy/Escape bỏ bản vẽ chưa hoàn tất |
| Đổi kiểu khi chỉnh sửa | Luôn chọn được kiểu đo. Giữ kết quả chỉnh hợp lệ theo kiểu cũ, rồi bắt đầu phép đo mới. Nếu chỉnh chưa hợp lệ, giữ kết quả trước khi chỉnh. Bản vẽ chưa kết thúc không được lưu khi đổi kiểu |
| Vòng đời | Hình đo tồn tại trong phiên, hiện trên 2D và giữ khi đổi qua 3D. Tải lại trang hoặc Đặt lại phiên xóa hình đo. Chưa lưu thành lớp nghiệp vụ |
| Diện tích màn hình | Thu gọn công cụ vẫn đo được. Mobile dùng khung đáy cao tối đa 48% vùng bản đồ. Thông số, từng đoạn và kết quả đã giữ mặc định đóng |
| Nhãn đo | Chỉ giá trị và đơn vị, diện tích ở tâm hình. Ưu tiên phép đo hiện tại, tránh công cụ và đối tượng nghiệp vụ. Không đủ chỗ thì ẩn nhãn, kết quả vẫn có trong panel |

Đo không tạo vùng ảnh hưởng, thay tình trạng đường hoặc tính lại mức ưu tiên.

Độ chính xác phụ thuộc dữ liệu nền. Đo trên ellipsoid, chiều dài bề mặt DEM, thể tích và chỉnh sửa lớp nghiệp vụ chưa thuộc bộ công cụ này. Mặt cắt dọc tuyến dùng công cụ địa hình riêng.

Mở rộng tiếp theo: mặt cắt theo đường tự vẽ và lưu/xuất hình đo thành lớp dữ liệu.

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

CRS, datum, dữ liệu ảnh và định hướng engine: [nền tảng GIS và viễn thám](../architecture/geospatial-platform.md). Demo chưa có nhập VN2000 hoặc pipeline phân tích ảnh được kiểm chứng, không ghi là đã đạt chuẩn vận hành.

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
