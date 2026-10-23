import { imagerySource, internetImagerySource, noteInternetDetail } from '../map/imagerySource';
import { internetDetailAvailable, deferInternetDetail } from '../map/imageryDetail';
import { localMapSource } from '../map/localMapSource';
import { FILM_WIDTH as W, FILM_HEIGHT as H, type FilmView } from './filmGeometry';
const C = 2 * Math.PI * 6378137;
type Tile = {
    x: number;
    y: number;
    z: number;
};
function tiles(view: FilmView, maxZoom: number): Tile[] {
    let z = Math.max(0, Math.min(maxZoom, Math.ceil(Math.log2(C / (256 * view.metresPerPixel)))));
    const range = (z: number) => { const span = C / 2 ** z; return { left: Math.floor((view.cx - W / 2 * view.metresPerPixel + C / 2) / span), right: Math.floor((view.cx + W / 2 * view.metresPerPixel + C / 2) / span), top: Math.floor((C / 2 - view.cy - H / 2 * view.metresPerPixel) / span), bottom: Math.floor((C / 2 - view.cy + H / 2 * view.metresPerPixel) / span) }; };
    let r = range(z);
    while ((r.right - r.left + 1) * (r.bottom - r.top + 1) > 120 && z > 0)
        r = range(--z);
    const result: Tile[] = [];
    for (let x = r.left; x <= r.right; x++)
        for (let y = r.top; y <= r.bottom; y++)
            result.push({ x, y, z });
    return result;
}
/** Fetch a bounded frame, local first. Internet refinement never removes local pixels. */
export async function loadFilmBackground(view: FilmView, signal: AbortSignal, onBase: (canvas: HTMLCanvasElement, credit: string) => void): Promise<void> {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#263d33';
    ctx.fillRect(0, 0, W, H);
    async function layer(template: string, maxZoom: number, detail: boolean, target = ctx) {
        const queue = tiles(view, maxZoom);
        let loaded = 0, failed = false;
        async function worker() {
            while (queue.length && !signal.aborted && !(detail && failed)) {
                const tile = queue.shift()!, controller = new AbortController(), abort = () => controller.abort();
                signal.addEventListener('abort', abort, { once: true });
                const timeout = setTimeout(abort, detail ? 4500 : 15000);
                let bitmap: ImageBitmap | undefined;
                try {
                    const url = template.replaceAll('{z}', String(tile.z)).replaceAll('{x}', String(tile.x)).replaceAll('{y}', String(tile.y));
                    const response = await fetch(url, { signal: controller.signal });
                    if (!response.ok)
                        throw new Error('Tile unavailable');
                    bitmap = await createImageBitmap(await response.blob());
                    signal.throwIfAborted();
                    const span = C / 2 ** tile.z, x = W / 2 + (tile.x * span - C / 2 - view.cx) / view.metresPerPixel, y = H / 2 - (C / 2 - tile.y * span - view.cy) / view.metresPerPixel, size = span / view.metresPerPixel;
                    target.drawImage(bitmap, x, y, size + .25, size + .25);
                    loaded++;
                }
                catch {
                    // Moving the map cancels an obsolete frame, not the network.
                    // Do not defer refinement for the new view in that case.
                    if (signal.aborted) return;
                    failed = true;
                    if (detail)
                        deferInternetDetail();
                }
                finally {
                    bitmap?.close();
                    clearTimeout(timeout);
                    signal.removeEventListener('abort', abort);
                }
            }
        }
        await Promise.all(Array.from({ length: 6 }, worker));
        signal.throwIfAborted();
        return { loaded, failed };
    }
    const base = await layer(imagerySource.url, imagerySource.maxNativeZoom, false);
    if (base.failed || !base.loaded)
        throw new Error('Map imagery unavailable');
    await document.fonts.load("500 23px Roboto").catch(() => undefined);
    signal.throwIfAborted();
    onBase(canvas, imagerySource.credit);
    if (localMapSource() && internetDetailAvailable()) {
        // Publish refinement atomically. A failed company network must not leave
        // a patchwork of Internet imagery and the packaged context image.
        const refined = document.createElement('canvas');
        refined.width = W; refined.height = H;
        const target = refined.getContext('2d')!;
        target.drawImage(canvas, 0, 0);
        const detail = await layer(internetImagerySource.url, internetImagerySource.maxNativeZoom, true, target);
        if (detail.loaded && !detail.failed) {
            noteInternetDetail();
            onBase(refined, imagerySource.credit);
        }
    }
}
