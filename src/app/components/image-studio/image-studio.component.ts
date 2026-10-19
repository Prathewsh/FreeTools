import {
  Component,
  ElementRef,
  Input,
  AfterViewInit,
  ViewChild,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ImageService,
  ImageFilters,
  WatermarkConfig,
  ImageExportOptions
} from '../../services/image.service';

interface HistoryState {
  canvasDataUrl: string;
  width: number;
  height: number;
}

type CropRatio = 'free' | '1:1' | '16:9' | '4:3' | '9:16' | '3:2' | '2:3' | 'circle';

@Component({
  selector: 'app-image-studio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-studio.component.html',
  styleUrl: './image-studio.component.scss'
})
export class ImageStudioComponent implements AfterViewInit {
  protected readonly Math = Math;
  stageCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('stageCanvas') set stageCanvas(ref: ElementRef<HTMLCanvasElement>) {
    this.stageCanvasRef = ref;
    if (ref) {
      this.renderPreview();
      this.calculateEstimatedSize();
    }
  }
  @ViewChild('cropOverlay', { static: false }) cropOverlayRef!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput', { static: false }) fileInputRef!: ElementRef<HTMLInputElement>;

  // External image input (e.g. from BG remover)
  @Input() set incomingImage(url: string | null) {
    if (url) {
      this.loadImageFromUrl(url);
    }
  }

  activeSubTool = signal<'crop' | 'resize' | 'rotate' | 'filters' | 'watermark' | 'export'>('crop');
  isProcessing = signal<boolean>(false);
  hasImage = signal<boolean>(false);

  // Active base canvas (current state)
  private currentCanvas: HTMLCanvasElement | null = null;
  imageDimensions = signal<{ width: number; height: number }>({ width: 0, height: 0 });

  // History stack for Undo/Redo
  private history: HistoryState[] = [];
  private historyIndex = signal(-1);
  canUndo = computed(() => this.historyIndex() > 0);
  canRedo = computed(() => this.historyIndex() < this.history.length - 1);

