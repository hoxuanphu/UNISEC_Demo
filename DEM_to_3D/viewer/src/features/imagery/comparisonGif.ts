import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { contextBasemapTone, tonedChannel } from './basemapTone';

export type GifFrame = { pane: string; title: string; date: string };

/** What the comparison map shows now, as a looping two-frame GIF for slides.
 * Each frame is the same view: toned basemap, one original Planet scene, the mapped extents,
 * the frame's date and the credits. Planet pixels are drawn unchanged. */
export async function comparisonGif({ container, frames, credit, delayMs, toneBasemap, maxWidth = 1600 }: {
  container: HTMLElement;
  frames: GifFrame[];
  credit: string;
  delayMs: number;
  toneBasemap: boolean;
  maxWidth?: number;
}): Promise<Blob> {
  const box = container.getBoundingClientRect();
  const scale = Math.min(2, maxWidth / box.width);
  const width = Math.round(box.width * scale), height = Math.round(box.height * scale);
  const draw = (ctx: CanvasRenderingContext2D, images: Iterable<HTMLImageElement>) => {
    for (const image of images) {
      if (!image.complete || !image.naturalWidth) continue;
      const r = image.getBoundingClientRect();
      ctx.drawImage(image, (r.left - box.left) * scale, (r.top - box.top) * scale, r.width * scale, r.height * scale);
    }
  };
  // Basemap once, toned like the live view.
  const base = canvas(width, height);
  draw(base, container.querySelectorAll<HTMLImageElement>('.leaflet-tile-pane img.leaflet-tile'));
  if (toneBasemap) {
    const pixels = base.getImageData(0, 0, width, height), lut = contextBasemapTone().map(gamma => Array.from({ length: 256 }, (_, v) => tonedChannel(v, gamma)));
    for (let i = 0; i < pixels.data.length; i += 4) for (let c = 0; c < 3; c++) pixels.data[i + c] = lut[c][pixels.data[i + c]];
    base.putImageData(pixels, 0, 0);
  }
  const vectors = await svgImage(container.querySelector<SVGSVGElement>('.leaflet-comparison-extents-pane svg'));
  const gif = GIFEncoder();
  for (const frame of frames) {
    const ctx = canvas(width, height);
    ctx.drawImage(base.canvas, 0, 0);
    draw(ctx, container.querySelectorAll<HTMLImageElement>(`.leaflet-${frame.pane}-pane img`));
    if (vectors) ctx.drawImage(vectors.image, (vectors.rect.left - box.left) * scale, (vectors.rect.top - box.top) * scale, vectors.rect.width * scale, vectors.rect.height * scale);
    label(ctx, frame, credit, scale);
    const rgba = ctx.getImageData(0, 0, width, height).data;
    const palette = quantize(rgba, 256);
    gif.writeFrame(applyPalette(rgba, palette), width, height, { palette, delay: delayMs, repeat: 0 });
    await new Promise(resolve => setTimeout(resolve));
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

function canvas(width: number, height: number): CanvasRenderingContext2D {
  const node = document.createElement('canvas'); node.width = width; node.height = height;
  const ctx = node.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#20232c'; ctx.fillRect(0, 0, width, height);
  return ctx;
}

async function svgImage(svg: SVGSVGElement | null): Promise<{ image: HTMLImageElement; rect: DOMRect } | null> {
  if (!svg) return null;
  const rect = svg.getBoundingClientRect(), copy = svg.cloneNode(true) as SVGSVGElement;
  copy.removeAttribute('style'); copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }));
  try {
    const image = new Image(); image.src = url; await image.decode();
    return { image, rect };
  } finally { URL.revokeObjectURL(url); }
}

/** Frame name and date top left, credits bottom right: readable on any imagery. */
function label(ctx: CanvasRenderingContext2D, frame: GifFrame, credit: string, scale: number) {
  const pad = 12 * scale, font = (size: number, weight: number) => `${weight} ${size * scale}px "Source Sans 3", "Segoe UI", sans-serif`;
  ctx.font = font(18, 700); const titleWidth = ctx.measureText(frame.title).width;
  ctx.font = font(16, 400); const dateWidth = ctx.measureText(frame.date).width;
  const boxHeight = 34 * scale;
  ctx.fillStyle = 'rgba(20, 22, 26, 0.72)';
  roundRect(ctx, pad, pad, titleWidth + dateWidth + 30 * scale, boxHeight, 6 * scale); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle';
  ctx.font = font(18, 700); ctx.fillText(frame.title, pad + 10 * scale, pad + boxHeight / 2);
  ctx.font = font(16, 400); ctx.fillText(frame.date, pad + 20 * scale + titleWidth, pad + boxHeight / 2);
  ctx.font = font(11, 400); const creditWidth = ctx.measureText(credit).width;
  ctx.fillStyle = 'rgba(20, 22, 26, 0.6)';
  ctx.fillRect(ctx.canvas.width - creditWidth - 16 * scale, ctx.canvas.height - 20 * scale, creditWidth + 16 * scale, 20 * scale);
  ctx.fillStyle = '#e8eaed'; ctx.fillText(credit, ctx.canvas.width - creditWidth - 8 * scale, ctx.canvas.height - 10 * scale);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
