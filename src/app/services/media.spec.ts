import { vi } from 'vitest';
import { AudioService } from './audio.service';
import { ImageService } from './image.service';
import { ImageStudioComponent } from '../components/image-studio/image-studio.component';
import { BatchConverterComponent } from '../components/batch-converter/batch-converter.component';
import { BatchService, BatchItem } from './batch.service';

const buffer = (values: number[]) => ({
  length: values.length, sampleRate: 10, numberOfChannels: 1,
  getChannelData: () => new Float32Array(values)
}) as unknown as AudioBuffer;

afterEach(() => vi.restoreAllMocks());

it('does not invent full-volume waveform peaks after a short clip', () => {
  const peaks = new AudioService().extractWaveformPeaks(buffer([0, 0]), 5);
  expect(Array.from(peaks)).toEqual([0, 0, 0, 0, 0]);
});

it('stopping playback detaches the callback that could restart a loop', () => {
  const source = { connect: vi.fn(), disconnect: vi.fn(), stop: vi.fn(), start: vi.fn(), playbackRate: { value: 1 }, onended: null as (() => void) | null };
  const gain = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
  const audio = new AudioService();
  vi.spyOn(audio, 'getAudioContext').mockReturnValue({ createBufferSource: () => source, createGain: () => gain, currentTime: 0 } as unknown as AudioContext);
  audio.playBuffer(buffer([1]), 0, 1, 1, 1, vi.fn());
  expect(source.onended).toBeTypeOf('function');
  audio.stopPlayback();
  expect(source.onended).toBeNull();
  expect(gain.disconnect).toHaveBeenCalled();
});

it('returns valid hex colors for bright pixels', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray([255, 255, 255, 255]) })
  } as unknown as CanvasRenderingContext2D);
  expect(new ImageService().extractColorPalette(document.createElement('canvas'))).toEqual(['#FFFFFF']);
});

it('preserves an incoming image instead of loading the default sample', () => {
  const studio = new ImageStudioComponent(new ImageService());
  const load = vi.spyOn(studio, 'loadImageFromUrl').mockResolvedValue();
  studio.incomingImage = 'data:image/png;base64,example';
  expect(load).toHaveBeenCalledOnce();
});

it('updates undo and redo availability after edits and history navigation', async () => {
  const images = new ImageService();
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,example');
  vi.spyOn(images, 'cropImage').mockReturnValue(canvas);
  const studio = new ImageStudioComponent(images);
  const internal = studio as unknown as { currentCanvas: HTMLCanvasElement; pushHistory(): void; restoreHistoryState(): Promise<void> };
  internal.currentCanvas = canvas;
  vi.spyOn(internal, 'restoreHistoryState').mockResolvedValue();
  expect(studio.canUndo()).toBe(false);
  internal.pushHistory();
  studio.applyCrop();
  expect(studio.canUndo()).toBe(true);
  await studio.undo();
  expect(studio.canUndo()).toBe(false);
  expect(studio.canRedo()).toBe(true);
  await studio.redo();
  expect(studio.canRedo()).toBe(false);
});

it('uses the encoded format for batch downloads after settings change', () => {
  const images = new ImageService();
  const component = new BatchConverterComponent(new BatchService(images), images);
  component.targetFormat.set('image/jpeg');
  let filename = '';
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });
  component.downloadItem({ name: 'photo.jpg', processedUrl: 'blob:example', processedBlob: new Blob([], { type: 'image/png' }) } as BatchItem);
  expect(filename).toBe('photo_converted.png');
});
