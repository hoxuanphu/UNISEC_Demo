#!/usr/bin/env python3
"""
dem_to_3d_v2.py — Bản v2 của dem_to_3d.py, khắc phục lỗi ghép mảnh.

Khác biệt so với v1 (dem_to_3d.py):
  * Thêm --grid-gsd / --grid-origin-x / --grid-origin-y: ép lưới xuất ra MỘT
    lattice chuẩn dùng chung cho mọi mảnh. Khi ghép nhiều mảnh cắt từ các file
    DEM khác nhau (vd 2 tỉnh), tâm pixel của các mảnh sẽ nằm trên cùng một
    mặt phẳng lấy mẫu -> mép mảnh khớp nhau, hết khe hở dọc biên.
  * Thêm --lattice-file: đọc/ghi lattice chuẩn vào file JSON để các lần chạy
    riêng biệt dùng chung lattice mà không phải nhớ số liệu thủ công.
  * Metadata ghi thêm khối "shared_lattice" (tuần thủ contract v1: chỉ thêm
    key mới, không đổi key cũ) để viewer/công cụ kiểm tra nhóm mảnh.

Mọi hành vi khác (đọc DEM, reproject, cắt xã, mesh, xuất GLB) giữ nguyên v1.

Ví dụ dùng cho 2 mảnh từ 2 file DEM khác tỉnh (chạy 2 lệnh riêng biệt):

    python dem_to_3d_v2.py --input SonLa_34Tinh_DEM_SRTM_30m.tif \
        --output chieng_lao_v2 \
        --commune-shp "Shapefile_PX_VN_34/Việt Nam (phường xã) - 34.shp" \
        --commune "Chiềng Lao" --colormap terrain --formats glb --step 1 \
        --lattice-file shared_lattice.json --lattice-create

    python dem_to_3d_v2.py --input LaoCai_34Tinh_DEM_SRTM_30m.tif \
        --output che_tao_v2 \
        --commune-shp "Shapefile_PX_VN_34/Việt Nam (phường xã) - 34.shp" \
        --commune "Chế Tạo" --colormap terrain --formats glb --step 1 \
        --lattice-file shared_lattice.json

Hoặc truyền số liệu trực tiếp thay vì dùng file:

    ... --grid-gsd 28.75 --grid-origin-x 370900 --grid-origin-y 2404900
"""

import argparse
import json
import os
import sys

import numpy as np

from terrain_contract import crs_is_projected_metre, crs_metadata, dump_metadata, validate_metadata

from dem_to_3d import (
    SUPPORTED_FORMATS,
    auto_utm_epsg,
    build_mesh,
    choose_world_origin,
    colorize_by_elevation,
    compute_step,
    crop_to_valid_bbox,
    downsample,
    export_mesh,
    fill_small_voids,
    load_commune_mask,
    log,
    rasterio_bounds,
    read_dem,
    serialize_transform,
    write_contract_grid,
)


