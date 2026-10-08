# Kiểm tra workspace

Mốc đối chiếu: batch GIS/catalog prepared ngày 08/10/2026, dữ liệu ứng phó mô phỏng Chế Tạo v0.2. Đây là kết quả kiểm tra phần mềm, chưa phải nghiệm thu dữ liệu hoặc thử với cán bộ trực.

## Phạm vi đã kiểm

| Nhóm | Phạm vi |
|---|---|
| Nghiệp vụ | Sự kiện → địa bàn → tuyến/căn cứ → áp dụng tin → bản xuất; cùng snapshot giữa map, panel và file |
| Công cụ | Đo, tọa độ, mặt cắt, lớp/nguồn, tổng quan, so ảnh; nhập/xuất GIS, vẽ/chỉnh AOI theo bản nháp, bắt đỉnh/hoàn tác; catalog prepared, metadata, bộ chọn và độ phủ |
| Giao diện | Sáng/tối, Việt/Anh, các bộ chữ, desktop/mobile, bàn phím, giữ lựa chọn và vị trí panel |
| Khi lỗi | Thiếu dữ liệu, API/file/GPU lỗi, khôi phục 2D, gói offline giải nén sạch |
| Phát hành | Cài sạch, unit/Python/browser tests, audit, build và đóng gói đạt trên Linux/Node 22 |

Lệnh và môi trường kiểm tra lấy từ [workflow](../../.github/workflows/dear-web.yml), không chép số lượng test hoặc phiên bản dependency vào tài liệu. Kết quả GitHub nằm ở [Actions](https://github.com/hoxuanphu/UNISEC_Demo/actions/workflows/dear-web.yml); chạy cục bộ không thay xác nhận trên GitHub.

## Giới hạn còn lại

| Nội dung | Chưa xác nhận |
|---|---|
| Dữ liệu và phương pháp | Nguồn/quyền dùng ảnh và DEM, bằng chứng gốc, tuyến và chính sách được duyệt |
| Phạm vi GIS | Fixture thứ hai dùng lại địa hình Chế Tạo; chưa kiểm khu vực thực hoặc nhiều CRS |
| Vận hành | Feed, xử lý SAR/AI, công bố dùng chung và backend mới ở mức kế hoạch |
| Bàn giao | URL Vercel, tốc độ/GPU, bản in PDF và thao tác trên máy trình chiếu |

Việc còn làm ở [công việc SIC](../tasks/sic-2026.md), điều kiện bàn giao ở [nghiệm thu](acceptance.md). Thiết kế và cách sử dụng ở [giao diện](../product/interface.md), [design system](../product/design-system.md), [công cụ GIS](../product/geodata-workspace.md).

## Tham chiếu

[Tiếp cận](assets/workspace-summary.png), [mặt cắt](assets/workspace-profile.png), [đo](assets/workspace-measurement.png) và [PNG xuất](assets/decision-map.png) là ảnh của bản trước, không phải bộ ảnh cần cập nhật sau mỗi lần sửa UI.

[Log phiên 30 phút](assets/session-30min.json) giữ browser, hash build, lỗi và số liệu của lần đo đó. Cách chạy lại ở [nghiệm thu](acceptance.md).

Chỉ cập nhật mốc kiểm tra khi chốt bản demo/phát hành hoặc có thay đổi đáng kể về phạm vi kiểm chứng. Lịch sử sửa lỗi và log từng lần chạy nằm trong Git/CI.
