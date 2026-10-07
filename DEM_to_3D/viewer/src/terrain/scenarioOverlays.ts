import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type {
  Community,
  AnalysisArea,
  Hazard,
  RoadSegment,
  ScenarioRoute
} from '../types/dear';
import type { TerrainMetadata } from '../types/terrain';
import { bilinearElevation } from './elevationGrid';
import { projectedToScene } from './coordinate';
import { roadColors } from './roadStyle';
import { mapLayerOrder } from '../features/map/mapLayerOrder';
import { defaultLayerAppearance, showRoad, type LayerAppearance } from '../features/map/layerAppearance';

import type { OverlayHit } from '../features/map/mapContracts';

type ScenarioOverlayOptions = {
  metadata: TerrainMetadata;
  grid: Float32Array;
  communities: Community[];
  hazards: Hazard[];
  roads: RoadSegment[];
  aoi?: AnalysisArea;
  selectedRoute: ScenarioRoute | null;
  selectedCommunityId: string | null;
  selectedObjectId: string | null;
  layers: Record<string, boolean>;
  appearance?: LayerAppearance;
  screenMarkers?: boolean;
  resolution?: { width: number; height: number };
};

function getSurfaceElevation(grid: Float32Array, metadata: TerrainMetadata, x: number, y: number): number {
  const result = bilinearElevation(grid, metadata, x, y);
  return result.elevation ?? metadata.elevation.base_elevation;
}

function interpolateSegmentPoints(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  intervalM: number = 40
): Array<{ x: number; y: number }> {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / intervalM));
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    points.push({ x: p1.x + dx * t, y: p1.y + dy * t });
  }
  return points;
}

