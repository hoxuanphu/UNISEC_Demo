import json
import sys
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

sys.path.insert(0, str(Path(__file__).parents[1] / "tools"))
import tiled_texture_benchmark
from tile_texture import build_tile_metadata, generate_pyramid, terrain_outer_bounds

class TileTextureTests(unittest.TestCase):
    def make_asset(self, root):
        source = root / "source.tif"
        terrain = root / "model.terrain.json"
        transform = from_origin(100, 200, 1, 1)
        with rasterio.open(source, "w", driver="GTiff", width=32, height=20, count=3, dtype="uint8", crs="EPSG:32648", transform=transform) as dst:
            for band in range(1, 4): dst.write(np.full((20, 32), band * 40, dtype=np.uint8), band)
        terrain.write_text(json.dumps({"asset_id": "model", "crs": {"code": 32648}, "grid": {"shape": [8, 12]}, "grid_transform": {"a": 2, "b": 0, "c": 100, "d": 0, "e": -2, "f": 200}}))
        return source, terrain

    def test_contract_uses_terrain_bounds_and_contiguous_levels(self):
        with tempfile.TemporaryDirectory() as temp:
            source, terrain = self.make_asset(Path(temp))
            metadata = build_tile_metadata(source, terrain, tile_size=8)
            self.assertEqual(terrain_outer_bounds(json.loads(terrain.read_text())), {"min_x": 100.0, "min_y": 184.0, "max_x": 124.0, "max_y": 200.0})
            self.assertEqual(set(metadata), {"schema_version", "asset_id", "format", "quality", "tile_size", "gutter_px", "min_zoom", "max_zoom", "bounds_projected", "crs", "orientation", "levels", "source"})
            self.assertEqual([level["zoom"] for level in metadata["levels"]], list(range(metadata["max_zoom"] + 1)))
            self.assertEqual(metadata["bounds_projected"]["max_x"], 124.0)

    def test_generation_writes_valid_guttered_webp_tiles(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); source, terrain = self.make_asset(root)
            report = generate_pyramid(source, terrain, root / "model_tiles", tile_size=8)
            self.assertGreater(report.tile_count, 0)
            metadata = json.loads(report.metadata_path.read_text())
            self.assertTrue((report.output_dir / "z0" / "0_0.webp").exists())
            with rasterio.open(source) as src:
                self.assertLess(report.width_px, src.width * 2)

    def test_benchmark_reports_peak_rss_without_recursive_measurement(self):
        class Usage:
            ru_maxrss = 123

        class ResourceStub:
            RUSAGE_SELF = 0

            @staticmethod
            def getrusage(_kind):
                return Usage()

        original = tiled_texture_benchmark.resource
        try:
            tiled_texture_benchmark.resource = ResourceStub
            self.assertEqual(tiled_texture_benchmark.peak_rss_bytes(), 123 * 1024)
        finally:
            tiled_texture_benchmark.resource = original

    def test_benchmark_windows_memory_counters_have_valid_size(self):
        import ctypes

        class Psapi:
            @staticmethod
            def GetProcessMemoryInfo(_process, counters, size):
                value = ctypes.cast(counters, ctypes.POINTER(ctypes.c_size_t))
                self.assertEqual(value[0], size)
                return 0

        class Windll:
            psapi = Psapi()

            class kernel32:
                @staticmethod
                def GetCurrentProcess():
                    return 1

        with patch.object(tiled_texture_benchmark, 'resource', None), patch.object(ctypes, 'windll', Windll(), create=True):
            with self.assertRaisesRegex(OSError, 'GetProcessMemoryInfo'):
                tiled_texture_benchmark.peak_rss_bytes()

if __name__ == "__main__": unittest.main()

