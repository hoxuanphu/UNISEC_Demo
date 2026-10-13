#!/usr/bin/env python3
"""
dem_to_3d.py — Chuyển DEM (GeoTIFF/ASCII Grid/...) thành mesh 3D.

Pipeline:
  1. Đọc DEM bằng rasterio (đọc được GeoTIFF, IMG, ASC, HGT, ... bất kỳ định
     dạng nào GDAL hỗ trợ).
  2. Nếu DEM ở hệ tọa độ địa lý (độ, ví dụ EPSG:4326) sẽ tự động reproject
     sang UTM (mét) tương ứng để tỷ lệ x/y/z không bị méo. Có thể ép CRS
     đích hoặc giữ nguyên bằng tham số dòng lệnh.
  3. Downsample lưới pixel (nếu cần) để giới hạn số vertex, tránh file khổng
     lồ / phần mềm 3D bị treo.
  4. Xây dựng vertex grid theo pixel-center convention. Khi xuất asset v1,
     GLB dùng scene axes X=east, Y=up, Z=-north và được recenter trước khi
     ghi; Pixel "nodata" sẽ tạo thành lỗ (hole) trên mesh.
  5. (Tùy chọn) tô màu vertex theo cao độ (colormap) hoặc dán texture ảnh vệ
     tinh cùng khu vực (UV mapping).
  6. Xuất ra nhiều định dạng: .obj (+ .mtl + texture nếu có), .stl, .ply,
     .glb; đồng thời ghi terrain.terrain.json và terrain.grid.bin cho viewer.

Yêu cầu thư viện:
    pip install rasterio trimesh numpy pillow matplotlib --break-system-packages

Ví dụ dùng:
    # Cơ bản, xuất tất cả định dạng, tự động downsample về tối đa 500k vertex
    python3 dem_to_3d.py --input dem.tif --output terrain

    # Khuếch đại địa hình 2.5 lần, chỉ xuất glb, tô màu theo cao độ
    python3 dem_to_3d.py --input dem.tif --output terrain \\
        --exaggeration 2.5 --formats glb --colormap terrain

    # Giữ độ phân giải gốc (không downsample) + dán ảnh vệ tinh làm texture
    python3 dem_to_3d.py --input dem.tif --output terrain \\
        --step 1 --texture satellite.tif --formats obj,glb
    # Liệt kê các xã/phường nằm trong khu vực DEM (dùng shapefile sẵn có trong repo)
    python3 dem_to_3d.py --input dem.tif --output terrain \
        --commune-shp "Shapefile_PX_VN_34/Việt Nam (phường xã) - 34.shp" --commune list

    # Cắt DEM chỉ giữ 1 xã (khớp theo tên hoặc mã xã), tô màu theo cao độ
    python3 dem_to_3d.py --input dem.tif --output tam_dao \
        --commune-shp "Shapefile_PX_VN_34/Việt Nam (phường xã) - 34.shp" \
        --commune "Tam Đảo" --colormap terrain --formats glb,ply

    # Ghép nhiều xã (cách nhau dấu phẩy), thêm đệm 200m quanh ranh giới;
    # xã trùng tên giữa các tỉnh thì ghi rõ "Tên xã|Tên tỉnh"
    python3 dem_to_3d.py --input dem.tif --output terrain \
        --commune-shp "Shapefile_PX_VN_34/Việt Nam (phường xã) - 34.shp" \
        --commune "Tân Lập|Điện Biên, Thanh Bình" --commune-buffer 200"""

import argparse
import os
import sys

import numpy as np

from terrain_contract import crs_is_projected_metre, crs_metadata, dump_metadata, validate_metadata


