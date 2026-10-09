# Tài liệu UNISEC Demo / DEAR

Demo SIC và công cụ thử nghiệm nằm tại repo này. Kiến trúc EO Platform/DEAR vận hành thuộc [repo platform](../../vsp-eo-platform/docs/README.md); [bàn giao](../../vsp-eo-platform/docs/plans/handoff.md) giải thích phần kế thừa.

**Bắt đầu:** [README](../README.md) → [trình diễn](operations/walkthrough.md) → [kế hoạch và công việc](tasks/sic-2026.md). Người kiểm tra dữ liệu đọc [sources](sources.md), [contract](architecture/data-contract.md) và [phương pháp](architecture/response-analysis.md).

| Chủ đề | Nơi sở hữu |
|---|---|
| Cài/chạy web và công cụ địa hình | [README](../README.md), [DEM](../DEM_to_3D/README.md) |
| Trình diễn, offline, online | [Walkthrough](operations/walkthrough.md), [offline](operations/offline.md), [Vercel](operations/vercel.md) |
| Phạm vi sản phẩm | [Yêu cầu](product/requirements.md) |
| Mốc, trạng thái, phụ trách và điều kiện bàn giao | [Kế hoạch SIC](tasks/sic-2026.md) |
| Nghiệm thu và giới hạn kiểm chứng | [Acceptance](quality/acceptance.md), [workspace review](quality/workspace-review.md) |
| Luồng UI, component, câu chữ và bản đồ | [Interface](product/interface.md), [design system](product/design-system.md), [thuật ngữ](product/terminology.md), [cartography](product/cartography.md) |
| KML/AOI/catalog thử nghiệm | [Workspace GIS](product/geodata-workspace.md) |
| Kiến trúc/source đang chạy | [Overview](architecture/overview.md), [source](architecture/source-structure.md) |
| Dữ liệu, phương pháp và bản xuất | [Contract](architecture/data-contract.md), [response analysis](architecture/response-analysis.md), [decision export](architecture/decision-export.md) |
| Tài liệu gốc, đối chiếu và phần chưa đủ căn cứ | [Sources](sources.md) |

## Quy tắc cập nhật

Một chủ đề có một nơi sở hữu. Sửa tài liệu khi cách dùng, contract, trách nhiệm, phương pháp hoặc phạm vi bàn giao đổi. Không cập nhật nhiều tài liệu cho một lỗi CSS/icon/refactor không đổi hành vi; không chép số test, dependency hoặc lịch sử commit vào docs.

Bản nghiên cứu UI cũ đã nhường chỗ cho quy tắc sản phẩm hiện hành; Git giữ lịch sử. `docs/superpowers/` và các báo cáo địa hình có ngày là hồ sơ thử nghiệm cũ, không phải task hiện tại và không cần sửa theo mỗi lần đổi viewer. Schema/source sở hữu định dạng máy đọc; bảng SIC sở hữu trạng thái bàn giao.

[Context chung](../../docs/README.md) và [references](../../references) nằm ngoài repo, cấp riêng; build không phụ thuộc chúng. Chỉ giữ ảnh được dẫn để giải thích sản phẩm hoặc làm bằng chứng có mốc; capture/log kiểm thử mới không commit.
