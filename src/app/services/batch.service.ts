import { Injectable } from '@angular/core';
import { ImageService } from './image.service';

export interface BatchItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  previewUrl: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  processedBlob?: Blob;
  processedUrl?: string;
  processedSize?: number;
  dimensions?: { width: number; height: number };
}

export interface BatchSettings {
  format: 'image/png' | 'image/jpeg' | 'image/webp';
  quality: number;
  maxWidth?: number;
  maxHeight?: number;
}

@Injectable({
  providedIn: 'root'
})
export class BatchService {
  constructor(private imageService: ImageService) {}

  async processItem(item: BatchItem, settings: BatchSettings): Promise<void> {
    item.status = 'processing';
    try {
      const img = await this.imageService.createImageFromSource(item.previewUrl);
      let targetW = img.width;
      let targetH = img.height;

      if (settings.maxWidth && targetW > settings.maxWidth) {
        const ratio = settings.maxWidth / targetW;
        targetW = settings.maxWidth;
        targetH = Math.round(targetH * ratio);
      }
      if (settings.maxHeight && targetH > settings.maxHeight) {
        const ratio = settings.maxHeight / targetH;
        targetH = settings.maxHeight;
        targetW = Math.round(targetW * ratio);
      }

      const canvas = this.imageService.resizeImage(img, targetW, targetH);
      const blob = await this.imageService.exportCanvasToBlob(canvas, {
        format: settings.format,
        quality: settings.quality
      });

      item.processedBlob = blob;
      item.processedSize = blob.size;
      item.processedUrl = URL.createObjectURL(blob);
      item.dimensions = { width: targetW, height: targetH };
      item.status = 'done';
    } catch {
      item.status = 'error';
    }
  }
}
