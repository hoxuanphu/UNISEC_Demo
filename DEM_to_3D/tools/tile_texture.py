"""Generate a bounded WebP texture pyramid for a terrain model."""
from __future__ import annotations

import argparse
import json
import math
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import rasterio
from affine import Affine
from PIL import Image, ImageOps
from rasterio.enums import Resampling
from rasterio.windows import Window, from_bounds
from rasterio.warp import reproject, transform_bounds

TILE_RE = re.compile(r"^z(\d+)/(\d+)_(\d+)\.webp$")

@dataclass(frozen=True)
class TileGenerationReport:
    metadata_path: Path
    output_dir: Path
    tile_count: int
    max_zoom: int
    width_px: int
    height_px: int

def _terrain_json(path: str | Path) -> dict[str, Any]:
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("terrain metadata must be an object")
    return value

def terrain_outer_bounds(metadata: dict[str, Any]) -> dict[str, float]:
    transform = metadata["grid_transform"]
    rows, cols = metadata["grid"]["shape"]
    if abs(float(transform["b"])) > 1e-12 or abs(float(transform["d"])) > 1e-12:
        raise ValueError("rotated/sheared grid transforms are not supported")
    a, e, c, f = (float(transform[key]) for key in ("a", "e", "c", "f"))
    if a <= 0 or e >= 0:
        raise ValueError("terrain grid must be north-up")
    return {"min_x": c, "min_y": f + e * rows, "max_x": c + a * cols, "max_y": f}

def _level(width: int, height: int, zoom: int, tile_size: int, pixel_x: float, pixel_y: float, scale: int) -> dict[str, Any]:
    return {"zoom": zoom, "width_px": width, "height_px": height, "columns": math.ceil(width / tile_size), "rows": math.ceil(height / tile_size), "pixel_size_x": pixel_x * scale, "pixel_size_y": pixel_y * scale}

def build_tile_metadata(source_path: str | Path, terrain_json_path: str | Path, tile_size: int = 512, quality: int = 88) -> dict[str, Any]:
    if not isinstance(tile_size, int) or tile_size <= 0:
        raise ValueError("tile_size must be a positive integer")
    if not 1 <= quality <= 100:
        raise ValueError("quality must be between 1 and 100")
    source_path, terrain = Path(source_path), _terrain_json(terrain_json_path)
    bounds = terrain_outer_bounds(terrain)
    target_crs = rasterio.crs.CRS.from_epsg(int(terrain["crs"]["code"]))
    with rasterio.open(source_path) as source:
        if source.crs is None:
            raise ValueError("source raster must have a CRS")
        if source.crs == target_crs:
            pixel_x, pixel_y = abs(float(source.transform.a)), abs(float(source.transform.e))
        else:
            source_bounds = transform_bounds(source.crs, target_crs, *source.bounds)
            pixel_x = abs((source_bounds[2] - source_bounds[0]) / source.width)
            pixel_y = abs((source_bounds[3] - source_bounds[1]) / source.height)
    native_width = max(1, math.ceil((bounds["max_x"] - bounds["min_x"]) / pixel_x))
    native_height = max(1, math.ceil((bounds["max_y"] - bounds["min_y"]) / pixel_y))
    max_zoom = max(0, math.ceil(math.log2(max(native_width, native_height) / tile_size)))
    max_width, max_height = max(tile_size, native_width), max(tile_size, native_height)
    max_pixel_x = (bounds["max_x"] - bounds["min_x"]) / max_width
    max_pixel_y = (bounds["max_y"] - bounds["min_y"]) / max_height
    levels = []
    for zoom in range(max_zoom + 1):
        scale = 2 ** (max_zoom - zoom)
        width = max(1, math.ceil(max_width / scale))
        height = max(1, math.ceil(max_height / scale))
        levels.append(_level(width, height, zoom, tile_size, max_pixel_x, max_pixel_y, scale))
    return {"schema_version": 1, "asset_id": str(terrain["asset_id"]), "format": "webp", "quality": quality, "tile_size": tile_size, "gutter_px": 2, "min_zoom": 0, "max_zoom": max_zoom, "bounds_projected": bounds, "crs": {"authority": "EPSG", "code": int(terrain["crs"]["code"]), "linear_unit": terrain["crs"].get("linear_unit", "metre")}, "orientation": {"origin": "top_left", "x": "east", "y": "north_to_south"}, "levels": levels, "source": source_path.name}

def _add_gutter(image: Image.Image, gutter_px: int) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"))
    padded = np.pad(pixels, ((gutter_px, gutter_px), (gutter_px, gutter_px), (0, 0)), mode="edge")
    return Image.fromarray(padded, mode="RGB")

