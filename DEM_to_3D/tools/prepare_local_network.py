"""Prepare the Chế Tạo schematic KMZ as an explicit, reproducible demo graph.

Only line endpoints may attach to another line (15 m default). Interior line
crossings never create junctions. Original coordinates and colours are retained
in sourceRoads; prepared graph coordinates are EPSG:32648, in metres.
Requires the same numpy/rasterio environment as the imagery preparation tools.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

import numpy as np
from rasterio.warp import transform

NS = {'k': 'http://www.opengis.net/kml/2.2'}
AOI = (104.00, 21.65, 104.12, 21.79)


def prepare(source, tolerance=15):
    with zipfile.ZipFile(source) as archive:
        root = ET.fromstring(archive.read('doc.kml'))
    styles = {s.get('id'): s for s in root.findall('.//k:Style', NS)}
    maps = {s.get('id'): s for s in root.findall('.//k:StyleMap', NS)}

    def style(feature):
        key = feature.findtext('k:styleUrl', '', NS).lstrip('#')
        if key in maps:
            pairs = maps[key].findall('k:Pair', NS)
            normal = next((p for p in pairs if p.findtext('k:key', '', NS) == 'normal'), pairs[0])
            key = normal.findtext('k:styleUrl', '', NS).lstrip('#')
        return styles.get(key)

    def coordinates(element):
        return [[float(n) for n in part.split(',')[:2]] for part in element.text.split()]

    def project(points):
        x, y = transform('EPSG:4326', 'EPSG:32648', *zip(*points))
        return np.column_stack((x, y))

    lines, places, areas, excluded = [], [], [], []
    for index, feature in enumerate(root.findall('.//k:Placemark', NS)):
        name = feature.findtext('k:name', '', NS)
        paint = style(feature)
        color = paint.findtext('k:LineStyle/k:color', '', NS) if paint is not None else ''
        point = feature.find('k:Point/k:coordinates', NS)
        if point is not None:
            lon, lat = coordinates(point)[0]
            if index in (22, 23, 24, 25):
                places.append({'id': f'place-{index}', 'name': name.strip() or 'Helipad',
                               'kind': 'hlz' if index == 22 else 'village',
                               'longitude': lon, 'latitude': lat,
                               'projected': dict(zip(('x', 'y'), map(float, project([[lon, lat]])[0]))),
                               'placemarkIndex': index})
        line = feature.find('k:LineString/k:coordinates', NS)
        if line is not None:
            geographic = coordinates(line)
            if not all(AOI[0] <= p[0] <= AOI[2] and AOI[1] <= p[1] <= AOI[3] for p in geographic):
                excluded.append({'placemarkIndex': index, 'reason': 'outside-che-tao-aoi'})
                continue
            if color not in ('ff00ff00', 'ff00ffff', 'ff0000ff'):
                raise ValueError(f'Unclassified road style: {index}: {color}')
            lines.append({'index': index, 'name': name, 'color': color,
                          'status': {'ff00ff00': 'open', 'ff00ffff': 'uncertain', 'ff0000ff': 'blocked'}[color],
                          'geographic': geographic, 'xy': project(geographic)})
        polygon = feature.find('k:Polygon/k:outerBoundaryIs/k:LinearRing/k:coordinates', NS)
        if polygon is not None and 31 <= index <= 65:
            points = coordinates(polygon)
            # The source contains duplicate water boundaries: keep one copy of each pair.
            if index in (61, 63, 65):
                continue
            areas.append({'id': f'area-{index}', 'kind': 'water' if index >= 60 else 'landslide',
                          'placemarkIndex': index, 'coordinates': points})

    parents, locations = [], []
    def node(point):
        i = len(parents); parents.append(i); locations.append(np.asarray(point)); return i
    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]; i = parents[i]
        return i
    def union(a, b):
        parents[find(b)] = find(a)
    marks, stations = [], []
    for line in lines:
        xy = line['xy']; station = np.r_[0, np.cumsum(np.linalg.norm(np.diff(xy, axis=0), axis=1))]
        stations.append(station)
        marks.append([(0., node(xy[0])), (float(station[-1]), node(xy[-1]))])
    snaps = []
    for i, line in enumerate(lines):
        for side in (0, 1):
            p = line['xy'][0 if side == 0 else -1]
            best = None
            for j, other in enumerate(lines):
                if i == j:
                    continue
                a, d = other['xy'][:-1], np.diff(other['xy'], axis=0)
                lengths = np.sum(d*d, axis=1)
                f = np.clip(np.sum((p-a)*d, axis=1) / np.maximum(lengths, 1e-20), 0, 1)
                q = a + f[:, None]*d
                distances = np.linalg.norm(q-p, axis=1); k = int(np.argmin(distances))
                candidate = (float(distances[k]), j, float(stations[j][k] + f[k]*math.sqrt(lengths[k])), q[k])
                if best is None or candidate[0] < best[0]:
                    best = candidate
            distance, j, station, anchor = best
            if distance <= tolerance:
                target = node(anchor); marks[j].append((station, target)); union(marks[i][side][1], target)
                snaps.append({'from': line['index'], 'end': side, 'to': lines[j]['index'], 'offsetM': round(distance, 3)})
    # Reciprocal attachments and near-identical endpoint cuts share one junction.
    for cuts in marks:
        cuts.sort()
        for a, b in zip(cuts, cuts[1:]):
            if b[0] - a[0] <= tolerance:
                union(a[1], b[1])
    groups = {}
    for i, point in enumerate(locations):
        groups.setdefault(find(i), []).append(point)
    canonical = {i: np.mean(points, axis=0).round(3) for i, points in groups.items()}
    roads = []
    for i, line in enumerate(lines):
        cuts = []
        for station, n in sorted(marks[i]):
            key = find(n)
            if not cuts or cuts[-1][1] != key:
                cuts.append((station, key))
        for part, (start, end) in enumerate(zip(cuts, cuts[1:])):
            a, b = start[0], end[0]
            interior = line['xy'][(stations[i] > a + .001) & (stations[i] < b - .001)]
            points = np.vstack((canonical[start[1]], interior, canonical[end[1]])).round(3)
            length = float(np.sum(np.linalg.norm(np.diff(points, axis=0), axis=1)))
            if length < .01:
                continue
            roads.append({'id': f'local-{line["index"]}-{part}', 'sourceRoadId': f'kmz-{line["index"]}',
                          'name': [f'Đường nhánh Chế Tạo {line["index"]+1:02}', f'Chế Tạo local road {line["index"]+1:02}'],
                          'cls': 'secondary', 'status': line['status'], 'len': length/1000,
                          'points': [{'x': float(p[0]), 'y': float(p[1])} for p in points]})
    return {'schemaVersion': 1, 'crs': 'EPSG:32648', 'dataKind': 'schematic-demo',
            'source': {'file': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                       'coordinateOrder': 'longitude,latitude', 'sourceCrs': 'EPSG:4326',
                       'statusBasis': 'KMZ style colours; not a verified road assessment', 'observedAt': None},
            'topology': {'method': 'endpoint-to-line', 'toleranceM': tolerance, 'crossingsConnected': False,
                         'snaps': snaps, 'excluded': excluded},
            'sourceRoads': [{'placemarkIndex': l['index'], 'sourceName': l['name'], 'color': l['color'],
                             'coordinates': l['geographic']} for l in lines],
            'roads': roads, 'places': places, 'areas': areas}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).parents[1]/'viewer/public/scenarios/che-tao/local-network.json')
    args = parser.parse_args()
    data = prepare(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    print(f'{len(data["sourceRoads"])} source roads -> {len(data["roads"])} edges; {len(data["topology"]["snaps"])} endpoint attachments')
