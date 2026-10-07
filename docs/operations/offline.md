# Gói chạy offline

Cập nhật: 2026-10-07. Gói mặc định dùng dữ liệu Chế Tạo mô phỏng, chưa được RS/PO duyệt.

## Chạy bản đóng gói

1. Giải nén gói, cần Python 3.11 trở lên.
2. Chạy `powershell -ExecutionPolicy Bypass -File .\Start.ps1`.
3. Mở `http://127.0.0.1:5212`. Dừng server bằng Ctrl+C.

Không cần Node.js hoặc Internet. Có sẵn dữ liệu, ảnh, địa hình và font. Nền khu vực ngoài ảnh cục bộ mặc định tắt. Đặt lại phiên trong Cài đặt. Khi cần PDF, chọn **Lưu đánh giá → Định dạng khác → In / lưu PDF**.

## Tạo và kiểm tra

Chạy trong `DEM_to_3D/viewer`:

Chọn manifest trong `public/workspace-config.json` trước build. Kiểm dữ liệu và đóng gói dùng cùng cấu hình, xem [hợp đồng dữ liệu](../architecture/data-contract.md).

```powershell
npm run build
python scripts/package_workspace.py --output dist-release/dear-sic-2026-10-05.zip
python scripts/check_offline_package.py dist-release/dear-sic-2026-10-05.zip
```

Lệnh kiểm tra cần Python Playwright và Chrome. Nó giải nén vào thư mục mới, kiểm SHA-256, chặn yêu cầu Internet và thử luồng ứng phó, xuất PNG, 3D/2D, đặt lại phiên.

| Trong gói | Nội dung |
|---|---|
| `dist/` | Web, dữ liệu và tài sản cục bộ |
| `Start.ps1`, `scripts/serve_workspace.py`, `scripts/workspace_configuration.py` | Server HTTP cục bộ, chọn manifest và cấu hình prepared/offline |
| `release.json` | Thời điểm đóng gói, commit và trạng thái thay đổi nguồn, trạng thái dữ liệu, checksum từng file |
| `licenses/`, `dist/fonts/` | Giấy phép thành phần và font |

Gói phần mềm đã kiểm tra không thay việc nghiệm thu dữ liệu. So ảnh cần hai GeoTIFF có nguồn/ngày và vùng chung. Xác thực, phân quyền, tiếp nhận tin trực tiếp và pipeline ảnh thuộc giai đoạn vận hành sau SIC, xem [kiến trúc](../architecture/overview.md).