export function buildScenarioOverlays(options: ScenarioOverlayOptions): THREE.Group {
  const {
    metadata,
    grid,
    communities,
    hazards,
    roads,
    selectedRoute,
    selectedCommunityId,
    selectedObjectId,
    layers
  } = options;

  const rootGroup = new THREE.Group();
  rootGroup.name = 'dear-scenario-overlays';

  if (options.aoi && layers.aoi) {
    const positions: number[] = [];
    for (let i = 1; i < options.aoi.points.length; i++) {
      const dense = interpolateSegmentPoints(options.aoi.points[i - 1], options.aoi.points[i], 80);
      if (i > 1) dense.shift();
      for (const point of dense) {
        const scene = projectedToScene(metadata, point, getSurfaceElevation(grid, metadata, point.x, point.y) + 5);
        positions.push(scene.x, scene.y, scene.z);
      }
    }
    const geometry = new LineGeometry(); geometry.setPositions(positions);
    const selected = selectedObjectId === `aoi:${options.aoi.id}`;
    const material = new LineMaterial({ color: selected ? 0x167b66 : 0x85aa9d, linewidth: selected ? 2 : 1.5,
      dashed: true, dashSize: 120, gapSize: 100, depthTest: false, transparent: true, opacity: selected ? 0.9 : 0.6 });
    material.resolution.set(options.resolution?.width ?? 1440, options.resolution?.height ?? 900);
    const outline = new Line2(geometry, material); outline.computeLineDistances();
    outline.renderOrder = mapLayerOrder.boundary * 2; outline.userData = { type: 'aoi', id: options.aoi.id }; rootGroup.add(outline);
  }

  // 1. Roads Layer
  if (layers.roads || (layers.route && selectedRoute)) {
    const roadGroup = new THREE.Group();
    roadGroup.name = 'scenario-roads';

    roads.forEach((road) => {
      if (road.points.length < 2) return;

      const densePoints: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < road.points.length - 1; i += 1) {
        const segPoints = interpolateSegmentPoints(road.points[i], road.points[i + 1], 40);
        if (i > 0) segPoints.shift();
        densePoints.push(...segPoints);
      }

      const isRoadSelected = selectedObjectId === `road:${road.id}`;
      const isPartOfSelectedRoute = selectedRoute?.segs.some((s) => s.id === road.id);
      const routeVisible = Boolean(isPartOfSelectedRoute && layers.route);
      if (!layers.roads && !routeVisible) return;
      const appearance = options.appearance ?? defaultLayerAppearance;
      if (!showRoad(road.status, Boolean(routeVisible || isRoadSelected), appearance.roads)) return;

      const positions: number[] = [];
      densePoints.forEach((pt) => {
        const elev = getSurfaceElevation(grid, metadata, pt.x, pt.y);
        const scenePt = projectedToScene(metadata, pt, elev + (isPartOfSelectedRoute ? 7 : 4));
        positions.push(scenePt.x, scenePt.y, scenePt.z);
      });

      let lineColor: THREE.ColorRepresentation = routeVisible ? roadColors.selected : (layers.imagery ? roadColors.networkImagery : roadColors.networkTerrain);
      // Route selection must preserve the warning on blocked or uncertain segments.
      if (layers.status && road.status === 'blocked') lineColor = roadColors.blocked;
      if (layers.status && road.status === 'uncertain') lineColor = roadColors.uncertain;
      const lineWidth = routeVisible || isRoadSelected ? 4 : 2.5;
      const addLine = (color: THREE.ColorRepresentation, width: number, casing: boolean): void => {
        const geometry = new LineGeometry();
        geometry.setPositions(positions);
        const opacity = routeVisible || isRoadSelected || (layers.status && road.status !== 'open') ? 1 : appearance.networkOpacity;
        const material = new LineMaterial({ color, linewidth: width, depthTest: false, transparent: true, opacity,
          dashed: !casing && layers.status && road.status === 'uncertain', dashSize: 100, gapSize: 70 });
        material.resolution.set(options.resolution?.width ?? 1440, options.resolution?.height ?? 900);
        const line = new Line2(geometry, material);
        line.computeLineDistances();
        const order = layers.status && road.status !== 'open' ? mapLayerOrder.roadStatus : routeVisible || isRoadSelected ? mapLayerOrder.route : mapLayerOrder.roads;
        line.renderOrder = order * 2 + (casing ? 0 : 1);
        line.userData = { type: 'road', id: road.id, casing };
        roadGroup.add(line);
      };
      const hasWarning = layers.status && road.status !== 'open';
      // A blue casing under warning dashes looks like two overlapping routes.
      addLine(isRoadSelected ? roadColors.inspectedCasing : routeVisible && !hasWarning ? roadColors.selectedCasing : roadColors.neutralCasing, lineWidth + (isRoadSelected ? 4 : 2), true);
      addLine(lineColor, lineWidth, false);
    });

    rootGroup.add(roadGroup);
  }

  // 2. Communities Layer
  if (layers.communities && !options.screenMarkers) {
    const commGroup = new THREE.Group();
    commGroup.name = 'scenario-communities';

    communities.forEach((comm) => {
      const isSelected = selectedCommunityId === comm.id;
      const elev = getSurfaceElevation(grid, metadata, comm.projected.x, comm.projected.y);
      const scenePos = projectedToScene(metadata, comm.projected, elev + 12);

      const pinGroup = new THREE.Group();
      pinGroup.position.set(scenePos.x, scenePos.y, scenePos.z);
      pinGroup.userData = { type: 'community', id: comm.id };

      let pinColor = 0x64748b;
      if (comm.prio === 1) pinColor = 0xef4444;
      else if (comm.prio === 2) pinColor = 0xf59e0b;

      // Inner sphere pin
      const sphereGeo = new THREE.SphereGeometry(isSelected ? 30 : 22, 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0x2563eb : pinColor
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.userData = { type: 'community', id: comm.id };
      pinGroup.add(sphere);

      // Outer ring for selected or priority 1
      if (isSelected || comm.prio === 1) {
        const ringGeo = new THREE.RingGeometry(28, 36, 24);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: isSelected ? 0x93c5fd : 0xfca5a5,
          side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = -6;
        pinGroup.add(ring);
      }

      // Small vertical stalk connecting marker to ground
      const stalkGeo = new THREE.CylinderGeometry(2, 2, 24, 8);
      const stalkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const stalk = new THREE.Mesh(stalkGeo, stalkMat);
      stalk.position.y = -12;
      pinGroup.add(stalk);

      commGroup.add(pinGroup);
    });

    rootGroup.add(commGroup);
  }

  // 3. Hazards Layer
  if (!options.screenMarkers && (layers.landslide || layers.flood || layers.status)) {
    const hazardGroup = new THREE.Group();
    hazardGroup.name = 'scenario-hazards';

    hazards.forEach((hz) => {
      if (!(hz.kind === 'landslide' ? layers.landslide : hz.kind === 'flood' ? layers.flood : layers.status)) return;
      const elev = getSurfaceElevation(grid, metadata, hz.projected.x, hz.projected.y);
      const scenePos = projectedToScene(metadata, hz.projected, elev + 16);

      const hzObj = new THREE.Group();
      hzObj.position.set(scenePos.x, scenePos.y, scenePos.z);
      hzObj.userData = { type: 'hazard', id: hz.id };

      const isSelected = selectedObjectId === `hazard:${hz.id}`;

      // Warning marker geometry (Tetrahedron / Diamond)
      const geo = new THREE.TetrahedronGeometry(isSelected ? 26 : 18);
      const mat = new THREE.MeshBasicMaterial({
        color: hz.kind === 'landslide' ? 0xdc2626 : 0xd97706,
        wireframe: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { type: 'hazard', id: hz.id };
      hzObj.add(mesh);

      hazardGroup.add(hzObj);
    });

    rootGroup.add(hazardGroup);
  }

  // 4. Staging FOB Point
  if (layers.staging && !options.screenMarkers) {
    const stagingGroup = new THREE.Group();
    stagingGroup.name = 'scenario-staging';
    const stagingCoords = { x: 399500, y: 2397000 };
    const elev = getSurfaceElevation(grid, metadata, stagingCoords.x, stagingCoords.y);
    const scenePos = projectedToScene(metadata, stagingCoords, elev + 16);

    const fobObj = new THREE.Group();
    fobObj.position.set(scenePos.x, scenePos.y, scenePos.z);
    fobObj.userData = { type: 'poi', id: 'TOWN' };

    const boxGeo = new THREE.BoxGeometry(26, 26, 26);
    const boxMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.userData = { type: 'poi', id: 'TOWN' };
    fobObj.add(box);

    stagingGroup.add(fobObj);
    rootGroup.add(stagingGroup);
  }

  return rootGroup;
}
