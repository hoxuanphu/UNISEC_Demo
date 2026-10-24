# Ghi nhận hiện trường và hai vai trò demo

Mục tiêu: người dân gửi ảnh tại nơi họ đang quan sát; điều phối viên kiểm tra nguồn, vị trí và nội dung trước khi dùng làm căn cứ. Đây là phần bổ sung đầu vào thực địa cho chuỗi tình huống, phân tích, kiểm tra và công bố trong proposal. Không thay luồng ứng phó chính.

## Quyền và trách nhiệm

| Thao tác | Người dân | Điều phối ứng phó |
|---|---|---|
| Xem tình trạng đường và chọn hành trình | Có | Có |
| Gửi ảnh tại nơi cư trú hoặc khu vực khác | Có | Có |
| Bổ sung ghi nhận | Ghi nhận của mình đang chờ kiểm tra hoặc cần bổ sung | Mọi hồ sơ trong phiên demo |
| Xem ảnh của người khác | Không có trong màn người dân | Có trong Ghi nhận gửi đến |
| Kiểm tra ghi nhận, yêu cầu bổ sung, không sử dụng | Không | Có, kèm nhận xét |
| Khoanh vùng nghi ảnh hưởng và quản lý GIS | Không | Có |
| Đổi tên địa bàn và đoạn đường | Không | Có, giữ ID và dữ liệu gốc |
| Thay bản đánh giá đường chính thức | Không | Qua bước cập nhật riêng của tình huống prepared |

Đăng nhập là lựa chọn vai trò mô phỏng. Tên hiển thị nhận diện người thử trong cùng trình duyệt, không phải xác thực. Có thể vào nhanh màn điều phối bằng `?demoRole=manager`; đây không phải token. Dữ liệu lưu tại trình duyệt, không có máy chủ nhận ảnh, đồng bộ giữa thiết bị hoặc bảo vệ tài khoản thật. Quét QR trên hai điện thoại tạo hai phiên độc lập.

## Form ngắn, dữ liệu có nguồn

1. Thêm ảnh. JPEG, PNG, WebP, AVIF, HEIC/HEIF được đọc tại máy. HEIC tải bộ giải mã khi cần; ảnh gốc giữ tên, kích thước, metadata và checksum, ảnh hiển thị là JPEG thu nhỏ.
2. Kiểm tra vị trí. Ưu tiên GPS trong ảnh nếu người dùng chưa chọn nơi khác; có thể lấy vị trí thiết bị, chạm bản đồ hoặc mở ô nhập tọa độ. Vị trí máy ảnh có thể khác nơi xảy ra hiện tượng.
3. Gửi ghi nhận. Chỉ cần ảnh hoặc mô tả và vị trí hợp lệ. Loại ghi nhận, mô tả, người ghi nhận và giờ chụp không bắt nhập hết. Trường bổ sung thu gọn mặc định.

Giờ chụp đọc từ EXIF khi có. Không lấy ngày sửa tệp làm ngày chụp, không tự suy múi giờ của máy ảnh. Thời điểm gửi được lưu riêng. Sai số lấy từ thiết bị khi dùng định vị, không yêu cầu người dân đoán. Không có metadata không đồng nghĩa ảnh giả; thông tin cần kiểm tra vẫn được lưu là chưa biết.

Camera trong ứng dụng lưu thời điểm bấm chụp và vị trí thiết bị nếu lấy được quyền định vị. Các giá trị này nằm trong `FieldPhoto.capture`, tách khỏi EXIF của tệp; vị trí giữ sai số và thời điểm đo. GPS chưa có hoặc bị từ chối không ngăn chụp ảnh và không tạo tọa độ thay thế. Khi trình duyệt không hỗ trợ camera trực tiếp, dùng bộ chọn camera của thiết bị và chỉ đọc metadata thật trong tệp trả về.

Form cho biết đã đọc được ngày hoặc vị trí nào. Thêm và bỏ ảnh cập nhật các trường tự điền theo ảnh còn lại; thông tin người dùng đã sửa không bị ghi đè. Vị trí hiện tượng vẫn có thể khác vị trí chụp. Thẻ ảnh trong ghi nhận hiển thị tên dễ hiểu, giữ tên tệp và thông tin máy ảnh trong phần chi tiết; thời gian và tọa độ đã có ở ghi nhận không lặp lại trên từng ảnh, nhưng các giá trị khác nhau vẫn hiện để kiểm tra.

