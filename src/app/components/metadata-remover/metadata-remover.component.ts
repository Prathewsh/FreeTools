import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface CleanedImage {
  name: string;
  originalSize: number;
  cleanedSize: number;
  previewUrl: string;
  cleanedUrl: string;
}

@Component({
  selector: 'app-metadata-remover',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metadata-remover.component.html',
  styleUrl: './metadata-remover.component.scss'
})
export class MetadataRemoverComponent {
  images = signal<CleanedImage[]>([]);
  isDragging = signal<boolean>(false);
  isProcessing = signal<boolean>(false);

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

  onFilesSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(Array.from(input.files));
      input.value = '';
    }
  }

  async handleFiles(files: File[]) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    this.isProcessing.set(true);

    for (const file of imageFiles) {
      try {
        const origUrl = URL.createObjectURL(file);
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = origUrl;
        });

        // Re-encoding through clean HTML5 canvas completely strips EXIF, GPS, camera serials, timestamps, thumbnails & color profiles
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        ctx.drawImage(img, 0, 0);

        const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, type, 0.95));
        if (!blob) continue;

        const cleanedUrl = URL.createObjectURL(blob);

        this.images.update(list => [
          ...list,
          {
            name: file.name,
            originalSize: file.size,
            cleanedSize: blob.size,
            previewUrl: origUrl,
            cleanedUrl: cleanedUrl
          }
        ]);
      } catch (err) {
        console.error('Error stripping metadata:', err);
      }
    }

    this.isProcessing.set(false);
  }

  downloadImage(item: CleanedImage) {
    const a = document.createElement('a');
    a.href = item.cleanedUrl;
    const parts = item.name.split('.');
    const ext = parts.pop();
    a.download = `${parts.join('.')}-clean.${ext}`;
    a.click();
  }

  downloadAll() {
    for (const item of this.images()) {
      this.downloadImage(item);
    }
  }

  clearAll() {
    for (const item of this.images()) {
      URL.revokeObjectURL(item.previewUrl);
      URL.revokeObjectURL(item.cleanedUrl);
    }
    this.images.set([]);
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }
}

