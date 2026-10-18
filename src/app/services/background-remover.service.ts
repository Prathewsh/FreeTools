import { Injectable } from '@angular/core';

export interface BgRemoveOptions {
  mode: 'auto' | 'color-key' | 'contour';
  tolerance: number; // 5 to 90 (default ~30)
  feather: number;   // 0 to 20 (default ~4)
  sampleColor?: { r: number; g: number; b: number };
  samplePoints?: { x: number; y: number }[];
  smoothEdges: boolean;
  despill: boolean;
}

export interface BackdropConfig {
  type: 'transparent' | 'color' | 'gradient' | 'blur' | 'custom-image';
  color: string;
  gradient: string;
  blurAmount: number;
  customImage?: HTMLImageElement;
}

@Injectable({
  providedIn: 'root'
})
export class BackgroundRemoverService {
  constructor() {}

  removeBackground(
    source: HTMLImageElement | HTMLCanvasElement,
    options: BgRemoveOptions,
    customMask?: Uint8Array
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const w = canvas.width;
    const h = canvas.height;

    // Determine target background colors
    let bgColors: { r: number; g: number; b: number }[] = [];

    if (options.sampleColor) {
      bgColors.push(options.sampleColor);
    } else {
      // Auto-sample 4 corners + 4 edge centers for robust background detection
      const sampleIndices = [
        0,                                   // Top-left
        (w - 1) * 4,                         // Top-right
        ((h - 1) * w) * 4,                   // Bottom-left
        ((h - 1) * w + (w - 1)) * 4,         // Bottom-right
        Math.floor(w / 2) * 4,               // Top-center
        ((h - 1) * w + Math.floor(w / 2)) * 4, // Bottom-center
        (Math.floor(h / 2) * w) * 4,         // Left-center
        (Math.floor(h / 2) * w + (w - 1)) * 4 // Right-center
      ];

      for (const idx of sampleIndices) {
        bgColors.push({
          r: data[idx],
          g: data[idx + 1],
          b: data[idx + 2]
        });
      }
    }

    const toleranceThreshold = (options.tolerance / 100) * 441.67; // max distance in RGB space = sqrt(255^2 * 3) ~ 441.67
    const featherRange = Math.max(1, (options.feather / 100) * 120);

    // Alpha mask buffer
    const alphaMask = new Uint8Array(w * h);
    const totalPixels = w * h;

    // Helper to calculate minimum color distance to background samples
    const getBgDistance = (pxIdx: number): number => {
      const r = data[pxIdx];
      const g = data[pxIdx + 1];
      const b = data[pxIdx + 2];
      let minDistance = 9999;
      for (let i = 0; i < bgColors.length; i++) {
        const bg = bgColors[i];
        const dist = Math.hypot(r - bg.r, g - bg.g, b - bg.b);
        if (dist < minDistance) minDistance = dist;
      }
      return minDistance;
    };

    if (options.mode === 'auto' || options.mode === 'contour') {
      // Border-connected BFS Flood Fill:
      // Prevents erasing subject's clothes, eyes, teeth or skin if they match the background color
      const isBackground = new Uint8Array(totalPixels);
      const queue = new Int32Array(totalPixels);
      let qHead = 0;
      let qTail = 0;

      // Seed outer image edges into the queue
      for (let x = 0; x < w; x++) {
        // Top edge
        const topIdx = x;
        if (getBgDistance(topIdx * 4) <= toleranceThreshold) {
          isBackground[topIdx] = 1;
          queue[qTail++] = topIdx;
        }
        // Bottom edge
        const btmIdx = (h - 1) * w + x;
        if (!isBackground[btmIdx] && getBgDistance(btmIdx * 4) <= toleranceThreshold) {
          isBackground[btmIdx] = 1;
          queue[qTail++] = btmIdx;
        }
      }
      for (let y = 0; y < h; y++) {
        // Left edge
        const leftIdx = y * w;
        if (!isBackground[leftIdx] && getBgDistance(leftIdx * 4) <= toleranceThreshold) {
          isBackground[leftIdx] = 1;
          queue[qTail++] = leftIdx;
        }
        // Right edge
        const rightIdx = y * w + (w - 1);
        if (!isBackground[rightIdx] && getBgDistance(rightIdx * 4) <= toleranceThreshold) {
          isBackground[rightIdx] = 1;
          queue[qTail++] = rightIdx;
        }
      }

      // BFS expansion along connected background pixels
      while (qHead < qTail) {
        const curr = queue[qHead++];
        const cx = curr % w;
        const cy = Math.floor(curr / w);

        const up = cy > 0 ? curr - w : -1;
        const down = cy < h - 1 ? curr + w : -1;
        const left = cx > 0 ? curr - 1 : -1;
        const right = cx < w - 1 ? curr + 1 : -1;

        const neighbors = [up, down, left, right];
        for (let i = 0; i < 4; i++) {
          const n = neighbors[i];
          if (n >= 0 && isBackground[n] === 0) {
            if (getBgDistance(n * 4) <= toleranceThreshold) {
              isBackground[n] = 1;
              queue[qTail++] = n;
            }
          }
        }
      }

      // Construct alpha mask with feathering along the boundary
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          if (isBackground[idx] === 1) {
            alphaMask[idx] = 0;
          } else {
            const dist = getBgDistance(idx * 4);
            if (dist <= toleranceThreshold + featherRange) {
              const hasBgNeighbor =
                (x > 0 && isBackground[idx - 1] === 1) ||
                (x < w - 1 && isBackground[idx + 1] === 1) ||
                (y > 0 && isBackground[idx - w] === 1) ||
                (y < h - 1 && isBackground[idx + w] === 1);

              if (hasBgNeighbor) {
                const alpha = Math.round(((dist - toleranceThreshold) / featherRange) * 255);
                alphaMask[idx] = Math.max(0, Math.min(255, alpha));
              } else {
                alphaMask[idx] = 255;
              }
            } else {
              alphaMask[idx] = 255;
            }
          }
        }
      }
    } else {
      // Standard / Smart Color-Key Mode
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          const dist = getBgDistance(idx * 4);

          let alpha = 255;
          if (dist <= toleranceThreshold) {
            alpha = 0;
          } else if (dist < toleranceThreshold + featherRange) {
            alpha = Math.round(((dist - toleranceThreshold) / featherRange) * 255);
          }

          alphaMask[idx] = alpha;
        }
      }
    }

    // Apply custom touchup mask overrides if provided
    if (customMask && customMask.length === alphaMask.length) {
      for (let i = 0; i < alphaMask.length; i++) {
        if (customMask[i] === 1) alphaMask[i] = 255; // Keep forced
        else if (customMask[i] === 2) alphaMask[i] = 0; // Erase forced
      }
    }

    // Smooth edges with simple 1-radius box blur on alpha mask if smoothEdges is true
    if (options.smoothEdges) {
      const smoothed = new Uint8Array(alphaMask);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          const sum =
            alphaMask[idx] * 4 +
            alphaMask[idx - 1] * 2 +
            alphaMask[idx + 1] * 2 +
            alphaMask[idx - w] * 2 +
            alphaMask[idx + w] * 2 +
            alphaMask[idx - w - 1] +
            alphaMask[idx - w + 1] +
            alphaMask[idx + w - 1] +
            alphaMask[idx + w + 1];
          smoothed[idx] = Math.round(sum / 16);
        }
      }
      for (let i = 0; i < alphaMask.length; i++) {
        alphaMask[i] = smoothed[i];
      }
    }

    // Write alpha back to imgData & apply despill
    const primaryBg = bgColors[0] || { r: 255, g: 255, b: 255 };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const maskIdx = y * w + x;
        const pixelIdx = maskIdx * 4;
        const alpha = alphaMask[maskIdx];

        data[pixelIdx + 3] = Math.round(data[pixelIdx + 3] * alpha / 255);

        // Despill fringe color on semi-transparent edge pixels
        if (options.despill && alpha > 0 && alpha < 240) {
          const factor = 1 - alpha / 255;
          data[pixelIdx] = Math.max(0, Math.min(255, data[pixelIdx] - primaryBg.r * factor * 0.4));
          data[pixelIdx + 1] = Math.max(0, Math.min(255, data[pixelIdx + 1] - primaryBg.g * factor * 0.4));
          data[pixelIdx + 2] = Math.max(0, Math.min(255, data[pixelIdx + 2] - primaryBg.b * factor * 0.4));
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  compositeWithBackdrop(
    cutoutCanvas: HTMLCanvasElement,
    originalSource: HTMLImageElement | HTMLCanvasElement,
    backdrop: BackdropConfig
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = cutoutCanvas.width;
    canvas.height = cutoutCanvas.height;
    const ctx = canvas.getContext('2d')!;

    if (backdrop.type === 'color') {
      ctx.fillStyle = backdrop.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (backdrop.type === 'gradient') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      const parts = backdrop.gradient.split(',').map((s) => s.trim());
      if (parts.length >= 2) {
        grad.addColorStop(0, parts[0]);
        grad.addColorStop(1, parts[1]);
      } else {
        grad.addColorStop(0, '#6366f1');
        grad.addColorStop(1, '#a855f7');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (backdrop.type === 'blur') {
      // Draw blurred original background behind cutout
      ctx.save();
      ctx.filter = `blur(${Math.max(4, backdrop.blurAmount)}px)`;
      // scale up slightly to prevent blur edge bleeding
      const scale = 1.05;
      const nw = canvas.width * scale;
      const nh = canvas.height * scale;
      ctx.drawImage(originalSource, (canvas.width - nw) / 2, (canvas.height - nh) / 2, nw, nh);
      ctx.restore();
    } else if (backdrop.type === 'custom-image' && backdrop.customImage) {
      ctx.drawImage(backdrop.customImage, 0, 0, canvas.width, canvas.height);
    }

    // Overlay foreground subject cutout
    ctx.drawImage(cutoutCanvas, 0, 0);
    return canvas;
  }
}
