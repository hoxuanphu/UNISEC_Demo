# Terrain asset contract v1

Mỗi lần export tạo một bộ asset đồng bộ:

```text
terrain.glb          # mesh, scene X=east Y=up Z=-north, đã recenter
terrain.terrain.json # metadata và transform của grid
terrain.grid.bin     # Float32 little-endian, row-major, không có header
```

`grid.shape` luôn là `[rows, cols]`. Mỗi sample đại diện cho tâm pixel và
được đổi qua affine Rasterio:

```text
x = a * (col + 0.5) + b * (row + 0.5) + c
y = d * (col + 0.5) + e * (row + 0.5) + f
```

`NaN` là nodata. `world_origin` chỉ có `x` và `y`; nó được trừ trước khi
ghi GLB. Cao độ thực khôi phục từ mesh bằng
`elevation = scene_y / exaggeration + base_elevation`.

Validator Python không cần thư viện JSON Schema:

```powershell
python terrain_contract.py terrain.terrain.json --grid terrain.grid.bin
```

Asset có `analysis_supported: true` phải dùng projected CRS với đơn vị mét.
`--keep-geographic` tạo asset visual-only (`analysis_supported: false`).


## Tiled texture pyramid v1

Texture độ phân giải cao là nguồn riêng theo từng model và không thay thế preview toàn model. Generator tạo sidecar MODEL.tiles.json cạnh MODEL.terrain.json và thư mục không track MODEL_tiles/z<zoom>/<column>_<row>.webp.

```powershell
python DEM_to_3D/tools/tile_texture.py --input DEM_to_3D/lao_chai_v2_tex.tif --terrain-json DEM_to_3D/lao_chai_v2_tex.terrain.json --output DEM_to_3D/lao_chai_v2_tex_tiles --tile-size 512 --format webp --quality 88
```

`bounds_projected` lấy từ outer bounds của grid_transform và grid.shape; generator đọc source theo từng window bounded, tạo gutter 2 pixel và dựng level thấp từ tile con. Viewer validate metadata, ghép tile theo asset_id, giữ tile z0 làm preview và không decode TIFF lớn khi pyramid hợp lệ. Khi nhiều model cùng hiển thị, detail được phân bổ theo ngân sách CPU/GPU và request toàn scene.