def parse_args():
    p = argparse.ArgumentParser(
        description="Chuyển file DEM (raster cao độ) thành mesh 3D nhiều định dạng.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--input", "-i", required=False, help="Đường dẫn file DEM đầu vào (GeoTIFF, ASC, HGT, IMG, ...)")
    p.add_argument("--output", "-o", required=False, help="Tên file đầu ra KHÔNG kèm đuôi (vd: terrain -> terrain.obj, terrain.stl, ...)")
    p.add_argument("--formats", default="obj,stl,ply,glb",
                    help="Danh sách định dạng xuất, cách nhau dấu phẩy. Hỗ trợ: obj,stl,ply,glb. Mặc định: obj,stl,ply,glb")

    # --- Hệ tọa độ ---
    p.add_argument("--target-epsg", type=int, default=None,
                    help="Ép EPSG đích cụ thể (vd 32648 cho UTM zone 48N Bắc Việt Nam). "
                         "Nếu không truyền, script tự tính UTM zone phù hợp khi DEM đang ở hệ độ (geographic).")
    p.add_argument("--keep-geographic", action="store_true",
                    help="KHÔNG reproject, giữ nguyên x/y theo độ kinh vĩ. "
                         "CẢNH BÁO: sẽ làm méo tỷ lệ địa hình vì z tính bằng mét còn x/y tính bằng độ. "
                         "Chỉ dùng nếu bạn tự xử lý tỷ lệ sau.")

    # --- Độ phân giải lưới ---
    p.add_argument("--step", type=int, default=None,
                    help="Lấy mẫu 1/N pixel theo mỗi chiều (vd 4 = lấy 1 trong mỗi 4 pixel). "
                         "Nếu không truyền, script tự tính step từ --max-vertices.")
    p.add_argument("--max-vertices", type=int, default=500_000,
                    help="Số vertex tối đa mong muốn khi --step không được chỉ định (mặc định 500,000). "
                         "Đặt --step 1 để lấy full độ phân giải gốc (có thể rất nặng).")

    # --- Cao độ ---
    p.add_argument("--exaggeration", type=float, default=1.5,
                    help="Hệ số khuếch đại cao độ theo trục Z (mặc định 1.5). Địa hình đồi núi: 1.5-3, đồng bằng: 5-15.")
    p.add_argument("--no-normalize-base", action="store_true",
                    help="Không trừ cao độ cho giá trị min (mặc định script đưa đáy thấp nhất về z=0 để mesh gọn, đặt cờ này để giữ cao độ tuyệt đối, vd so sánh nhiều khu vực).")

    # --- Cắt theo địa giới hành chính ---
    p.add_argument("--commune-shp", default=None,
                    help="Đường dẫn shapefile địa giới xã/phường (vd: Shapefile_PX_VN_34/'Việt Nam (phường xã) - 34.shp'). "
                         "Dùng kèm --commune để chỉ giữ DEM bên trong ranh giới xã đã chọn.")
    p.add_argument("--commune", default=None,
                    help="Tên xã/phường hoặc mã xã cần cắt (không phân biệt hoa/thường, khớp tên HOẶC mã). "
                         "Có thể truyền nhiều tên cách nhau dấu phẩy. "
                         "Bỏ trống hoặc 'list' để in danh sách xã có DEM phủ lên màn hình.")
    p.add_argument("--commune-buffer", type=float, default=0.0,
                    help="Mở rộng ranh giới cắt thêm N mét quanh ranh giới xã (mặc định 0).")

    # --- Xử lý nodata ---
    p.add_argument("--hole-mode", choices=["mask", "fill"], default="mask",
                    help="'mask' (mặc định): pixel nodata sẽ tạo lỗ trên mesh theo đúng ranh giới dữ liệu — "
                         "phù hợp cho DEM bị cắt theo ranh giới hành chính như tỉnh/huyện/xã. "
                         "'fill': nội suy lấp các vùng nodata nhỏ (voids rải rác trong SRTM) — "
                         "KHÔNG nên dùng nếu vùng nodata là toàn bộ khu vực ngoài ranh giới, vì sẽ nội suy sai.")

    # --- Màu / texture ---
    p.add_argument("--colormap", choices=["none", "terrain", "viridis", "gray"], default="none",
                    help="Tô màu vertex theo cao độ (ghi vào .ply/.glb/.obj). Mặc định: none (không tô màu).")
    p.add_argument("--texture", default=None,
                    help="Đường dẫn ảnh vệ tinh/ortho có tọa độ địa lý (GeoTIFF) để dán làm texture (UV mapping). "
                         "Ảnh sẽ tự động được resample về đúng lưới DEM. Bỏ trống nếu không cần texture.")

    p.add_argument("--verbose", "-v", action="store_true", help="In thông tin chi tiết từng bước.")
    p.add_argument("--asset-id", default=None,
                    help="ID asset ghi vào metadata (mặc định lấy tên file output).")
    p.add_argument("--write-fixture", default=None, metavar="PATH",
                    help="Ghi metadata fixture contract v1 nhỏ (dùng cho test/viewer smoke test) rồi thoát.")
    return p.parse_args()


def log(msg, verbose=True):
    if verbose:
        print(f"[dem_to_3d] {msg}", file=sys.stderr)


# --------------------------------------------------------------------------
# 1. Đọc DEM
# --------------------------------------------------------------------------
def read_dem(path, verbose):
    import rasterio

    with rasterio.open(path) as src:
        array = src.read(1).astype(np.float64)
        transform = src.transform
        crs = src.crs
        nodata = src.nodata
        bounds = src.bounds

    if nodata is None:
        log("CẢNH BÁO: file DEM không khai báo giá trị nodata. "
            "Toàn bộ pixel sẽ được coi là hợp lệ.", verbose)
        nodata_mask = np.zeros(array.shape, dtype=bool)
    else:
        nodata_mask = np.isclose(array, nodata)
    nodata_mask |= ~np.isfinite(array)

    log(f"Đọc DEM: {path}", verbose)
    log(f"  Kích thước: {array.shape[1]} x {array.shape[0]} pixel ({array.size:,} pixel)", verbose)
    log(f"  CRS gốc: {crs}", verbose)
    log(f"  Bounds: {bounds}", verbose)
    valid = array[~nodata_mask]
    if valid.size:
        log(f"  Cao độ hợp lệ: min={valid.min():.1f}m  max={valid.max():.1f}m  mean={valid.mean():.1f}m", verbose)
    log(f"  Tỷ lệ pixel nodata: {nodata_mask.mean()*100:.1f}%", verbose)

    return array, transform, crs, nodata_mask


