# 3D Upload and Geographic Terrain Merge Design

> Historical design/implementation record. Not the current task list; see [SIC plan](../../tasks/sic-2026.md). Do not update this record for routine viewer changes.

## Goal

Add an upload workflow to the DEM viewer that can display one uploaded 3D
model or combine multiple uploaded models. When models include their matching
`.terrain.json` sidecars, the multi-model workflow must place them in one
common scene using the exporter contract's CRS and `world_origin` values.

## User flow

- The upload panel offers `Một model` and `Ghép nhiều model` modes.
- The single-model mode displays the first selected `.glb` or `.gltf` and
  replaces the current scene.
- The multi-model mode displays every selected model. Geographic placement is
  enabled by default and requires a matching `<model>.terrain.json` for every
  model; the user may turn it off for local-coordinate preview.
- A terrain sidecar may reference a `.grid.bin` file. The grid is loaded when
  supplied so the existing hover/measurement analysis remains available for a
  single uploaded terrain. A model and metadata without a grid remains
  renderable but is explicitly visual-only for analysis.
- `.gltf` external buffers/textures are resolved from the other selected files
  by filename. Embedded GLB assets continue to work without sidecars.

## Geographic placement contract

The v1 exporter writes mesh coordinates as:

```text
scene_x = world_x - world_origin.x
scene_z = -(world_y - world_origin.y)
scene_y = (elevation - base_elevation) * exaggeration
```

For a reference model `R` and a model `M`, the placement into R's local
coordinate system is:

```text
translation.x = M.world_origin.x - R.world_origin.x
translation.z = -(M.world_origin.y - R.world_origin.y)
scale.y       = R.exaggeration / M.exaggeration
translation.y = (M.base_elevation - R.base_elevation) * R.exaggeration
```

This preserves projected coordinates and real elevation while allowing every
model to render with the reference model's vertical scale. Automatic merging
accepts only schema v1, metre-compatible, projected terrain metadata with the
same CRS authority/code. Different or missing CRS metadata is rejected rather
than silently approximated.

## Architecture

- Keep the existing default `loadTerrain` path and analysis functions intact.
- Add an upload loader that pairs model files with optional metadata/grid
  sidecars, resolves glTF dependencies through a `LoadingManager` URL map, and
  owns object URL cleanup.
- Add a geographic placement module with pure functions for CRS compatibility
  and precise placement calculations.
- Generalize `TerrainViewer` from one terrain root to a list of model roots;
  raycast hits retain the originating model so hover coordinates and elevation
  use the correct metadata.
- Keep profile/slope analysis enabled only when exactly one loaded model has a
  complete metadata + grid pair; multi-model rendering remains safe and
  clearly visual-only for those analysis panels.

## Validation and errors

- Reject unsupported extensions, duplicate/ambiguous model pairing, malformed
  metadata, missing required glTF external resources, and invalid grid sizes.
- Geographic merge errors identify the model and the incompatible CRS or
  missing sidecar.
- Dispose loaded Three.js resources and revoke upload object URLs when a scene
  is replaced, unloaded, or fails validation.

## Verification

- Unit tests cover geographic placement, CRS/unit rejection, file pairing, and
  model-sidecar loading seams.
- Run the viewer Vitest suite, TypeScript typecheck, and production build.
- Run `git diff --check` and inspect the final diff for unrelated changes.
