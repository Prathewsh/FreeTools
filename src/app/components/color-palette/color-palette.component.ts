import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageService } from '../../services/image.service';

@Component({
  selector: 'app-color-palette',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './color-palette.component.html',
  styleUrl: './color-palette.component.scss'
})
export class ColorPaletteComponent {
  @ViewChild('paletteCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false }) fileInputRef!: ElementRef<HTMLInputElement>;

  colors = signal<string[]>([]);
  copiedColor = signal<string | null>(null);
  pickedPixelColor = signal<string | null>(null);
  isEyedropperActive = signal<boolean>(false);
  hasImage = signal(false);
  isLoading = signal(false);

  constructor(private imageService: ImageService) {}

  onDropFile(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) this.loadFile(file);
  }

  async loadFile(file: File) {
    this.isLoading.set(true);
    try {
      await this.processImage(await this.imageService.fileToDataUrl(file));
    } catch {
      alert('Could not load image. Please choose a valid image file.');
    } finally {
      this.isLoading.set(false);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.loadFile(input.files[0]);
    }
  }

  async processImage(url: string) {
    const img = await this.imageService.createImageFromSource(url);
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const palette = this.imageService.extractColorPalette(canvas, 8);
    this.colors.set(palette);
    this.pickedPixelColor.set(null);
    this.hasImage.set(true);
  }

  handleCanvasClick(event: MouseEvent) {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((event.clientX - rect.left) * scaleX);
    const y = Math.floor((event.clientY - rect.top) * scaleY);

    const ctx = canvas.getContext('2d')!;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`.toUpperCase();

    this.pickedPixelColor.set(hex);
    this.copyHex(hex);
  }

  async copyHex(hex: string) {
    try {
      await navigator.clipboard.writeText(hex);
    } catch {
      alert('Clipboard access is unavailable. You can copy the displayed hex code manually.');
      return;
    }
    this.copiedColor.set(hex);
    setTimeout(() => this.copiedColor.set(null), 1800);
  }
}