def auto_utm_epsg(crs, transform, width, height):
    """Tính EPSG UTM phù hợp dựa trên kinh độ trung tâm của DEM (chỉ áp dụng khi CRS gốc là hệ địa lý độ)."""
    import rasterio
    from rasterio.warp import transform as warp_transform

    # Tâm ảnh theo tọa độ pixel -> tọa độ CRS gốc
    center_col, center_row = width / 2, height / 2
    cx, cy = transform @ (center_col, center_row)

    if crs.is_geographic:
        lon, lat = cx, cy
    else:
        # Trường hợp hiếm: CRS gốc không phải geographic nhưng vẫn muốn auto UTM
        # -> chuyển tạm sang EPSG:4326 để lấy lon/lat
        lons, lats = warp_transform(crs, "EPSG:4326", [cx], [cy])
        lon, lat = lons[0], lats[0]

    zone = int((lon + 180) // 6) + 1
    epsg = 32600 + zone if lat >= 0 else 32700 + zone
    return epsg, lon, lat


# --------------------------------------------------------------------------
# 2. Reproject sang hệ tọa độ mét (UTM) nếu cần
# --------------------------------------------------------------------------
def reproject_dem(array, transform, crs, nodata_mask, target_epsg, keep_geographic, verbose):
    if crs is None:
        if keep_geographic:
            log("DEM không khai báo CRS; tạo visual-only asset theo --keep-geographic.", verbose)
            return array, transform, crs, nodata_mask
        raise ValueError("DEM không khai báo CRS; cần --keep-geographic hoặc gán CRS trước khi export.")
    if keep_geographic:
        log("Giữ nguyên hệ tọa độ gốc theo yêu cầu (--keep-geographic). "
            "x/y sẽ tính theo ĐỘ, không phải mét — tỷ lệ với z (mét) sẽ bị méo.", verbose)
        return array, transform, crs, nodata_mask

    if not crs.is_geographic and target_epsg is None:
        log(f"CRS gốc ({crs}) đã là hệ tọa độ chiếu (mét), không cần reproject.", verbose)
        return array, transform, crs, nodata_mask

    import rasterio
    from rasterio.warp import calculate_default_transform, reproject, Resampling
    from rasterio.crs import CRS

    height, width = array.shape

    if target_epsg is None:
        epsg, lon, lat = auto_utm_epsg(crs, transform, width, height)
        log(f"DEM đang ở hệ tọa độ địa lý (độ). Tâm ảnh ~ lon={lon:.4f}, lat={lat:.4f} "
            f"-> tự động chọn UTM EPSG:{epsg}.", verbose)
    else:
        epsg = target_epsg
        log(f"Reproject sang EPSG do người dùng chỉ định: {epsg}", verbose)

    dst_crs = CRS.from_epsg(epsg)

    # Đặt nodata thành giá trị chuẩn để rasterio xử lý biên chính xác khi resample
    src_nodata_value = -32768.0
    work = array.copy()
    work[nodata_mask] = src_nodata_value

    dst_transform, dst_width, dst_height = calculate_default_transform(
        crs, dst_crs, width, height, *rasterio_bounds(transform, width, height)
    )

    dst_array = np.full((dst_height, dst_width), src_nodata_value, dtype=np.float64)

    reproject(
        source=work,
        destination=dst_array,
        src_transform=transform,
        src_crs=crs,
        dst_transform=dst_transform,
        dst_crs=dst_crs,
        src_nodata=src_nodata_value,
        dst_nodata=src_nodata_value,
        resampling=Resampling.bilinear,
    )

    # Do not classify every low elevation as nodata; only the explicit
    # destination sentinel is invalid.
    new_nodata_mask = np.isclose(dst_array, src_nodata_value)

    log(f"  Sau reproject: {dst_width} x {dst_height} pixel, GSD ~ {dst_transform[0]:.2f}m", verbose)

    return dst_array, dst_transform, dst_crs, new_nodata_mask


def rasterio_bounds(transform, width, height):
    """Trả về (left, bottom, right, top) từ affine transform, tránh phụ thuộc rasterio.DatasetReader.bounds."""
    corners = [transform @ point for point in ((0, 0), (width, 0), (0, height), (width, height))]
    xs, ys = zip(*corners)
    return min(xs), min(ys), max(xs), max(ys)


# --------------------------------------------------------------------------
# 3. Downsample lưới pixel
# --------------------------------------------------------------------------
def compute_step(width, height, max_vertices):
    if max_vertices < 1:
        raise ValueError("--max-vertices phải >= 1")
    total = width * height
    if total <= max_vertices:
        return 1
    return int(np.ceil(np.sqrt(total / max_vertices)))


def downsample(array, transform, nodata_mask, step, verbose):
    if step < 1:
        raise ValueError("--step phải là số nguyên >= 1")
    if step <= 1:
        return array, transform, nodata_mask

    from affine import Affine

    array_ds = array[::step, ::step]
    mask_ds = nodata_mask[::step, ::step]
    # ``array[::step, ::step]`` keeps source samples at indices
    # (row*step, col*step).  Shift the affine so the new pixel centre still
    # maps to the centre of that source pixel (not to the centre of a step-wide
    # block).
    shift = Affine.translation(-(step - 1) / 2.0, -(step - 1) / 2.0)
    transform_ds = transform @ shift @ Affine.scale(step, step)

    log(f"Downsample với step={step}: {array.shape[1]}x{array.shape[0]} -> "
        f"{array_ds.shape[1]}x{array_ds.shape[0]} pixel ({array_ds.size:,} vertex tiềm năng)", verbose)

    return array_ds, transform_ds, mask_ds


def crop_to_valid_bbox(array, transform, nodata_mask):
    """Crop to valid pixels and shift the affine to the cropped origin."""
    from affine import Affine

    keep = (~nodata_mask) & np.isfinite(array)
    rows_with_data = np.any(keep, axis=1)
    cols_with_data = np.any(keep, axis=0)
    if not rows_with_data.any() or not cols_with_data.any():
        return array, transform, nodata_mask
    r0 = int(np.argmax(rows_with_data))
    r1 = int(rows_with_data.size - np.argmax(rows_with_data[::-1]) - 1)
    c0 = int(np.argmax(cols_with_data))
    c1 = int(cols_with_data.size - np.argmax(cols_with_data[::-1]) - 1)
    return (
        array[r0:r1 + 1, c0:c1 + 1],
        transform @ Affine.translation(c0, r0),
        nodata_mask[r0:r1 + 1, c0:c1 + 1],
    )


# --------------------------------------------------------------------------
# 3b. Cắt DEM theo ranh giới xã/phường từ shapefile
# --------------------------------------------------------------------------
def _binary_dilate(mask, iterations):
    """Phóng nhị phân mask theo 8 láng giềng, không cần scipy."""
    m = mask.copy()
    for _ in range(iterations):
        grown = m.copy()
        grown[1:, :] |= m[:-1, :]
        grown[:-1, :] |= m[1:, :]
        grown[:, 1:] |= m[:, :-1]
        grown[:, :-1] |= m[:, 1:]
        grown[1:, 1:] |= m[:-1, :-1]
        grown[1:, :-1] |= m[:-1, 1:]
        grown[:-1, 1:] |= m[1:, :-1]
        grown[:-1, :-1] |= m[1:, 1:]
        m = grown
    return m


def rasterize_commune_geometries(
    geometries, transform, crs, grid_shape, buffer_m=0, boundary_pixels=0
):
    """Rasterize WGS84 commune geometries directly onto the DEM grid.

    Rasterio performs the scan conversion in C and honors the same affine
    pixel-center convention as the exported grid, avoiding a full-resolution
    Python ray-cast over the entire source raster.

    ``boundary_pixels`` extends the rasterized footprint by whole pixels. A
    one-pixel extension is needed when adjacent independently exported tiles
    are merged: the mesh faces connect pixel centres, so clipping exactly at a
    polygon boundary would otherwise leave a visible gap between the tiles.
    """
    from rasterio.features import rasterize
    from rasterio.warp import transform_geom

    if boundary_pixels < 0 or int(boundary_pixels) != boundary_pixels:
        raise ValueError("boundary_pixels must be a non-negative integer")

    rows, cols = grid_shape
    shapes = []
    for geometry in geometries:
        projected = geometry
        if not crs.is_geographic:
            projected = transform_geom("EPSG:4326", crs, geometry, precision=-1)
        shapes.append((projected, 1))
    inside = rasterize(
        shapes,
        out_shape=(rows, cols),
        transform=transform,
        fill=0,
        default_value=1,
        all_touched=False,
        dtype="uint8",
    ).astype(bool)
    if buffer_m > 0:
        gsd = abs(transform.a) if not crs.is_geographic else abs(transform.a) * 111_320.0
        inside = _binary_dilate(inside, min(max(int(round(buffer_m / max(gsd, 1e-9))), 0), 500))
    if boundary_pixels:
        inside = _binary_dilate(inside, int(boundary_pixels))
    return inside


def load_commune_mask(shp_path, commune_query, transform, crs, grid_shape, buffer_m, verbose, return_metadata=False):
    """
    Trả về mask (True = pixel NGOÀI ranh giới xã, sẽ bị coi là nodata).

    commune_query: chuỗi tên/mã xã, cách nhau dấu phẩy. Đặt 'list' để in danh sách
    xã giao với DEM rồi thoát. Cú pháp "Tên xã|Tên tỉnh" chọn đúng xã trùng tên.
    """
    import shapefile
    from rasterio.warp import transform as warp_transform

    rows, cols = grid_shape

    if not os.path.isfile(shp_path):
        print(f"Lỗi: không tìm thấy shapefile '{shp_path}'", file=sys.stderr)
        sys.exit(1)

    log(f"Đọc shapefile ranh giới: {shp_path}", verbose)
    r = shapefile.Reader(shp_path)

    # Use only the grid bounds for query/list filtering; rasterization below
    # avoids allocating coordinate arrays for every source pixel.
    from rasterio.transform import array_bounds
    from rasterio.warp import transform_bounds
    left, bottom, right, top = array_bounds(rows, cols, transform)
    if crs.is_geographic:
        dem_bounds_wgs84 = (left, bottom, right, top)
    else:
        dem_bounds_wgs84 = transform_bounds(crs, "EPSG:4326", left, bottom, right, top)

    # ----- Chế độ liệt kê -----
    queries = [q.strip().lower() for q in (commune_query or "list").split(",") if q.strip()]
    wants_list = any(q in ("list", "?") for q in queries)
    queries = [q for q in queries if q not in ("list", "?")]

    if wants_list:
        dem_lon_min, dem_lat_min, dem_lon_max, dem_lat_max = dem_bounds_wgs84
        print(f"\nCác xã/phường có ranh giới giao với vùng DEM "
              f"(lon {dem_lon_min:.4f}..{dem_lon_max:.4f}, lat {dem_lat_min:.4f}..{dem_lat_max:.4f}):")
        n = 0
        for i, shape in enumerate(r.iterShapes()):
            sxmin, symin, sxmax, symax = shape.bbox
            if sxmax < dem_lon_min or sxmin > dem_lon_max or symax < dem_lat_min or symin > dem_lat_max:
                continue
            rec = r.record(i)
            print(f"  {rec['ma_xa']}  {rec['ten_xa']:<30} tỉnh: {rec['ten_tinh']}")
            n += 1
        print(f"Tổng: {n} xã. Chạy lại với --commune '<tên hoặc mã>' để cắt.")
        if not queries:
            sys.exit(0)

    # ----- Tìm xã khớp truy vấn (tên HOẶC mã, kèm tỉnh nếu trùng tên) -----
    matches = []  # [(shape, ten_xa, ten_tinh, attributes)]
    for i, shape in enumerate(r.iterShapes()):
        rec = r.record(i)
        ten = str(rec["ten_xa"] or "").strip()
        ma = str(rec["ma_xa"] or "").strip()
        tinh = str(rec["ten_tinh"] or "").strip()
        for q in queries:
            if "|" in q:
                q_xa, _, q_tinh = q.partition("|")
                if q_xa.strip() == ten.lower() and q_tinh.strip() == tinh.lower():
                    matches.append((shape, ten, tinh, rec.as_dict()))
                    break
            elif q == ten.lower() or q == ma:
                matches.append((shape, ten, tinh, rec.as_dict()))
                break

    if not matches:
        print(f"Lỗi: không tìm thấy xã nào khớp truy vấn: {', '.join(queries)}", file=sys.stderr)
        sys.exit(1)

    log(f"Khớp {len(matches)} xã: " + ", ".join(f"{t} ({p})" for _, t, p, _ in matches), verbose)

    geometries = [shape.__geo_interface__ for shape, _, _, _ in matches]
    inside = rasterize_commune_geometries(
        geometries,
        transform,
        crs,
        grid_shape,
        buffer_m,
        boundary_pixels=1,
    )

    outside = ~inside
    log(f"Giữ lại {(~outside).sum():,}/{outside.size:,} pixel "
        f"({(~outside).mean()*100:.1f}%) bên trong ranh giới xã.", verbose)
    if not return_metadata:
        return outside
    field_map = {
        "commune_code": "ma_xa",
        "commune_name": "ten_xa",
        "province_code": "ma_tinh",
        "province_name": "ten_tinh",
        "headquarters": "tru_so",
        "type": "loai",
        "area_km2": "dtich_km2",
        "population": "dan_so",
        "density_per_km2": "matdo_km2",
    }
    administrative_units = []
    for _, _, _, attributes in matches:
        unit = {}
        for output_key, input_key in field_map.items():
            value = attributes.get(input_key)
            if value is not None and value != "":
                unit[output_key] = value
        administrative_units.append(unit)
    return outside, administrative_units


# --------------------------------------------------------------------------
# 4. Xây dựng mesh: vertices + faces (vector hóa bằng numpy, không loop Python)
# --------------------------------------------------------------------------
def build_mesh(array, transform, nodata_mask, exaggeration, normalize_base, hole_mode, verbose):
    if hole_mode == "fill":
        array, nodata_mask = fill_small_voids(array, nodata_mask, verbose)

    rows, cols = array.shape
    # NaN is the v1 binary-grid nodata encoding.  Treat non-finite source
    # values as nodata even when the source raster did not declare a sentinel.
    valid_mask = (~nodata_mask) & np.isfinite(array)

    if not valid_mask.any():
        raise ValueError("Toàn bộ DEM là nodata sau khi xử lý — không thể tạo mesh.")

    # Toạ độ x,y thực từ affine transform, áp dụng cho toàn bộ lưới cùng lúc
    col_idx, row_idx = np.meshgrid(np.arange(cols), np.arange(rows))
    # All mesh/grid/hover code uses pixel centres.  ``col_idx`` and
    # ``row_idx`` refer to zero-based pixel indices, hence the +0.5 terms.
    xs = transform.c + transform.a * (col_idx + 0.5) + transform.b * (row_idx + 0.5)
    ys = transform.f + transform.d * (col_idx + 0.5) + transform.e * (row_idx + 0.5)

    elevation = array.copy()
    base = np.nanmin(elevation[valid_mask]) if normalize_base else 0.0
    zs = (elevation - base) * exaggeration
    zs[~valid_mask] = 0.0  # giá trị placeholder, vertex này sẽ không được face nào tham chiếu tới

    vertices_full = np.stack([xs, ys, zs], axis=-1).reshape(-1, 3)

    # --- Xây dựng face (2 tam giác / ô vuông 2x2 pixel), bỏ ô có góc nodata ---
    idx = np.arange(rows * cols, dtype=np.int64).reshape(rows, cols)
    i0 = idx[:-1, :-1]
    i1 = idx[:-1, 1:]
    i2 = idx[1:, :-1]
    i3 = idx[1:, 1:]

    quad_ok = valid_mask[:-1, :-1] & valid_mask[:-1, 1:] & valid_mask[1:, :-1] & valid_mask[1:, 1:]

    tri1 = np.stack([i0[quad_ok], i2[quad_ok], i1[quad_ok]], axis=1)
    tri2 = np.stack([i1[quad_ok], i2[quad_ok], i3[quad_ok]], axis=1)
    faces_full = np.vstack([tri1, tri2])

    if faces_full.shape[0] == 0:
        raise ValueError("Không tạo được tam giác nào — kiểm tra lại vùng dữ liệu hợp lệ của DEM.")

    # --- Loại bỏ vertex không được tham chiếu (vùng nodata) để file gọn hơn ---
    used = np.unique(faces_full)
    remap = np.full(rows * cols, -1, dtype=np.int64)
    remap[used] = np.arange(used.size)
    faces = remap[faces_full]
    vertices = vertices_full[used]

    log(f"Mesh: {vertices.shape[0]:,} vertex, {faces.shape[0]:,} tam giác "
        f"(đã loại {rows*cols - used.size:,} vertex nodata không dùng đến)", verbose)

    return vertices, faces, used, (rows, cols)


def choose_world_origin(array, transform, nodata_mask):
    """Choose a stable horizontal origin near the centre of valid samples."""
    valid = (~nodata_mask) & np.isfinite(array)
    if not valid.any():
        raise ValueError("Không có pixel hợp lệ để chọn world_origin.")
    rows, cols = np.nonzero(valid)
    # The midpoint of the valid coordinate bounds is deterministic and keeps
    # both scene horizontal axes close to zero without adding origin_z.
    x0, y0 = transform.c + transform.a * (cols + 0.5) + transform.b * (rows + 0.5), \
        transform.f + transform.d * (cols + 0.5) + transform.e * (rows + 0.5)
    return {"x": float((x0.min() + x0.max()) / 2.0), "y": float((y0.min() + y0.max()) / 2.0)}


def serialize_transform(transform):
    """Serialize an affine in the explicit Rasterio order used by v1."""
    return {
        "a": float(transform.a), "b": float(transform.b), "c": float(transform.c),
        "d": float(transform.d), "e": float(transform.e), "f": float(transform.f),
        "convention": "rasterio_affine", "pixel_reference": "center",
    }


def write_contract_grid(array, nodata_mask, path):
    """Write the final grid as raw Float32 little-endian row-major values."""
    grid = np.asarray(array, dtype=np.float32).copy()
    grid[(nodata_mask) | ~np.isfinite(grid)] = np.nan
    # ``<f4`` is explicit even on little-endian development machines.
    grid.astype("<f4", copy=False).tofile(path)
    return grid


def fill_small_voids(array, nodata_mask, verbose):
    """Nội suy các lỗ nodata nhỏ rải rác (voids của SRTM), KHÔNG dùng cho vùng nodata lớn/liền khối
    như khu vực ngoài ranh giới hành chính (sẽ bị nội suy sai thành mặt phẳng vô nghĩa)."""
    try:
        from rasterio.fill import fillnodata
    except ImportError:
        log("CẢNH BÁO: không import được rasterio.fill, bỏ qua --hole-mode fill, dùng mask.", verbose)
        return array, nodata_mask

    mask_for_fill = (~nodata_mask).astype(np.uint8)  # rasterio: mask=1 là pixel hợp lệ (giữ nguyên)
    original = array.copy()
    filled = fillnodata(array.copy(), mask=mask_for_fill, max_search_distance=25, smoothing_iterations=0)

    # Pixel nào fillnodata KHÔNG lấp được (nằm quá xa mọi pixel hợp lệ, vd sâu trong
    # vùng ngoài ranh giới) thì giá trị không đổi -> vẫn phải coi là nodata, tránh sinh
    # gai cao độ rác từ giá trị sentinel nodata gốc.
    still_nodata = nodata_mask & (~np.isfinite(filled) | np.isclose(filled, original, equal_nan=True))
    n_filled = int(nodata_mask.sum() - still_nodata.sum())
    log(f"Đã nội suy lấp {n_filled:,} pixel nodata nhỏ trong bán kính 25px "
        f"(hole-mode=fill). Còn lại {still_nodata.sum():,} pixel vẫn là lỗ vì quá xa dữ liệu hợp lệ.", verbose)
    return filled, still_nodata


# --------------------------------------------------------------------------
# 5a. Tô màu vertex theo cao độ (colormap)
# --------------------------------------------------------------------------
def colorize_by_elevation(array, used, grid_shape, colormap_name, verbose):
    import matplotlib
    import matplotlib.colors as mcolors

    rows, cols = grid_shape
    elevation_flat = array.reshape(-1)[used]

    vmin, vmax = np.nanmin(elevation_flat), np.nanmax(elevation_flat)
    if vmax <= vmin:
        vmax = vmin + 1.0
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    cmap_lookup = {"terrain": "terrain", "viridis": "viridis", "gray": "gray"}
    cmap = matplotlib.colormaps[cmap_lookup[colormap_name]]

    rgba = (cmap(norm(elevation_flat)) * 255).astype(np.uint8)
    log(f"Tô màu vertex theo cao độ với colormap '{colormap_name}' (min={vmin:.1f}m, max={vmax:.1f}m).", verbose)
    return rgba


# --------------------------------------------------------------------------
# 5b. Dán texture ảnh vệ tinh (UV mapping)
# --------------------------------------------------------------------------
def build_texture_uv(texture_path, transform, dem_crs, grid_shape, used, verbose):
    """Đọc ảnh texture (georeferenced), resample về đúng lưới + CRS của DEM hiện tại,
    trả về (uv_coords cho từng vertex đã dùng, ảnh PIL RGB)."""
    import rasterio
    from rasterio.warp import reproject, Resampling
    from PIL import Image

    rows, cols = grid_shape

    with rasterio.open(texture_path) as tex_src:
        tex_crs = tex_src.crs
        tex_count = min(tex_src.count, 3)
        band_indexes = list(range(1, tex_count + 1))

        dst = np.zeros((tex_count, rows, cols), dtype=np.uint8)
        reproject(
            source=rasterio.band(tex_src, band_indexes),
            destination=dst,
            src_transform=tex_src.transform,
            src_crs=tex_crs,
            dst_transform=transform,
            dst_crs=dem_crs,
            resampling=Resampling.bilinear,
        )

    if tex_count == 1:
        dst = np.repeat(dst, 3, axis=0)

    img_array = np.transpose(dst, (1, 2, 0))  # (rows, cols, 3)
    image = Image.fromarray(img_array, mode="RGB")

    # UV: u theo cột (0 trái -> 1 phải), v theo hàng nhưng LẬT (ảnh có gốc trên-trái,
    # UV chuẩn glTF/OBJ có gốc dưới-trái) -> v = 1 - row/rows
    col_idx, row_idx = np.meshgrid(np.arange(cols), np.arange(rows))
    u = col_idx / max(cols - 1, 1)
    v = 1.0 - row_idx / max(rows - 1, 1)
    uv_full = np.stack([u, v], axis=-1).reshape(-1, 2)
    uv = uv_full[used]

    log(f"Đã resample ảnh texture '{texture_path}' về lưới {cols}x{rows} và tính UV cho {uv.shape[0]:,} vertex.", verbose)
    return uv, image


# --------------------------------------------------------------------------
# 6. Xuất mesh ra các định dạng
# --------------------------------------------------------------------------
SUPPORTED_FORMATS = ("obj", "stl", "ply", "glb")


def export_mesh(vertices, faces, vertex_colors, uv, texture_image, output_base, formats, verbose):
    import trimesh

    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)

    # Vertex normals mượt (trung bình normal các mặt kề nhau) — trimesh tự tính khi cần
    _ = mesh.vertex_normals

    if uv is not None and texture_image is not None:
        mesh.visual = trimesh.visual.TextureVisuals(uv=uv, image=texture_image)
        log("Đã gán texture (UV) vào mesh.", verbose)
    elif vertex_colors is not None:
        mesh.visual.vertex_colors = vertex_colors
        log("Đã gán màu vertex vào mesh.", verbose)

    written = []
    for fmt in formats:
        fmt = fmt.strip().lower()
        if fmt not in SUPPORTED_FORMATS:
            log(f"CẢNH BÁO: bỏ qua định dạng không hỗ trợ '{fmt}'. Hỗ trợ: {', '.join(SUPPORTED_FORMATS)}", verbose)
            continue

        out_path = f"{output_base}.{fmt}"

        if fmt == "stl" and (uv is not None or vertex_colors is not None):
            log("Lưu ý: định dạng STL không hỗ trợ màu/texture, chỉ xuất hình học.", verbose)
        if fmt == "ply" and uv is not None:
            log("Lưu ý: định dạng PLY (qua trimesh) không giữ texture ảnh, chỉ giữ được vertex color nếu có.", verbose)

        # OBJ có texture cần ghi trực tiếp ra đường dẫn để trimesh tự sinh kèm .mtl + ảnh texture
        mesh.export(out_path)
        size_mb = os.path.getsize(out_path) / (1024 * 1024)
        log(f"  Đã ghi: {out_path}  ({size_mb:.2f} MB)", verbose)
        written.append(out_path)

    return written


