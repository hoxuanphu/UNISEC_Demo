"""Check the prepared scenario package before building or handing it over."""

import argparse
import hashlib
import json
import re
import shutil
import struct
from datetime import datetime
from pathlib import Path
from workspace_configuration import workspace_manifest_path


PUBLIC = Path(__file__).resolve().parents[1] / "public"


def fail(message: str) -> None:
    raise SystemExit(f"Dataset invalid: {message}")


def check_asset(path: Path, asset: dict) -> str | None:
    if not path.is_file():
        return f"missing file: {path}"
    if path.stat().st_size != asset["byteLength"]:
        return f"size mismatch: {path}"
    with path.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    if digest != asset["sha256"]:
        return f"checksum mismatch: {path}"
    return None


def embedded_image(path: Path) -> bytes:
    """Extract the first embedded PNG without a graphics/GIS dependency."""
    data = path.read_bytes()
    if len(data) < 28 or data[:4] != b'glTF' or struct.unpack_from('<II', data, 4) != (2, len(data)):
        fail('invalid GLB image source')
    json_size, json_kind = struct.unpack_from('<II', data, 12)
    if json_kind != 0x4e4f534a or 20 + json_size + 8 > len(data):
        fail('invalid GLB JSON chunk')
    document = json.loads(data[20:20 + json_size])
    offset = 20 + json_size
    binary_size, binary_kind = struct.unpack_from('<II', data, offset)
    if binary_kind != 0x004e4942 or offset + 8 + binary_size > len(data):
        fail('invalid GLB binary chunk')
    image = document['images'][0]
    view = document['bufferViews'][image['bufferView']]
    start = view.get('byteOffset', 0)
    end = start + view['byteLength']
    if image.get('mimeType') != 'image/png' or view.get('buffer', 0) != 0 or start < 0 or end > binary_size:
        fail('invalid embedded image')
    result = data[offset + 8 + start:offset + 8 + end]
    if not result.startswith(b'\x89PNG\r\n\x1a\n'):
        fail('invalid PNG image')
    return result


def main(prepare: bool = False, manifest_path: Path | None = None) -> None:
    selected = manifest_path if manifest_path is not None else workspace_manifest_path(PUBLIC)[0]
    manifest = json.loads(selected.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        fail("manifest must be an object")
    if type(manifest.get("schemaVersion")) is not int or manifest["schemaVersion"] != 1:
        fail("unsupported manifest version")
    if manifest.get("dataKind") not in {"synthetic", "historical", "operational"}:
        fail("invalid data kind")
    if manifest.get("reviewStatus") not in {"draft", "reviewed", "published"}:
        fail("invalid review status")
    for key in ("datasetVersion", "incidentId", "snapshotAt", "crs"):
        if not isinstance(manifest.get(key), str) or not manifest[key].strip():
            fail(f"missing {key}")
    if not re.fullmatch(r"EPSG:\d+", manifest["crs"]):
        fail("invalid CRS")
    try:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}", manifest["snapshotAt"]):
            fail("invalid snapshotAt")
        datetime.fromisoformat(manifest["snapshotAt"])
    except ValueError:
        fail("invalid snapshotAt")
    if not isinstance(manifest.get("counts"), dict) or not isinstance(manifest.get("terrain"), dict):
        fail("counts and terrain must be objects")
    for key in ("communities", "roads", "hazards"):
        value = manifest.get("counts", {}).get(key)
        if type(value) is not int or value < 0:
            fail(f"invalid count: {key}")

    paths = set()
    assets = {}
    copies = []
    for key in ("glb", "grid", "metadata"):
        asset = manifest.get("terrain", {}).get(key)
        if not isinstance(asset, dict):
            fail(f"missing terrain asset: {key}")
        url = asset.get("url")
        if not isinstance(url, str) or not re.fullmatch(r"/terrain/[A-Za-z0-9._-]+", url) or ".." in url:
            fail(f"invalid asset path: {key}")
        if url in paths:
            fail(f"duplicate asset path: {url}")
        paths.add(url)
        if type(asset.get("byteLength")) is not int or asset["byteLength"] <= 0:
            fail(f"invalid asset size: {key}")
        if not isinstance(asset.get("sha256"), str) or not re.fullmatch(r"[0-9a-f]{64}", asset["sha256"]):
            fail(f"invalid asset checksum: {key}")
        path = PUBLIC / url.lstrip("/")
        if prepare:
            canonical = PUBLIC.parents[1] / path.name
            error = check_asset(canonical, asset)
            if error:
                fail(error)
            if check_asset(path, asset):
                copies.append((canonical, path))
        else:
            error = check_asset(path, asset)
            if error:
                fail(error)
        assets[key] = path

    image_write = None
    if 'image' in manifest['terrain']:
        image = manifest['terrain']['image']
        if not isinstance(image, dict) or not re.fullmatch(r'/terrain/[A-Za-z0-9._-]+\.png', image.get('url', '')) or '..' in image['url']:
            fail('invalid image path')
        if image['url'] in paths or type(image.get('byteLength')) is not int or image['byteLength'] <= 0 or not re.fullmatch(r'[0-9a-f]{64}', image.get('sha256', '')):
            fail('invalid image contract')
        path = PUBLIC / image['url'].lstrip('/')
        if prepare:
            source = PUBLIC.parents[1] / assets['glb'].name
            contents = embedded_image(source)
            if len(contents) != image['byteLength'] or hashlib.sha256(contents).hexdigest() != image['sha256']:
                fail('embedded image checksum mismatch')
            if check_asset(path, image):
                image_write = (path, contents)
        elif error := check_asset(path, image):
            fail(error)
        assets['image'] = path

    if 'workspace' in manifest:
        packet = manifest['workspace']
        if not isinstance(packet, dict) or not re.fullmatch(r'/scenarios/[A-Za-z0-9._/-]+/incident\.json', packet.get('url', '')) or '..' in packet['url']:
            fail('invalid workspace path')
        if type(packet.get('byteLength')) is not int or packet['byteLength'] <= 0 or not re.fullmatch(r'[0-9a-f]{64}', packet.get('sha256', '')):
            fail('invalid workspace contract')
        packet_path = PUBLIC / packet['url'].lstrip('/')
        if error := check_asset(packet_path, packet):
            fail(error)
        assets['workspace'] = packet_path

    # Validate metadata from the canonical source before writing generated files.
    metadata_source = PUBLIC.parents[1] / assets['metadata'].name if prepare else assets['metadata']
    metadata = json.loads(metadata_source.read_text(encoding="utf-8"))
    if manifest["crs"] != f"{metadata['crs']['authority']}:{metadata['crs']['code']}":
        fail("terrain CRS mismatch")
    if metadata["mesh"]["file"] != assets["glb"].name:
        fail("mesh reference mismatch")
    if metadata["grid"]["file"] != assets["grid"].name:
        fail("grid reference mismatch")

    # Verify every canonical source before changing generated public files.
    for source, destination in copies:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
    if image_write:
        path, contents = image_write
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(contents)

    print(f"Dataset valid: {manifest['datasetVersion']} ({len(assets)} verified assets, {len(copies)} copied)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare", action="store_true", help="Copy verified canonical assets into public/terrain")
    main(prepare=parser.parse_args().prepare)
