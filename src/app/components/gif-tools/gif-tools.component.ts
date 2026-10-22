import { Component, signal, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { decodeGif } from './gif-decoder';

type GifSubtool = 'maker' | 'splitter' | 'spritesheet' | 'reverser';

interface FrameItem {
  id: number;
  dataUrl: string;
  delay: number;
}

@Component({
  selector: 'app-gif-tools',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gif-tools.component.html',
  styleUrl: './gif-tools.component.scss'
})
export class GifToolsComponent implements OnDestroy {
  private previewCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('previewCanvas') set previewCanvas(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.previewCanvasRef = ref;
    if (ref) this.refreshPreview();
  }
  private loadController: AbortController | null = null;
  private drawVersion = 0;
  private nextFrameId = 0;
  errorMsg = signal('');
  useOriginalTiming = signal(false);

  mode = signal<GifSubtool>('maker');

  // Input GIF / Giphy Link
  giphyUrl = signal<string>('');
  loadedGifPreview = signal<string | null>(null);

  // GIF Maker & Sequence
  frames = signal<FrameItem[]>([]);
  frameDelay = signal<number>(200); // ms
  gifWidth = signal<number>(400);
  gifHeight = signal<number>(400);
  isPlaying = signal<boolean>(false);
  currentFrameIndex = signal<number>(0);
  private playInterval: ReturnType<typeof setTimeout> | null = null;

  // Splitter / Extractor
  sourceGifUrl = signal<string | null>(null);
  extractedFrames = signal<string[]>([]);
  isProcessing = signal<boolean>(false);

  // Speed & Reverse
  speedMultiplier = signal<number>(1);
  reversePlayback = signal<boolean>(false);

  // Sprite Sheet Generator
  sheetColumns = signal<number>(5);
  sheetTileWidth = signal<number>(128);
  sheetTileHeight = signal<number>(128);
  sheetPadding = signal<number>(2);
  sheetGenerated = signal<boolean>(false);
  sheetDataUrl = signal<string | null>(null);

  async onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    if (files.some(file => file.type === 'image/gif' || /\.gif$/i.test(file.name))) {
      if (files.length === 1) await this.loadGifFile(files[0]);
      else this.errorMsg.set('Load full GIFs individually. Upload frame images accepts still images.');
      return;
    }
    this.errorMsg.set('');
    try {
      const newFrames = await Promise.all(files.map(file => new Promise<FrameItem>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ id: ++this.nextFrameId, dataUrl: reader.result as string, delay: this.frameDelay() });
        reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
        reader.readAsDataURL(file);
      })));
      this.frames.update(current => [...current, ...newFrames]);
      this.invalidateSheet();
      this.startPreview();
    } catch (error) { this.errorMsg.set(error instanceof Error ? error.message : 'Could not load images.'); }
  }

  async onSingleGifSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await this.loadGifFile(file);
  }

  private async loadGifFile(file: File) {
    const url = URL.createObjectURL(file);
    try { await this.loadGifFromSource(url); }
    finally { URL.revokeObjectURL(url); }
  }

  async loadFromGiphyUrl() {
    try {
      const source = new URL(this.giphyUrl().trim());
      if (!['http:', 'https:'].includes(source.protocol)) throw new Error();
      let url = source.href;
      if (/(^|\.)giphy\.com$/.test(source.hostname) && /^\/(gifs|clips)\//.test(source.pathname)) {
        const id = source.pathname.split('/').filter(Boolean).at(-1)?.split('-').at(-1);
        if (!id || !/^[a-zA-Z0-9]+$/.test(id)) throw new Error();
        url = `https://i.giphy.com/media/${id}/giphy.gif`;
      }
      await this.loadGifFromSource(url);
    } catch { this.errorMsg.set('Enter a valid Giphy page URL or direct http(s) GIF URL.'); }
  }

  async loadGifFromSource(url: string) {
    this.loadController?.abort();
    const controller = new AbortController();
    this.loadController = controller;
    this.isProcessing.set(true);
    this.errorMsg.set('');
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`GIF download failed (HTTP ${response.status}).`);
      const decoded = await decodeGif(await response.arrayBuffer(), controller.signal);
      if (this.loadController !== controller) return;
      this.stopPreview();
      this.frames.set(decoded.frames.map(frame => ({ ...frame, id: ++this.nextFrameId })));
      this.extractedFrames.set(decoded.frames.map(frame => frame.dataUrl));
      this.gifWidth.set(decoded.width);
      this.gifHeight.set(decoded.height);
      this.useOriginalTiming.set(true);
      this.currentFrameIndex.set(this.reversePlayback() ? decoded.frames.length - 1 : 0);
      this.sourceGifUrl.set(url);
      this.loadedGifPreview.set(null);
      this.invalidateSheet();
      this.startPreview();
    } catch (error) {
      if (this.loadController === controller) this.errorMsg.set(controller.signal.aborted
        ? 'GIF loading timed out. Try uploading the file instead.'
        : `${error instanceof Error ? error.message : 'Could not load GIF.'} If the host blocks access, download the GIF and upload it here.`);
    } finally {
      clearTimeout(timeout);
      if (this.loadController === controller) { this.loadController = null; this.isProcessing.set(false); }
    }
  }

  startPreview() {
    this.stopPreview();
    if (!this.frames().length) return;
    this.isPlaying.set(true);
    this.tick();
  }

  private tick() {
    if (!this.isPlaying() || !this.frames().length) return;
    const index = Math.min(this.currentFrameIndex(), this.frames().length - 1);
    this.currentFrameIndex.set(index);
    const frame = this.frames()[index];
    this.drawFrame(frame.dataUrl);
    const baseDelay = this.useOriginalTiming() ? frame.delay : this.frameDelay();
    const delay = Math.max(20, (Number(baseDelay) || 200) / (Number(this.speedMultiplier()) || 1));
    this.playInterval = setTimeout(() => {
      const count = this.frames().length;
      if (!count) return;
      this.currentFrameIndex.set((index + (this.reversePlayback() ? -1 : 1) + count) % count);
      this.tick();
    }, delay);
  }

  stopPreview() {
    this.isPlaying.set(false);
    if (this.playInterval !== null) clearTimeout(this.playInterval);
    this.playInterval = null;
  }

  refreshPreview() {
    const frame = this.frames()[Math.min(this.currentFrameIndex(), this.frames().length - 1)];
    if (frame) this.drawFrame(frame.dataUrl);
  }

  resizePreview(axis: 'width' | 'height', value: number) {
    const size = Math.min(2000, Math.max(1, Math.round(Number(value)) || 1));
    if (axis === 'width') this.gifWidth.set(size); else this.gifHeight.set(size);
    this.refreshPreview();
  }

  drawFrame(dataUrl: string) {
    if (!this.previewCanvasRef) return;
    const canvas = this.previewCanvasRef.nativeElement;
    const version = ++this.drawVersion;
    const img = new Image();
    img.onload = () => {
      if (version !== this.drawVersion || this.previewCanvasRef?.nativeElement !== canvas) return;
      canvas.width = this.gifWidth();
      canvas.height = this.gifHeight();
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
  }

  private invalidateSheet() { this.sheetDataUrl.set(null); this.sheetGenerated.set(false); }

  ngOnDestroy() {
    this.stopPreview();
    this.loadController?.abort();
    this.loadController = null;
    this.drawVersion++;
  }

  removeFrame(index: number) {
    this.frames.update(f => f.filter((_, i) => i !== index));
    this.currentFrameIndex.set(Math.max(0, Math.min(this.currentFrameIndex(), this.frames().length - 1)));
    this.invalidateSheet();
    if (!this.frames().length) this.clearFrames();
    else this.refreshPreview();
  }

  clearFrames() {
    this.stopPreview();
    this.loadController?.abort();
    this.loadController = null;
    this.isProcessing.set(false);
    this.drawVersion++;
    this.extractedFrames.set([]);
    this.sourceGifUrl.set(null);
    this.currentFrameIndex.set(0);
    this.invalidateSheet();
    const canvas = this.previewCanvasRef?.nativeElement;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    this.frames.set([]);
    this.loadedGifPreview.set(null);
  }

  moveFrame(index: number, direction: 'up' | 'down') {
    const list = [...this.frames()];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= list.length) return;
    const temp = list[index];
    list[index] = list[target];
    list[target] = temp;
    this.frames.set(list);
    this.invalidateSheet();
    this.refreshPreview();
  }

  // --- Sprite Sheet Generator ---
  generateSpriteSheet() {
    const frameList = this.reversePlayback() ? [...this.frames()].reverse() : this.frames();
    if (!frameList.length) {
      alert('Please add frames or load a GIF first to generate a sprite sheet.');
      return;
    }

    const cols = Math.max(1, this.sheetColumns());
    const rows = Math.ceil(frameList.length / cols);
    const tileW = this.sheetTileWidth();
    const tileH = this.sheetTileHeight();
    const pad = this.sheetPadding();

    const canvasW = cols * tileW + (cols - 1) * pad;
    const canvasH = rows * tileH + (rows - 1) * pad;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;

    let loaded = 0;
    const images: HTMLImageElement[] = [];

    frameList.forEach((frame, idx) => {
      const img = new Image();
      img.onload = () => {
        loaded++;
        if (loaded === frameList.length) {
          images.forEach((loadedImg, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = col * (tileW + pad);
            const y = row * (tileH + pad);
            ctx.drawImage(loadedImg, x, y, tileW, tileH);
          });
          const url = canvas.toDataURL('image/png');
          this.sheetDataUrl.set(url);
          this.sheetGenerated.set(true);
        }
      };
      img.src = frame.dataUrl;
      images.push(img);
    });
  }

  downloadSpriteSheet() {
    const url = this.sheetDataUrl();
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `spritesheet-${Date.now()}.png`;
    link.click();
  }

  downloadFrame(dataUrl: string, index: number) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `frame-${index + 1}.png`;
    link.click();
  }
}