Cách lấy EXIF được tham khảo từ [Survey123 media questions](https://doc.arcgis.com/en/survey123/create/main/xlsformmedia.htm). Đây là dữ liệu hỗ trợ đối chiếu, không phải bằng chứng xác thực tuyệt đối. Điều phối viên đọc ảnh, thời gian, GPS và mô tả rồi ghi kết quả: Đã kiểm tra, Cần bổ sung hoặc Không sử dụng. Kết quả này không tự biến thành trạng thái đường hoặc vùng sạt lở đã xác nhận.

## Điểm, vùng và tên

- ID đầy đủ là UUID, giữ liên kết giữa điểm, ảnh và vùng khoanh. Mã ngắn `GN-XXXXXXXX` chỉ để nhận biết trên giao diện; không dùng thay khóa dữ liệu.
- Tên trong KML/GeoJSON được giữ theo nguồn. Tên hiển thị được sửa riêng; không đổi ID, tọa độ hoặc tên tệp gốc.
- Tên mới nên mô tả địa điểm hoặc nội dung quan sát: “Đất đá trên đường vào Nậm Khắt”. Không bắt người dân chọn đúng phân loại chuyên môn trước khi gửi.
- Vùng khoanh thủ công gắn vào điểm là vùng nghi ảnh hưởng, không phải sản phẩm phát hiện tự động hoặc AOI phân tích.

[GeoJSON RFC 7946](https://www.rfc-editor.org/rfc/rfc7946.html#section-3.2) quy định định danh Feature có thể là chuỗi hoặc số; không quy định một mẫu tên điểm hiện trường dùng chung toàn cầu. `GN-...` là quy ước của demo, không được giới thiệu là chuẩn quốc tế.

## GIS và hành trình

GIS là công cụ trong DEAR: giữ header chung, danh sách bên trái, hồ sơ được chọn bên phải. Ở màn hẹp, hồ sơ thay danh sách và có nút quay lại. Có lọc theo tên/tệp, ẩn hoặc hiện nhóm, chọn nhiều để xóa và hoàn tác; xóa điểm bao gồm ảnh và vùng liên quan.

AOI có tên sửa được. Khi sửa ranh giới, đường viền đi theo điểm đang kéo; tay nắm ở giữa di chuyển toàn vùng. Hút vào điểm gần là hỗ trợ đặt đỉnh khớp điểm đã có. Bản nháp chỉ lưu khi Áp dụng; Hủy và Hoàn tác giữ vai trò rõ ràng.

Công cụ hình tuyến đường chọn hai điểm bất kỳ trên mạng đường đã có, hoặc chọn điểm tập kết, địa bàn và đối tượng GIS. Điểm ngoài đường nối tới vị trí gần nhất trong phạm vi 5 km để tham chiếu; khoảng cách thẳng tới đường hiển thị riêng và không cộng vào chiều dài hành trình. Đoạn nối này không phải đường đã khảo sát. Khoảng cách tính dọc các đoạn nối được; không tự nối đường giao nhau trên hình nhưng thiếu kết nối trong dữ liệu. Mặt cắt dùng DEM hiện có, có giới hạn phủ và độ phân giải. Chưa ghi nhận bị chặn không xác nhận đường an toàn.

## Bản đồ cho người dân

Màn người dân mở bản đồ trước, có thông tin đường, gửi ghi nhận và ghi nhận đã gửi ở thanh dưới. Tài khoản trên header cho xem tên, vai trò và quay lại màn chọn vai trò.

Tìm đường cho người dân dùng chính sách `conditions`: tuyến chỉ có đoạn `open` được ưu tiên nếu không dài quá 1,25 lần tuyến ngắn nhất chưa bị chặn; nếu không, chọn tuyến ít đoạn cần kiểm tra hơn trong giới hạn đó. Đoạn `blocked` bị loại khỏi mạng dùng để gợi ý. Công cụ đo hành trình giữ chính sách khoảng cách ngắn nhất. Hai chính sách giữ nguyên vị trí đã chọn, kết nối của mạng và cách tính khoảng cách dọc đường. Khoảng nối từ vị trí ra đường không tính thành đường có thể đi.

Bản đồ địa phương hiển thị thêm hành lang phía bắc bằng nét xám như các tuyến khác chưa được chọn khi hai điểm đã chọn có đường nối qua mạng tới hai đầu hành lang. Tình trạng biên soạn xét cả vùng của mạng địa phương và các polygon khảo sát/vẽ đã xuất hiện trên bản đồ. Xét vùng sạt đã xảy ra hoặc có nguy cơ, đang hiện, cách các đường phía bắc không quá 10 m. Các liên kết cũ cách đường hàng trăm mét đã bỏ. Mọi polygon đủ điều kiện đều có liên kết, không chọn sẵn ba vùng. Các polygon gốc và ID được giữ nguyên.

Mỗi vị trí gần đường được khoanh đoạn ảnh hưởng 35 m về mỗi phía. Khi các đoạn này chồng nhau, dùng một đoạn đường liên tục, giữ đủ ID các vùng liên quan và một biển cảnh báo không có số lượng; đây là ký hiệu đoạn đường, không phải cụm điểm. Thay đổi, ẩn hoặc xóa polygon làm tính lại tình trạng và tuyến. Liên hệ hình học không tự chứng minh đường bị chặn: quyết định bị chặn vẫn thuộc lớp tình trạng biên soạn của bộ dữ liệu này.

App gợi ý đường tránh bằng nét xanh, lấy khung cả hai tuyến và các vùng liên kết, cho chạm dấu sạt lở để xem đoạn bị chặn. Các vùng vàng hiện ngay ở khung nhìn toàn tuyến, dùng viền mảnh và màu tô nhẹ trên màn người dân; khi chọn vùng, viền được làm nổi. Chỉ ẩn các vùng không liên quan khi thu ra mức khu vực dưới zoom 12. Vùng liên kết cảnh báo luôn hiện, có nét nối ngắn từ vùng tới vị trí trên đường. Hành lang bị chặn chỉ để đối chiếu, không phải lựa chọn có thể đi.

Các vị trí và tình trạng thêm nằm riêng trong `localRoadConditions.ts`, nguồn `authored-scenario`, không có thời điểm quan sát. Đây là dữ liệu biên soạn cho bộ Chế Tạo hiện tại, không phải kết quả Google/Apple hoặc phát hiện vệ tinh được xác minh. Tọa độ và nguồn KMZ gốc trong `local-network.json` được giữ nguyên. Không dùng các trạng thái biên soạn này làm feed cảnh báo thực địa; nguồn thật phải được kiểm tra trước khi thay thế.

Đường được chọn hiển thị xanh liền, đậm và có viền tương phản. Viền cam giữ cảnh báo trên đoạn cần kiểm tra; đường bị chặn vẫn đỏ. Tên bản được dịch để hiển thị, không sửa tên nguồn, tọa độ hoặc ID. Câu chữ trên màn hình không dùng nhãn demo; nguồn dữ liệu và phần chưa được kiểm tra vẫn có trong thông tin bản đồ. Trạng thái `open` chỉ có nghĩa chưa ghi nhận bị chặn, không chứng minh tuyến an toàn.

Trên bản đồ người dân, ghim A và B thay biểu tượng địa điểm tại cùng tọa độ. Nhãn tránh ghim, điểm khác và bảng thông tin; khi thiếu chỗ thì ẩn nhãn. Điểm gần nhau không tạo bong bóng số. Điểm trùng vẫn mở danh sách để chọn từng địa điểm, không dịch tọa độ. Loại đường khó đi của mạng địa phương được ghi “Khó đi, vẫn qua được” ở màn người dân và màn hành trình 3D; nhãn này không thay trạng thái chưa xác minh của mạng ứng phó. Màn người dân ẩn thước tỷ lệ và nút Nguồn để dành chỗ cho bản đồ. Màn hình chính giữ nút vừa tuyến và vị trí hiện tại; phóng bản đồ dùng thao tác chụm hai ngón.

Ký hiệu đoạn bị chặn dùng một biển tròn đỏ, vạch trắng, thống nhất giữa sạt lở đã xảy ra và đường bị chặn vì lý do khác. Vùng chỉ có nguy cơ dùng tam giác vàng và trạng thái `uncertain`, không tự đóng đường. Khi một đoạn chứa cả hai loại, tình trạng bị chặn được ưu tiên và giữ liên kết tới vùng đã xảy ra. Ký hiệu trên bản đồ và trong chú giải dùng cùng nguồn SVG.

Bảng đường đi trên màn người dân rút gọn tên nơi đi, nơi đến, quãng đường và tình trạng chính; tên hai nơi nằm cùng hàng khi đủ chỗ. Chú giải không lặp lại tiêu đề đường đề xuất. Chạm bảng để xem chi tiết; các nút chọn địa điểm và báo cáo vẫn giữ kích thước dễ chạm.

Tìm đường và đường về bản dùng chung thứ tự đánh giá trong giới hạn đường vòng: loại đoạn bị chặn, giảm chiều dài có nguy cơ sạt lở, rồi giảm chiều dài cần kiểm tra. Trạng thái tuyến được tính từ các đoạn hiện tại. Khi người dân chọn đường khác, cả bảng bản đồ và phần chi tiết ghi “Đường bạn chọn”; định danh lựa chọn gắn với đường thực tế, không gắn với thứ tự trong danh sách. Khi đường đó bị chặn hoặc không còn nối được, bỏ lựa chọn cũ và tính lại.

Đường khác chỉ nhận thao tác chọn ở phần riêng, không phủ vùng chạm lên đoạn xanh dùng chung. Bản đồ chỉ mở một đối tượng mỗi lần; đóng thẻ trở về thông tin tuyến. Chú giải dưới bản đồ phản ánh các cảnh báo đang bật. Ẩn vùng vàng không làm thay đổi vị trí hay tình trạng cảnh báo trên đường. Vùng vàng có cùng kiểu viền và độ trong ở hai nguồn lớp, còn vùng nguy cơ giữ viền đứt. Đường gần một vùng sạt chỉ được ghi là đường gần đó, không suy ra bị chặn hay đi được từ khoảng cách.

## Khi triển khai dùng chung

Cần xác thực thật, API tiếp nhận, kho ảnh gốc riêng tư, cơ sở dữ liệu điểm/vùng, phân quyền ở server và lịch sử xét duyệt. Chỉ công bố thông tin đã được người có quyền duyệt; dữ liệu cá nhân và ảnh gốc không mặc định công khai. Phần này thuộc EO Platform/DEAR vận hành, chưa có trong bản web tĩnh.