  // 1. Crop State
  cropRatio = signal<CropRatio>('free');
  cropBox = signal<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });
  isDraggingCrop = false;
  dragMode: 'move' | 'nw' | 'ne' | 'se' | 'sw' = 'move';
  dragStartX = 0;
  dragStartY = 0;
  dragInitialBox = { x: 0, y: 0, w: 0, h: 0 };

  // 2. Resize State
  resizeWidth = signal<number>(800);
  resizeHeight = signal<number>(800);
  lockAspectRatio = signal<boolean>(true);
  scalePercentage = signal<number>(100);

  // 3. Rotate & Flip State
  rotationAngle = signal<number>(0); // -180 to 180
  flipHorizontal = signal<boolean>(false);
  flipVertical = signal<boolean>(false);

  // 4. Filters State
  filters = signal<ImageFilters>({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hueRotate: 0,
    blur: 0,
    sepia: 0,
    grayscale: 0,
    invert: 0,
    exposure: 0,
    sharpen: 0
  });

  // 5. Watermark State
  watermark = signal<WatermarkConfig>({
    enabled: true,
    text: 'FreeTools by MGE',
    fontSize: 36,
    color: '#ffffff',
    opacity: 0.7,
    position: 'bottom-right',
    bold: true
  });

  // 6. Export State
  exportFormat = signal<'image/png' | 'image/jpeg' | 'image/webp'>('image/webp');
  exportQuality = signal<number>(0.85);
  estimatedSize = signal<string>('0 KB');
  originalFileSize = signal<string>('0 KB');

  constructor(private imageService: ImageService) {}

  ngAfterViewInit() {
    setTimeout(() => {
      this.renderPreview();
    }, 50);
  }

  async loadImageFromUrl(url: string) {
    this.isProcessing.set(true);
    try {
      const img = await this.imageService.createImageFromSource(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      this.currentCanvas = canvas;
      this.imageDimensions.set({ width: img.width, height: img.height });
      this.resizeWidth.set(img.width);
      this.resizeHeight.set(img.height);
      this.hasImage.set(true);

      // Reset filters & rotate
      this.resetFilterValues();
      this.rotationAngle.set(0);
      this.flipHorizontal.set(false);
      this.flipVertical.set(false);

      // Initialize crop box to 80% center
      this.resetCropBox();

      // Clear & set initial history
      this.history = [];
      this.historyIndex.set(-1);
      this.pushHistory();

      this.renderPreview();
      this.calculateEstimatedSize();
    } catch {
      alert('Could not load image. Please choose a valid image file.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  onDropFile(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) this.loadFile(file);
  }

  async loadFile(file: File) {
    try {
      const url = await this.imageService.fileToDataUrl(file);
      this.originalFileSize.set(`${(file.size / 1024).toFixed(1)} KB`);
      await this.loadImageFromUrl(url);
    } catch {
      alert('Could not read image. Please choose a valid image file.');
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.loadFile(input.files[0]);
    }
  }

  // History operations
  private pushHistory() {
    if (!this.currentCanvas) return;
    // Discard any redos
    if (this.historyIndex() < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex() + 1);
    }
    this.history.push({
      canvasDataUrl: this.currentCanvas.toDataURL(),
      width: this.currentCanvas.width,
      height: this.currentCanvas.height
    });
    this.historyIndex.set(this.history.length - 1);
  }

  async undo() {
    if (!this.canUndo()) return;
    this.historyIndex.update(index => index - 1);
    await this.restoreHistoryState(this.history[this.historyIndex()]);
  }

  async redo() {
    if (!this.canRedo()) return;
    this.historyIndex.update(index => index + 1);
    await this.restoreHistoryState(this.history[this.historyIndex()]);
  }

  private async restoreHistoryState(state: HistoryState) {
    const img = await this.imageService.createImageFromSource(state.canvasDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = state.width;
    canvas.height = state.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    this.currentCanvas = canvas;
    this.imageDimensions.set({ width: state.width, height: state.height });
    this.resizeWidth.set(state.width);
    this.resizeHeight.set(state.height);
    this.resetCropBox();
    this.renderPreview();
    this.calculateEstimatedSize();
  }

  renderPreview() {
    if (!this.stageCanvasRef || !this.currentCanvas) return;
    const canvas = this.stageCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;

    let workingCanvas = this.currentCanvas;

    // Apply live rotation if not 0
    if (this.rotationAngle() !== 0 || this.flipHorizontal() || this.flipVertical()) {
      workingCanvas = this.imageService.rotateAndFlipImage(
        workingCanvas,
        this.rotationAngle(),
        this.flipHorizontal(),
        this.flipVertical()
      );
    }

    // Apply live filters and watermark
    const filteredCanvas = this.imageService.applyFiltersAndAdjustments(
      workingCanvas,
      this.filters(),
      this.watermark().enabled && this.activeSubTool() === 'watermark' ? this.watermark() : undefined
    );

    canvas.width = filteredCanvas.width;
    canvas.height = filteredCanvas.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(filteredCanvas, 0, 0);
  }

  // --- CROP TOOL ---
  resetCropBox() {
    const w = this.imageDimensions().width;
    const h = this.imageDimensions().height;
    const cropW = Math.round(w * 0.8);
    const cropH = Math.round(h * 0.8);
    const cropX = Math.round((w - cropW) / 2);
    const cropY = Math.round((h - cropH) / 2);
    this.cropBox.set({ x: cropX, y: cropY, w: cropW, h: cropH });
  }

  setCropRatio(ratio: CropRatio) {
    this.cropRatio.set(ratio);
    const current = this.cropBox();
    const origW = this.imageDimensions().width;
    const origH = this.imageDimensions().height;

    let targetRatio = 1;
    if (ratio === '1:1' || ratio === 'circle') targetRatio = 1;
    else if (ratio === '16:9') targetRatio = 16 / 9;
    else if (ratio === '4:3') targetRatio = 4 / 3;
    else if (ratio === '9:16') targetRatio = 9 / 16;
    else if (ratio === '3:2') targetRatio = 3 / 2;
    else if (ratio === '2:3') targetRatio = 2 / 3;
    else return;

    let newW = current.w;
    let newH = Math.round(newW / targetRatio);

    if (newH > origH) {
      newH = origH;
      newW = Math.round(newH * targetRatio);
    }

    const newX = Math.max(0, Math.min(origW - newW, current.x));
    const newY = Math.max(0, Math.min(origH - newH, current.y));

    this.cropBox.set({ x: newX, y: newY, w: newW, h: newH });
  }

  getAspectMultiplier(): number {
    switch (this.cropRatio()) {
      case '1:1':
      case 'circle': return 1;
      case '16:9': return 16 / 9;
      case '4:3': return 4 / 3;
      case '9:16': return 9 / 16;
      case '3:2': return 3 / 2;
      case '2:3': return 2 / 3;
      default: return 1;
    }
  }

  onCropMouseDown(event: MouseEvent, mode: 'move' | 'nw' | 'ne' | 'se' | 'sw') {
    event.preventDefault();
    event.stopPropagation();
    if (!this.stageCanvasRef) return;

    const canvas = this.stageCanvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const imgW = this.imageDimensions().width;
    const imgH = this.imageDimensions().height;
    const scaleX = imgW / rect.width;
    const scaleY = imgH / rect.height;

    this.isDraggingCrop = true;
    this.dragMode = mode;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragInitialBox = { ...this.cropBox() };

    const minSize = Math.min(24, imgW, imgH);

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDraggingCrop) return;
      const deltaX = (e.clientX - this.dragStartX) * scaleX;
      const deltaY = (e.clientY - this.dragStartY) * scaleY;
      const init = this.dragInitialBox;
      const ratio = this.cropRatio() !== 'free' ? this.getAspectMultiplier() : null;

      if (this.dragMode === 'move') {
        let newX = Math.round(init.x + deltaX);
        let newY = Math.round(init.y + deltaY);
        newX = Math.max(0, Math.min(imgW - init.w, newX));
        newY = Math.max(0, Math.min(imgH - init.h, newY));
        this.cropBox.set({ x: newX, y: newY, w: init.w, h: init.h });
      } else if (this.dragMode === 'se') {
        let newW = Math.max(minSize, Math.min(imgW - init.x, Math.round(init.w + deltaX)));
        let newH = ratio ? Math.round(newW / ratio) : Math.max(minSize, Math.min(imgH - init.y, Math.round(init.h + deltaY)));
        if (init.y + newH > imgH && ratio) {
          newH = imgH - init.y;
          newW = Math.round(newH * ratio);
        }
        this.cropBox.set({ x: init.x, y: init.y, w: newW, h: newH });
      } else if (this.dragMode === 'sw') {
        const targetRight = init.x + init.w;
        let newX = Math.max(0, Math.min(targetRight - minSize, Math.round(init.x + deltaX)));
        let newW = targetRight - newX;
        let newH = ratio ? Math.round(newW / ratio) : Math.max(minSize, Math.min(imgH - init.y, Math.round(init.h + deltaY)));
        if (init.y + newH > imgH && ratio) {
          newH = imgH - init.y;
          newW = Math.round(newH * ratio);
          newX = targetRight - newW;
        }
        this.cropBox.set({ x: newX, y: init.y, w: newW, h: newH });
      } else if (this.dragMode === 'ne') {
        const targetBottom = init.y + init.h;
        let newW = Math.max(minSize, Math.min(imgW - init.x, Math.round(init.w + deltaX)));
        let newH = ratio ? Math.round(newW / ratio) : Math.min(targetBottom, Math.max(minSize, targetBottom - Math.round(init.y + deltaY)));
        let newY = targetBottom - newH;
        if (newY < 0 && ratio) {
          newY = 0;
          newH = targetBottom;
          newW = Math.round(newH * ratio);
        }
        this.cropBox.set({ x: init.x, y: Math.max(0, newY), w: newW, h: newH });
      } else if (this.dragMode === 'nw') {
        const targetRight = init.x + init.w;
        const targetBottom = init.y + init.h;
        let newX = Math.max(0, Math.min(targetRight - minSize, Math.round(init.x + deltaX)));
        let newW = targetRight - newX;
        let newH = ratio ? Math.round(newW / ratio) : Math.min(targetBottom, Math.max(minSize, targetBottom - Math.round(init.y + deltaY)));
        let newY = targetBottom - newH;
        if (newY < 0 && ratio) {
          newY = 0;
          newH = targetBottom;
          newW = Math.round(newH * ratio);
          newX = targetRight - newW;
        }
        this.cropBox.set({ x: Math.max(0, newX), y: Math.max(0, newY), w: newW, h: newH });
      }
    };

    const onMouseUp = () => {
      this.isDraggingCrop = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  applyCrop() {
    if (!this.currentCanvas) return;
    const box = this.cropBox();
    const circular = this.cropRatio() === 'circle';
    const cropped = this.imageService.cropImage(this.currentCanvas, box.x, box.y, box.w, box.h, circular);

    this.currentCanvas = cropped;
    this.imageDimensions.set({ width: cropped.width, height: cropped.height });
    this.resizeWidth.set(cropped.width);
    this.resizeHeight.set(cropped.height);
    this.resetCropBox();
    this.pushHistory();
    this.renderPreview();
    this.calculateEstimatedSize();
  }

  // --- RESIZE TOOL ---
  onResizeWidthChange(val: number) {
    val = this.safeDimension(val);
    this.resizeWidth.set(val);
    if (this.lockAspectRatio() && this.currentCanvas) {
      const ratio = this.currentCanvas.height / this.currentCanvas.width;
      this.resizeHeight.set(Math.round(val * ratio));
    }
  }

  onResizeHeightChange(val: number) {
    val = this.safeDimension(val);
    this.resizeHeight.set(val);
    if (this.lockAspectRatio() && this.currentCanvas) {
      const ratio = this.currentCanvas.width / this.currentCanvas.height;
      this.resizeWidth.set(Math.round(val * ratio));
    }
  }

  onScalePercentageChange(pct: number) {
    pct = Math.min(400, Math.max(1, Number(pct) || 100));
    this.scalePercentage.set(pct);
    if (!this.currentCanvas) return;
    const factor = pct / 100;
    this.resizeWidth.set(Math.round(this.currentCanvas.width * factor));
    this.resizeHeight.set(Math.round(this.currentCanvas.height * factor));
  }

  setPresetSize(w: number, h: number) {
    this.resizeWidth.set(w);
    this.resizeHeight.set(h);
    this.scalePercentage.set(100);
  }

  applyResize() {
    if (!this.currentCanvas) return;
    const width = this.safeDimension(this.resizeWidth());
    const height = this.safeDimension(this.resizeHeight());
    this.resizeWidth.set(width);
    this.resizeHeight.set(height);
    const resized = this.imageService.resizeImage(this.currentCanvas, width, height);
    this.currentCanvas = resized;
    this.imageDimensions.set({ width: resized.width, height: resized.height });
    this.resetCropBox();
    this.pushHistory();
    this.renderPreview();
    this.calculateEstimatedSize();
  }

  private safeDimension(value: number): number {
    return Math.min(16384, Math.max(1, Math.round(Number(value) || 1)));
  }

  setRotation(angle: number) {
    this.rotationAngle.set(Math.min(180, Math.max(-180, Number(angle) || 0)));
    this.renderPreview();
  }

  // --- ROTATE & FLIP TOOL ---
  rotate90CW() {
    this.rotationAngle.update((a) => (a + 90) % 360);
    this.renderPreview();
  }

  rotate90CCW() {
    this.rotationAngle.update((a) => (a - 90) % 360);
    this.renderPreview();
  }

  toggleFlipH() {
    this.flipHorizontal.update((f) => !f);
    this.renderPreview();
  }

  toggleFlipV() {
    this.flipVertical.update((f) => !f);
    this.renderPreview();
  }

  applyRotation() {
    if (!this.currentCanvas) return;
    const rotated = this.imageService.rotateAndFlipImage(
      this.currentCanvas,
      this.rotationAngle(),
      this.flipHorizontal(),
      this.flipVertical()
    );
    this.currentCanvas = rotated;
    this.rotationAngle.set(0);
    this.flipHorizontal.set(false);
    this.flipVertical.set(false);
    this.imageDimensions.set({ width: rotated.width, height: rotated.height });
    this.resizeWidth.set(rotated.width);
    this.resizeHeight.set(rotated.height);
    this.resetCropBox();
    this.pushHistory();
    this.renderPreview();
  }

  // --- FILTERS TOOL ---
  updateFilter<K extends keyof ImageFilters>(key: K, value: number) {
    this.filters.update((f) => ({ ...f, [key]: value }));
    this.renderPreview();
  }

  resetFilterValues() {
    this.filters.set({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      hueRotate: 0,
      blur: 0,
      sepia: 0,
      grayscale: 0,
      invert: 0,
      exposure: 0,
      sharpen: 0
    });
    this.renderPreview();
  }

  applyFilterPreset(name: string) {
    this.resetFilterValues();
    if (name === 'noir') {
      this.filters.update((f) => ({ ...f, grayscale: 100, contrast: 30, brightness: -10 }));
    } else if (name === 'cyberpunk') {
      this.filters.update((f) => ({ ...f, hueRotate: 180, saturation: 45, contrast: 25 }));
    } else if (name === 'vintage') {
      this.filters.update((f) => ({ ...f, sepia: 60, contrast: 15, brightness: 5, saturation: -20 }));
    } else if (name === 'dramatic') {
      this.filters.update((f) => ({ ...f, contrast: 45, sharpen: 35, saturation: 15 }));
    } else if (name === 'warm') {
      this.filters.update((f) => ({ ...f, sepia: 30, saturation: 20, brightness: 10 }));
    } else if (name === 'cold') {
      this.filters.update((f) => ({ ...f, hueRotate: 210, saturation: 15, contrast: 10 }));
    }
    this.renderPreview();
  }

  applyFiltersPermanently() {
    if (!this.currentCanvas) return;
    const baked = this.imageService.applyFiltersAndAdjustments(this.currentCanvas, this.filters());
    this.currentCanvas = baked;
    this.resetFilterValues();
    this.pushHistory();
    this.renderPreview();
    this.calculateEstimatedSize();
  }

  // --- WATERMARK TOOL ---
  updateWatermark<K extends keyof WatermarkConfig>(key: K, value: WatermarkConfig[K]) {
    this.watermark.update((w) => ({ ...w, enabled: true, [key]: value }));
    this.renderPreview();
  }

  applyWatermarkPermanently() {
    if (!this.currentCanvas) return;
    const baked = this.imageService.applyFiltersAndAdjustments(
      this.currentCanvas,
      {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        hueRotate: 0,
        blur: 0,
        sepia: 0,
        grayscale: 0,
        invert: 0,
        exposure: 0,
        sharpen: 0
      },
      this.watermark()
    );
    this.currentCanvas = baked;
    this.watermark.update(value => ({ ...value, enabled: false }));
    this.pushHistory();
    this.renderPreview();
    this.calculateEstimatedSize();
  }

  // --- EXPORT & DOWNLOAD ---
  async calculateEstimatedSize() {
    if (!this.stageCanvasRef) return;
    try {
      const blob = await this.imageService.exportCanvasToBlob(this.stageCanvasRef.nativeElement, {
        format: this.exportFormat(),
        quality: this.exportQuality()
      });
      const kb = blob.size / 1024;
      if (kb > 1024) {
        this.estimatedSize.set(`${(kb / 1024).toFixed(2)} MB`);
      } else {
        this.estimatedSize.set(`${Math.round(kb)} KB`);
      }
    } catch {
      this.estimatedSize.set('N/A');
    }
  }

  async downloadImage() {
    if (!this.stageCanvasRef) return;
    const format = this.exportFormat();
    const ext = format === 'image/png' ? 'png' : format === 'image/jpeg' ? 'jpg' : 'webp';
    const blob = await this.imageService.exportCanvasToBlob(this.stageCanvasRef.nativeElement, {
      format,
      quality: this.exportQuality()
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `freetools-edited-${Date.now()}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async copyImage() {
    if (!this.stageCanvasRef) return;
    try {
      const blob = await this.imageService.exportCanvasToBlob(this.stageCanvasRef.nativeElement, {
        format: 'image/png',
        quality: 1.0
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      alert('Image copied to clipboard!');
    } catch {
      alert('Clipboard copy is not available in this context.');
    }
  }
}
