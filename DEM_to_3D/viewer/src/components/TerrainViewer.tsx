import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { LoadedModel, HoverInfo, TerrainPoint } from '../types/terrain';
import { bilinearElevation } from '../terrain/elevationGrid';
import { formatHover, projectedToScene, projectedToPixel, sceneToProjected } from '../terrain/coordinate';
import { buildBvh, disposeBvh } from '../terrain/raycast';
import type { SurfaceProfile } from '../terrain/profile';
import type { GeographicPlacement } from '../terrain/geographic';
import { applyElevationColorRamp } from '../terrain/colorRamp';
import { createModelTileState, disposeModelTileState, updateModelDetail, type ModelTileState } from '../terrain/tileAtlas';
import { SceneTileCoordinator, type TileStreamingStats } from '../terrain/tileCoordinator';
import { tileLevel } from '../terrain/tileMetadata';
import { TileRequestQueue } from '../terrain/tileTexture';
import { createSarOverlay, type SarRaster, type SarSurface } from '../terrain/sarOverlay';
import { renderWithoutColorTexture } from '../terrain/textureVisibility';
import { buildContours, createContourBudget } from '../terrain/contours';
import { buildContourLabels, formatContourElevation, labelCollides, MAX_LABEL_CANDIDATES, MAX_VISIBLE_LABELS, projectContourLabel, projectContourTangent, rotatedLabelBox, terrainOccludesLabel, type LabelBox } from '../terrain/contourLabels';

type ContourScreenLabel = { element: HTMLDivElement; point: THREE.Vector3; tangent: THREE.Vector3; group: THREE.Group };

type Props = {
  models: LoadedModel[];
  geographicPlacements?: GeographicPlacement[];
  showAdministrativeInfo?: boolean;
  onHover: (info: HoverInfo | null) => void;
  measureMode?: boolean;
  onPick?: (point: TerrainPoint) => void;
  focusPoint?: { x: number; y: number; z: number } | null;
  profile?: SurfaceProfile | null;
  profileMetadata?: LoadedModel['metadata'];
  onTileStats?: (stats: TileStreamingStats) => void;
  sarRaster?: SarRaster | null;
  sarBand?: number;
  sarVisible?: boolean;
  colorTextureVisible?: boolean;
  sarOpacity?: number;
  onSarError?: (message: string | null) => void;
  contoursVisible?: boolean;
  contourInterval?: number;
  onContourStatus?: (message: string | null) => void;
};

type ModelEntry = {
  model: LoadedModel;
  root: THREE.Object3D;
  group: THREE.Group;
  meshes: THREE.Mesh[];
  label?: HTMLDivElement;
  labelAnchor?: THREE.Vector3;
  tileState?: ModelTileState;
};

function createAdministrativeLabel(model: LoadedModel): HTMLDivElement | undefined {
  const administrative = model.metadata?.administrative;
  if (!administrative) return undefined;
  const units = administrative.units ?? [administrative];
  const names = units.map((unit) => unit.commune_name).filter((name): name is string => Boolean(name));
  const headquarters = units.map((unit) => unit.headquarters).filter((value): value is string => Boolean(value));
  if (names.length === 0 && headquarters.length === 0) return undefined;

  const label = document.createElement('div');
  label.className = 'terrain-admin-label';
  label.setAttribute('aria-hidden', 'true');
  const title = document.createElement('strong');
  title.textContent = names.join(' · ') || 'Administrative area';
  label.appendChild(title);
  if (headquarters.length > 0) {
    const subtitle = document.createElement('span');
    subtitle.textContent = `Trụ sở: ${headquarters.join(' · ')}`;
    label.appendChild(subtitle);
  }
  return label;
}

function configureRoot(root: THREE.Object3D, model: LoadedModel): void {
  if (root.userData.terrainViewerConfigured) return;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (material?.isMeshStandardMaterial) {
      material.roughness = 0.92;
      material.metalness = 0;
    }
  });
  if (model.metadata) applyElevationColorRamp(root, model.metadata);
  root.userData.terrainViewerConfigured = true;
}

