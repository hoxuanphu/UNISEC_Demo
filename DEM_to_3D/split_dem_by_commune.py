"""Split a DEM into one masked GeoTIFF per commune in a shapefile.

Run from any directory:
    python DEM_to_3D/split_dem_by_commune.py
    python DEM_to_3D/split_dem_by_commune.py --code 12345 --output-dir commune_dem
"""

import argparse
from pathlib import Path
import re
import sys

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.features import bounds
from rasterio.mask import mask
from rasterio.warp import transform_geom
import shapefile


HERE = Path(__file__).resolve().parent
DEFAULT_DEM = HERE / "YenBai_63Tinh_DEM_SRTM_30m.tif"
DEFAULT_SHP = HERE / "Shapefile_QH_VN_63" / "Việt Nam (quận huyện) - 63.shp"


def commune_filename(name, code):
    safe_name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name.strip())
    safe_name = re.sub(r"\s+", "_", safe_name).strip(" ._")
    return f"{safe_name + '_' if safe_name else ''}{code}.tif"


def split_dem(dem_path, shp_path, output_dir, code=None, overwrite=False, name=None):
    output_dir.mkdir(parents=True, exist_ok=True)
    source_crs = CRS.from_wkt(shp_path.with_suffix(".prj").read_text(encoding="utf-8"))
    written = skipped = 0
    matched = 0
    name_query, _, province_query = (name or "").casefold().partition("|")
    name_query = name_query.strip()
    province_query = province_query.strip()

    with rasterio.open(dem_path) as dem, shapefile.Reader(str(shp_path)) as communes:
        if dem.crs is None or dem.nodata is None:
            raise ValueError("DEM must define both a CRS and a NoData value")

        for record in communes.iterShapeRecords():
            commune_code = str(record.record["ma_huyen"] or "").strip()
            commune_name = str(record.record["ten_huyen"] or "").strip()
            if code is not None and commune_code != code:
                continue
            if name is not None:
                province_name = str(record.record["ten_tinh"] or "").strip().casefold()
                if commune_name.casefold() != name_query or ("|" in name and province_name != province_query):
                    continue
            matched += 1
            if not commune_code or not re.fullmatch(r"[A-Za-z0-9_-]+", commune_code):
                raise ValueError(f"Invalid commune code: {commune_code!r}")

            geometry = record.shape.__geo_interface__
            if source_crs != dem.crs:
                geometry = transform_geom(source_crs, dem.crs, geometry)
            left, bottom, right, top = bounds(geometry)
            if (right <= dem.bounds.left or left >= dem.bounds.right
                    or top <= dem.bounds.bottom or bottom >= dem.bounds.top):
                skipped += 1
                continue

            destination = output_dir / commune_filename(commune_name, commune_code)
            if destination.exists() and not overwrite:
                skipped += 1
                continue

            try:
                data, transform = mask(dem, [geometry], crop=True, filled=False)
            except ValueError:
                skipped += 1
                continue
            if np.ma.getmaskarray(data).all():
                skipped += 1
                continue

            profile = dem.profile.copy()
            profile.update(driver="GTiff", height=data.shape[1], width=data.shape[2],
                           transform=transform, compress="deflate")
            with rasterio.open(destination, "w", **profile) as output:
                output.write(data.filled(dem.nodata))
            written += 1
            print(f"{commune_code}: {data.shape[2]} x {data.shape[1]} -> {destination}")

    if (code is not None or name is not None) and written == 0:
        print(f"No DEM written for commune {code or name} "
              f"({'no matching name/code' if not matched else 'outside DEM, no valid pixels, or already exists'}).")
    print(f"Done: {written} written, {skipped} skipped.")


def main():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError):
            pass
    parser = argparse.ArgumentParser(description="Export a masked DEM GeoTIFF for each commune with valid elevation data.")
    parser.add_argument("--dem", type=Path, default=DEFAULT_DEM, help="Source DEM GeoTIFF")
    parser.add_argument("--shp", type=Path, default=DEFAULT_SHP, help="Commune shapefile (.prj required)")
    parser.add_argument("--output-dir", type=Path, default=HERE / "commune_dem", help="Directory for <ten_xa>_<ma_xa>.tif files")
    selector = parser.add_mutually_exclusive_group()
    selector.add_argument("--code", help="Export only this ma_xa code")
    selector.add_argument("--name", help="Exact commune name, optionally 'Commune|Province' for duplicates")
    parser.add_argument("--overwrite", action="store_true", help="Replace existing outputs")
    args = parser.parse_args()
    split_dem(args.dem, args.shp, args.output_dir, args.code, args.overwrite, args.name)


if __name__ == "__main__":
    main()