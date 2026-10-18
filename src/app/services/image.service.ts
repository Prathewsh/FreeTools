import { Injectable } from '@angular/core';

export interface ImageFilters {
  brightness: number; // -100 to 100 (0 default)
  contrast: number;   // -100 to 100 (0 default)
  saturation: number; // -100 to 100 (0 default)
  hueRotate: number;  // 0 to 360 (0 default)
  blur: number;       // 0 to 30 (0 default)
  sepia: number;      // 0 to 100 (0 default)
  grayscale: number;  // 0 to 100 (0 default)
  invert: number;     // 0 to 100 (0 default)
  exposure: number;   // -100 to 100 (0 default)
  sharpen: number;    // 0 to 100 (0 default)
}

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  position: 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'tile';
  bold: boolean;
}

export interface ImageExportOptions {
  format: 'image/png' | 'image/jpeg' | 'image/webp';
  quality: number; // 0.1 to 1.0
  width?: number;
  height?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  constructor() {}

  createImageFromSource(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }

  async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  cropImage(
    sourceImg: HTMLImageElement | HTMLCanvasElement,
    cropX: number,
    cropY: number,
    cropWidth: number,
    cropHeight: number,
    circular: boolean = false
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(cropWidth));
    canvas.height = Math.max(1, Math.round(cropHeight));
    const ctx = canvas.getContext('2d')!;

    if (circular) {
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2, 0, Math.PI * 2);
      ctx.clip();
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceImg, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  resizeImage(
    source: HTMLImageElement | HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(targetWidth));
    canvas.height = Math.max(1, Math.round(targetHeight));
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  rotateAndFlipImage(
    source: HTMLImageElement | HTMLCanvasElement,
    angleDegrees: number,
    flipH: boolean,
    flipV: boolean
  ): HTMLCanvasElement {
    const rad = (angleDegrees * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));

    const origW = source.width;
    const origH = source.height;

    const newW = Math.round(origW * cos + origH * sin);
    const newH = Math.round(origW * sin + origH * cos);

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, newW);
    canvas.height = Math.max(1, newH);
    const ctx = canvas.getContext('2d')!;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(source, -origW / 2, -origH / 2);

    return canvas;
  }

  applyFiltersAndAdjustments(
    source: HTMLImageElement | HTMLCanvasElement,
    filters: ImageFilters,
    watermark?: WatermarkConfig
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d')!;

    // Build CSS filter string for standard adjustments
    const b = 100 + filters.brightness;
    const c = 100 + filters.contrast;
    const s = 100 + filters.saturation;
    const h = filters.hueRotate;
    const bl = filters.blur;
    const sep = filters.sepia;
    const gray = filters.grayscale;
    const inv = filters.invert;

    ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) hue-rotate(${h}deg) blur(${bl}px) sepia(${sep}%) grayscale(${gray}%) invert(${inv}%)`;
    ctx.drawImage(source, 0, 0);
    ctx.filter = 'none';

    // Apply exposure / sharpen if configured
    if (filters.exposure !== 0 || filters.sharpen > 0) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Exposure adjustment
      if (filters.exposure !== 0) {
        const factor = Math.pow(2, filters.exposure / 50);
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, Math.max(0, data[i] * factor));
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor));
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor));
        }
      }

      // Sharpen convolution (3x3 kernel)
      if (filters.sharpen > 0) {
        const strength = filters.sharpen / 100;
        const copy = new Uint8ClampedArray(data);
        const w = canvas.width;
        const h = canvas.height;

        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            for (let c = 0; c < 3; c++) {
              const current = copy[idx + c];
              const up = copy[((y - 1) * w + x) * 4 + c];
              const down = copy[((y + 1) * w + x) * 4 + c];
              const left = copy[(y * w + (x - 1)) * 4 + c];
              const right = copy[(y * w + (x + 1)) * 4 + c];

              const sharpVal = current * (1 + 4 * strength) - (up + down + left + right) * strength;
              data[idx + c] = Math.min(255, Math.max(0, sharpVal));
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
    }

    // Watermark overlay
    if (watermark && watermark.enabled && watermark.text.trim()) {
      ctx.save();
      ctx.font = `${watermark.bold ? 'bold ' : ''}${watermark.fontSize}px 'Outfit', sans-serif`;
      ctx.fillStyle = watermark.color;
      ctx.globalAlpha = watermark.opacity;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 6;

      const padding = 24;
      const metrics = ctx.measureText(watermark.text);
      const textW = metrics.width;
      const textH = watermark.fontSize;

      if (watermark.position === 'center') {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(watermark.text, canvas.width / 2, canvas.height / 2);
      } else if (watermark.position === 'bottom-right') {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(watermark.text, canvas.width - padding, canvas.height - padding);
      } else if (watermark.position === 'bottom-left') {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(watermark.text, padding, canvas.height - padding);
      } else if (watermark.position === 'top-right') {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(watermark.text, canvas.width - padding, padding);
      } else if (watermark.position === 'top-left') {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(watermark.text, padding, padding);
      } else if (watermark.position === 'tile') {
        ctx.rotate((-25 * Math.PI) / 180);
        ctx.textAlign = 'center';
        const stepX = textW + 120;
        const stepY = textH + 80;
        for (let x = -canvas.width; x < canvas.width * 2; x += stepX) {
          for (let y = -canvas.height; y < canvas.height * 2; y += stepY) {
            ctx.fillText(watermark.text, x, y);
          }
        }
      }

      ctx.restore();
    }

    return canvas;
  }

  async exportCanvasToBlob(canvas: HTMLCanvasElement, options: ImageExportOptions): Promise<Blob> {
    let targetCanvas = canvas;
    if (options.width && options.height && (options.width !== canvas.width || options.height !== canvas.height)) {
      targetCanvas = this.resizeImage(canvas, options.width, options.height);
    }

    return new Promise((resolve, reject) => {
      targetCanvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas export failed'));
        },
        options.format,
        options.quality
      );
    });
  }

  extractColorPalette(canvas: HTMLCanvasElement, maxColors: number = 6): string[] {
    const ctx = canvas.getContext('2d')!;
    const sampleSize = 64;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sampleSize;
    tempCanvas.height = sampleSize;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(canvas, 0, 0, sampleSize, sampleSize);

    const imgData = tempCtx.getImageData(0, 0, sampleSize, sampleSize).data;
    const colorBuckets = new Map<string, number>();

    for (let i = 0; i < imgData.length; i += 16) {
      const a = imgData[i + 3];
      if (a < 128) continue;
      // Quantize to 32 steps per channel
      const r = Math.min(255, Math.round(imgData[i] / 32) * 32);
      const g = Math.min(255, Math.round(imgData[i + 1] / 32) * 32);
      const b = Math.min(255, Math.round(imgData[i + 2] / 32) * 32);
      const key = `${r},${g},${b}`;
      colorBuckets.set(key, (colorBuckets.get(key) || 0) + 1);
    }

    const sorted = Array.from(colorBuckets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxColors)
      .map(([rgbStr]) => {
        const [r, g, b] = rgbStr.split(',').map(Number);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
      });

    return sorted.length > 0 ? sorted : ['#3B82F6', '#10B981', '#6366F1', '#EC4899'];
  }

}
