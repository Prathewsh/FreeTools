import { vi } from 'vitest';
import { GifToolsComponent } from './gif-tools.component';
import { decodeGif } from './gif-decoder';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('GIF playback controls', () => {
  function studio() {
    const component = new GifToolsComponent();
    component.frames.set([0, 1, 2].map(id => ({ id, dataUrl: `frame${id}`, delay: 100 * (id + 1) })));
    const draw = vi.spyOn(component, 'drawFrame').mockImplementation(() => {});
    return { component, draw };
  }

  it('pauses on the displayed frame and resumes without resetting', () => {
    vi.useFakeTimers();
    const { component, draw } = studio();
    component.startPreview();
    vi.advanceTimersByTime(200);
    expect(component.currentFrameIndex()).toBe(1);
    component.stopPreview();
    vi.advanceTimersByTime(1000);
    expect(draw).toHaveBeenCalledTimes(2);
    component.startPreview();
    expect(draw).toHaveBeenLastCalledWith('frame1');
    component.ngOnDestroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses original frame delays and applies speed and reverse to frame order', () => {
    vi.useFakeTimers();
    const { component, draw } = studio();
    component.useOriginalTiming.set(true);
    component.speedMultiplier.set(2);
    component.reversePlayback.set(true);
    component.startPreview();
    vi.advanceTimersByTime(49);
    expect(draw).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(draw).toHaveBeenLastCalledWith('frame2');
    vi.advanceTimersByTime(150);
    expect(draw).toHaveBeenLastCalledWith('frame1');
    component.ngOnDestroy();
  });

  it('redraws sizing changes while paused and clears extracted results', () => {
    const { component, draw } = studio();
    component.resizePreview('width', 640);
    expect(component.gifWidth()).toBe(640);
    expect(draw).toHaveBeenLastCalledWith('frame0');
    component.extractedFrames.set(['old']);
    component.sheetDataUrl.set('old');
    component.clearFrames();
    expect(component.extractedFrames()).toEqual([]);
    expect(component.sheetDataUrl()).toBeNull();
    expect(component.frames()).toEqual([]);
  });

  it('reports blocked downloads instead of displaying an uncontrollable animation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const component = new GifToolsComponent();
    await component.loadGifFromSource('https://example.com/test.gif');
    expect(component.isProcessing()).toBe(false);
    expect(component.errorMsg()).toContain('upload');
    expect(component.loadedGifPreview()).toBeNull();
  });

  it('resolves a Giphy page slug to a direct GIF URL', async () => {
    const component = new GifToolsComponent();
    const load = vi.spyOn(component, 'loadGifFromSource').mockResolvedValue();
    component.giphyUrl.set('https://giphy.com/gifs/high-quality-highqualitygifs-g01ZnwAUvutuK8GIQn');
    await component.loadFromGiphyUrl();
    expect(load).toHaveBeenCalledWith('https://i.giphy.com/media/g01ZnwAUvutuK8GIQn/giphy.gif');
  });
});

describe('GIF frame decoding', () => {
  it('decodes both frames and their individual delays from a real GIF byte stream', async () => {
    const patches: number[][] = [];
    const context = {
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (image: ImageData) => patches.push(Array.from(image.data)),
      drawImage: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn()
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,frame');
    const header = [71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255];
    const frame = (delay: number, pixel: number) => [33,249,4,4,delay,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,pixel,1,0];
    const data = new Uint8Array([...header, ...frame(10, 68), ...frame(20, 76), 59]);
    const result = await decodeGif(data.buffer);
    expect(result.frames.map(frame => frame.delay)).toEqual([100, 200]);
    expect(patches).toEqual([[0, 0, 0, 255], [255, 255, 255, 255]]);
    expect(context.drawImage).toHaveBeenCalledTimes(2);
  });

  it('rejects HTML pages masquerading as GIFs', async () => {
    await expect(decodeGif(new TextEncoder().encode('<html>not a gif</html>').buffer)).rejects.toThrow('not a GIF');
  });
});
