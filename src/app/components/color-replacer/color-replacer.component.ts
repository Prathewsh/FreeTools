import {
  Component,
  ElementRef,
  ViewChild,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ColorMatch {
  r: number;
  g: number;
  b: number;
  a: number;
}

@Component({
  selector: 'app-color-replacer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './color-replacer.component.html',
  styleUrl: './color-replacer.component.scss'
})
export class ColorReplacerComponent {
  @ViewChild('sourceCanvas', { static: false }) sourceCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('outputCanvas', { static: false }) outputCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false }) fileInputRef!: ElementRef<HTMLInputElement>;

  hasImage = signal(false);
  isProcessing = signal(false);
  imageDimensions = signal<{ width: number; height: number }>({ width: 0, height: 0 });
  originalFileSize = signal('0 KB');

  // Source color (to replace)
  sourceColor = signal('#ff0000');
  sourceColorRgb = computed(() => this.hexToRgb(this.sourceColor()));

  // Replacement color
  targetColor = signal('#0000ff');
  targetColorRgb = computed(() => this.hexToRgb(this.targetColor()));

  // Match tolerance (0-100%)
  tolerance = signal(10);

  // Preserve color shades (lightness)
  preserveShades = signal(false);

  // Edge smoothing
  edgeSmoothing = signal(0);

  // Preview mask mode
  showMask = signal(false);

  // Pick-from-image mode
  pickMode = signal<'source' | 'target' | null>(null);

  // Stats
  matchedPixels = signal(0);
  totalPixels = signal(0);
  matchPercentage = computed(() => {
    const total = this.totalPixels();
    if (total === 0) return '0';
    return ((this.matchedPixels() / total) * 100).toFixed(1);
  });

  private originalImageData: ImageData | null = null;
  private sourceImage: HTMLImageElement | null = null;

  onDropFile(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) this.loadFile(file);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.loadFile(input.files[0]);
    }
  }

  async loadFile(file: File) {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    this.originalFileSize.set(`${(file.size / 1024).toFixed(1)} KB`);
    const url = await this.fileToDataUrl(file);
    await this.loadImageFromUrl(url);
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async loadImageFromUrl(url: string) {
    this.isProcessing.set(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });

      this.sourceImage = img;
      this.imageDimensions.set({ width: img.width, height: img.height });
      this.totalPixels.set(img.width * img.height);
      this.hasImage.set(true);

      // Draw original to source canvas and store data
      setTimeout(() => {
        this.drawSourceCanvas();
        this.applyReplacement();
      }, 50);
    } catch {
      alert('Could not load image.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  private drawSourceCanvas() {
    if (!this.sourceCanvasRef || !this.sourceImage) return;
    const canvas = this.sourceCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    canvas.width = this.sourceImage.width;
    canvas.height = this.sourceImage.height;
    ctx.drawImage(this.sourceImage, 0, 0);
    this.originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  onCanvasClick(event: MouseEvent) {
    if (!this.pickMode() || !this.sourceCanvasRef || !this.originalImageData) return;

    const canvas = this.sourceCanvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((event.clientX - rect.left) * scaleX);
    const y = Math.floor((event.clientY - rect.top) * scaleY);

    const idx = (y * canvas.width + x) * 4;
    const r = this.originalImageData.data[idx];
    const g = this.originalImageData.data[idx + 1];
    const b = this.originalImageData.data[idx + 2];

    const hex = this.rgbToHex(r, g, b);

    if (this.pickMode() === 'source') {
      this.sourceColor.set(hex);
    } else {
      this.targetColor.set(hex);
    }
    this.pickMode.set(null);
    this.applyReplacement();
  }

  applyReplacement() {
    if (!this.originalImageData || !this.outputCanvasRef) return;

    const canvas = this.outputCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    canvas.width = this.originalImageData.width;
    canvas.height = this.originalImageData.height;

    const src = this.originalImageData;
    const output = ctx.createImageData(src.width, src.height);
    const data = src.data;
    const out = output.data;

    const srcRgb = this.sourceColorRgb();
    const tgtRgb = this.targetColorRgb();
    const tol = this.tolerance() / 100;
    const preserveShades = this.preserveShades();
    const showMask = this.showMask();
    const edgeSmooth = this.edgeSmoothing();

    let matched = 0;

    // Convert target to HSL for shade preservation
    const tgtHsl = this.rgbToHsl(tgtRgb.r, tgtRgb.g, tgtRgb.b);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      const dist = this.colorDistance(r, g, b, srcRgb.r, srcRgb.g, srcRgb.b);

      if (dist <= tol) {
        matched++;

        if (showMask) {
          // Show matched pixels as white, others as dark
          out[i] = 255;
          out[i + 1] = 255;
          out[i + 2] = 255;
          out[i + 3] = a;
        } else if (preserveShades) {
          // Keep the lightness of original pixel
          const origHsl = this.rgbToHsl(r, g, b);
          const newRgb = this.hslToRgb(tgtHsl.h, tgtHsl.s, origHsl.l);

          if (edgeSmooth > 0 && dist > tol * (1 - edgeSmooth / 100)) {
            const blend = (dist - tol * (1 - edgeSmooth / 100)) / (tol * edgeSmooth / 100);
            out[i] = Math.round(newRgb.r * (1 - blend) + r * blend);
            out[i + 1] = Math.round(newRgb.g * (1 - blend) + g * blend);
            out[i + 2] = Math.round(newRgb.b * (1 - blend) + b * blend);
          } else {
            out[i] = newRgb.r;
            out[i + 1] = newRgb.g;
            out[i + 2] = newRgb.b;
          }
          out[i + 3] = a;
        } else {
          if (edgeSmooth > 0 && dist > tol * (1 - edgeSmooth / 100)) {
            const blend = (dist - tol * (1 - edgeSmooth / 100)) / (tol * edgeSmooth / 100);
            out[i] = Math.round(tgtRgb.r * (1 - blend) + r * blend);
            out[i + 1] = Math.round(tgtRgb.g * (1 - blend) + g * blend);
            out[i + 2] = Math.round(tgtRgb.b * (1 - blend) + b * blend);
          } else {
            out[i] = tgtRgb.r;
            out[i + 1] = tgtRgb.g;
            out[i + 2] = tgtRgb.b;
          }
          out[i + 3] = a;
        }
      } else {
        if (showMask) {
          out[i] = Math.round(r * 0.2);
          out[i + 1] = Math.round(g * 0.2);
          out[i + 2] = Math.round(b * 0.2);
          out[i + 3] = a;
        } else {
          out[i] = r;
          out[i + 1] = g;
          out[i + 2] = b;
          out[i + 3] = a;
        }
      }
    }

    ctx.putImageData(output, 0, 0);
    this.matchedPixels.set(matched);
  }

  private colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
    const dr = (r1 - r2) / 255;
    const dg = (g1 - g2) / 255;
    const db = (b1 - b2) / 255;
    return Math.sqrt((dr * dr + dg * dg + db * db) / 3);
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 0, g: 0, b: 0 };
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h, s, l };
  }

  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    let r: number, g: number, b: number;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  setSourceColor(value: string) {
    this.sourceColor.set(value);
    this.applyReplacement();
  }

  setTargetColor(value: string) {
    this.targetColor.set(value);
    this.applyReplacement();
  }

  setTolerance(value: number) {
    this.tolerance.set(Math.max(0, Math.min(100, value)));
    this.applyReplacement();
  }

  togglePreserveShades() {
    this.preserveShades.update(v => !v);
    this.applyReplacement();
  }

  setEdgeSmoothing(value: number) {
    this.edgeSmoothing.set(Math.max(0, Math.min(100, value)));
    this.applyReplacement();
  }

  toggleMask() {
    this.showMask.update(v => !v);
    this.applyReplacement();
  }

  startPick(mode: 'source' | 'target') {
    this.pickMode.set(mode);
  }

  async downloadResult() {
    if (!this.outputCanvasRef) return;
    const canvas = this.outputCanvasRef.nativeElement;
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(b => resolve(b!), 'image/png');
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `color-replaced-${Date.now()}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async copyResult() {
    if (!this.outputCanvasRef) return;
    try {
      const canvas = this.outputCanvasRef.nativeElement;
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(b => resolve(b!), 'image/png');
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      alert('Image copied to clipboard!');
    } catch {
      alert('Clipboard copy is not available in this context.');
    }
  }
}