def write_asset_fixture(path):
    """Write a tiny deterministic contract fixture for docs and viewer smoke tests."""
    path = os.path.abspath(path)
    root = os.path.dirname(path)
    os.makedirs(root, exist_ok=True)
    grid_path = os.path.join(root, "terrain.grid.bin")
    values = np.arange(6, dtype="<f4").reshape(2, 3)
    values.tofile(grid_path)
    metadata = {
        "schema_version": 1,
        "asset_id": "fixture-plane",
        "crs": {"authority": "EPSG", "code": 32648, "proj4": "+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs", "linear_unit": "metre"},
        "scene_axes": {"x": "east", "y": "up", "z": "negative_north"},
        "world_origin": {"x": 500000.0, "y": 2500000.0},
        "grid": {"file": "terrain.grid.bin", "shape": [2, 3], "shape_order": "rows_cols", "dtype": "float32", "byte_order": "little_endian", "layout": "row_major", "nodata_encoding": "nan", "elevation_unit": "metre", "sampling_method": "nearest_subsample", "source_step": 1, "byte_length": 24},
        "grid_transform": {"a": 10.0, "b": 0.0, "c": 499995.0, "d": 0.0, "e": -10.0, "f": 2500005.0, "convention": "rasterio_affine", "pixel_reference": "center"},
        "elevation": {"base_elevation": 0.0, "exaggeration": 1.0, "normalize_base": False, "min": 0.0, "max": 5.0},
        "analysis_supported": True,
    }
    dump_metadata(metadata, path)
    validate_metadata(metadata, grid_path=grid_path)
    print(f"Fixture written: {path} and {grid_path}")


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------
def main():
    # Keep CLI diagnostics readable on Windows consoles using the legacy
    # cp1252 code page; file contents remain UTF-8.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError):
            pass
    args = parse_args()
    if args.write_fixture:
        write_asset_fixture(args.write_fixture)
        return
    if not args.input or not args.output:
        raise ValueError("--input và --output là bắt buộc khi export DEM (hoặc dùng --write-fixture).")
    if args.exaggeration <= 0:
        raise ValueError("--exaggeration phải > 0")
    verbose = True  # luôn in tiến trình để người dùng theo dõi; tắt bằng cách sửa nếu cần chạy im lặng

    if not os.path.isfile(args.input):
        print(f"Lỗi: không tìm thấy file input '{args.input}'", file=sys.stderr)
        sys.exit(1)

    formats = [f.strip().lower() for f in args.formats.split(",") if f.strip()]
    if not formats:
        print("Lỗi: --formats rỗng, cần ít nhất 1 định dạng trong obj,stl,ply,glb", file=sys.stderr)
        sys.exit(1)

    out_dir = os.path.dirname(os.path.abspath(args.output))
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    # 1. Đọc DEM
    array, transform, crs, nodata_mask = read_dem(args.input, verbose)

    # 2. Reproject (nếu cần) sang hệ mét
    array, transform, crs, nodata_mask = reproject_dem(
        array, transform, crs, nodata_mask,
        target_epsg=args.target_epsg,
        keep_geographic=args.keep_geographic,
        verbose=verbose,
    )

    # Analysis assets need a projected metre CRS.  Geographic assets remain
    # useful for visual inspection, but are explicitly marked visual-only in
    # metadata and must not be used for metre-based measurements.
    analysis_supported = crs_is_projected_metre(crs)
    if not args.keep_geographic and not analysis_supported:
        raise ValueError(
            "CRS sau reprojection không phải projected metre; dùng --target-epsg "
            "hoặc --keep-geographic để tạo visual-only asset."
        )
    if args.keep_geographic:
        analysis_supported = False

    administrative_units = []
    # 3. Cắt theo ranh giới xã/phường (nếu có) — đánh dấu pixel ngoài xã thành nodata
    if args.commune_shp:
        outside_mask, administrative_units = load_commune_mask(
            args.commune_shp, args.commune, transform, crs, array.shape,
            args.commune_buffer, verbose, return_metadata=True,
        )
        nodata_mask = nodata_mask | outside_mask

        # Crop DEM về khung (bbox) vùng còn dữ liệu: xã nhỏ trong DEM tỉnh lớn sẽ
        # không bị downsample tính theo toàn tỉnh -> giữ nguyên độ chi tiết.
        original_shape = array.shape
        array, transform, nodata_mask = crop_to_valid_bbox(array, transform, nodata_mask)
        if array.shape != original_shape:
            log("Crop DEM về khung vùng dữ liệu: "
                f"-> {array.shape[1]}x{array.shape[0]} pixel.", verbose)
        log("Đã áp ranh giới xã: vùng ngoài xã sẽ thành lỗ (hole) trên mesh.", verbose)

    # 4. Downsample
    height, width = array.shape
    step = args.step if args.step is not None else compute_step(width, height, args.max_vertices)
    if args.step is None:
        log(f"Tự động chọn step={step} để giữ vertex dưới ~{args.max_vertices:,} "
            f"(dùng --step để ép giá trị cụ thể, --step 1 = full độ phân giải gốc).", verbose)
    array, transform, nodata_mask = downsample(array, transform, nodata_mask, step, verbose)

    # 5. Xây mesh
    # Apply the selected hole policy once, before both mesh and binary-grid
    # serialization, so the two representations cannot drift apart.
    if args.hole_mode == "fill":
        array, nodata_mask = fill_small_voids(array, nodata_mask, verbose)
    vertices, faces, used, grid_shape = build_mesh(
        array, transform, nodata_mask,
        exaggeration=args.exaggeration,
        normalize_base=not args.no_normalize_base,
        hole_mode="mask",
        verbose=verbose,
    )

    # Build the contract grid from the exact final array/mask.  The same
    # transform and sampling are used by the mesh and by the viewer.
    output_base = os.path.abspath(args.output)
    grid_path = output_base + ".grid.bin"
    json_path = output_base + ".terrain.json"
    glb_path = output_base + ".glb"
    grid = write_contract_grid(array, nodata_mask, grid_path)

    valid_elevation = grid[np.isfinite(grid)]
    if valid_elevation.size == 0:
        raise ValueError("Grid sau xử lý không còn cao độ hợp lệ.")
    base_elevation = float(np.nanmin(grid)) if not args.no_normalize_base else 0.0
    world_origin = choose_world_origin(array, transform, nodata_mask)

    # Recenter horizontal coordinates and map vertical data to the v1 scene
    # axes before any mesh format is written.
    world_x = vertices[:, 0].astype(np.float64)
    world_y = vertices[:, 1].astype(np.float64)
    scene_vertices = np.empty_like(vertices, dtype=np.float64)
    scene_vertices[:, 0] = world_x - world_origin["x"]
    scene_vertices[:, 2] = -(world_y - world_origin["y"])
    # Recover the elevation for each compacted vertex from its source grid
    # index, rather than relying on an already exaggerated mesh coordinate.
    vertex_elevation = array.reshape(-1)[used].astype(np.float64)
    scene_vertices[:, 1] = (vertex_elevation - base_elevation) * args.exaggeration

    # The existing mesh export code accepts any vertex array; export the
    # recentered v1 coordinates while preserving OBJ/PLY/STL compatibility.
    export_formats = list(dict.fromkeys(formats + (["glb"] if "glb" not in formats else [])))

    # 6. Màu / texture (chọn 1 trong 2 — texture ưu tiên nếu có)
    vertex_colors = None
    uv, texture_image = None, None

    if args.texture:
        if not os.path.isfile(args.texture):
            print(f"Lỗi: không tìm thấy file texture '{args.texture}'", file=sys.stderr)
            sys.exit(1)
        uv, texture_image = build_texture_uv(args.texture, transform, crs, grid_shape, used, verbose)
    elif args.colormap != "none":
        vertex_colors = colorize_by_elevation(array, used, grid_shape, args.colormap, verbose)

    # 7. Xuất file
    written = export_mesh(scene_vertices, faces, vertex_colors, uv, texture_image, output_base, export_formats, verbose)

    metadata = {
        "schema_version": 1,
        "asset_id": args.asset_id or os.path.basename(output_base),
        "crs": crs_metadata(crs),
        "scene_axes": {"x": "east", "y": "up", "z": "negative_north"},
        "world_origin": world_origin,
        "grid": {
            "file": os.path.basename(grid_path),
            "shape": [int(grid_shape[0]), int(grid_shape[1])],
            "shape_order": "rows_cols",
            "dtype": "float32",
            "byte_order": "little_endian",
            "layout": "row_major",
            "nodata_encoding": "nan",
            "elevation_unit": "metre",
            "sampling_method": "nearest_subsample",
            "source_step": int(step),
            "byte_length": int(os.path.getsize(grid_path)),
        },
        "grid_transform": serialize_transform(transform),
        "elevation": {
            "base_elevation": base_elevation,
            "exaggeration": float(args.exaggeration),
            "normalize_base": not args.no_normalize_base,
            "min": float(np.nanmin(grid)),
            "max": float(np.nanmax(grid)),
        },
        "analysis_supported": bool(analysis_supported),
        "hole_mode": args.hole_mode,
        "mesh": {
            "file": os.path.basename(glb_path),
            "vertex_count": int(scene_vertices.shape[0]),
            "triangle_count": int(faces.shape[0]),
        },
    }
    if administrative_units:
        metadata["administrative"] = {
            "source": os.path.basename(args.commune_shp),
            **(administrative_units[0] if len(administrative_units) == 1 else {"units": administrative_units}),
        }
    validate_metadata(metadata)
    dump_metadata(metadata, json_path)
    # Validate the just-written pair, including its byte length, before
    # reporting success.
    validate_metadata(metadata, grid_path=grid_path, require_mesh=True)
    log(f"  Đã ghi: {json_path}", verbose)
    log(f"  Đã ghi: {grid_path} ({os.path.getsize(grid_path)} bytes)", verbose)

    print("\nHoàn tất. Các file đã tạo:")
    for w in written:
        print(f"  - {w}")
    print(f"  - {json_path}")
    print(f"  - {grid_path}")


if __name__ == "__main__":
    main()
