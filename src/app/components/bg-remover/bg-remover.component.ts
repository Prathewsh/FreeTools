import {
  Component,
  ElementRef,
  EventEmitter,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Output,
  ViewChild,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BackgroundRemoverService,
  BgRemoveOptions,
  BackdropConfig
} from '../../services/background-remover.service';
import { ImageService } from '../../services/image.service';

@Component({
  selector: 'app-bg-remover',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bg-remover.component.html',
  styleUrl: './bg-remover.component.scss'
})
export class BgRemoverComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('originalCanvas', { static: false }) originalCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('resultCanvas', { static: false }) resultCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('brushCanvas', { static: false }) brushCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false }) fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('backdropFileInput', { static: false }) backdropFileInputRef!: ElementRef<HTMLInputElement>;

  @Output() sendToStudio = new EventEmitter<string>();

  hasImage = signal<boolean>(false);
  isProcessing = signal<boolean>(false);
  originalImg = signal<HTMLImageElement | null>(null);

  // Background removal settings
  mode = signal<'auto' | 'color-key' | 'contour'>('auto');
  tolerance = signal<number>(28);
  feather = signal<number>(5);
  despill = signal<boolean>(true);
  smoothEdges = signal<boolean>(true);
  eyedropperActive = signal<boolean>(false);
  pickedColor = signal<{ r: number; g: number; b: number } | null>(null);

  // View modes
  viewMode = signal<'split' | 'side-by-side' | 'cutout'>('split');
  splitPosition = signal<number>(50); // percentage (0 - 100)

  // Backdrop replacement settings
  backdropType = signal<'transparent' | 'color' | 'gradient' | 'blur' | 'custom-image'>('transparent');
  backdropColor = signal<string>('#ffffff');
  backdropGradient = signal<string>('#6366f1, #a855f7');
  blurAmount = signal<number>(18);
  customBackdropImg = signal<HTMLImageElement | null>(null);

  // Touchup Brush
  brushActive = signal<boolean>(false);
  brushMode = signal<'keep' | 'erase'>('keep');
  brushSize = signal<number>(25);
  isPainting = false;
  touchupMask: Uint8Array | null = null;

  // Cached processed canvases
  private cutoutCanvas: HTMLCanvasElement | null = null;
  private compositedCanvas: HTMLCanvasElement | null = null;

  // Presets
  colorPresets = ['#ffffff', '#000000', '#f1f5f9', '#0f172a', '#3b82f6', '#10b981', '#f43f5e', '#f59e0b'];
  gradientPresets = [
    { label: 'Cyberpunk', val: '#6366f1, #06b6d4' },
    { label: 'Sunset', val: '#f43f5e, #fb923c' },
    { label: 'Velvet', val: '#8b5cf6, #ec4899' },
    { label: 'Aurora', val: '#10b981, #06b6d4' },
    { label: 'Midnight', val: '#0f172a, #1e293b' },
    { label: 'Gold Amber', val: '#f59e0b, #d97706' }
  ];

  constructor(
    private bgRemoverService: BackgroundRemoverService,
    private imageService: ImageService
  ) {}

  ngOnInit() {
    // Clipboard paste listener
    window.addEventListener('paste', this.pasteListener);
  }

  private readonly pasteListener = (event: ClipboardEvent) => this.handlePaste(event);

  ngOnDestroy() {
    window.removeEventListener('paste', this.pasteListener);
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.renderCanvases();
    }, 50);
  }

  handlePaste(e: ClipboardEvent) {
    if (e.clipboardData && e.clipboardData.items) {
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            this.loadFile(file);
            break;
          }
        }
      }
    }
  }

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
    this.isProcessing.set(true);
    try {
      const dataUrl = await this.imageService.fileToDataUrl(file);
      const img = await this.imageService.createImageFromSource(dataUrl);
      this.setOriginalImage(img);
    } catch {
      alert('Could not load image. Please choose a valid image file.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  setOriginalImage(img: HTMLImageElement) {
    this.originalImg.set(img);
    this.hasImage.set(true);
    this.touchupMask = new Uint8Array(img.width * img.height);
    this.pickedColor.set(null);
    this.processBackgroundRemoval();
  }

  processBackgroundRemoval() {
    const img = this.originalImg();
    if (!img) return;

    this.isProcessing.set(true);
    setTimeout(() => {
      const options: BgRemoveOptions = {
        mode: this.mode(),
        tolerance: this.tolerance(),
        feather: this.feather(),
        despill: this.despill(),
        smoothEdges: this.smoothEdges(),
        sampleColor: this.pickedColor() || undefined
      };

      this.cutoutCanvas = this.bgRemoverService.removeBackground(img, options, this.touchupMask || undefined);
      this.updateCompositedCanvas();
      this.renderCanvases();
      this.isProcessing.set(false);
    }, 10);
  }

  updateCompositedCanvas() {
    const img = this.originalImg();
    if (!img || !this.cutoutCanvas) return;

    const backdrop: BackdropConfig = {
      type: this.backdropType(),
      color: this.backdropColor(),
      gradient: this.backdropGradient(),
      blurAmount: this.blurAmount(),
      customImage: this.customBackdropImg() || undefined
    };

    if (backdrop.type === 'transparent') {
      this.compositedCanvas = this.cutoutCanvas;
    } else {
      this.compositedCanvas = this.bgRemoverService.compositeWithBackdrop(this.cutoutCanvas, img, backdrop);
    }
  }

  renderCanvases() {
    const img = this.originalImg();
    if (!img || !this.compositedCanvas) return;

    // Render result canvas
    if (this.resultCanvasRef) {
      const rCanvas = this.resultCanvasRef.nativeElement;
      rCanvas.width = img.width;
      rCanvas.height = img.height;
      const rCtx = rCanvas.getContext('2d')!;
      rCtx.clearRect(0, 0, rCanvas.width, rCanvas.height);
      rCtx.drawImage(this.compositedCanvas, 0, 0);
    }

    // Render original canvas
    if (this.originalCanvasRef) {
      const oCanvas = this.originalCanvasRef.nativeElement;
      oCanvas.width = img.width;
      oCanvas.height = img.height;
      const oCtx = oCanvas.getContext('2d')!;
      oCtx.clearRect(0, 0, oCanvas.width, oCanvas.height);
      oCtx.drawImage(img, 0, 0);
    }

    this.renderBrushCanvas();
  }

  renderBrushCanvas() {
    if (!this.brushCanvasRef || !this.originalImg()) return;
    const canvas = this.brushCanvasRef.nativeElement;
    const img = this.originalImg()!;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!this.touchupMask || !this.brushActive()) return;

    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < this.touchupMask.length; i++) {
      const val = this.touchupMask[i];
      if (val === 1) {
        // Keep (Green)
        data[i * 4] = 16;
        data[i * 4 + 1] = 185;
        data[i * 4 + 2] = 129;
        data[i * 4 + 3] = 100;
      } else if (val === 2) {
        // Erase (Red)
        data[i * 4] = 244;
        data[i * 4 + 1] = 63;
        data[i * 4 + 2] = 94;
        data[i * 4 + 3] = 100;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  // Eyedropper click handler
  handleCanvasClick(event: MouseEvent) {
    if (this.eyedropperActive()) {
      const img = this.originalImg();
      if (!img) return;
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const scaleX = img.width / rect.width;
      const scaleY = img.height / rect.height;
      const clickX = Math.floor((event.clientX - rect.left) * scaleX);
      const clickY = Math.floor((event.clientY - rect.top) * scaleY);

      // Sample color from original image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(img, 0, 0);
      const pixel = tempCtx.getImageData(clickX, clickY, 1, 1).data;

      this.pickedColor.set({ r: pixel[0], g: pixel[1], b: pixel[2] });
      this.mode.set('color-key');
      this.eyedropperActive.set(false);
      this.processBackgroundRemoval();
      return;
    }

    if (this.brushActive()) {
      this.paintBrushAt(event);
    }
  }

  // Brush Touchup Painting
  startPainting(event: MouseEvent) {
    if (!this.brushActive()) return;
    this.isPainting = true;
    this.paintBrushAt(event);
  }

  paintMove(event: MouseEvent) {
    if (!this.isPainting || !this.brushActive()) return;
    this.paintBrushAt(event);
  }

  stopPainting() {
    if (this.isPainting) {
      this.isPainting = false;
      this.processBackgroundRemoval();
    }
  }

  paintBrushAt(event: MouseEvent) {
    const img = this.originalImg();
    if (!img || !this.touchupMask) return;

    const targetEl = event.currentTarget as HTMLElement;
    const rect = targetEl.getBoundingClientRect();
    const scaleX = img.width / rect.width;
    const scaleY = img.height / rect.height;
    const centerX = Math.floor((event.clientX - rect.left) * scaleX);
    const centerY = Math.floor((event.clientY - rect.top) * scaleY);

    const radius = Math.floor(this.brushSize() * (scaleX + scaleY) * 0.5 * 0.5);
    const modeVal = this.brushMode() === 'keep' ? 1 : 2;
    const w = img.width;
    const h = img.height;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const px = centerX + dx;
          const py = centerY + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            this.touchupMask[py * w + px] = modeVal;
          }
        }
      }
    }

    this.renderBrushCanvas();
  }

  clearTouchup() {
    const img = this.originalImg();
    if (!img) return;
    this.touchupMask = new Uint8Array(img.width * img.height);
    this.renderBrushCanvas();
    this.processBackgroundRemoval();
  }

  // Backdrop actions
  setBackdrop(type: 'transparent' | 'color' | 'gradient' | 'blur' | 'custom-image') {
    this.backdropType.set(type);
    this.updateCompositedCanvas();
    this.renderCanvases();
  }

  setBackdropColor(color: string) {
    this.backdropColor.set(color);
    this.setBackdrop('color');
  }

  setBackdropGradient(grad: string) {
    this.backdropGradient.set(grad);
    this.setBackdrop('gradient');
  }

  onBackdropFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = async () => {
        const img = await this.imageService.createImageFromSource(reader.result as string);
        this.customBackdropImg.set(img);
        this.setBackdrop('custom-image');
      };
      reader.readAsDataURL(file);
    }
  }

  // Export & Download
  downloadImage(asTransparentPng: boolean = true) {
    const canvas = asTransparentPng ? this.cutoutCanvas : this.compositedCanvas;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = asTransparentPng ? 'cutout-removed-bg.png' : 'freetools-backdrop-export.jpg';
    link.href = canvas.toDataURL(asTransparentPng ? 'image/png' : 'image/jpeg', 0.95);
    link.click();
  }

  async copyToClipboard() {
    if (!this.cutoutCanvas) return;
    try {
      const blob = await this.imageService.exportCanvasToBlob(this.cutoutCanvas, {
        format: 'image/png', quality: 1
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      alert('Cutout copied to clipboard!');
    } catch {
      alert('Clipboard copy not supported by your browser in this context.');
    }
  }

  onSendToStudio() {
    if (!this.cutoutCanvas) return;
    const dataUrl = this.cutoutCanvas.toDataURL('image/png');
    this.sendToStudio.emit(dataUrl);
  }
}
