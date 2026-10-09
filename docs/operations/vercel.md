# Deploy DEAR lên Vercel

Cập nhật: 2026-10-05. Bản deploy dùng dữ liệu prepared và các file địa hình trong repo. API Python cục bộ không được đưa lên Vercel bằng cấu hình này.

## Cấu hình dự án

| Trường | Giá trị |
|---|---|
| Framework Preset | Vite |
| Root Directory | `DEM_to_3D/viewer` |
| Include source files outside of the Root Directory in the Build Step | Bật |
| Node.js Version | 22.x, đã khai báo trong `package.json` |
| Install Command | `npm ci` |
| Build Command | `python3 scripts/validate_dataset.py --prepare && npm run build:app` |
| Output Directory | `dist` |
| Environment Variables | Không cần. Để trống `VITE_DEAR_API_BASE` |

Lệnh cài/build và thư mục output đã nằm trong [`vercel.json`](../../DEM_to_3D/viewer/vercel.json). Python 3.11+ chỉ dùng lúc build để kiểm checksum và chuẩn bị dữ liệu; không cần cài thư viện GIS.

Ba file nguồn `che_tao_v2_tex.glb`, `.grid.bin` và `.terrain.json` nằm ở `DEM_to_3D/`. Tùy chọn đọc ngoài Root Directory là bắt buộc. Vercel hướng dẫn tại [Monorepos FAQ](https://vercel.com/docs/monorepos/monorepo-faq); build image hiện có [Python 3.12](https://vercel.com/changelog/legacy-build-image-is-being-deprecated).

## Các bước deploy

1. Commit và push bản cần trình diễn lên Git remote. Nhánh hiện tại: `feat/dear-3d-workspace`. Kiểm tra workflow **DEAR web** trong GitHub Actions đạt.
2. Vercel: **Add New → Project**, import repo và đặt cấu hình theo bảng trên. Nếu tùy chọn đọc ngoài Root Directory chưa xuất hiện khi import, vào **Settings → Build and Deployment** bật rồi redeploy.
3. Nếu cần URL chính lấy từ nhánh này, chọn `feat/dear-3d-workspace` trong **Settings → Environments → Production → Branch Tracking**. Nếu giữ nhánh production mặc định, dùng deployment preview của nhánh này.
4. Deploy và kiểm tra URL theo bảng dưới. Những lần push sau sẽ tạo deployment mới.

Không đưa `references/`, `node_modules/`, `dist/` hay ZIP offline vào Git để deploy. Vercel tự tạo `dist` từ source và lockfile. Không thêm rewrite mọi URL về `index.html`: app hiện chưa dùng đường dẫn cho từng màn hình, còn file dữ liệu thiếu phải trả 404.

Workflow [DEAR web](../../.github/workflows/dear-web.yml) kiểm tra dữ liệu, unit test, dependency runtime, build, gói offline và luồng trình duyệt. Đã cấu hình Node 22/Python 3.12 trên Linux; chưa có kết quả chạy GitHub Actions hoặc Vercel. Kết quả tại máy local ở [rà soát](../quality/workspace-review.md).

## Kiểm tra URL sau deploy

| Kiểm tra | Kết quả cần có |
|---|---|
| Mở web và reload | Có sự kiện, AOI, địa bàn và ảnh nền 2D |
| `/workspace-config.json` | JSON có `dataSource: "prepared"` |
| `/scenarios/che-tao/v0.2/manifest.json` | JSON, không trả HTML |
| Chuyển 3D rồi về 2D | Tải được địa hình, 2D tiếp tục hoạt động |
| Chọn Nậm Khắt → kiểm tra tuyến → áp dụng tin mới | Tuyến và nhận định đổi theo tin mới |
| Lưu đánh giá | PNG/JSON/GeoJSON tải được; PDF mở hộp in |
| Đổi ngôn ngữ, font, độ rộng panel | Bố cục và nội dung giữ đúng |

## Xử lý lỗi build

| Lỗi | Cách xử lý |
|---|---|
| Thiếu `che_tao_v2_tex.*` | Kiểm tra ba file có trong commit, Root Directory và tùy chọn đọc ngoài root |
| Không tìm thấy `python3` hoặc thiếu `hashlib.file_digest` | Chọn build image hiện hành, dùng Python 3.11+ |
| Node không được hỗ trợ | Chọn 22.x rồi redeploy theo `engines.node` trong repo |
| Checksum/size mismatch | Kiểm tra file nguồn và manifest cùng phiên bản; giữ bước kiểm dữ liệu |
| Web gọi `localhost` hoặc `/api/v1/...` | Xóa `VITE_DEAR_API_BASE`, kiểm tra config là prepared, redeploy |
| URL vẫn chạy bản cũ | Kiểm tra commit của deployment và nhánh production |

## Phạm vi deploy

Demo giữ `dataSource: "prepared"` và để trống `VITE_DEAR_API_BASE`. Không cần API ghi, DB hoặc worker để trình diễn bộ đã chuẩn bị. Các biến `VITE_*` đọc được từ trình duyệt, không chứa khóa bí mật.

Backend sản phẩm được thiết kế tại [platform](../../../vsp-eo-platform/docs/plans/roadmap.md#backend-và-worker), có cấu hình và artifact riêng; không bổ sung vào project Vercel demo theo tài liệu này.
