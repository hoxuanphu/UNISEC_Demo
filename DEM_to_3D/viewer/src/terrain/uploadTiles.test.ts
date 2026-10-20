import { describe, expect, it } from 'vitest';
import { pairUploadedFiles, validateUploadedTileInventory } from './upload';
function rooted(file: File, relative: string): File { Object.defineProperty(file, 'webkitRelativePath', { value: relative }); return file; }
const tileMetadata = (asset: string) => JSON.stringify({ schema_version: 1, asset_id: asset, format: 'webp', quality: 88, tile_size: 512, gutter_px: 2, min_zoom: 0, max_zoom: 0, bounds_projected: { min_x: 0, min_y: 0, max_x: 1, max_y: 1 }, crs: { authority: 'EPSG', code: 32648, linear_unit: 'metre' }, orientation: { origin: 'top_left', x: 'east', y: 'north_to_south' }, levels: [{ zoom: 0, width_px: 512, height_px: 512, columns: 1, rows: 1, pixel_size_x: 1, pixel_size_y: 1 }], source: asset + '.tif' });
describe('uploaded tile pairing', () => { it('isolates equal tile paths by model root', () => { const files = [rooted(new File(['a'], 'lao.glb'), 'lao.glb'), rooted(new File([tileMetadata('lao')], 'lao.tiles.json'), 'lao_tiles/lao.tiles.json'), rooted(new File(['a'], 'a'), 'lao_tiles/z0/0_0.webp'), rooted(new File(['b'], 'che.glb'), 'che.glb'), rooted(new File([tileMetadata('che')], 'che.tiles.json'), 'che_tiles/che.tiles.json'), rooted(new File(['b'], 'b'), 'che_tiles/z0/0_0.webp')]; const pairs = pairUploadedFiles(files); expect(pairs).toHaveLength(2); expect(pairs[0].tilePyramid?.files.get('z0/0_0.webp')).toBe(files[2]); expect(pairs[1].tilePyramid?.files.get('z0/0_0.webp')).toBe(files[5]); }); });

describe('uploaded tile folder paths', () => {
  it('pairs a pyramid inside a selected parent folder', () => {
    const model = rooted(new File(['model'], 'lao.glb'), 'export/lao.glb');
    const metadata = rooted(new File([tileMetadata('lao')], 'lao.tiles.json'), 'export/lao_tiles/lao.tiles.json');
    const preview = rooted(new File(['image'], '0_0.webp'), 'export/lao_tiles/z0/0_0.webp');
    const [pair] = pairUploadedFiles([model, metadata, preview]);
    expect(pair.tilePyramid?.rootPath).toBe('export/lao_tiles');
    expect(pair.tilePyramid?.files.get('z0/0_0.webp')).toBe(preview);
  });

  it('supports parent directories whose own name ends in _tiles', () => {
    const preview = rooted(new File(['image'], '0_0.webp'), 'export_tiles/lao_tiles/z0/0_0.webp');
    const [pair] = pairUploadedFiles([
      rooted(new File(['model'], 'lao.glb'), 'export_tiles/lao.glb'),
      rooted(new File([tileMetadata('lao')], 'lao.tiles.json'), 'export_tiles/lao_tiles/lao.tiles.json'),
      preview,
    ]);
    expect(pair.tilePyramid?.rootPath).toBe('export_tiles/lao_tiles');
    expect(pair.tilePyramid?.files.get('z0/0_0.webp')).toBe(preview);
  });

  it('finds a nested pyramid when its manifest is next to the model', () => {
    const preview = rooted(new File(['image'], '0_0.webp'), 'export_tiles/lao_tiles/z0/0_0.webp');
    const [pair] = pairUploadedFiles([
      rooted(new File(['model'], 'lao.glb'), 'export_tiles/lao.glb'),
      rooted(new File([tileMetadata('lao')], 'lao.tiles.json'), 'export_tiles/lao.tiles.json'),
      preview,
    ]);
    expect(pair.tilePyramid?.rootPath).toBe('export_tiles/lao_tiles');
    expect(pair.tilePyramid?.files.get('z0/0_0.webp')).toBe(preview);
  });

  it('normalizes case and numeric tile indexes for preview lookup', () => {
    const preview = rooted(new File(['image'], '00_00.WEBP'), 'lao_tiles/Z00/00_00.WEBP');
    const [pair] = pairUploadedFiles([
      new File(['model'], 'lao.glb'),
      rooted(new File([tileMetadata('lao')], 'lao.tiles.json'), 'lao_tiles/lao.tiles.json'),
      preview,
    ]);
    expect(pair.tilePyramid?.files.get('z0/0_0.webp')).toBe(preview);
  });

  it('rejects duplicate logical tiles instead of silently replacing their data', () => {
    const files = [
      new File(['model'], 'lao.glb'),
      rooted(new File([tileMetadata('lao')], 'lao.tiles.json'), 'lao_tiles/lao.tiles.json'),
      rooted(new File(['one'], '0_0.webp'), 'lao_tiles/z0/0_0.webp'),
      rooted(new File(['two'], '0_0.webp'), 'lao_tiles/z0/0_0.webp'),
    ];
    expect(() => pairUploadedFiles(files)).toThrow(/Duplicate.*tile/i);
  });
});

describe('uploaded tile inventory', () => {
  it('rejects tile indexes outside the metadata level bounds', async () => {
    const { validateTilePyramidMetadata } = await import('./tileMetadata');
    const metadata = validateTilePyramidMetadata(JSON.parse(tileMetadata('lao')));
    expect(() => validateUploadedTileInventory(metadata, new Map([
      ['z0/0_0.webp', new File(['ok'], '0_0.webp')],
      ['z1/0_0.webp', new File(['invalid'], '0_0.webp')],
    ]))).toThrow(/outside metadata bounds/);
  });

  it('rejects backslash and drive-prefixed tile paths', () => {
    expect(() => pairUploadedFiles([
      rooted(new File(['a'], 'lao.glb'), 'lao.glb'),
      rooted(new File([tileMetadata('lao')], 'lao.tiles.json'), 'lao_tiles/lao.tiles.json'),
      rooted(new File(['bad'], '0_0.webp'), 'lao_tiles\\z0\\0_0.webp'),
    ])).toThrow(/unsafe|path/i);
  });
});

