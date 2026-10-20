// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ImageLayersPanel } from './ImageLayersPanel';
import { readSarRaster, type SarRaster } from '../terrain/sarOverlay';
import type { ImageControl, ImageLayer } from '../terrain/imageLayers';

vi.mock('../terrain/sarOverlay', async (original) => ({ ...await original<typeof import('../terrain/sarOverlay')>(), readSarRaster: vi.fn() }));
let container: HTMLDivElement;
let root: Root;
const sample = (name: string, gray = false): SarRaster => ({
  name, width: 2, height: 2, photometric: gray ? 1 : 2, bbox: [10, 20, 12, 22],
  bands: [0, 1, 2].map((index) => ({ index, label: `Band ${index + 1}` })), readBand: async () => [1, 2, 3, 4],
});
function Harness() {
  const [layers, setLayers] = useState<ImageLayer[]>([]);
  const [controls, setControls] = useState<Record<string, ImageControl>>({});
  return <ImageLayersPanel layers={layers} onLayers={setLayers} controls={controls} onControl={(id, control) => setControls((current) => ({ ...current, [id]: control }))} errors={{}} />;
}
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(readSarRaster).mockImplementation(async (file) => sample(file.name));
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); });
const input = () => container.querySelector<HTMLInputElement>('input[type=file]')!;
async function select(...names: string[]) {
  await act(async () => {
    Object.defineProperty(input(), 'files', { configurable: true, value: names.map((name) => new File([''], name)) });
    input().dispatchEvent(new Event('change', { bubbles: true }));
  });
}
const rows = () => Array.from(container.querySelectorAll('fieldset'));
async function click(text: string, within: ParentNode = container) {
  const button = Array.from(within.querySelectorAll('button')).find((node) => node.textContent === text)!;
  await act(async () => button.click());
}

it('selects multiple RGB files, appends later batches in order and enforces four total', async () => {
  expect(input().multiple).toBe(true);
  await select('first.tif', 'second.tif');
  await select('third.tif');
  expect(rows().map((row) => row.querySelector('legend')?.textContent)).toEqual(['1. first.tif', '2. second.tif', '3. third.tif']);
  await select('fourth.tif', 'fifth.tif');
  expect(container.querySelector('[role=alert]')?.textContent).toContain('Tối đa 4');
  expect(readSarRaster).toHaveBeenCalledTimes(3);
  expect(rows()).toHaveLength(3);
  await select('fourth.tif');
  expect(rows()).toHaveLength(4); expect(input().disabled).toBe(true);
  await click('Xóa ảnh', rows()[1]);
  expect(rows()).toHaveLength(3); expect(input().disabled).toBe(false);
});

it('toggles each image independently and removes one without removing the others', async () => {
  await select('first.tif', 'second.tif');
  const first = rows()[0].querySelector<HTMLInputElement>('input[type=checkbox]')!;
  await act(async () => first.click());
  expect(first.checked).toBe(false);
  expect(rows()[1].querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(true);
  const opacity = rows()[0].querySelector<HTMLInputElement>('input[type=range]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(opacity, '0.4');
    opacity.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(rows()[0].textContent).toContain('40%');
  expect(rows()[1].querySelector<HTMLInputElement>('input[type=range]')!.value).toBe('1');
  await click('Xóa ảnh', rows()[0]);
  expect(rows()).toHaveLength(1);
  expect(rows()[0].textContent).toContain('second.tif');
  await click('Xóa tất cả ảnh'); expect(rows()).toHaveLength(0);
});

it('retains existing layers and valid files when a file in a batch fails', async () => {
  await select('existing.tif');
  vi.mocked(readSarRaster).mockImplementation(async (file) => { if (file.name === 'bad.tif') throw new Error('Invalid CRS'); return sample(file.name); });
  await select('bad.tif', 'valid.tif');
  expect(rows()).toHaveLength(2);
  expect(container.querySelector('[role=alert]')?.textContent).toContain('bad.tif: Invalid CRS');
  expect(rows()[0].textContent).toContain('existing.tif');
});

it('cancels a pending batch when cleared and skips remaining files', async () => {
  let finish!: (value: SarRaster) => void;
  vi.mocked(readSarRaster).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  await select('slow.tif', 'queued.tif');
  expect(input().disabled).toBe(true);
  expect(container.textContent).toContain('Đang đọc');
  await click('Xóa tất cả ảnh');
  await act(async () => finish(sample('slow.tif')));
  expect(rows()).toHaveLength(0);
  expect(readSarRaster).toHaveBeenCalledTimes(1);
  expect(input().disabled).toBe(false);
});

it('keeps grayscale band controls while RGB layers have no band selector', async () => {
  vi.mocked(readSarRaster).mockImplementation(async (file) => sample(file.name, file.name === 'gray.tif'));
  await select('rgb.tif', 'gray.tif');
  expect(rows()[0].querySelector('select')).toBeNull();
  const bandSelect = rows()[1].querySelector('select')!;
  await act(async () => { bandSelect.value = '1'; bandSelect.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(rows()[1].querySelector('select')!.value).toBe('1');
});
