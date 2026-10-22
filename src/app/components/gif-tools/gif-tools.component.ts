import { Component, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
export class GifToolsComponent {
  @ViewChild('previewCanvas') previewCanvasRef!: ElementRef<HTMLCanvasElement>;

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
  private playInterval: any = null;

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

  // Multi-frame file selection
  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files.length) return;

    const files = Array.from(input.files);
    let loaded = 0;
    const newFrames: FrameItem[] = [];

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newFrames.push({
          id: Date.now() + index,
          dataUrl: e.target?.result as string,
          delay: this.frameDelay()
        });
        loaded++;
        if (loaded === files.length) {
          this.frames.update(current => [...current, ...newFrames]);
          if (!this.isPlaying()) this.startPreview();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Upload a standalone .gif file to parse & load into animation studio
  onSingleGifSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        this.loadGifFromSource(url);
      };
      reader.readAsDataURL(file);
    }
  }

  // Load GIF from direct URL (e.g., Giphy: media.giphy.com/media/.../giphy.gif)
  async loadFromGiphyUrl() {
    let url = this.giphyUrl().trim();
    if (!url) {
      alert('Please enter a valid GIF URL (e.g. from Giphy).');
      return;
    }

    // Auto-resolve common Giphy page URLs to direct image URLs
    // e.g., https://giphy.com/gifs/funny-cat-3o7btPCcdNniyf0ArS -> https://i.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif
    const giphyIdMatch = url.match(/giphy\.com\/(?:gifs|clips)\/(?:[\w-]+-)?([a-zA-Z0-9]+)/);
    if (giphyIdMatch && giphyIdMatch[1]) {
      url = `https://i.giphy.com/media/${giphyIdMatch[1]}/giphy.gif`;
    }

    this.loadGifFromSource(url);
  }

  loadGifFromSource(url: string) {
    this.isProcessing.set(true);
    this.sourceGifUrl.set(url);
    this.loadedGifPreview.set(url);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.gifWidth.set(img.width || 400);
      this.gifHeight.set(img.height || 400);

      // Create snapshot frames to initialize sequence
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 400;
      canvas.height = img.height || 400;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const frameUrl = canvas.toDataURL('image/png');
      this.extractedFrames.set([frameUrl]);

      // If no frames yet in studio, add the base frame
      if (this.frames().length === 0) {
        this.frames.set([
          { id: Date.now(), dataUrl: frameUrl, delay: this.frameDelay() }
        ]);
        this.startPreview();
      }

      this.isProcessing.set(false);
    };

    img.onerror = () => {
      // Direct load fallback
      this.extractedFrames.set([url]);
      this.isProcessing.set(false);
    };

    img.src = url;
  }

  startPreview() {
    if (this.playInterval) clearInterval(this.playInterval);
    if (!this.frames().length) return;

    this.isPlaying.set(true);
    let idx = 0;

    const loop = () => {
      const framesList = this.reversePlayback() ? [...this.frames()].reverse() : this.frames();
      if (!framesList.length) return;

      const f = framesList[idx % framesList.length];
      this.currentFrameIndex.set(idx % framesList.length);
      this.drawFrame(f.dataUrl);

      idx++;
      const currentDelay = Math.max(20, Math.round(this.frameDelay() / this.speedMultiplier()));
      this.playInterval = setTimeout(loop, currentDelay);
    };

    loop();
  }

  stopPreview() {
    this.isPlaying.set(false);
    if (this.playInterval) clearTimeout(this.playInterval);
  }

  drawFrame(dataUrl: string) {
    if (!this.previewCanvasRef) return;
    const canvas = this.previewCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      canvas.width = this.gifWidth();
      canvas.height = this.gifHeight();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
  }

  removeFrame(index: number) {
    this.frames.update(f => f.filter((_, i) => i !== index));
    if (!this.frames().length) this.stopPreview();
  }

  clearFrames() {
    this.stopPreview();
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