def render_max_level_tile(source: Any, target_crs: Any, target_transform: Affine, tile_window: Window, gutter_px: int = 2) -> Image.Image:
    tile_size = int(tile_window.width)
    left, top = target_transform.c, target_transform.f
    right, bottom = left + target_transform.a * tile_size, top + target_transform.e * tile_size
    source_bounds = transform_bounds(target_crs, source.crs, left, bottom, right, top, densify_pts=2)
    raw = from_bounds(*source_bounds, transform=source.transform)
    raw_col0, raw_row0 = math.floor(raw.col_off) - 2, math.floor(raw.row_off) - 2
    raw_col1, raw_row1 = math.ceil(raw.col_off + raw.width) + 2, math.ceil(raw.row_off + raw.height) + 2
    if raw_col1 <= 0 or raw_row1 <= 0 or raw_col0 >= source.width or raw_row0 >= source.height:
        return Image.new("RGB", (tile_size + gutter_px * 2, tile_size + gutter_px * 2), (0, 0, 0))
    col0, row0 = max(0, raw_col0), max(0, raw_row0)
    col1, row1 = min(source.width, raw_col1), min(source.height, raw_row1)
    window = Window(col0, row0, max(1, col1 - col0), max(1, row1 - row0))
    indexes = [1, 2, 3] if source.count >= 3 else [1]
    data = source.read(indexes, window=window, boundless=False, out_dtype="uint8")
    if data.shape[0] == 1:
        data = np.repeat(data, 3, axis=0)
    destination = np.zeros((3, tile_size, tile_size), dtype=np.uint8)
    reproject(source=data, destination=destination, src_transform=source.window_transform(window), src_crs=source.crs, dst_transform=target_transform, dst_crs=target_crs, resampling=Resampling.bilinear, src_nodata=0, dst_nodata=0)
    return _add_gutter(Image.fromarray(np.transpose(destination, (1, 2, 0)), mode="RGB"), gutter_px)

def downsample_child_tiles(child_paths: Iterable[str | Path], target_size: int, gutter_px: int = 2) -> Image.Image:
    paths = [Path(path) for path in child_paths]
    if len(paths) != 4:
        raise ValueError("a parent tile requires four child tiles")
    mosaic = Image.new("RGB", (target_size * 2, target_size * 2))
    for index, path in enumerate(paths):
        with Image.open(path) as image:
            tile = image.convert("RGB").crop((gutter_px, gutter_px, image.width - gutter_px, image.height - gutter_px))
        if tile.size != (target_size, target_size):
            tile = tile.resize((target_size, target_size), Image.Resampling.BILINEAR)
        mosaic.paste(tile, ((index % 2) * target_size, (index // 2) * target_size))
    return _add_gutter(mosaic.resize((target_size, target_size), Image.Resampling.BILINEAR), gutter_px)

def _validate_output(metadata: dict[str, Any], output_dir: Path) -> int:
    count, expected = 0, metadata["tile_size"] + 2 * metadata["gutter_px"]
    for level in metadata["levels"]:
        paths = sorted((output_dir / f"z{level['zoom']}").glob("*.webp"))
        if len(paths) != level["columns"] * level["rows"]:
            raise ValueError(f"level {level['zoom']} has incomplete tile output")
        for path in paths:
            match = TILE_RE.match(path.relative_to(output_dir).as_posix())
            if not match or int(match.group(2)) >= level["columns"] or int(match.group(3)) >= level["rows"]:
                raise ValueError(f"unsafe tile path: {path}")
            with Image.open(path) as image:
                if image.size != (expected, expected):
                    raise ValueError(f"invalid tile dimensions: {path}")
                image.load()
            count += 1
    return count

def generate_pyramid(source_path: str | Path, terrain_json_path: str | Path, output_dir: str | Path, tile_size: int = 512, quality: int = 88) -> TileGenerationReport:
    metadata = build_tile_metadata(source_path, terrain_json_path, tile_size, quality)
    output_dir = Path(output_dir)
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)
    bounds = metadata["bounds_projected"]
    target_crs = rasterio.crs.CRS.from_epsg(int(metadata["crs"]["code"]))
    max_level = metadata["levels"][-1]
    with rasterio.open(source_path) as source:
        level_dir = output_dir / f"z{metadata['max_zoom']}"
        level_dir.mkdir()
        for row in range(max_level["rows"]):
            for column in range(max_level["columns"]):
                transform = Affine(max_level["pixel_size_x"], 0, bounds["min_x"] + column * tile_size * max_level["pixel_size_x"], 0, -max_level["pixel_size_y"], bounds["max_y"] - row * tile_size * max_level["pixel_size_y"])
                render_max_level_tile(source, target_crs, transform, Window(0, 0, tile_size, tile_size), metadata["gutter_px"]).save(level_dir / f"{column}_{row}.webp", format="WEBP", quality=quality, method=4)
    for zoom in range(metadata["max_zoom"] - 1, -1, -1):
        level, child = metadata["levels"][zoom], metadata["levels"][zoom + 1]
        child_dir, level_dir = output_dir / f"z{zoom + 1}", output_dir / f"z{zoom}"
        level_dir.mkdir()
        for row in range(level["rows"]):
            for column in range(level["columns"]):
                paths = [child_dir / f"{min(column * 2 + dx, child['columns'] - 1)}_{min(row * 2 + dy, child['rows'] - 1)}.webp" for dy in range(2) for dx in range(2)]
                downsample_child_tiles(paths, tile_size, metadata["gutter_px"]).save(level_dir / f"{column}_{row}.webp", format="WEBP", quality=quality, method=4)
    count = _validate_output(metadata, output_dir)
    metadata_path = Path(terrain_json_path).with_name(f"{Path(terrain_json_path).name.removesuffix('.terrain.json')}.tiles.json")
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return TileGenerationReport(metadata_path, output_dir, count, metadata["max_zoom"], max_level["width_px"], max_level["height_px"])

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--terrain-json", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--tile-size", type=int, default=512)
    parser.add_argument("--format", choices=["webp"], default="webp")
    parser.add_argument("--quality", type=int, default=88)
    args = parser.parse_args()
    report = generate_pyramid(args.input, args.terrain_json, args.output, args.tile_size, args.quality)
    print(json.dumps({"metadata": str(report.metadata_path), "output": str(report.output_dir), "tiles": report.tile_count, "max_zoom": report.max_zoom}, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