# --------------------------------------------------------------------------
# v2: lattice chuẩn dùng chung
# --------------------------------------------------------------------------
def parse_args():
    p = argparse.ArgumentParser(
        description="Chuyển file DEM (raster cao độ) thành mesh 3D nhiều định dạng (v2: shared lattice).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    # Giữ nguyên toàn bộ tham số của v1
    p.add_argument("--input", "-i", required=False)
    p.add_argument("--output", "-o", required=False)
    p.add_argument("--formats", default="obj,stl,ply,glb")
    p.add_argument("--target-epsg", type=int, default=None)
    p.add_argument("--keep-geographic", action="store_true")
    p.add_argument("--step", type=int, default=None)
    p.add_argument("--max-vertices", type=int, default=500_000)
    p.add_argument("--exaggeration", type=float, default=1.5)
    p.add_argument("--no-normalize-base", action="store_true")
    p.add_argument("--commune-shp", default=None)
    p.add_argument("--commune", default=None)
    p.add_argument("--commune-buffer", type=float, default=0.0)
    p.add_argument("--hole-mode", choices=["mask", "fill"], default="mask")
    p.add_argument("--colormap", choices=["none", "terrain", "viridis", "gray"], default="none")
    p.add_argument("--texture", default=None)
    p.add_argument("--texture-crop-bbox", default=None, metavar="PATH",
                    help="Khi dùng --texture: cắt (crop) ảnh gốc về đúng vùng lưới DEM rồi GHI RA file ảnh "
                         "GeoTIFF riêng (vd texture_cropped.tif) trước khi resample. File cắt giữ nguyên CRS/độ phân giải "
                         "gốc của ảnh, loại bỏ phần ảnh ngoài vùng cần thiết, và được lưu kèm asset để dùng lại.")
    p.add_argument("--verbose", "-v", action="store_true")
    p.add_argument("--asset-id", default=None)
    p.add_argument("--write-fixture", default=None, metavar="PATH")

    # --- v2: lattice chuẩn ---
    p.add_argument("--grid-gsd", type=float, default=None,
                    help="Kích thước pixel (mét) của lưới xuất. Cùng giá trị này cho mọi mảnh cần ghép.")
    p.add_argument("--grid-origin-x", type=float, default=None,
                    help="Hoành độ tâm pixel (0,0) của lattice chuẩn (mét, theo CRS đích).")
    p.add_argument("--grid-origin-y", type=float, default=None,
                    help="Tung độ tâm pixel (0,0) của lattice chuẩn (mét, theo CRS đích).")
    p.add_argument("--lattice-file", default=None, metavar="PATH",
                    help="File JSON đọc/ghi lattice chuẩn {gsd, origin_x, origin_y, epsg}. "
                         "Kết hợp với --lattice-create ở lần chạy đầu tiên.")
    p.add_argument("--lattice-create", action="store_true",
                    help="Nếu lattice-file chưa tồn tại: tính lattice tự động từ DEM hiện tại rồi GHI ra file. "
                         "Nếu đã tồn tại thì dùng file (báo lỗi nếu tham số truyền vào xung đột).")
    return p.parse_args()


LATTICE_KEYS = ("gsd", "origin_x", "origin_y", "epsg")


def read_lattice_file(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    missing = [k for k in LATTICE_KEYS if k not in data]
    if missing:
        raise ValueError(f"Lattice file '{path}' thiếu các key: {', '.join(missing)}")
    return {k: data[k] for k in LATTICE_KEYS}


def write_lattice_file(path, lattice):
    root = os.path.dirname(os.path.abspath(path))
    if root:
        os.makedirs(root, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(lattice, f, indent=2, ensure_ascii=False)
        f.write("\n")
    log(f"[v2] Đã ghi lattice chuẩn ra: {path}  (gsd={lattice['gsd']:.4f}m, "
        f"origin=({lattice['origin_x']:.2f}, {lattice['origin_y']:.2f}), epsg={lattice['epsg']})", True)


def snap_transform(dst_transform, dst_width, dst_height, gsd, origin_x, origin_y, verbose):
    """Ép transform đích về lattice chuẩn (origin + gsd cho trước).

    Trả về (transform_mới, width, height) sao cho tâm pixel (col, row) nằm tại
    (origin_x + col*gsd, origin_y - row*gsd). Kích thước lưới giữ đủ phủ bbox
    của lưới tự tính ban đầu (mở rộng ra ngoài ranh giới để không mất dữ liệu).
    """
    from affine import Affine
    import math

    # Bbox tâm pixel của lưới tự tính (ảnh north-up: a > 0, e < 0)
    xs_min = dst_transform.c + 0.5 * dst_transform.a
    xs_max = dst_transform.c + (dst_width - 0.5) * dst_transform.a
    ys_max = dst_transform.f + 0.5 * dst_transform.e
    ys_min = dst_transform.f + (dst_height - 0.5) * dst_transform.e

    # Chỉ số pixel (theo lattice mới) bao quanh bbox cũ, mở rộng 1 pixel mỗi phía
    col_start = math.floor((xs_min - origin_x) / gsd) - 1
    row_start = math.floor((origin_y - ys_max) / gsd) - 1
    col_end = math.ceil((xs_max - origin_x) / gsd) + 1
    row_end = math.ceil((origin_y - ys_min) / gsd) + 1
    width = col_end - col_start + 1
    height = row_end - row_start + 1

    # Transform chuẩn: tâm pixel (col, row) = (origin_x + col*gsd, origin_y - row*gsd).
    # Pixel (0,0) của lưới crop chính là pixel (col_start, row_start) của lattice.
    t = Affine.translation(origin_x + col_start * gsd - 0.5 * gsd,
                           origin_y - row_start * gsd + 0.5 * gsd) @ Affine.scale(gsd, -gsd)

    log(f"[v2] Snap lattice chuẩn: gsd={gsd:.4f}m origin=({origin_x:.2f},{origin_y:.2f}) "
        f"-> lưới {width}x{height} (tự tính cũ: {dst_width}x{dst_height})", verbose)
    return t, width, height


def reproject_dem_v2(array, transform, crs, nodata_mask, target_epsg, keep_geographic,
                     lattice, verbose):
    """Như reproject_dem của v1 nhưng ép lưới đích về lattice chuẩn (nếu có)."""
    if crs is None:
        if keep_geographic:
            log("DEM không khai báo CRS; tạo visual-only asset theo --keep-geographic.", verbose)
            return array, transform, crs, nodata_mask
        raise ValueError("DEM không khai báo CRS; cần --keep-geographic hoặc gán CRS trước khi export.")
    if keep_geographic:
        log("Giữ nguyên hệ tọa độ gốc theo yêu cầu (--keep-geographic).", verbose)
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

    if lattice is not None and int(lattice["epsg"]) != int(epsg):
        raise ValueError(
            f"Lattice chuẩn dùng EPSG:{lattice['epsg']} nhưng DEM này reproject sang EPSG:{epsg}. "
            f"Dùng --target-epsg {int(lattice['epsg'])} để đồng bộ CRS."
        )

    dst_crs = CRS.from_epsg(epsg)
    src_nodata_value = -32768.0
    work = array.copy()
    work[nodata_mask] = src_nodata_value

    dst_transform, dst_width, dst_height = calculate_default_transform(
        crs, dst_crs, width, height, *rasterio_bounds(transform, width, height)
    )

    if lattice is not None:
        # v2: ép về lattice chuẩn
        dst_transform, dst_width, dst_height = snap_transform(
            dst_transform, dst_width, dst_height,
            float(lattice["gsd"]), float(lattice["origin_x"]), float(lattice["origin_y"]), verbose,
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
    new_nodata_mask = np.isclose(dst_array, src_nodata_value)
    log(f"  Sau reproject: {dst_width} x {dst_height} pixel, GSD ~ {dst_transform[0]:.4f}m", verbose)
    return dst_array, dst_transform, dst_crs, new_nodata_mask


# --------------------------------------------------------------------------
# v2: crop ảnh texture về bbox lưới DEM (theo tọa độ địa lý), ghi file kèm theo
# --------------------------------------------------------------------------
def crop_texture_to_grid(texture_path, transform, crs, grid_shape, out_path, verbose):
    """Crop ảnh texture về đúng bbox của lưới DEM hiện tại (sau crop xã + snap lattice).

    - Bbox tính theo TÂM PIXEL (pixel-center), nới thêm nửa pixel mỗi phía cho an toàn.
    - Ảnh ở CRS khác DEM thì tự động warp về CRS của DEM trong lúc cắt.
    - Ghi file GeoTIFF RGB (3 band uint8) kèm asset; trả về đường dẫn file đã cắt.
    - UV map không đổi: vẫn do build_texture_uv tính theo lưới DEM, nên texture
      crop khớp UV tuyệt đối (cùng vùng địa lý).
    """
    import rasterio
    from rasterio.windows import from_bounds, Window
    from rasterio.warp import transform_bounds

    def _window(bounds):
        w = from_bounds(*bounds, src.transform)
        # ceil sang số nguyên dương, tránh round_shape deprecated
        col_off, row_off = int(np.floor(w.col_off)), int(np.floor(w.row_off))
        width = max(int(np.ceil(w.width + (w.col_off - col_off))), 1)
        height = max(int(np.ceil(w.height + (w.row_off - row_off))), 1)
        return Window(col_off, row_off, width, height)

    def _gsd_str(tr, crs_img):
        g = abs(tr.a)
        if crs_img is not None and crs_img.is_geographic:
            return f"~{g * 111_320:.1f}m (độ)"
        return f"~{g:.2f}m"

    rows, cols = grid_shape
    # bbox theo tâm pixel của lưới DEM
    xs_min = transform.c + 0.5 * transform.a
    xs_max = transform.c + (cols - 0.5) * transform.a
    ys_max = transform.f + 0.5 * transform.e
    ys_min = transform.f + (rows - 0.5) * transform.e
    # nới nửa pixel mỗi phía
    pad_x = 0.5 * abs(transform.a)
    pad_y = 0.5 * abs(transform.e)
    left, bottom, right, top = xs_min - pad_x, ys_min - pad_y, xs_max + pad_x, ys_max + pad_y

    with rasterio.open(texture_path) as src:
        band_count = min(src.count, 3)
        band_indexes = list(range(1, band_count + 1))
        if src.crs is None:
            raise ValueError(f"Ảnh texture '{texture_path}' không có CRS — không thể crop theo tọa độ địa lý.")
        if src.crs == crs:
            window = _window((left, bottom, right, top))
            data = src.read(band_indexes, window=window)
            out_transform = src.window_transform(window)
            out_crs = src.crs
            log(f"[v2] Crop texture: window {int(window.width)}x{int(window.height)} px "
                f"(GSD ảnh {_gsd_str(src.transform, src.crs)}), không cần warp.", verbose)
        else:
            # warp bbox sang CRS của ảnh rồi mới crop; ảnh giữ nguyên CRS gốc
            left_w, bottom_w, right_w, top_w = transform_bounds(crs, src.crs, left, bottom, right, top)
            window = _window((left_w, bottom_w, right_w, top_w))
            data = src.read(band_indexes, window=window)
            out_transform = src.window_transform(window)
            out_crs = src.crs
            log(f"[v2] Crop texture: window {int(window.width)}x{int(window.height)} px "
                f"(GSD ảnh {_gsd_str(src.transform, src.crs)}), CRS ảnh {src.crs} != DEM {crs} "
                f"(bbox đã warp, ảnh giữ CRS gốc).", verbose)

    if data.dtype != np.uint8:
        data = np.clip(data, 0, 255).astype(np.uint8)

    profile = {
        "driver": "GTiff",
        "height": data.shape[1],
        "width": data.shape[2],
        "count": data.shape[0],
        "dtype": "uint8",
        "crs": out_crs,
        "transform": out_transform,
        "compress": "deflate",
    }
    with rasterio.open(out_path, "w", **profile) as dst:
        dst.write(data)
    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    log(f"[v2] Đã ghi texture cắt: {out_path}  ({size_mb:.2f} MB, {data.shape[2]}x{data.shape[1]} px)", verbose)
    return out_path


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------
def main():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError):
            pass
    args = parse_args()
    if args.write_fixture:
        from dem_to_3d import write_asset_fixture
        write_asset_fixture(args.write_fixture)
        return
    if not args.input or not args.output:
        raise ValueError("--input và --output là bắt buộc khi export DEM.")
    if args.exaggeration <= 0:
        raise ValueError("--exaggeration phải > 0")
    verbose = True

    if not os.path.isfile(args.input):
        print(f"Lỗi: không tìm thấy file input '{args.input}'", file=sys.stderr)
        sys.exit(1)

    formats = [f.strip().lower() for f in args.formats.split(",") if f.strip()]
    if not formats:
        print("Lỗi: --formats rỗng.", file=sys.stderr)
        sys.exit(1)

    # ----- v2: xác định lattice chuẩn -----
    lattice = None
    gsd = args.grid_gsd
    ox = args.grid_origin_x
    oy = args.grid_origin_y

    if args.lattice_file:
        if os.path.isfile(args.lattice_file):
            lattice = read_lattice_file(args.lattice_file)
            log(f"[v2] Đọc lattice chuẩn từ: {args.lattice_file}", verbose)
            # Tham số dòng lệnh không được xung đột với file
            for name, cli_val, key in (("--grid-gsd", gsd, "gsd"),):
                if cli_val is not None and abs(cli_val - float(lattice[key])) > 1e-6:
                    raise ValueError(f"{name}={cli_val} xung đột lattice file ({lattice[key]})")
            if ox is not None and abs(ox - float(lattice["origin_x"])) > 1e-6:
                raise ValueError(f"--grid-origin-x={ox} xung đột lattice file ({lattice['origin_x']})")
            if oy is not None and abs(oy - float(lattice["origin_y"])) > 1e-6:
                raise ValueError(f"--grid-origin-y={oy} xung đột lattice file ({lattice['origin_y']})")
        else:
            if not args.lattice_create:
                raise ValueError(f"Lattice file '{args.lattice_file}' chưa tồn tại; dùng --lattice-create ở lần chạy đầu.")
            # Lattice sẽ được tạo sau reproject (cần biết EPSG); gắn cờ
            lattice = "CREATE"
    elif gsd is not None or ox is not None or oy is not None:
        if gsd is None or ox is None or oy is None:
            raise ValueError("--grid-gsd, --grid-origin-x, --grid-origin-y phải đi cùng nhau (hoặc dùng --lattice-file).")
        lattice = {"gsd": float(gsd), "origin_x": float(ox), "origin_y": float(oy), "epsg": int(args.target_epsg or 0)}
        if lattice["epsg"] == 0:
            raise ValueError("--target-epsg bắt buộc khi truyền lattice trực tiếp qua --grid-gsd/... (cần biết CRS).")

    out_dir = os.path.dirname(os.path.abspath(args.output))
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    # 1. Đọc DEM
    array, transform, crs, nodata_mask = read_dem(args.input, verbose)

    # 2. Reproject (nếu cần) — v2 kèm snap lattice
    creating = lattice == "CREATE"
    lattice_run = None if creating else lattice
    if creating:
        # Chạy reproject thường trước để lấy EPSG tự tính, rồi tạo lattice
        array, transform, crs, nodata_mask = reproject_dem_v2(
            array, transform, crs, nodata_mask,
            target_epsg=args.target_epsg, keep_geographic=args.keep_geographic,
            lattice=None, verbose=verbose,
        )
        # Tạo lattice từ kết quả tự tính của chính DEM này
        epsg = int(crs.to_epsg()) if crs is not None and crs.to_epsg() else 0
        lattice = {
            "gsd": float(abs(transform.a)),
            "origin_x": float(transform.c + 0.5 * transform.a),
            "origin_y": float(transform.f + 0.5 * transform.e),
            "epsg": epsg,
        }
        # Re-project lại lần 2 theo lattice vừa tạo (chính là lưới tự tính -> identity, nhưng
        # chạy qua snap để transform khớp format chuẩn một cách tường minh)
        # Đọc lại DEM gốc để reproject lần 2 trên dữ liệu sạch
        array, transform, crs, nodata_mask = read_dem(args.input, verbose)
        array, transform, crs, nodata_mask = reproject_dem_v2(
            array, transform, crs, nodata_mask,
            target_epsg=args.target_epsg, keep_geographic=args.keep_geographic,
            lattice=lattice, verbose=verbose,
        )
        write_lattice_file(args.lattice_file, lattice)
    else:
        array, transform, crs, nodata_mask = reproject_dem_v2(
            array, transform, crs, nodata_mask,
            target_epsg=args.target_epsg, keep_geographic=args.keep_geographic,
            lattice=lattice_run, verbose=verbose,
        )

    analysis_supported = crs_is_projected_metre(crs)
    if not args.keep_geographic and not analysis_supported:
        raise ValueError(
            "CRS sau reprojection không phải projected metre; dùng --target-epsg "
            "hoặc --keep-geographic để tạo visual-only asset."
        )
    if args.keep_geographic:
        analysis_supported = False

    administrative_units = []
    # 3. Cắt theo ranh giới xã
    if args.commune_shp:
        outside_mask, administrative_units = load_commune_mask(
            args.commune_shp, args.commune, transform, crs, array.shape,
            args.commune_buffer, verbose, return_metadata=True,
        )
        nodata_mask = nodata_mask | outside_mask
        original_shape = array.shape
        array, transform, nodata_mask = crop_to_valid_bbox(array, transform, nodata_mask)
        if array.shape != original_shape:
            log("Crop DEM về khung vùng dữ liệu: "
                f"-> {array.shape[1]}x{array.shape[0]} pixel.", verbose)
        log("Đã áp ranh giới xã: vùng ngoài xã sẽ thành lỗ (hole) trên mesh.", verbose)

    # 4. Downsample
    height, width = array.shape
    step = args.step if args.step is not None else compute_step(width, height, args.max_vertices)
    array, transform, nodata_mask = downsample(array, transform, nodata_mask, step, verbose)

    # 5. Xây mesh
    if args.hole_mode == "fill":
        array, nodata_mask = fill_small_voids(array, nodata_mask, verbose)
    vertices, faces, used, grid_shape = build_mesh(
        array, transform, nodata_mask,
        exaggeration=args.exaggeration,
        normalize_base=not args.no_normalize_base,
        hole_mode="mask",
        verbose=verbose,
    )

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

    world_x = vertices[:, 0].astype(np.float64)
    world_y = vertices[:, 1].astype(np.float64)
    scene_vertices = np.empty_like(vertices, dtype=np.float64)
    scene_vertices[:, 0] = world_x - world_origin["x"]
    scene_vertices[:, 2] = -(world_y - world_origin["y"])
    vertex_elevation = array.reshape(-1)[used].astype(np.float64)
    scene_vertices[:, 1] = (vertex_elevation - base_elevation) * args.exaggeration

    export_formats = list(dict.fromkeys(formats + (["glb"] if "glb" not in formats else [])))

    vertex_colors = None
    uv, texture_image = None, None
    texture_source = None      # file texture thực sự dùng (sau khi crop nếu có)
    texture_cropped_path = None
    if args.texture:
        if not os.path.isfile(args.texture):
            print(f"Lỗi: không tìm thấy file texture '{args.texture}'", file=sys.stderr)
            sys.exit(1)
        from dem_to_3d import build_texture_uv
        texture_source = args.texture
        if args.texture_crop_bbox:
            texture_cropped_path = os.path.abspath(args.texture_crop_bbox)
            texture_cropped_path = crop_texture_to_grid(
                args.texture, transform, crs, grid_shape, texture_cropped_path, verbose,
            )
            texture_source = texture_cropped_path
        uv, texture_image = build_texture_uv(texture_source, transform, crs, grid_shape, used, verbose)
    elif args.colormap != "none":
        vertex_colors = colorize_by_elevation(array, used, grid_shape, args.colormap, verbose)

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
    if lattice is not None and lattice != "CREATE":
        metadata["shared_lattice"] = {
            "gsd": float(lattice["gsd"]),
            "origin_x": float(lattice["origin_x"]),
            "origin_y": float(lattice["origin_y"]),
            "epsg": int(lattice["epsg"]),
        }
    if texture_cropped_path:
        metadata["texture"] = {
            "source": os.path.basename(args.texture),
            "file": os.path.basename(texture_cropped_path),
            "cropped_to_grid": True,
            "note": "Ảnh gốc đã cắt về bbox lưới DEM (pixel-center + nửa pixel đệm) trước khi resample.",
        }
    if administrative_units:
        metadata["administrative"] = {
            "source": os.path.basename(args.commune_shp),
            **(administrative_units[0] if len(administrative_units) == 1 else {"units": administrative_units}),
        }

    validate_metadata(metadata)
    dump_metadata(metadata, json_path)
    validate_metadata(metadata, grid_path=grid_path, require_mesh=True)
    log(f"  Đã ghi: {json_path}", verbose)
    log(f"  Đã ghi: {grid_path} ({os.path.getsize(grid_path)} bytes)", verbose)

    print("\nHoàn tất. Các file đã tạo:")
    for w in written:
        print(f"  - {w}")
    print(f"  - {json_path}")
    print(f"  - {grid_path}")
    if texture_cropped_path:
        print(f"  - {texture_cropped_path}  (texture đã cắt theo bbox lưới DEM)")
    if lattice is not None and lattice != "CREATE":
        print(f"  Lattice chuẩn: gsd={lattice['gsd']:.4f}m origin=({lattice['origin_x']:.2f}, {lattice['origin_y']:.2f}) epsg={lattice['epsg']}")


if __name__ == "__main__":
    main()
