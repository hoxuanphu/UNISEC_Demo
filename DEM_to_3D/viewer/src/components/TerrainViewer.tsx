import { useEffect, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { MapControls as ThreeMapControls } from 'three/examples/jsm/controls/MapControls.js';
import type { LoadedModel, TerrainPoint, TerrainMetadata } from '../types/terrain';
import { bilinearElevation } from '../terrain/elevationGrid';
import { projectedToScene, projectedToPixel, sceneToProjected } from '../terrain/coordinate';
import { buildBvh, disposeBvh, disposeObjectResources } from '../terrain/raycast';
import type { SurfaceProfile } from '../terrain/profile';
import type { GeographicPlacement } from '../terrain/geographic';
import { applyElevationColorRamp } from '../terrain/colorRamp';
import { buildScenarioOverlays } from '../terrain/scenarioOverlays';
import { createScenarioMarkers } from '../terrain/scenarioMarkers';
import { createMapReference } from '../terrain/mapReference';
import { createRegionalBasemap } from '../terrain/regionalBasemap';
import type { MapDisplayProps, OverlayHit } from '../features/map/mapContracts';

export type TerrainViewerProps = MapDisplayProps & {
  models: LoadedModel[];
  geographicPlacements?: GeographicPlacement[];
  measureMode?: boolean;
  onPick?: (point: TerrainPoint, metadata: TerrainMetadata) => void;
  profile?: SurfaceProfile | null;
  mapMode?: '3d' | '2d';
  theme?: 'light' | 'dark';
  onUnavailable?: () => void;
};

type Props = TerrainViewerProps;

type ModelEntry = { model: LoadedModel; root: THREE.Object3D; group: THREE.Group; meshes: THREE.Mesh[] };

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

export function TerrainViewer({
  models,
  geographicPlacements,
  measureMode = false,
  onPick,
  focusPoint,
  profile = null,
  profileMetadata,
  mapMode = '3d',
  theme = 'light',
  locale = 'vi',
  onBasemapState,
  onUnavailable,
  scenarioProps,
  onSelectOverlayHit,
  viewControlRef
}: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const measureModeRef = useRef(measureMode);
  const onPickRef = useRef(onPick);
  const focusPointRef = useRef(focusPoint);
  const profileRef = useRef(profile);
  const mapModeRef = useRef(mapMode);
  const onSelectOverlayHitRef = useRef(onSelectOverlayHit);
  const scenarioPropsRef = useRef(scenarioProps);
  const themeRef = useRef(theme);
  const localeRef = useRef(locale);
  const profileMetadataRef = useRef(profileMetadata);
  const onBasemapStateRef = useRef(onBasemapState);
  const propsUnavailableRef = useRef(onUnavailable);
  const runtimeRef = useRef<{ updateScenario: () => void; setMode: (mode: '2d' | '3d') => void; updateSurface: () => void } | null>(null);

  measureModeRef.current = measureMode;
  onPickRef.current = onPick;
  focusPointRef.current = focusPoint;
  profileRef.current = profile;
  mapModeRef.current = mapMode;
  onSelectOverlayHitRef.current = onSelectOverlayHit;
  scenarioPropsRef.current = scenarioProps;
  themeRef.current = theme;
  localeRef.current = locale;
  profileMetadataRef.current = profileMetadata;
  onBasemapStateRef.current = onBasemapState;
  propsUnavailableRef.current = onUnavailable;

  // Controls remove document listeners through canvas.getRootNode(). Tear them
  // down before React detaches the host, while that root is still the document.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(themeRef.current === 'dark' ? '#0b1720' : '#e7eeef');

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1_000_000);
    camera.aspect = Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const onContextLost = (event: Event): void => { event.preventDefault(); propsUnavailableRef.current?.(); };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.domElement.className = 'terrain-canvas';
    host.appendChild(renderer.domElement);
    const mapReference = createMapReference(host);

    const controls = new ThreeMapControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.28;
    controls.panSpeed = 1;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.85;
    controls.target.set(0, 0, 0);
    let markerLayoutDirty = true;
    const onControlsChange = (): void => {
      markerLayoutDirty = true;
      host.parentElement?.style.setProperty('--map-bearing', `${THREE.MathUtils.radToDeg(controls.getAzimuthalAngle())}deg`);
    };
    controls.addEventListener('change', onControlsChange);

    const ambient = new THREE.HemisphereLight('#f2f7ff', '#465748', 2.4);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight('#ffffff', 2.8);
    sun.position.set(1, 2, 1);
    scene.add(sun);

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
      return { model, root, group, meshes };
    });
    scene.updateMatrixWorld(true);
    const primary = entries[0];
    const basemap = primary?.model.metadata
      ? createRegionalBasemap(primary.model.metadata, primary.group.matrixWorld, state => onBasemapStateRef.current?.(state))
      : null;
    if (basemap) scene.add(basemap.group);

    type SurfaceMaterial = THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
    const originalMaterials = new Map<SurfaceMaterial, { map: THREE.Texture | null; color: THREE.Color; vertexColors: boolean }>();
    const textureAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    entries.forEach(entry => entry.root.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => {
        const surface = material as SurfaceMaterial;
        if (surface.color && 'map' in surface && !originalMaterials.has(surface)) {
          if (surface.map && surface.map.anisotropy !== textureAnisotropy) {
            surface.map.anisotropy = textureAnisotropy; surface.map.needsUpdate = true;
          }
          originalMaterials.set(surface, { map: surface.map, color: surface.color.clone(), vertexColors: surface.vertexColors });
        }
      });
    }));
    const updateSurface = (): void => {
      const layers = scenarioPropsRef.current?.layers;
      basemap?.setOptions(layers?.context !== false, layers?.imagery === false ? 'terrain' : 'satellite');
      if (!basemap) onBasemapStateRef.current?.({ status: layers?.context === false || !models.length ? 'off' : 'unavailable', style: layers?.imagery === false ? 'terrain' : 'satellite', loaded: 0, total: 0 });
      scene.background = new THREE.Color(themeRef.current === 'dark' ? '#0b1720' : '#e7eeef');
      originalMaterials.forEach((original, material) => {
        const imagery = layers?.imagery !== false;
        const nextMap = imagery ? original.map : null;
        if (material.map !== nextMap) { material.map = nextMap; material.needsUpdate = true; }
        material.color.copy(imagery ? original.color : new THREE.Color(themeRef.current === 'dark' ? '#354a50' : '#c8d5c4'));
        if (material.vertexColors !== (imagery && original.vertexColors)) { material.vertexColors = imagery && original.vertexColors; material.needsUpdate = true; }
      });
      ambient.intensity = layers?.hillshade === false ? 3.2 : 2.4;
      sun.intensity = layers?.hillshade === false ? 0 : 2.8;
    };
    updateSurface();

    const overlay = new THREE.Group();
    overlay.name = 'profile-overlay';
    scene.add(overlay);

    let scenarioOverlayGroup: THREE.Group | null = null;
    let scenarioMarkers: ReturnType<typeof createScenarioMarkers> | null = null;
    const rebuildScenarioOverlays = (): void => {
      scenarioMarkers?.dispose();
      scenarioMarkers = null;
      updateSurface();
      if (scenarioOverlayGroup) {
        scene.remove(scenarioOverlayGroup);
        scenarioOverlayGroup.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
            else mesh.material?.dispose();
          }
        });
        scenarioOverlayGroup = null;
      }

      const sp = scenarioPropsRef.current;
      const primaryModel = entries[0]?.model;
      if (sp && primaryModel?.metadata && primaryModel?.grid) {
        scenarioOverlayGroup = buildScenarioOverlays({
          metadata: primaryModel.metadata,
          grid: primaryModel.grid,
          communities: sp.communities,
          hazards: sp.hazards,
          roads: sp.roads,
          aoi: sp.aoi,
          selectedRoute: sp.selectedRoute,
          selectedCommunityId: sp.selectedCommunityId,
          selectedObjectId: sp.selectedObjectId,
          layers: sp.layers,
          appearance: sp.appearance,
          screenMarkers: true,
          resolution: { width: host.clientWidth, height: host.clientHeight }
        });
        scenarioOverlayGroup.position.copy(entries[0].group.position);
        scenarioOverlayGroup.scale.copy(entries[0].group.scale);
        scene.add(scenarioOverlayGroup);
        scenarioMarkers = createScenarioMarkers(host, {
          ...sp, metadata: primaryModel.metadata, grid: primaryModel.grid,
          transform: entries[0].group.matrixWorld, locale: localeRef.current,
          onSelect: hit => onSelectOverlayHitRef.current?.(hit)
        });
      }
      markerLayoutDirty = true;
    };
    rebuildScenarioOverlays();

    const focusMarker = document.createElement('div');
    focusMarker.className = 'map-profile-point';
    focusMarker.setAttribute('role', 'img');
    focusMarker.hidden = true;
    host.appendChild(focusMarker);
    const focusPosition = new THREE.Vector3();

    const bounds = new THREE.Box3();
    entries.forEach((entry) => bounds.expandByObject(entry.group));
    const center = bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
    const size = bounds.isEmpty() ? new THREE.Vector3(1, 1, 1) : bounds.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 1);

    type CameraTransition = {
      fromPosition: THREE.Vector3; fromTarget: THREE.Vector3;
      toPosition: THREE.Vector3; toTarget: THREE.Vector3;
      startedAt: number; mode: '3d' | '2d';
    };
    let cameraTransition: CameraTransition | null = null;
    const applyModeConstraints = (mode: '3d' | '2d'): void => {
      controls.minPolarAngle = mode === '2d' ? 0 : 0.12;
      controls.maxPolarAngle = mode === '2d' ? 0.05 : Math.PI / 2.35;
      controls.enableRotate = mode === '3d';
    };
    const setInitialCamera = (mode: '3d' | '2d', smooth = false): void => {
      const direction = mode === '2d' ? new THREE.Vector3(0, 1, .0001).normalize() : new THREE.Vector3(.6, .85, .65).normalize();
      const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
      const up = new THREE.Vector3().crossVectors(direction, right).normalize();
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const tanH = tanV * camera.aspect;
      let distance = 1;
      for (const x of [-size.x / 2, size.x / 2]) for (const y of [-size.y / 2, size.y / 2]) for (const z of [-size.z / 2, size.z / 2]) {
        const corner = new THREE.Vector3(x, y, z);
        distance = Math.max(distance, corner.dot(direction) + Math.max(Math.abs(corner.dot(right)) / tanH, Math.abs(corner.dot(up)) / tanV));
      }
      distance *= 1.12;
      const nextPosition = center.clone().addScaledVector(direction, distance);
      controls.cursor.copy(center);
      controls.maxTargetRadius = Math.max(Math.hypot(size.x, size.z) * 0.75, 1);
      camera.near = Math.max(distance / 10_000, 0.01);
      camera.far = Math.max(distance * 25, 1000);
      controls.minDistance = Math.max(maxDimension * .04, size.y * .65);
      controls.maxDistance = Math.max(distance * 2.2, maxDimension * 2.5);
      camera.updateProjectionMatrix();
      if (smooth && camera.position.distanceTo(nextPosition) > 1) {
        // Clear residual damping before interpolating, otherwise the old drag
        // continues to move the camera during a mode change.
        controls.enableDamping = false;
        controls.update();
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI / 2.35;
        controls.enableRotate = true;
        cameraTransition = {
          fromPosition: camera.position.clone(), fromTarget: controls.target.clone(),
          toPosition: nextPosition, toTarget: center.clone(),
          startedAt: performance.now(), mode
        };
      } else {
        cameraTransition = null;
        camera.position.copy(nextPosition);
        controls.target.copy(center);
        applyModeConstraints(mode);
        controls.enableDamping = true;
        controls.update();
      }
      markerLayoutDirty = true;
    };
    setInitialCamera(mapModeRef.current);
    const interruptCameraTransition = (): void => {
      if (!cameraTransition) return;
      const mode = cameraTransition.mode;
      cameraTransition = null;
      applyModeConstraints(mode);
      controls.enableDamping = true;
      controls.enabled = !measureModeRef.current;
      controls.update();
      markerLayoutDirty = true;
    };
    runtimeRef.current = { updateScenario: rebuildScenarioOverlays, setMode: mode => setInitialCamera(mode, true), updateSurface };

    if (viewControlRef) {
      viewControlRef.current = {
        zoomIn: () => {
          interruptCameraTransition();
          const offset = camera.position.clone().sub(controls.target);
          offset.multiplyScalar(0.8);
          camera.position.copy(controls.target).add(offset);
          controls.update();
        },
        zoomOut: () => {
          interruptCameraTransition();
          const offset = camera.position.clone().sub(controls.target);
          offset.multiplyScalar(1.25);
          camera.position.copy(controls.target).add(offset);
          controls.update();
        },
        resetView: () => {
          setInitialCamera(mapModeRef.current, true);
        },
        retryBasemap: () => basemap?.retry(),
        focusProjected: point => {
          if (!primary?.model.metadata) return;
          interruptCameraTransition();
          const elevation = primary.model.grid ? bilinearElevation(primary.model.grid, primary.model.metadata, point.x, point.y).elevation : undefined;
          const p = projectedToScene(primary.model.metadata, point, elevation ?? primary.model.metadata.elevation.base_elevation);
          const target = primary.group.localToWorld(new THREE.Vector3(p.x, p.y, p.z));
          const shift = target.clone().sub(controls.target);
          camera.position.add(shift); controls.target.copy(target); controls.update(); markerLayoutDirty = true;
        }
      };
    }

    const meshEntries = new Map<THREE.Object3D, ModelEntry>();
    entries.forEach((entry) => entry.meshes.forEach((mesh) => meshEntries.set(mesh, entry)));

    const raycaster = new THREE.Raycaster();
    // Line2 uses screen pixels for this extra selection width.
    raycaster.params.Line2 = { threshold: window.matchMedia('(pointer: coarse)').matches ? 20 : 12 };
    raycaster.firstHitOnly = true;
    const terrainMeshes = entries.flatMap(entry => entry.meshes);
    const pointer = new THREE.Vector2();
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
        // Route geometry already carries road-status colours. A second profile
        // line would cover blocked/uncertain segments with an unqualified blue.
        if (nextProfile && nextProfile.geometry !== 'route') {
          nextProfile.segments.forEach((segment) => {
            const points = segment.map((index) => {
              const sample = nextProfile.samples[index];
              const metadata = profileMetadataRef.current;
              if (!metadata) return new THREE.Vector3();
              const scenePoint = projectedToScene(metadata, sample.projected, sample.elevation!);
              return new THREE.Vector3(scenePoint.x, scenePoint.y + 6, scenePoint.z);
            });
            if (points.length < 2) return;
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: '#60a5fa', linewidth: 3, depthTest: false });
            const line = new THREE.Line(geometry, material);
            line.renderOrder = 9;
            overlay.add(line);
          });
        }
      }
    };

    const updateFocusMarker = (): void => {
      const point = focusPointRef.current;
      focusMarker.hidden = !point;
      if (!point) return;
      focusPosition.set(point.x, point.y + 12, point.z).project(camera);
      const x = (focusPosition.x + 1) * host.clientWidth / 2;
      const y = (1 - focusPosition.y) * host.clientHeight / 2;
      focusMarker.hidden = focusPosition.z < -1 || focusPosition.z > 1 || x < 0 || y < 0 || x > host.clientWidth || y > host.clientHeight;
      focusMarker.style.transform = `translate(${x - 5}px,${y - 5}px)`;
      focusMarker.setAttribute('aria-label', localeRef.current === 'vi' ? 'Vị trí đang đọc trên mặt cắt' : 'Current profile position');
    };

    let pointerStart: { x: number; y: number } | null = null;
    let dragged = false;
    let hoverFrame = 0;
    let hoverPosition: { clientX: number; clientY: number } | null = null;
    const setRay = (position: { clientX: number; clientY: number }): void => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((position.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((position.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    };
    const pickOverlay = (): OverlayHit | null => {
      if (!scenarioOverlayGroup || !onSelectOverlayHitRef.current) return null;
      const hit = raycaster.intersectObjects(scenarioOverlayGroup.children, true)[0];
      let object: THREE.Object3D | null = hit?.object ?? null;
      while (object && !object.userData?.type) object = object.parent;
      return object?.userData?.type ? { type: object.userData.type, id: object.userData.id } as OverlayHit : null;
    };
    const updateCursor = (): void => {
      hoverFrame = 0;
      if (measureModeRef.current) { renderer.domElement.style.cursor = 'crosshair'; return; }
      if (pointerStart) { renderer.domElement.style.cursor = 'grabbing'; return; }
      if (hoverPosition) setRay(hoverPosition);
      renderer.domElement.style.cursor = hoverPosition && pickOverlay() ? 'pointer' : 'grab';
    };
    const scheduleCursor = (): void => { if (!hoverFrame) hoverFrame = requestAnimationFrame(updateCursor); };
    const onPointerDown = (event: PointerEvent): void => {
      interruptCameraTransition();
      pointerStart = { x: event.clientX, y: event.clientY };
      dragged = false;
      renderer.domElement.style.cursor = measureModeRef.current ? 'crosshair' : 'grabbing';
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (pointerStart && event.buttons && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) dragged = true;
      hoverPosition = { clientX: event.clientX, clientY: event.clientY };
      if (event.pointerType !== 'touch') scheduleCursor();
    };
    const onPointerUp = (): void => { pointerStart = null; scheduleCursor(); };
    const onPointerCancel = (): void => { pointerStart = null; dragged = true; hoverPosition = null; scheduleCursor(); };
    const onPointerLeave = (): void => { hoverPosition = null; scheduleCursor(); };
    const onWheel = (): void => interruptCameraTransition();
    // Capture before MapControls handles the gesture, so the first drag or
    // wheel tick immediately takes control from a camera transition.
    renderer.domElement.addEventListener('pointerdown', onPointerDown, true);
    renderer.domElement.addEventListener('wheel', onWheel, true);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

    const onClick = (event: MouseEvent): void => {
      if (dragged) return;
      setRay(event);

      // Check scenario overlays first
      const overlayHit = pickOverlay();
      if (overlayHit && !measureModeRef.current) { onSelectOverlayHitRef.current?.(overlayHit); return; }

      // If measure mode is active, pick ground point
      if (measureModeRef.current && onPickRef.current) {
        const hit = raycaster.intersectObjects(terrainMeshes, false)[0];
        const entry = hit ? meshEntries.get(hit.object) : undefined;
        if (!hit || !entry || !entry.model.metadata) return;
        const localPoint = entry.root.worldToLocal(hit.point.clone());
        const sample = sampleModel(entry.model, localPoint);
        if (!sample) return;
        onPickRef.current({ scene: { x: hit.point.x, y: hit.point.y, z: hit.point.z }, projected: sample.projected, elevation: sample.elevation, row: sample.row, column: sample.column, interpolated: sample.interpolated }, entry.model.metadata);
      }
    };
    renderer.domElement.addEventListener('click', onClick);

    const resize = (): void => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      scenarioOverlayGroup?.traverse(object => {
        const material = (object as THREE.Mesh).material as THREE.Material & { resolution?: THREE.Vector2 };
        material?.resolution?.set(width, height);
      });
      markerLayoutDirty = true;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const mapUiObserver = new MutationObserver(() => { markerLayoutDirty = true; });
    const mapArea = host.closest('.map-area');
    const markLayoutDirty = () => { markerLayoutDirty = true; };
    mapArea?.addEventListener('dear:map-layout', markLayoutDirty);
    const workspace = mapArea ?? host.parentElement;
    if (workspace) mapUiObserver.observe(workspace, { childList: true, subtree: true });
    resize();

    let animationFrame = 0;
    const animate = (): void => {
      animationFrame = requestAnimationFrame(animate);
      controls.enabled = !measureModeRef.current && !cameraTransition;
      updateProfileOverlay();
      if (cameraTransition) {
        const transition = cameraTransition;
        const progress = Math.min((performance.now() - transition.startedAt) / 220, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
        controls.target.lerpVectors(transition.fromTarget, transition.toTarget, eased);
        markerLayoutDirty = true;
        if (progress === 1) {
          cameraTransition = null;
          applyModeConstraints(transition.mode);
          controls.enableDamping = true;
          controls.enabled = !measureModeRef.current;
        }
      }
      controls.update();
      renderer.render(scene, camera);
      updateFocusMarker();
      if (markerLayoutDirty) {
        mapReference.update(camera, controls.target, controls.getAzimuthalAngle(), mapModeRef.current, localeRef.current, entries[0]?.model.metadata, entries[0]?.group.matrixWorld);
        scenarioMarkers?.update(camera);
        markerLayoutDirty = false;
      }
    };
    animate();

    return () => {
      runtimeRef.current = null;
      cancelAnimationFrame(animationFrame);
      cancelAnimationFrame(hoverFrame);
      resizeObserver.disconnect();
      mapUiObserver.disconnect();
      mapArea?.removeEventListener('dear:map-layout', markLayoutDirty);
      controls.removeEventListener('change', onControlsChange);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown, true);
      renderer.domElement.removeEventListener('wheel', onWheel, true);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('click', onClick);
      clearOverlay();
      scenarioMarkers?.dispose();
      mapReference.dispose();
      basemap?.dispose();
      if (scenarioOverlayGroup) {
        scene.remove(scenarioOverlayGroup);
        scenarioOverlayGroup.traverse(object => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose(); const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; materials.forEach(material => material?.dispose()); });
      }
      originalMaterials.forEach((original, material) => { material.map = original.map; material.color.copy(original.color); material.vertexColors = original.vertexColors; material.needsUpdate = true; });
      focusMarker.remove();
      entries.forEach((entry) => {
        // A reused model must release this renderer's GPU allocations and dispose
        // listeners too. Three.js can re-upload its retained geometry/texture data.
        disposeObjectResources(entry.root, false);
        if (entry.model.preserveResources) return;
        if (!entry.model.released && !entry.model.bvhDisposed) {
          disposeBvh(entry.root);
          entry.model.bvhDisposed = true;
        }
      });
      controls.dispose();
      renderer.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [geographicPlacements, models]);

  useEffect(() => { runtimeRef.current?.updateScenario(); }, [scenarioProps?.aoi, scenarioProps?.layers, scenarioProps?.appearance, scenarioProps?.communities, scenarioProps?.responseSites, scenarioProps?.hazards, scenarioProps?.roads, scenarioProps?.selectedRoute, scenarioProps?.selectedCommunityId, scenarioProps?.selectedObjectId, locale]);
  useLayoutEffect(() => { runtimeRef.current?.setMode(mapMode); }, [mapMode]);
  useEffect(() => { runtimeRef.current?.updateSurface(); }, [theme]);

  return <div ref={hostRef} className="terrain-viewer" aria-label={locale === 'vi' ? `Bản đồ địa hình ${mapMode.toUpperCase()}` : `${mapMode.toUpperCase()} terrain map`} />;
}
