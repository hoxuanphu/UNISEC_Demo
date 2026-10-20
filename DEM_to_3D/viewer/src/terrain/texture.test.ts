// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { fromBlob } from 'geotiff';
import { decodeTextureFile } from './texture';

vi.mock('geotiff', () => ({ fromBlob: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture(values: Uint8Array | Uint16Array, fields: Record<string, unknown>) {
  const data = new Uint8ClampedArray(4);
  const readRGB = vi.fn(async () => values);
  vi.mocked(fromBlob).mockResolvedValue({ getImage: async () => ({
    getWidth: () => 1, getHeight: () => 1, readRGB,
    getFileDirectory: () => ({ getValue: (key: string) => fields[key] }),
  }) } as any);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createImageData: () => ({ data }), putImageData: vi.fn(),
  } as any);
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1, height: 1 })));
  return { data, readRGB };
}

it('scales native 16-bit RGB samples instead of clipping them to white', async () => {
  const { data, readRGB } = fixture(new Uint16Array([65535, 32768, 0]), { PhotometricInterpretation: 2, BitsPerSample: [16, 16, 16] });
  const decoded = await decodeTextureFile(new File([''], 'terrain.tif'));
  expect(Array.from(data)).toEqual([255, 128, 0, 255]);
  expect(readRGB).toHaveBeenCalledWith({ interleave: true, enableAlpha: false });
  expect(decoded.texture.flipY).toBe(false);
  decoded.texture.dispose();
});

it('requests alpha and converts associated samples to unassociated canvas colors', async () => {
  const { data, readRGB } = fixture(new Uint8Array([64, 32, 0, 128]), {
    PhotometricInterpretation: 2, BitsPerSample: [8, 8, 8, 8], ExtraSamples: [1],
  });
  const decoded = await decodeTextureFile(new File([''], 'terrain.tiff'));
  expect(Array.from(data)).toEqual([128, 64, 0, 128]);
  expect(readRGB).toHaveBeenCalledWith({ interleave: true, enableAlpha: true });
  decoded.texture.dispose();
});

it('preserves unassociated alpha and 8-bit RGB values', async () => {
  const { data } = fixture(new Uint8Array([100, 50, 25, 0]), {
    PhotometricInterpretation: 2, BitsPerSample: [8], ExtraSamples: [2],
  });
  const decoded = await decodeTextureFile(new File([''], 'terrain.tif'));
  expect(Array.from(data)).toEqual([100, 50, 25, 0]);
  decoded.texture.dispose();
});

it('does not rescale palette/grayscale output already converted to RGB bytes', async () => {
  const { data } = fixture(new Uint8Array([128, 128, 128]), { PhotometricInterpretation: 1, BitsPerSample: [16] });
  const decoded = await decodeTextureFile(new File([''], 'terrain.tif'));
  expect(Array.from(data)).toEqual([128, 128, 128, 255]);
  decoded.texture.dispose();
});

it('rejects RGB float/signed samples rather than silently clipping their values', async () => {
  for (const format of [2, 3]) {
    const { readRGB } = fixture(new Uint8Array([1, 2, 3]), { PhotometricInterpretation: 2, BitsPerSample: [32], SampleFormat: [format] });
    await expect(decodeTextureFile(new File([''], 'terrain.tif'))).rejects.toThrow('unsigned integer');
    expect(readRGB).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  }
});
