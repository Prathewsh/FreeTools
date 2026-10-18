import { Component, ElementRef, ViewChild, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BatchService, BatchItem, BatchSettings } from '../../services/batch.service';
import { ImageService } from '../../services/image.service';

@Component({
  selector: 'app-batch-converter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './batch-converter.component.html',
  styleUrl: './batch-converter.component.scss'
})
export class BatchConverterComponent implements OnDestroy {
  private destroyed = false;

  ngOnDestroy() {
    this.destroyed = true;
    this.clearAll();
  }

  private releaseItem(item: BatchItem) {
    URL.revokeObjectURL(item.previewUrl);
    if (item.processedUrl) URL.revokeObjectURL(item.processedUrl);
  }
  protected readonly Math = Math;

  @ViewChild('batchFileInput', { static: false }) batchFileInputRef!: ElementRef<HTMLInputElement>;

  items = signal<BatchItem[]>([]);
  isBatchProcessing = signal<boolean>(false);

  // Settings
  targetFormat = signal<'image/webp' | 'image/jpeg' | 'image/png'>('image/webp');
  targetQuality = signal<number>(0.8);
  maxWidth = signal<number>(1920);
  applyResize = signal<boolean>(false);

  totalOriginalSize = computed(() => {
    return this.items().reduce((acc, it) => acc + it.originalSize, 0);
  });

  totalProcessedSize = computed(() => {
    return this.items().reduce((acc, it) => acc + (it.processedSize || it.originalSize), 0);
  });

  totalSavingsPercent = computed(() => {
    const orig = this.totalOriginalSize();
    const proc = this.totalProcessedSize();
    if (orig === 0 || proc === 0) return 0;
    return Math.max(0, Math.round(((orig - proc) / orig) * 100));
  });

  constructor(
    private batchService: BatchService,
    private imageService: ImageService
  ) {}

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.addFiles(Array.from(input.files));
    }
  }

  onDropFiles(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer && event.dataTransfer.files) {
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  addFiles(files: File[]) {
    const newItems: BatchItem[] = files
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        originalSize: file.size,
        previewUrl: URL.createObjectURL(file),
        status: 'pending'
      }));

    this.items.update((list) => [...list, ...newItems]);
  }

  hasUnprocessedItems = computed(() => {
    return this.items().some((it) => it.status !== 'done');
  });

  hasDoneItems = computed(() => {
    return this.items().some((it) => it.status === 'done' && it.processedUrl);
  });

  async processAll() {
    if (this.isBatchProcessing()) return;
    this.isBatchProcessing.set(true);
    const settings: BatchSettings = {
      format: this.targetFormat(),
      quality: this.targetQuality(),
      maxWidth: this.applyResize() ? this.maxWidth() : undefined
    };

    const currentList = this.items();
    for (const item of currentList) {
      if (this.destroyed) break;
      if (item.status !== 'done' && this.items().includes(item)) {
        const pending = this.batchService.processItem(item, settings);
        this.items.update(list => [...list]);
        await pending;
        if (this.destroyed || !this.items().includes(item)) this.releaseItem(item);
        this.items.update(list => [...list]);
      }
    }


    this.isBatchProcessing.set(false);
    this.downloadAll();
  }

  downloadItem(item: BatchItem) {
    if (!item.processedUrl) return;
    const ext = item.processedBlob?.type === 'image/webp' ? 'webp' : item.processedBlob?.type === 'image/jpeg' ? 'jpg' : 'png';
    const link = document.createElement('a');
    link.href = item.processedUrl;
    link.download = `${item.name.replace(/\.[^/.]+$/, '')}_converted.${ext}`;
    link.click();
  }

  downloadAll() {
    const doneItems = this.items().filter((it) => it.status === 'done' && it.processedUrl);
    doneItems.forEach((item, index) => {
      setTimeout(() => {
        if (!this.destroyed && this.items().includes(item)) this.downloadItem(item);
      }, index * 200);
    });
  }

  removeItem(id: string) {
    const item = this.items().find(it => it.id === id);
    if (item) this.releaseItem(item);
    this.items.update((list) => list.filter((it) => it.id !== id));
  }

  clearAll() {
    this.items().forEach(item => this.releaseItem(item));
    this.items.set([]);
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
}
