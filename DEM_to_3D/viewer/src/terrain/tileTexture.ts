export type TileCacheEntry = { key: string; bitmap: ImageBitmap; byteEstimate: number; lastUsed: number };
export type TileLoader = (url: string, signal: AbortSignal) => Promise<ImageBitmap>;
const defaultLoader: TileLoader = async (url, signal) => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error('Tile request failed: ' + response.status);
      return await createImageBitmap(await response.blob());
    } catch (error) {
      lastError = error;
      if (signal.aborted || attempt === 2) throw error;
    }
  }
  throw lastError;
};

export class TileTextureCache {
  private entries = new Map<string, TileCacheEntry>();
  private inflight = new Map<string, Promise<ImageBitmap>>();
  private totalBytes = 0;
  constructor(private readonly loader: TileLoader = defaultLoader, private readonly now: () => number = () => Date.now()) {}
  get(key: string): ImageBitmap | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    entry.lastUsed = this.now();
    return entry.bitmap;
  }
  async load(key: string, url: string, signal?: AbortSignal): Promise<ImageBitmap> {
    const cached = this.get(key);
    if (cached) return cached;
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const requestSignal = signal ?? new AbortController().signal;
    const request = this.loader(url, requestSignal).then((bitmap) => {
      if (requestSignal.aborted) {
        bitmap.close();
        throw new DOMException('Cancelled', 'AbortError');
      }
      const previous = this.entries.get(key);
      if (previous) {
        this.totalBytes -= previous.byteEstimate;
        previous.bitmap.close();
      }
      const entry = { key, bitmap, byteEstimate: bitmap.width * bitmap.height * 4, lastUsed: this.now() };
      this.entries.set(key, entry);
      this.totalBytes += entry.byteEstimate;
      return bitmap;
    }).finally(() => this.inflight.delete(key));
    this.inflight.set(key, request);
    return request;
  }
  evictToBudget(maxBytes: number): void {
    while (this.totalBytes > maxBytes && this.entries.size) {
      const victim = [...this.entries.values()].sort((a, b) => a.lastUsed - b.lastUsed)[0];
      this.entries.delete(victim.key);
      this.totalBytes -= victim.byteEstimate;
      victim.bitmap.close();
    }
  }
  get byteEstimate(): number { return this.totalBytes; }
  get loadedCount(): number { return this.entries.size; }
  dispose(): void {
    for (const entry of this.entries.values()) entry.bitmap.close();
    this.entries.clear();
    this.inflight.clear();
    this.totalBytes = 0;
  }
}

type QueueItem = { sourceId: string; run: (signal: AbortSignal) => Promise<void>; resolve: () => void; reject: (reason: unknown) => void };
export class TileRequestQueue {
  private active = 0;
  private pending: QueueItem[] = [];
  private controllers = new Map<string, AbortController>();
  private activeBySource = new Map<string, number>();
  constructor(private readonly limit = 6) {}
  enqueue<T>(sourceId: string, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const item: QueueItem = {
        sourceId,
        resolve: () => undefined,
        reject,
        run: async (signal) => { resolve(await operation(signal)); },
      };
      this.pending.push(item);
      this.pump();
    });
  }
  cancel(sourceId: string): void {
    this.controllers.get(sourceId)?.abort();
    this.controllers.delete(sourceId);
    this.activeBySource.delete(sourceId);
    const cancelled = this.pending.filter((item) => item.sourceId === sourceId);
    this.pending = this.pending.filter((item) => item.sourceId !== sourceId);
    cancelled.forEach((item) => item.reject(new DOMException('Cancelled', 'AbortError')));
  }
  get activeCount(): number { return this.active; }
  get queuedCount(): number { return this.pending.length; }
  private pump(): void {
    while (this.active < this.limit && this.pending.length) {
      const item = this.pending.shift()!;
      const controller = this.controllers.get(item.sourceId) ?? new AbortController();
      this.controllers.set(item.sourceId, controller);
      this.activeBySource.set(item.sourceId, (this.activeBySource.get(item.sourceId) ?? 0) + 1);
      this.active += 1;
      item.run(controller.signal).catch(item.reject).finally(() => {
        this.active -= 1;
        const remaining = (this.activeBySource.get(item.sourceId) ?? 1) - 1;
        if (remaining <= 0) { this.activeBySource.delete(item.sourceId); this.controllers.delete(item.sourceId); } else this.activeBySource.set(item.sourceId, remaining);
        this.pump();
      });
    }
  }
}

