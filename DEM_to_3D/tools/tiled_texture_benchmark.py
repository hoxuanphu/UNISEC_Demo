"""Benchmark tiled texture generation with timing and peak RSS."""
from __future__ import annotations
import argparse, json, time
import sys
try:
    import resource
except ImportError:
    resource = None

def peak_rss_bytes() -> int:
    if resource is not None:
        value = int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
        return value if sys.platform == 'darwin' else value * 1024
    import ctypes
    class Counters(ctypes.Structure):
        _fields_ = [("cb", ctypes.c_ulong), ("page_fault_count", ctypes.c_ulong), ("peak_working_set", ctypes.c_size_t), ("working_set", ctypes.c_size_t), ("quota_peak_paged_pool", ctypes.c_size_t), ("quota_paged_pool", ctypes.c_size_t), ("quota_peak_non_paged_pool", ctypes.c_size_t), ("quota_non_paged_pool", ctypes.c_size_t), ("pagefile_usage", ctypes.c_size_t), ("peak_pagefile_usage", ctypes.c_size_t)]
    counters = Counters()
    counters.cb = ctypes.sizeof(Counters)
    kernel32 = ctypes.windll.kernel32
    psapi = ctypes.windll.psapi
    kernel32.GetCurrentProcess.restype = ctypes.c_void_p
    psapi.GetProcessMemoryInfo.argtypes = [ctypes.c_void_p, ctypes.POINTER(Counters), ctypes.c_ulong]
    psapi.GetProcessMemoryInfo.restype = ctypes.c_int
    if not psapi.GetProcessMemoryInfo(kernel32.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
        raise OSError('GetProcessMemoryInfo failed')
    return int(counters.peak_working_set or counters.working_set or counters.pagefile_usage)
from pathlib import Path
from tile_texture import generate_pyramid

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--terrain-json', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--tile-size', type=int, default=512)
    parser.add_argument('--quality', type=int, default=88)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    started = time.perf_counter()
    report = generate_pyramid(args.input, args.terrain_json, args.output, args.tile_size, args.quality)
    result = {'elapsed_seconds': time.perf_counter() - started, 'peak_rss_bytes': peak_rss_bytes(), 'tile_count': report.tile_count, 'max_zoom': report.max_zoom, 'metadata': str(report.metadata_path), 'output': str(report.output_dir)}
    text = json.dumps(result, indent=2) + '\n'
    if args.report: args.report.write_text(text, encoding='utf-8')
    print(text, end='')
    return 0
if __name__ == '__main__': raise SystemExit(main())