function sampleModel(model: LoadedModel, localPoint: THREE.Vector3): { projected: { x: number; y: number }; elevation: number; row: number; column: number; interpolated: boolean } | null {
  if (!model.metadata) return null;
  const converted = sceneToProjected(model.metadata, localPoint);
  const pixel = projectedToPixel(model.metadata, converted.projected.x, converted.projected.y);
  const sampled = model.grid
    ? bilinearElevation(model.grid, model.metadata, converted.projected.x, converted.projected.y)
    : { elevation: undefined, row: Math.round(pixel.row), column: Math.round(pixel.column), interpolated: false };
  return { projected: converted.projected, elevation: sampled.elevation ?? converted.elevation, row: sampled.row, column: sampled.column, interpolated: sampled.interpolated };
}

export function TerrainViewer({ models, geographicPlacements, showAdministrativeInfo = true, onTileStats, onHover, measureMode = false, onPick, focusPoint, profile = null, profileMetadata, sarRaster, sarBand = 0, sarVisible = true, sarOpacity = 0.65, onSarError, colorTextureVisible = true, contoursVisible = false, contourInterval = 20, onContourStatus }: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const contourEntriesRef = useRef<ModelEntry[]>([]);
  const contourLabelsRef = useRef<ContourScreenLabel[]>([]);
  const sarControlsRef = useRef({ visible: sarVisible, opacity: sarOpacity });
  sarControlsRef.current = { visible: sarVisible, opacity: sarOpacity };
  const colorTextureVisibleRef = useRef(colorTextureVisible);
  colorTextureVisibleRef.current = colorTextureVisible;
  const measureModeRef = useRef(measureMode);
  const onPickRef = useRef(onPick);
  const focusPointRef = useRef(focusPoint);
  const profileRef = useRef(profile);
  measureModeRef.current = measureMode;
  onPickRef.current = onPick;
  focusPointRef.current = focusPoint;
  profileRef.current = profile;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1220');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1_000_000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.domElement.className = 'terrain-canvas';
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    const tileCoordinator = new SceneTileCoordinator({ atlasSize: Math.min(2048, renderer.capabilities.maxTextureSize) });
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.HemisphereLight('#dbeafe', '#172033', 2.2));
    const sun = new THREE.DirectionalLight('#ffffff', 2.8);
    sun.position.set(1, 2, 1);
    scene.add(sun);

    const sharedRequestQueue = new TileRequestQueue(tileCoordinator.budget.maxRequests);
    const entries: ModelEntry[] = models.map((model, index) => {
      const root = model.gltf.scene;
      const group = new THREE.Group();
      group.name = `terrain-model-${model.id}`;
      const placement = geographicPlacements?.[index];
      if (placement) {
        group.position.set(placement.position.x, placement.position.y, placement.position.z);
        group.scale.set(1, placement.scaleY, 1);
      }
      configureRoot(root, model);
      group.add(root);
      scene.add(group);
      const meshes = buildBvh(root);
      model.bvhDisposed = false;
      const label = showAdministrativeInfo ? createAdministrativeLabel(model) : undefined;
      if (label) host.appendChild(label);
      const tileState = createModelTileState(model, renderer.capabilities, tileCoordinator.budget, sharedRequestQueue);
      model.tileObject = group;
      return { model, root, group, meshes, label, tileState };
    });
    contourEntriesRef.current = entries;
    let sarSurface: SarSurface | null = null;
    let cancelled = false;
    if (sarRaster) {
      const supported = entries.flatMap((entry) => entry.model.metadata ? [{ root: entry.root, metadata: entry.model.metadata }] : []);
      if (!supported.length) onSarError?.('SAR requires a model with .terrain.json metadata; an elevation grid is not required.');
      else void createSarOverlay(sarRaster, sarBand, supported).then((surface) => {
        if (cancelled) { surface.dispose(); return; }
        sarSurface = surface;
        onSarError?.(entries.some((entry) => !entry.model.metadata) ? 'Models without terrain metadata do not receive SAR.' : null);
      }).catch((error: unknown) => { if (!cancelled) onSarError?.(error instanceof Error ? error.message : String(error)); });
    }
    scene.updateMatrixWorld(true);
    entries.forEach((entry) => {
      if (!entry.label) return;
      const bounds = new THREE.Box3().setFromObject(entry.group);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const lift = Math.max(size.x, size.y, size.z, 1) * 0.035;
      entry.labelAnchor = new THREE.Vector3(center.x, bounds.max.y + lift, center.z);
    });
    const overlay = new THREE.Group();
    overlay.name = 'profile-overlay';
    scene.add(overlay);
    const focusMarker = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#fbbf24', depthTest: false }),
    );
    focusMarker.visible = false;
    focusMarker.renderOrder = 10;
    scene.add(focusMarker);
    // GLB coordinates already follow the contract.  The origin is therefore
    // applied exactly once by the exporter; do not translate again here.
    const bounds = new THREE.Box3();
    entries.forEach((entry) => bounds.expandByObject(entry.group));
    const center = bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
    const size = bounds.isEmpty() ? new THREE.Vector3(1, 1, 1) : bounds.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 1);
    const distance = (maxDimension / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.35;
    camera.position.copy(center).add(new THREE.Vector3(distance * 0.72, distance * 0.62, distance * 0.72));
    camera.near = Math.max(distance / 10_000, 0.01);
    camera.far = Math.max(distance * 20, 1000);
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    const requestDetail = (): void => {
      entries.forEach((entry) => {
        const state = entry.tileState;
        if (!state) return;
        if (!tileCoordinator.shouldRequestDetail(entry.model.id)) return;
        const level = tileLevel(state.metadata, state.metadata.max_zoom);
        const localTarget = entry.group.worldToLocal(controls.target.clone());
        const projected = entry.model.metadata ? sceneToProjected(entry.model.metadata, localTarget).projected : undefined;
        const bounds = state.metadata.bounds_projected;
        const normalizedX = projected ? (projected.x - bounds.min_x) / Math.max(bounds.max_x - bounds.min_x, Number.EPSILON) : 0.5;
        const normalizedY = projected ? (bounds.max_y - projected.y) / Math.max(bounds.max_y - bounds.min_y, Number.EPSILON) : 0.5;
        const centerColumn = Math.floor(Math.max(0, Math.min(level.columns - 1, normalizedX * level.columns)));
        const centerRow = Math.floor(Math.max(0, Math.min(level.rows - 1, normalizedY * level.rows)));
        const count = Math.max(1, Math.min(state.atlasSize / state.tileSize, 4));
        const requested = [];
        for (let row = Math.max(0, centerRow - Math.floor(count / 2)); row < Math.min(level.rows, centerRow + Math.ceil(count / 2)); row += 1) {
          for (let column = Math.max(0, centerColumn - Math.floor(count / 2)); column < Math.min(level.columns, centerColumn + Math.ceil(count / 2)); column += 1) requested.push({ zoom: level.zoom, column, row });
        }
        void updateModelDetail(state, requested).then(() => onTileStats?.(tileCoordinator.getStats(entries.map((entry) => ({ id: entry.model.id, tileCache: entry.tileState?.cache, requestQueue: entry.tileState?.requestQueue })))));
      });
    };
    void tileCoordinator.update(models, camera, { width: host.clientWidth, height: host.clientHeight }).then(() => { requestDetail(); onTileStats?.(tileCoordinator.getStats(entries.map((entry) => ({ id: entry.model.id, tileCache: entry.tileState?.cache, requestQueue: entry.tileState?.requestQueue })))); });
    const onControlsChange = (): void => { void tileCoordinator.update(models, camera, { width: host.clientWidth, height: host.clientHeight }).then(() => { requestDetail(); onTileStats?.(tileCoordinator.getStats(entries.map((entry) => ({ id: entry.model.id, tileCache: entry.tileState?.cache, requestQueue: entry.tileState?.requestQueue })))); }); };
    controls.addEventListener('change', onControlsChange);
    const meshEntries = new Map<THREE.Object3D, ModelEntry>();
    entries.forEach((entry) => entry.meshes.forEach((mesh) => meshEntries.set(mesh, entry)));
    const raycaster = new THREE.Raycaster();
    (raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    const pointer = new THREE.Vector2();
    let pendingFrame = 0;
    let renderedProfile: SurfaceProfile | null | undefined;
    const clearOverlay = (): void => {
      while (overlay.children.length) {
        const child = overlay.children[0];
        if (!child) continue;
        overlay.remove(child);
        child.traverse((object) => {
          const line = object as THREE.Line;
          line.geometry?.dispose();
          const material = line.material as THREE.Material | undefined;
          material?.dispose();
        });
      }
    };
    const updateProfileOverlay = (): void => {
      const nextProfile = profileRef.current;
      if (nextProfile !== renderedProfile) {
        clearOverlay();
        renderedProfile = nextProfile;
        if (nextProfile) {
          // Split each segment into measured vs gap-filled runs: gap-filled
          // (bridged over nodata) stretches render dashed so the measurement
          // line stays connected across tile seams / nodata regions.
          nextProfile.segments.forEach((segment) => {
            const runs: Array<{ dashed: boolean; indices: number[] }> = [];
            segment.forEach((index) => {
              const dashed = Boolean(nextProfile.samples[index].gapFilled);
              const last = runs[runs.length - 1];
              if (last && last.dashed === dashed) last.indices.push(index);
              else runs.push({ dashed, indices: [index] });
            });
            runs.forEach((run) => {
              const points = run.indices.map((index) => {
                const sample = nextProfile.samples[index];
                const metadata = profileMetadata;
                if (!metadata) return new THREE.Vector3();
                const scenePoint = projectedToScene(metadata, sample.projected, sample.elevation!);
                return new THREE.Vector3(scenePoint.x, scenePoint.y + 0.35, scenePoint.z);
              });
              if (points.length < 2) return;
              const geometry = new THREE.BufferGeometry().setFromPoints(points);
              const material = run.dashed
                ? new THREE.LineDashedMaterial({ color: '#fbbf24', dashSize: 8, gapSize: 6, depthTest: false })
                : new THREE.LineBasicMaterial({ color: '#fbbf24', depthTest: false });
              const line = new THREE.Line(geometry, material);
              if (run.dashed) line.computeLineDistances();
              line.renderOrder = 9;
              overlay.add(line);
            });
          });
        }
      }
      const point = focusPointRef.current;
      focusMarker.visible = Boolean(point);
      if (point) focusMarker.position.set(point.x, point.y + 0.8, point.z);
    };
    const updateAdministrativeLabels = (): void => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      entries.forEach((entry) => {
        if (!entry.label || !entry.labelAnchor) return;
        const projected = entry.labelAnchor.clone().project(camera);
        const visible = projected.z >= -1 && projected.z <= 1
          && projected.x >= -1.15 && projected.x <= 1.15
          && projected.y >= -1.15 && projected.y <= 1.15;
        entry.label.style.display = visible ? 'grid' : 'none';
        if (visible) {
          entry.label.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
          entry.label.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
        }
      });
    };

    const labelRaycaster = new THREE.Raycaster();
    labelRaycaster.firstHitOnly = true;
    const terrainMeshes = entries.flatMap((entry) => entry.meshes);
    const lastLabelCamera = new THREE.Matrix4();
    const lastLabelProjection = new THREE.Matrix4();
    let lastLabels: ContourScreenLabel[] | undefined;
    let lastLabelWidth = 0;
    let lastLabelHeight = 0;
    const updateContourLabels = (): void => {
      camera.updateMatrixWorld();
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (lastLabels === contourLabelsRef.current && lastLabelCamera.equals(camera.matrixWorld)
        && lastLabelProjection.equals(camera.projectionMatrix) && width === lastLabelWidth && height === lastLabelHeight) return;
      lastLabels = contourLabelsRef.current;
      lastLabelCamera.copy(camera.matrixWorld);
      lastLabelProjection.copy(camera.projectionMatrix);
      lastLabelWidth = width;
      lastLabelHeight = height;
      scene.updateMatrixWorld();
      const occupied: LabelBox[] = [];
      for (const label of contourLabelsRef.current) {
        label.element.style.display = 'none';
        if (occupied.length >= MAX_VISIBLE_LABELS) continue;
        const world = label.group.localToWorld(label.point.clone());
        const box = projectContourLabel(world, camera, host.clientWidth, host.clientHeight);
        if (!box) continue;
        const tangent = label.group.localToWorld(label.point.clone().add(label.tangent)).sub(world);
        const angle = projectContourTangent(world, tangent, camera, width, height);
        if (angle === null) continue;
        const rotated = rotatedLabelBox(box, angle);
        if (rotated.x < 0 || rotated.y < 0 || rotated.x + rotated.width > width || rotated.y + rotated.height > height
          || labelCollides(rotated, occupied)) continue;
        const direction = world.clone().sub(camera.position);
        const distance = direction.length();
        labelRaycaster.set(camera.position, direction.normalize());
        labelRaycaster.far = distance;
        const hit = labelRaycaster.intersectObjects(terrainMeshes, false)[0];
        if (terrainOccludesLabel(hit?.distance, distance)) continue;
        occupied.push(rotated);
        label.element.style.transform = `rotate(${angle}deg)`;
        label.element.style.left = `${box.x}px`;
        label.element.style.top = `${box.y}px`;
        label.element.style.display = 'block';
      }
    };

    const updateHover = (): void => {
      pendingFrame = 0;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((lastPointerX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((lastPointerY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(entries.flatMap((entry) => entry.meshes), false)[0];
      const entry = hit ? meshEntries.get(hit.object) : undefined;
      if (!hit || !entry || !entry.model.metadata) {
        onHover(null);
        return;
      }
      const localPoint = entry.root.worldToLocal(hit.point.clone());
      const sample = sampleModel(entry.model, localPoint);
      if (!sample) return;
      onHover(formatHover(entry.model.metadata, { x: hit.point.x, y: hit.point.y, z: hit.point.z }, sample.projected, sample.elevation, sample.row, sample.column, sample.interpolated));
    };
    let lastPointerX = -1;
    let lastPointerY = -1;
    const onPointerMove = (event: PointerEvent): void => {
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      if (!pendingFrame) pendingFrame = requestAnimationFrame(updateHover);
    };
    const onPointerLeave = (): void => {
      lastPointerX = -1;
      lastPointerY = -1;
      onHover(null);
    };
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    const onClick = (event: MouseEvent): void => {
      if (!measureModeRef.current || !onPickRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(entries.flatMap((entry) => entry.meshes), false)[0];
      const entry = hit ? meshEntries.get(hit.object) : undefined;
      if (!hit || !entry || !entry.model.metadata) return;
      const localPoint = entry.root.worldToLocal(hit.point.clone());
      const sample = sampleModel(entry.model, localPoint);
      if (!sample) return;
      onPickRef.current({ scene: { x: hit.point.x, y: hit.point.y, z: hit.point.z }, projected: sample.projected, elevation: sample.elevation, row: sample.row, column: sample.column, interpolated: sample.interpolated });
    };
    renderer.domElement.addEventListener('click', onClick);

    const resize = (): void => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();
    const neutralMaterial = new THREE.MeshStandardMaterial({ color: '#b8b8b8', roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    let animationFrame = 0;
    const animate = (): void => {
      animationFrame = requestAnimationFrame(animate);
      controls.enabled = !measureModeRef.current;
      updateProfileOverlay();
      controls.update();
      updateAdministrativeLabels();
      updateContourLabels();
      if (sarSurface) sarSurface.render(colorTextureVisibleRef.current, sarControlsRef.current.visible, sarControlsRef.current.opacity, () => renderer.render(scene, camera));
      else if (colorTextureVisibleRef.current) renderer.render(scene, camera);
      else renderWithoutColorTexture(entries.map((entry) => entry.root), neutralMaterial, () => renderer.render(scene, camera));
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      if (pendingFrame) cancelAnimationFrame(pendingFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('click', onClick);
      clearOverlay();
      entries.forEach((entry) => entry.label?.remove());
      contourLabelsRef.current.forEach((label) => label.element.remove());
      contourLabelsRef.current = [];
      focusMarker.geometry.dispose();
      (focusMarker.material as THREE.Material).dispose();
      controls.removeEventListener('change', onControlsChange);
      cancelled = true;
      sarSurface?.dispose();
      tileCoordinator.dispose();
      entries.forEach((entry) => {
        entry.tileState && disposeModelTileState(entry.tileState);
        if (entry.model.preserveResources) return;
        if (!entry.model.released && !entry.model.bvhDisposed) {
          disposeBvh(entry.root);
          entry.model.bvhDisposed = true;
        }
      });
      controls.dispose();
      neutralMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [geographicPlacements, models, onHover, onTileStats, showAdministrativeInfo, sarBand, sarRaster]);

  useEffect(() => {
    onContourStatus?.(null);
    if (!contoursVisible) return;
    const controller = new AbortController();
    const lines: THREE.LineSegments[] = [];
    const labels: ContourScreenLabel[] = [];
    const clear = (): void => {
      labels.forEach((label) => label.element.remove());
      contourLabelsRef.current = contourLabelsRef.current.filter((label) => !labels.includes(label));
      labels.length = 0;
      lines.forEach((line) => {
        line.removeFromParent();
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      });
      lines.length = 0;
    };
    const entries = contourEntriesRef.current.filter((entry) => entry.model.metadata && entry.model.grid);
    onContourStatus?.('Đang tạo đường đồng mức…');
    const budget = createContourBudget();
    void (async () => {
      let segments = 0;
      for (const entry of entries) {
        const positions = await buildContours(entry.model.grid!, entry.model.metadata!, contourInterval, controller.signal, budget);
        if (controller.signal.aborted) return;
        segments += positions.length / 6;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.LineBasicMaterial({ color: '#fff2ac', depthTest: true, depthWrite: false, toneMapped: false });
        // Polygon offset does not affect GL lines. Bias clip-space depth instead,
        // retaining terrain occlusion without lifting coordinates off the DEM.
        material.onBeforeCompile = (shader) => {
          shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n gl_Position.z -= 0.00002 * gl_Position.w;');
        };
        const line = new THREE.LineSegments(geometry, material);
        line.name = 'elevation-contours';
        line.renderOrder = 5;
        entry.group.add(line);
        lines.push(line);
        const anchors = await buildContourLabels(positions, entry.model.metadata!, contourInterval, controller.signal, Math.floor(MAX_LABEL_CANDIDATES / entries.length));
        if (controller.signal.aborted) return;
        for (const anchor of anchors) {
          const element = document.createElement('div');
          element.className = 'terrain-contour-label';
          element.textContent = formatContourElevation(anchor.elevation);
          element.style.display = 'none';
          element.setAttribute('aria-hidden', 'true');
          hostRef.current?.appendChild(element);
          const label = { element, point: anchor.point, tangent: anchor.tangent, group: entry.group };
          labels.push(label);
          contourLabelsRef.current = [...contourLabelsRef.current, label];
        }
      }
      if (!controller.signal.aborted) onContourStatus?.(`${segments.toLocaleString('vi-VN')} đoạn đồng mức · khoảng cao độ ${contourInterval} m${entries.length < models.length ? ' · Model thiếu metadata/lưới DEM đã bỏ qua.' : ''}`);
    })().catch((error: unknown) => {
      clear();
      if (!controller.signal.aborted) onContourStatus?.(error instanceof Error ? error.message : String(error));
    });
    return () => { controller.abort(); clear(); };
  }, [contoursVisible, contourInterval, onContourStatus, geographicPlacements, models, onHover, onTileStats, showAdministrativeInfo, sarBand, sarRaster]);

  return <div ref={hostRef} className="terrain-viewer" aria-label="3D terrain viewer" />;
}
