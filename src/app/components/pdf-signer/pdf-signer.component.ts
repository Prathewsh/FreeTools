import { Component, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker
(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

@Component({
  selector: 'app-pdf-signer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pdf-signer.component.html',
  styleUrl: './pdf-signer.component.scss'
})
export class PdfSignerComponent implements AfterViewInit {
  @ViewChild('sigPad') sigPadRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pdfCanvas') pdfCanvasRef!: ElementRef<HTMLCanvasElement>;

  signMode = signal<'draw' | 'type' | 'upload'>('draw');
  typedSignature = signal<string>('');
  fontFamily = signal<string>('cursive');
  
  pdfBytes: ArrayBuffer | null = null;
  pdfDoc: any = null;
  currentPage = signal<number>(1);
  totalPages = signal<number>(1);
  pdfLoaded = signal<boolean>(false);

  // Signature placement state
  signatureDataUrl = signal<string | null>(null);
  sigX = signal<number>(150);
  sigY = signal<number>(150);
  sigWidth = signal<number>(160);
  sigHeight = signal<number>(60);
  isDraggingSig = signal<boolean>(false);
  dragStartX = 0;
  dragStartY = 0;

  private isDrawing = false;

  ngAfterViewInit() {
    this.initSigPad();
  }

  initSigPad() {
    if (!this.sigPadRef) return;
    const canvas = this.sigPadRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
  }

  onMouseDown(e: MouseEvent) {
    if (this.signMode() !== 'draw') return;
    this.isDrawing = true;
    const canvas = this.sigPadRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  onMouseMove(e: MouseEvent) {
    if (!this.isDrawing || this.signMode() !== 'draw') return;
    const canvas = this.sigPadRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  }

  onMouseUp() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.generateSignatureImage();
    }
  }

  clearSigPad() {
    if (!this.sigPadRef) return;
    const canvas = this.sigPadRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.signatureDataUrl.set(null);
  }

  generateSignatureImage() {
    if (this.signMode() === 'draw') {
      const canvas = this.sigPadRef.nativeElement;
      this.signatureDataUrl.set(canvas.toDataURL('image/png'));
    } else if (this.signMode() === 'type') {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#000000';
      ctx.font = `italic 36px ${this.fontFamily()}`;
      ctx.fillText(this.typedSignature() || 'Signature', 20, 60);
      this.signatureDataUrl.set(canvas.toDataURL('image/png'));
    }
  }

  onUploadSig(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        this.signatureDataUrl.set(reader.result as string);
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  async onPdfUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) {
      const file = input.files[0];
      this.pdfBytes = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(this.pdfBytes) });
      this.pdfDoc = await loadingTask.promise;
      this.totalPages.set(this.pdfDoc.numPages);
      this.currentPage.set(1);
      this.pdfLoaded.set(true);
      await this.renderPdfPage(1);
    }
  }

  async renderPdfPage(num: number) {
    if (!this.pdfDoc || !this.pdfCanvasRef) return;
    const page = await this.pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: 1.2 });
    const canvas = this.pdfCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;
  }

  async nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      await this.renderPdfPage(this.currentPage());
    }
  }

  async prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      await this.renderPdfPage(this.currentPage());
    }
  }

  startSigDrag(e: MouseEvent) {
    e.preventDefault();
    this.isDraggingSig.set(true);
    this.dragStartX = e.clientX - this.sigX();
    this.dragStartY = e.clientY - this.sigY();

    const onMove = (moveEv: MouseEvent) => {
      if (this.isDraggingSig()) {
        this.sigX.set(Math.max(0, moveEv.clientX - this.dragStartX));
        this.sigY.set(Math.max(0, moveEv.clientY - this.dragStartY));
      }
    };

    const onUp = () => {
      this.isDraggingSig.set(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  async downloadSignedPdf() {
    if (!this.pdfBytes || !this.signatureDataUrl()) return;

    try {
      const pdf = await PDFDocument.load(this.pdfBytes);
      const pages = pdf.getPages();
      const pageIndex = this.currentPage() - 1;
      const page = pages[pageIndex];

      const pngImg = await pdf.embedPng(this.signatureDataUrl()!);
      const { width: pageW, height: pageH } = page.getSize();

      const canvas = this.pdfCanvasRef.nativeElement;
      const scaleX = pageW / canvas.width;
      const scaleY = pageH / canvas.height;

      // In PDF coordinate system, origin (0,0) is bottom-left
      const pdfX = this.sigX() * scaleX;
      const pdfY = pageH - ((this.sigY() + this.sigHeight()) * scaleY);
      const pdfW = this.sigWidth() * scaleX;
      const pdfH = this.sigHeight() * scaleY;

      page.drawImage(pngImg, {
        x: pdfX,
        y: pdfY,
        width: pdfW,
        height: pdfH
      });

      const savedBytes = await pdf.save();
      const blob = new Blob([savedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'signed-document.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Signing failed', e);
    }
  }
}
