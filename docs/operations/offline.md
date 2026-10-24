# Gói demo offline

Gói Windows x64 dùng trên laptop cá nhân, không cần Node.js, Python cài sẵn hoặc Internet. Cần Chrome/Edge và tăng tốc đồ họa để xem 3D, xuất MP4. Dữ liệu nghiệp vụ demo vẫn có phần mô phỏng/chưa duyệt; nguồn ảnh và dữ liệu đo đạc được giữ riêng.

## Mở tại buổi thi

1. Giải nén **toàn bộ** `DEAR-Offline-Windows-x64.zip` vào thư mục có quyền ghi trên ổ máy, không chạy bên trong ZIP.
2. Mở `Start-DEAR.cmd`. Launcher kiểm tra SHA-256 toàn bộ tệp rồi mở cửa sổ Chrome/Edge phóng to với hồ sơ riêng của gói, mở **3D** mặc định và dùng **English** ở lần mở đầu; sau đó nhớ lựa chọn **English/Tiếng Việt** trong **Settings → Language**. Chọn **Response coordinator → Enter app** để trình diễn điều phối, hoặc **Resident** để gửi ghi nhận.
3. Nếu trình duyệt không tự mở, vào `http://127.0.0.1:5212/`. Launcher mở cửa sổ app riêng và chạy dịch vụ cục bộ ở nền. Nếu cần xem lỗi khởi động, mở `Start-Diagnostics.cmd`; nhật ký ở `user-data/launcher.log`.
4. Nếu cổng đang được chương trình khác dùng, chạy `powershell -ExecutionPolicy Bypass -File .\Start.ps1 -Port 5213`. Launcher không tắt tiến trình khác.

Vai trò điều phối dùng toàn bộ cửa sổ; khi bấm **Enter app**, trình duyệt được yêu cầu vào toàn màn hình (có thể thoát bằng **Esc**). Cả hai vai trò dùng mục **Account / Tài khoản** trên header để xem tên và đổi vai trò. Vai trò người dân dùng giao diện mobile, kể cả trên laptop, và mở bản đồ trước. Tên **A Phủ** được điền sẵn và sửa được.

Không mở `dist/index.html` bằng double click. Có thể mở lại launcher để quay về app đang chạy; nó chỉ nhận server cùng mã gói. Nếu checksum sai/thiếu tệp, giải nén lại từ ZIP gốc.

Trước ngày thi, thử đúng laptop và màn chiếu với Wi-Fi tắt, đóng/mở lại app rồi thực hiện luồng trình diễn. Mang ZIP và MP4 dự phòng trên USB. Giữ nguồn điện laptop, bật tăng tốc đồ họa trong Chrome/Edge. Bản Vercel vẫn là phương án online riêng.

## Phạm vi offline

| Thành phần | Nguồn và hành vi |
|---|---|
| Tình huống, tuyến, GIS, mặt cắt | Dữ liệu đóng gói; mặt cắt chỉ dùng DEM phân tích có sẵn |
| Ảnh Planet và hiện trường | Tệp gốc đã chuẩn bị kèm ngày/nguồn; có so ảnh, xem ảnh lớn |
| Nền 2D, 3D và GIS | XYZ cục bộ từ composite Sentinel-2 ESA WorldCover 2021 khoảng 10 m, hình chữ nhật liên tục, mức zoom 7–14; không tải Esri/Google để đóng gói |
| Chi tiết khi có Internet | Tự bổ sung cùng nguồn Esri World Imagery của web ở cả góc tổng quan và zoom gần; nền cục bộ luôn giữ bên dưới. Mạng lỗi thì giữ ảnh offline và chờ trước khi thử lại. Không có bộ chọn nguồn. Hai phim 3D dùng cùng bộ địa hình và ảnh đóng gói; ảnh Internet bổ sung khi có kết nối |
| Địa hình xung quanh | Mapzen Terrain Tiles (SRTM/GMTED2010), lưu cục bộ; chỉ để hiển thị, không đưa vào lưới phân tích |
| Phủ ảnh trong vùng demo | Bắt buộc đủ pixel ảnh nền trong phạm vi đóng gói; không dùng hillshade xám thay ảnh bị thiếu |
| Ngoài phạm vi bản đồ đóng gói | Khi không có Internet: nền trung tính. Giới hạn và checksum ở `dist/offline-map/map.json` |
| Video | Hành trình 25 giây, ba vùng sạt chính, ảnh hiện trường và góc tổng quan cuối; xuất MP4 qua trình duyệt |
| Ghi nhận/GIS | Lưu trên trình duyệt của máy này, không tự đồng bộ sang máy khác; xuất dữ liệu trước khi đặt lại phiên |
| PDF | Dùng In / lưu PDF của trình duyệt |

