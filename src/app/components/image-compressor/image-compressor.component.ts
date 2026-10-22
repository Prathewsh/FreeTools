import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';

export interface CompressedItem {
  id: string;
  name: string;
  originalSize: number;
  originalFormatted: string;
  compressedSize: number;
  compressedFormatted: string;
  savingsPercent: number;
  originalUrl: string;
  compressedUrl: string;
  width: number;
  height: number;
  status: 'idle' | 'compressing' | 'done' | 'error';
  targetFormat: OutputFormat;
}

@Component({
  selector: 'app-image-compressor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-compressor.component.html',
  styleUrl: './image-compressor.component.scss'
})
export class ImageCompressorComponent {
  quality = signal<number>(80);
  targetFormat = signal<OutputFormat>('image/webp');
  maxWidth = signal<number>(0);
  maxHeight = signal<number>(0);
  maintainAspect = signal<boolean>(true);
  
  items = signal<CompressedItem[]>([]);
  isProcessing = signal<boolean>(false);
  isDragging = signal<boolean>(false);

  totalOriginal = computed(() => {
    return this.items().reduce((sum, item) => sum + item.originalSize, 0);
  });

  totalCompressed = computed(() => {
    return this.items().reduce((sum, item) => sum + (item.compressedSize || item.originalSize), 0);
  });

  overallSavings = computed(() => {
    const orig = this.totalOriginal();
    const comp = this.totalCompressed();
    if (orig === 0 || comp === 0 || comp >= orig) return 0;
    return Math.round(((orig - comp) / orig) * 100);
  });

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave() {
    this.isDragging.set(false);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(false);
    if (e.dataTransfer?.files) {
      this.handleFiles(Array.from(e.dataTransfer.files));
    }
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(Array.from(input.files));
      input.value = '';
    }
  }

  handleFiles(files: File[]) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    const validFiles = files.filter(f => validTypes.includes(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name));

    if (validFiles.length === 0) return;

    for (const file of validFiles) {
      const origUrl = URL.createObjectURL(file);
      const item: CompressedItem = {
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        originalSize: file.size,
        originalFormatted: this.formatBytes(file.size),
        compressedSize: 0,
        compressedFormatted: '...',
        savingsPercent: 0,
        originalUrl: origUrl,
        compressedUrl: '',
        width: 0,
        height: 0,
        status: 'compressing',
        targetFormat: this.targetFormat()
      };

      this.items.update(list => [...list, item]);
      this.compressSingle(item, file);
    }
  }

  async compressSingle(item: CompressedItem, file?: Blob) {
    try {
      const img = new Image();
      const sourceUrl = item.originalUrl;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = sourceUrl;
      });

      let w = img.naturalWidth;
      let h = img.naturalHeight;

      const maxW = this.maxWidth();
      const maxH = this.maxHeight();

      if (maxW > 0 && maxH > 0) {
        if (this.maintainAspect()) {
          const ratio = Math.min(maxW / w, maxH / h);
          if (ratio < 1) {
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
        } else {
          w = maxW;
          h = maxH;
        }
      } else if (maxW > 0 && w > maxW) {
        h = Math.round((h * maxW) / w);
        w = maxW;
      } else if (maxH > 0 && h > maxH) {
        w = Math.round((w * maxH) / h);
        h = maxH;
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context error');

      if (this.targetFormat() === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.drawImage(img, 0, 0, w, h);

      const q = this.quality() / 100;
      let blob: Blob | null = null;
      let usedFormat = this.targetFormat();

      try {
        blob = await new Promise<Blob | null>(res => canvas.toBlob(res, usedFormat, q));
      } catch (e) {
        blob = null;
      }

      // Fallback for AVIF if browser lacks canvas encoder
      if (!blob || blob.size === 0) {
        usedFormat = 'image/webp';
        blob = await new Promise<Blob | null>(res => canvas.toBlob(res, usedFormat, q));
      }

      if (!blob) throw new Error('Failed to generate image blob');

      const compUrl = URL.createObjectURL(blob);
      const compSize = blob.size;
      const savings = item.originalSize > 0 && compSize < item.originalSize
        ? Math.round(((item.originalSize - compSize) / item.originalSize) * 100)
        : 0;

      this.items.update(list => list.map(i => {
        if (i.id === item.id) {
          return {
            ...i,
            compressedSize: compSize,
            compressedFormatted: this.formatBytes(compSize),
            savingsPercent: savings,
            compressedUrl: compUrl,
            width: w,
            height: h,
            status: 'done',
            targetFormat: usedFormat
          };
        }
        return i;
      }));
    } catch (err) {
      console.error(err);
      this.items.update(list => list.map(i => i.id === item.id ? { ...i, status: 'error' } : i));
    }
  }

  recompressAll() {
    for (const item of this.items()) {
      this.compressSingle(item);
    }
  }

  downloadItem(item: CompressedItem) {
    if (!item.compressedUrl) return;
    const a = document.createElement('a');
    a.href = item.compressedUrl;
    const ext = this.getExtension(item.targetFormat);
    const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
    a.download = `${baseName}-compressed.${ext}`;
    a.click();
  }

  downloadAll() {
    for (const item of this.items()) {
      if (item.status === 'done') {
        this.downloadItem(item);
      }
    }
  }

  removeItem(id: string) {
    this.items.update(list => {
      const target = list.find(x => x.id === id);
      if (target?.originalUrl) URL.revokeObjectURL(target.originalUrl);
      if (target?.compressedUrl) URL.revokeObjectURL(target.compressedUrl);
      return list.filter(x => x.id !== id);
    });
  }

  clearAll() {
    for (const item of this.items()) {
      if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
      if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
    }
    this.items.set([]);
  }

  getExtension(format: OutputFormat): string {
    switch (format) {
      case 'image/jpeg': return 'jpg';
      case 'image/png': return 'png';
      case 'image/webp': return 'webp';
      case 'image/avif': return 'avif';
      default: return 'jpg';
    }
  }
}

