# Tài liệu UNISEC Demo / DEAR

Repo này sở hữu bản demo SIC và các công cụ thử nghiệm đang chạy. Thiết kế sản phẩm EO lâu dài nằm ở [VSP EO Platform](../../vsp-eo-platform/docs/README.md); phần chuyển giao ở [handoff](../../vsp-eo-platform/docs/plans/handoff.md).

| Công việc | Tài liệu |
|---|---|
| Chạy và trình diễn | [README](../README.md), [walkthrough](operations/walkthrough.md), [offline](operations/offline.md), [Vercel](operations/vercel.md) |
| Phạm vi và bàn giao SIC | [Yêu cầu](product/requirements.md), [kế hoạch](plans/sic-2026.md), [công việc](tasks/sic-2026.md), [nghiệm thu](quality/acceptance.md) |
| Giao diện và bản đồ hiện tại | [Interface](product/interface.md), [design system](product/design-system.md), [cartography](product/cartography.md) |
| Công cụ AOI/KML/catalog thử nghiệm | [Dữ liệu GIS](product/geodata-workspace.md) |
| Kiến trúc và code đang chạy | [Overview](architecture/overview.md), [source](architecture/source-structure.md) |
| Dữ liệu và phương pháp demo | [Contract v1](architecture/data-contract.md), [response analysis](architecture/response-analysis.md), [decision export](architecture/decision-export.md) |
| Kiểm chứng và nguồn | [Workspace review](quality/workspace-review.md), [GIS review](quality/gis-review.md), [sources](sources.md), [source review](quality/source-review.md) |

[Đánh giá prototype 29/09](quality/dear-ux-review.md) và tài liệu lưu trữ giữ bối cảnh cũ, không thay quy tắc hiện hành. PO/SW/AI/RS lần lượt là sản phẩm/phần mềm/xử lý AI/viễn thám.

## Quy tắc cập nhật

Mỗi nội dung có một nơi sở hữu. Chỉ sửa tài liệu khi cách dùng, trách nhiệm, contract, phương pháp hoặc phạm vi bàn giao đổi. CSS/icon/câu chữ nhỏ/refactor không đổi hành vi không cần cập nhật hàng loạt. Git và CI giữ lịch sử, log và số test.

Định dạng đang chạy theo schema/source; quy tắc giao diện theo tài liệu sản phẩm; trạng thái bàn giao theo bảng công việc. Kiến trúc/backend/contract platform sửa tại repo platform, không tạo bản sao tại đây.

[Context chung](../../docs/README.md) và [references](../../references) nằm ngoài repo, cấp riêng tại máy; không phải phụ thuộc build. Chỉ commit ảnh được dẫn trong docs; capture/log kiểm thử không đưa vào tài liệu nguồn.