Composite trung vị năm 2021 từ [ESA WorldCover](https://registry.opendata.aws/esa-worldcover-vito-composites/) (CC BY 4.0) làm nền bối cảnh, không phải ảnh Planet mới nhất. Dữ liệu gốc khoảng 10 m, nền khu vực chuẩn bị ở độ phân giải gốc khoảng 10 m; phép tăng zoom không tạo thêm chi tiết ảnh. Hồ sơ cân màu hiển thị chỉ áp cho đúng SHA-256 của ảnh nền đã hiệu chỉnh; ảnh Internet dùng hồ sơ riêng, ảnh Planet gốc giữ nguyên. Không suy luận ngày quan sát từ nền ghép hoặc dùng địa hình bối cảnh thay DEM khi đo đạc. Hồ sơ trình duyệt nằm trong `user-data/browser`; sao lưu phần này nếu cần giữ phiên làm việc.

## Khi bản web báo không tải được dữ liệu

Thông báo lỗi chỉ rõ tài nguyên và mã HTTP. Nếu tệp `*.grid.bin` nhận HTTP 403 / `VG-Blockdownload` nhưng JSON và ảnh vẫn tải được, đường tải dữ liệu nhị phân đang bị từ chối; không thể kết luận chỉ từ thông báo đó là lỗi Vercel hay chính sách mạng. Kiểm tra truy cập trên mạng khác hoặc dùng gói offline qua `127.0.0.1`. Sau khi quyền truy cập được khôi phục, **Retry** tải lại đúng bộ dữ liệu, không thay thế bằng dữ liệu khác. Cấu hình offline luôn dùng bộ dữ liệu cục bộ, kể cả khi bản build có cấu hình API bên ngoài.

## Tạo gói

Chạy trong `DEM_to_3D/viewer`, chọn manifest ở `public/workspace-config.json`. Máy chuẩn bị cần Node theo `.nvmrc`, Python 3.11+, rasterio 1.4+/numpy/Pillow cho nền cục bộ. Chỉ máy chuẩn bị cần Internet để tải runtime chính thức và địa hình công khai. Thư mục đầu ra của `prepare_offline_map.py` phải mới/trống để tránh trộn hai phiên bản nền.

```powershell
npm ci
npm test
python -m unittest discover -s scripts -p 'test_*.py'
npm run build
python scripts/prepare_demo_runtime.py --output "$env:TEMP/dear-runtime/python-3.13.17-embed-amd64.zip"
python ../tools/prepare_context_imagery.py --bounds 103.7 21.4 104.6 22.1 --output dist-release/sentinel-context-2021.tif --cache "$env:TEMP/dear-worldcover-cogs"
python ../tools/prepare_offline_map.py --rgb dist-release/sentinel-context-2021.tif --imagery-metadata dist-release/sentinel-context-2021.source.json --bounds 103.74660177812206 21.47574395496185 104.50632710969855 22.04322981573678 --require-coverage --output dist-release/offline-map --cache "$env:TEMP/dear-offline-elevation"
python scripts/package_workspace.py --output dist-release/DEAR-Offline-Windows-x64.zip --local-map dist-release/offline-map --runtime "$env:TEMP/dear-runtime/python-3.13.17-embed-amd64.zip"
```

Runtime tải từ python.org, xác minh SHA-256 theo bản SPDX chính thức. Giấy phép Python và thư viện được giữ trong gói. `release.json` ghi commit, trạng thái cây nguồn, dữ liệu và checksum từng tệp. Đối với gói đa nền tảng không kèm runtime/nền vùng rộng, bỏ hai tham số `--runtime` và `--local-map`; máy chạy gói đó cần Python 3.11+.

## Kiểm tra bản phát hành

Máy kiểm thử cần Python Playwright và Chrome. Kiểm tra portable phải chạy trên Windows để thực sự dùng `runtime/python.exe` trong gói:

```powershell
python scripts/check_offline_package.py dist-release/DEAR-Offline-Windows-x64.zip --chrome 'C:/Program Files/Google/Chrome/Application/chrome.exe'
python scripts/check_demo_package.py dist-release/DEAR-Offline-Windows-x64.zip --chrome 'C:/Program Files/Google/Chrome/Application/chrome.exe' --video dist-release/DEAR-hanh-trinh-25s.mp4
```

Bộ kiểm tra giải nén mới vào đường dẫn có dấu/khoảng trắng, kiểm checksum, chạy bằng runtime đi kèm từ thư mục khác, thử mở launcher hai lần, chặn Internet và xác nhận không có yêu cầu ngoài localhost. Luồng kiểm tra gồm phản ứng/PNG/reset, 2D/3D, GIS sửa/áp dụng/bỏ nháp, ảnh Planet/ảnh hiện trường và phục hồi lỗi tải, mặt cắt, camera hành trình, ảnh/ghi âm/báo cáo người dân. MP4 được giải mã để kiểm tra bản đồ chuyển động và đủ ba ảnh tương ứng.

Kiểm thử phần mềm không thay nghiệm thu dữ liệu hoặc thử phần cứng trình chiếu. Xác thực, đồng bộ nhiều máy và tiếp nhận tin thực tế thuộc giai đoạn vận hành, xem [kiến trúc](../architecture/overview.md).


## Phim A–B trên mạng đường Chế Tạo

Trong màn hình điều phối, mở **Directions / Chỉ đường** cạnh ô tìm kiếm để chọn các bản, điểm ứng phó hoặc vị trí trên bản đồ. Trong **Layers / Lớp**, hàng **Đường trong xã Chế Tạo** có nút căn khung và công tắc riêng. Chọn một đoạn để xem tình trạng và tìm đường giữa các làng. Để mở phim 3D, dùng `http://127.0.0.1:5212/?workspace=routes` sau khi chạy launcher. Bản web dùng cùng đường dẫn `/?workspace=routes`.

Chọn hai làng hoặc bấm chọn A/B trên bản đồ 3D. **Avoid blocked roads** loại các cạnh đỏ khỏi phép tìm tuyến nhưng vẫn giữ chúng trên bản đồ. **Fit route** căn khung tuyến; **Whole network** xem toàn mạng đường. Phim giữ góc nghiêng 3D rộng trong lúc tuyến hiện dần và điểm di chuyển, sau đó mở rộng để bao quát toàn mạng đường ở cuối. Mặc định 25 giây. Thanh timeline luôn hiện khi phát, hỗ trợ tua, tạm dừng và tốc độ 0.75×–1.5×. **Export MP4** xuất 1920×1080, 30 fps bằng cùng bộ vẽ với bản xem trước.

Vùng sạt dùng polygon vàng có lớp phủ, không thêm icon ở tâm. Chọn vùng trên bản đồ hoặc danh sách điểm trong phim để xem ảnh; polygon tương ứng được nhấn khi phát. Ảnh khảo sát dùng cho phim địa phương được ghi rõ là ảnh minh họa, không xác nhận hiện trạng tại tọa độ đó. Vùng nước được làm mềm ở bờ chỉ bằng cách hiển thị, không đổi ranh nguồn. Các vùng sạt demo cũng xuất hiện trên bản đồ điều phối, tách khỏi hồ sơ sạt lở đã có.

Nguồn riêng: `resources/kml/xa che tao demo2.kmz`, 21 đường địa phương, Village A/B/C và bãi đáp. Màu đường, vùng sạt và vùng nước là ký hiệu từ nguồn demo, chưa phải đánh giá đường đã xác minh hoặc kết quả đối chiếu ảnh Planet. Không nhập đè hồ sơ sự kiện hiện có. JSON giữ tọa độ WGS84 gốc, tên nguồn, SHA-256, chỉ số Placemark và graph EPSG:32648. Khi chuẩn bị graph chỉ gắn đầu đường vào đường khác trong 15 m; không nối mọi giao cắt. Điểm làng giữ tọa độ thật, phần cách đường hiển thị nét đứt và số mét chưa xác minh; điểm quá 250 m không được coi là đã nối mạng đường. Đường nằm ngoài Chế Tạo bị loại có ghi lý do trong metadata.

Chuẩn bị lại nguồn trong môi trường numpy/rasterio:

```powershell
python ../tools/prepare_local_network.py '../../../resources/kml/xa che tao demo2.kmz'
```

Kiểm tra bản chạy thật với Internet bị chặn, có thể xuất luôn video dự phòng:

```powershell
python scripts/check_local_route_film.py --url http://127.0.0.1:5212 --chrome 'C:/Program Files/Google/Chrome/Application/chrome.exe' --output dist-release/DEAR-Che-Tao-A-B.mp4
```

`--fixture` chỉ dùng trên CI để thay ảnh nền qua mạng bằng tile kiểm thử cố định; kiểm tra offline bàn giao không dùng cờ này.
