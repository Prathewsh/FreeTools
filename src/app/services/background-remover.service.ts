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

  private colorDistance(
    a: { r: number; g: number; b: number },
    b: { r: number; g: number; b: number }
  ): number {
    // Red-mean distance tracks perceived color difference better than raw RGB.
    const redMean = (a.r + b.r) / 2;
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return Math.sqrt(
      (2 + redMean / 256) * dr * dr +
      4 * dg * dg +
      (2 + (255 - redMean) / 256) * db * db
    );
  }

  private detectBackgroundColors(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): { r: number; g: number; b: number }[] {
    interface Cluster {
      r: number;
      g: number;
      b: number;
      count: number;
      sides: Set<number>;
      centerHits: number;
    }

    const clusters: Cluster[] = [];
    const sample = (x: number, y: number, side: number) => {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 24) return;
      const color = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
      let cluster = clusters.find((candidate) => this.colorDistance(candidate, color) < 42);
      if (!cluster) {
        cluster = { ...color, count: 0, sides: new Set<number>(), centerHits: 0 };
        clusters.push(cluster);
      }
      cluster.count++;
      cluster.sides.add(side);
      const weight = 1 / cluster.count;
      cluster.r += (color.r - cluster.r) * weight;
      cluster.g += (color.g - cluster.g) * weight;
      cluster.b += (color.b - cluster.b) * weight;
    };

    const stepX = Math.max(1, Math.floor(width / 80));
    const stepY = Math.max(1, Math.floor(height / 80));
    for (let x = 0; x < width; x += stepX) {
      sample(x, 0, 0);
      sample(x, height - 1, 2);
    }
    for (let y = 0; y < height; y += stepY) {
      sample(0, y, 3);
      sample(width - 1, y, 1);
    }

    // A cluster common in the center is probably the subject touching an edge.
    const centerStepX = Math.max(1, Math.floor(width / 16));
    const centerStepY = Math.max(1, Math.floor(height / 16));
    for (let y = Math.floor(height * 0.25); y <= height * 0.75; y += centerStepY) {
      for (let x = Math.floor(width * 0.25); x <= width * 0.75; x += centerStepX) {
        const offset = (y * width + x) * 4;
        const color = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
        const nearest = clusters
          .map((cluster) => ({ cluster, distance: this.colorDistance(cluster, color) }))
          .sort((a, b) => a.distance - b.distance)[0];
        if (nearest && nearest.distance < 42) nearest.cluster.centerHits++;
      }
    }

    const ranked = clusters
      .map((cluster) => ({
        cluster,
        score: cluster.count * (1 + cluster.sides.size * 0.35) / (1 + cluster.centerHits * 0.9)
      }))
      .sort((a, b) => b.score - a.score);

    if (!ranked.length) return [{ r: 255, g: 255, b: 255 }];
    const bestScore = ranked[0].score;
    const selected = ranked
      .filter(({ cluster, score }) => score >= bestScore * 0.55 && cluster.sides.size >= 2)
      .slice(0, 3)
      .map(({ cluster }) => ({
        r: Math.round(cluster.r),
        g: Math.round(cluster.g),
        b: Math.round(cluster.b)
      }));
    if (selected.length) return selected;
    const fallback = ranked[0].cluster;
    return [{ r: Math.round(fallback.r), g: Math.round(fallback.g), b: Math.round(fallback.b) }];
  }

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
      bgColors = this.detectBackgroundColors(data, w, h);
    }

    // Keep the UI's percentage intuitive without letting a normal value erase
    // broad ranges of foreground colors.
    const toleranceThreshold = 12 + options.tolerance * 1.55;
    const featherRange = Math.max(1, options.feather * 3.25);

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
        const dist = this.colorDistance({ r, g, b }, bg);
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

      // Only seed pixels that resemble the detected background. Subject colors
      // touching an edge can no longer become background samples by themselves.
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

      // Construct a hard connected mask first. Feathering is applied by pixel
      // distance below, so similarly colored subject details stay intact.
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          alphaMask[idx] = isBackground[idx] === 1 ? 0 : 255;
        }
      }

      const featherPixels = Math.min(20, Math.max(0, Math.round(options.feather)));
      if (featherPixels > 0) {
        const edgeQueue = new Int32Array(totalPixels);
        const distances = new Int16Array(totalPixels);
        distances.fill(-1);
        let edgeHead = 0;
        let edgeTail = 0;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            if (isBackground[idx]) continue;
            const touchesBackground =
              (x > 0 && isBackground[idx - 1] === 1) ||
              (x < w - 1 && isBackground[idx + 1] === 1) ||
              (y > 0 && isBackground[idx - w] === 1) ||
              (y < h - 1 && isBackground[idx + w] === 1);
            if (touchesBackground) {
              distances[idx] = 1;
              edgeQueue[edgeTail++] = idx;
            }
          }
        }

        while (edgeHead < edgeTail) {
          const idx = edgeQueue[edgeHead++];
          const distance = distances[idx];
          alphaMask[idx] = Math.round(255 * distance / (featherPixels + 1));
          if (distance >= featherPixels) continue;
          const x = idx % w;
          const neighbors = [idx - w, idx + w, idx - 1, idx + 1];
          for (let n = 0; n < neighbors.length; n++) {
            const next = neighbors[n];
            const horizontalWrap = n >= 2 && Math.abs((next % w) - x) !== 1;
            if (next >= 0 && next < totalPixels && !horizontalWrap && !isBackground[next] && distances[next] === -1) {
              distances[next] = distance + 1;
              edgeQueue[edgeTail++] = next;
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

    // Apply manual edits last so smoothing cannot weaken explicit keep/erase strokes.
    if (customMask && customMask.length === alphaMask.length) {
      for (let i = 0; i < alphaMask.length; i++) {
        if (customMask[i] === 1) alphaMask[i] = 255;
        else if (customMask[i] === 2) alphaMask[i] = 0;
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
