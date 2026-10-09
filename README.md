# UNISEC_Demo

Repo demo SIC, build/deploy độc lập. Web DEAR mô phỏng hỗ trợ xem tác động, ưu tiên địa bàn và kiểm tra tuyến tiếp cận. Sản phẩm lâu dài thuộc [VSP EO Platform](../vsp-eo-platform/README.md); demo là nơi thử nghiệm và kế thừa chọn lọc, không phải backend của platform.

## Chạy web DEAR

Cần Node.js dòng 22, từ 22.13 trở lên, npm và Python 3.11 trở lên:

```powershell
cd DEM_to_3D/viewer
npm ci
npm run dev
```

Dev dùng gói prepared, không cần API riêng. Các lệnh dev/test/build tự kiểm gói và chuẩn bị địa hình/ảnh từ bản nguồn trong Git; không commit asset sinh ra trong `public/terrain/` hoặc `dist/`.

```powershell
npm run typecheck
npm test
npm run test:dataset
npm run test:api
npm run build
npm run serve:workspace
```

Lệnh cuối phục vụ bản build và API snapshot chỉ đọc tại `http://127.0.0.1:5212`. Nền EOX cần Internet; dữ liệu khu vực nằm tại máy. 2D không cần WebGL; lỗi GLB/GPU có thể chuyển về 2D. Đây là dữ liệu mô phỏng, chưa phải phương án ứng phó được duyệt.

## Phần giữ trong demo

| Phần | Mục đích | Hướng dẫn |
|---|---|---|
| DEAR | Trình diễn sự kiện → địa bàn → tuyến/căn cứ → tin mới → bản xuất | [Walkthrough](docs/operations/walkthrough.md) |
| KML/AOI/catalog prepared | Thử công cụ GIS, kiểm hình học và đầu vào viễn thám; không thay đánh giá sự kiện | [Workspace GIS](docs/product/geodata-workspace.md) |
| DEM exporter và asset contract | Tạo địa hình, thử viewer/mặt cắt và kế thừa kỹ thuật | [Công cụ địa hình](DEM_to_3D/README.md) |
| Offline/online | Bàn giao SIC độc lập | [Gói offline](docs/operations/offline.md), [Vercel](docs/operations/vercel.md) |

Không cần gỡ KML/AOI chỉ vì đã có Workbench. Giữ chức năng đã thử; tính năng EO mới và backend sản phẩm phát triển tại platform, không mở rộng hai bản song song. [Bàn giao](../vsp-eo-platform/docs/plans/handoff.md) quy định cách kế thừa.

[Tài liệu](docs/README.md), [kế hoạch và công việc SIC](docs/tasks/sic-2026.md). Dữ liệu lớn, capture/log và tài sản sinh ra không commit; danh mục nguồn địa hình ở README của công cụ. [Context chung](../docs/README.md) và references được cấp riêng, không tham gia build.
