import { Component, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type AnnotationTool = 'arrow' | 'rect' | 'circle' | 'text' | 'step' | 'blur' | 'freehand';

interface StepItem {
  num: number;
  x: number;
  y: number;
}

@Component({
  selector: 'app-screenshot-studio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './screenshot-studio.component.html',
  styleUrl: './screenshot-studio.component.scss'
})
export class ScreenshotStudioComponent implements AfterViewInit {
  @ViewChild('stageCanvas') stageCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileIn') fileInputRef!: ElementRef<HTMLInputElement>;

  hasImage = signal<boolean>(false);
  activeTool = signal<AnnotationTool>('arrow');
  strokeColor = signal<string>('#ef4444');
  strokeWidth = signal<number>(4);
  textColor = signal<string>('#ffffff');
  fontSize = signal<number>(20);
  currentStep = signal<number>(1);
  mockupFrame = signal<'none' | 'mac' | 'browser' | 'iphone'>('none');

  private baseImage: HTMLImageElement | null = null;
  private isDrawing = false;
  private startX = 0;
  private startY = 0;
  private steps: StepItem[] = [];
  private historyStack: ImageData[] = [];

  ngAfterViewInit() {
    this.initCanvas();
  }

  initCanvas() {
    const canvas = this.stageCanvasRef?.nativeElement;
    if (!canvas) return;
    canvas.width = 900;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1e2026';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  async captureScreen() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        setTimeout(() => {
          const canvas = this.stageCanvasRef.nativeElement;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            this.saveHistory();
            this.hasImage.set(true);
          }
          stream.getTracks().forEach(t => t.stop());
        }, 300);
      };
    } catch {
      // User cancelled or screen capture not permitted
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const img = new Image();
    img.onload = () => {
      this.baseImage = img;
      const canvas = this.stageCanvasRef.nativeElement;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        this.saveHistory();
        this.hasImage.set(true);
      }
    };
    img.src = URL.createObjectURL(file);
  }

  saveHistory() {
    const canvas = this.stageCanvasRef?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      if (this.historyStack.length > 20) this.historyStack.shift();
      this.historyStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }
  }

  undo() {
    if (this.historyStack.length > 1) {
      this.historyStack.pop(); // Remove current state
      const prev = this.historyStack[this.historyStack.length - 1];
      const canvas = this.stageCanvasRef.nativeElement;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.putImageData(prev, 0, 0);
    }
  }

  onMouseDown(e: MouseEvent) {
    if (!this.hasImage()) return;
    const canvas = this.stageCanvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    this.startX = (e.clientX - rect.left) * scaleX;
    this.startY = (e.clientY - rect.top) * scaleY;
    this.isDrawing = true;

    if (this.activeTool() === 'step') {
      this.drawStepBadge(this.startX, this.startY);
      this.saveHistory();
      this.isDrawing = false;
    } else if (this.activeTool() === 'text') {
      const text = prompt('Enter annotation text:');
      if (text) {
        this.drawAnnotationText(text, this.startX, this.startY);
        this.saveHistory();
      }
      this.isDrawing = false;
    }
  }

  onMouseMove(e: MouseEvent) {
    if (!this.isDrawing) return;
    const canvas = this.stageCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    if (this.activeTool() === 'blur') {
      this.applyPixelateBrush(currentX, currentY);
      return;
    }

    if (this.activeTool() === 'freehand') {
      ctx.strokeStyle = this.strokeColor();
      ctx.lineWidth = this.strokeWidth();
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.startX, this.startY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();
      this.startX = currentX;
      this.startY = currentY;
      return;
    }

    // Live preview by restoring state
    if (this.historyStack.length) {
      ctx.putImageData(this.historyStack[this.historyStack.length - 1], 0, 0);
    }

    ctx.strokeStyle = this.strokeColor();
    ctx.lineWidth = this.strokeWidth();

    if (this.activeTool() === 'rect') {
      ctx.strokeRect(this.startX, this.startY, currentX - this.startX, currentY - this.startY);
    } else if (this.activeTool() === 'circle') {
      const radius = Math.hypot(currentX - this.startX, currentY - this.startY);
      ctx.beginPath();
      ctx.arc(this.startX, this.startY, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.activeTool() === 'arrow') {
      this.drawArrow(ctx, this.startX, this.startY, currentX, currentY);
    }
  }

  onMouseUp() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.saveHistory();
    }
  }

  private drawArrow(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) {
    const headLength = 16 + this.strokeWidth() * 1.5;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = this.strokeColor();
    ctx.fill();
  }

  private drawStepBadge(x: number, y: number) {
    const canvas = this.stageCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const radius = 16;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = this.strokeColor();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.currentStep()), x, y);

    this.currentStep.update(n => n + 1);
  }

  private drawAnnotationText(text: string, x: number, y: number) {
    const canvas = this.stageCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = `bold ${this.fontSize()}px sans-serif`;
    ctx.fillStyle = this.strokeColor();
    ctx.fillText(text, x, y);
  }

  private applyPixelateBrush(x: number, y: number) {
    const canvas = this.stageCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = 30;
    const blockSize = 6;
    const sx = Math.max(0, Math.floor(x - size / 2));
    const sy = Math.max(0, Math.floor(y - size / 2));
    const imgData = ctx.getImageData(sx, sy, size, size);
    const d = imgData.data;

    for (let py = 0; py < size; py += blockSize) {
      for (let px = 0; px < size; px += blockSize) {
        const i = (py * size + px) * 4;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        for (let dy = 0; dy < blockSize; dy++) {
          for (let dx = 0; dx < blockSize; dx++) {
            if (px + dx < size && py + dy < size) {
              const target = ((py + dy) * size + (px + dx)) * 4;
              d[target] = r;
              d[target + 1] = g;
              d[target + 2] = b;
            }
          }
        }
      }
    }
    ctx.putImageData(imgData, sx, sy);
  }

  exportImage(format: 'png' | 'jpeg') {
    const srcCanvas = this.stageCanvasRef.nativeElement;
    let outCanvas = srcCanvas;

    // Apply device mockup frame if requested
    if (this.mockupFrame() !== 'none') {
      outCanvas = document.createElement('canvas');
      const pad = this.mockupFrame() === 'mac' ? 40 : 20;
      const topBar = this.mockupFrame() === 'mac' ? 36 : 24;
      outCanvas.width = srcCanvas.width + pad * 2;
      outCanvas.height = srcCanvas.height + pad * 2 + topBar;
      const ctx = outCanvas.getContext('2d')!;

      // Backdrop shadow
      ctx.fillStyle = '#101114';
      ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);

      // Window Frame
      ctx.fillStyle = '#222329';
      ctx.roundRect(pad, pad, srcCanvas.width, srcCanvas.height + topBar, 10);
      ctx.fill();

      // Mac buttons
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(pad + 16, pad + 18, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#eab308';
      ctx.beginPath(); ctx.arc(pad + 32, pad + 18, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath(); ctx.arc(pad + 48, pad + 18, 5, 0, Math.PI * 2); ctx.fill();

      ctx.drawImage(srcCanvas, pad, pad + topBar);
    }

    const link = document.createElement('a');
    link.download = `annotated-screenshot.${format}`;
    link.href = outCanvas.toDataURL(`image/${format}`, 0.95);
    link.click();
  }
}

