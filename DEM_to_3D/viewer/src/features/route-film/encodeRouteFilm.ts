import { FILM_DURATION, FILM_WIDTH, FILM_HEIGHT } from './filmGeometry';
import { paintFilmFrame, type FilmScene } from './filmPainter';
export async function encodeRouteFilm(scene: FilmScene, speed: number, signal: AbortSignal, onProgress: (progress: number) => void): Promise<Blob> {
    const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH, getFirstEncodableVideoCodec } = await import('mediabunny');
    const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: FILM_WIDTH, height: FILM_HEIGHT });
    if (!codec)
        throw new Error('Video encoding is unavailable in this browser');
    signal.throwIfAborted();
    const canvas = document.createElement('canvas');
    canvas.width = FILM_WIDTH;
    canvas.height = FILM_HEIGHT;
    const ctx = canvas.getContext('2d')!, output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() }), source = new CanvasSource(canvas, { codec, bitrate: QUALITY_HIGH, keyFrameInterval: 2 });
    output.addVideoTrack(source, { frameRate: 30 });
    try {
        await output.start();
        const frames = Math.ceil(FILM_DURATION / speed * 30);
        for (let i = 0; i < frames; i++) {
            signal.throwIfAborted();
            paintFilmFrame(ctx, scene, i / 30 * speed);
            await source.add(i / 30, 1 / 30);
            if (i % 8 === 0) {
                onProgress(i / frames);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        signal.throwIfAborted();
        await output.finalize();
        onProgress(1);
        return new Blob([(output.target as InstanceType<typeof BufferTarget>).buffer!], { type: 'video/mp4' });
    }
    catch (error) {
        await output.cancel();
        throw error;
    }
}
