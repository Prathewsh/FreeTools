import { Component, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

type PdfSubtool = 'doc-editor' | 'merge' | 'split' | 'rotate' | 'metadata';

interface PdfFileItem {
  id: number;
  name: string;
  size: string;
  pageCount: number;
  bytes: Uint8Array;
}

@Component({
  selector: 'app-pdf-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pdf-editor.component.html',
  styleUrl: './pdf-editor.component.scss'
})
export class PdfEditorComponent {
  @ViewChild('editorArea') editorAreaRef!: ElementRef<HTMLDivElement>;

  mode = signal<PdfSubtool>('doc-editor');
  isProcessing = signal(false);

  // Document Editor State
  docTitle = signal('Document Title');
  pageSize = signal<'a4' | 'letter' | 'legal'>('a4');
  docPageSize = this.pageSize; // alias
  docFont = signal<'sans' | 'serif' | 'mono'>('sans');
  fontFamily = this.docFont; // alias
  docMargin = signal<number>(50); // pt
  fontSize = signal<number>(12);
  isGeneratingPdf = signal(false);

  // Multi-PDF State
  pdfFiles = signal<PdfFileItem[]>([]);
  mergeList = this.pdfFiles; // alias for merge view
  activePdf = signal<PdfFileItem | null>(null);
  splitPdfItem = signal<PdfFileItem | null>(null);
  rotatePdfItem = signal<PdfFileItem | null>(null);

  // Split & Rotate
  splitRanges = signal('1, 2-3');
  splitRange = this.splitRanges; // alias
  rotationAngle = signal<number>(90);

  // Metadata
  pdfTitle = signal('');
  pdfAuthor = signal('');
  pdfSubject = signal('');
  metaTitle = signal('');
  metaAuthor = signal('');
  metaSubject = signal('');
  metaKeywords = signal('');
  metaPdfItem = signal<PdfFileItem | null>(null);

  // Rich Text Editor Commands
  execCmd(command: string, value: string | undefined = undefined) {
    document.execCommand(command, false, value);
    if (this.editorAreaRef) {
      this.editorAreaRef.nativeElement.focus();
    }
  }

  insertHeading(level: string) {
    this.execCmd('formatBlock', `<${level}>`);
  }

  insertList(ordered: boolean) {
    this.execCmd(ordered ? 'insertOrderedList' : 'insertUnorderedList');
  }

  // --- Upload existing PDF directly into Content Editor ---
  async onPdfUploadToEditor(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    this.isProcessing.set(true);

    try {
      const buffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdf = await loadingTask.promise;

      let extractedHtml = '';
      this.docTitle.set(file.name.replace(/\.[^/.]+$/, ''));

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        let lastY: number | null = null;
        let pageText = '';

        for (const item of textContent.items as any[]) {
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 8) {
            pageText += '\n';
          }
          pageText += item.str + ' ';
          lastY = item.transform[5];
        }

        const paragraphs = pageText
          .split('\n')
          .map(p => p.trim())
          .filter(Boolean);

        extractedHtml += `<h3>Page ${pageNum}</h3>`;
        paragraphs.forEach(para => {
          extractedHtml += `<p>${para}</p>`;
        });
        if (pageNum < pdf.numPages) {
          extractedHtml += '<hr/>';
        }
      }

      if (this.editorAreaRef) {
        this.editorAreaRef.nativeElement.innerHTML = extractedHtml;
      }
    } catch {
      alert('Could not extract text from this PDF. It may be a scanned image or protected.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  // --- Export Document Editor to Real PDF using pdf-lib ---
  async exportDocumentToPdf() {
    if (!this.editorAreaRef) return;
    this.isProcessing.set(true);

    try {
      const editorEl = this.editorAreaRef.nativeElement;
      const innerText = editorEl.innerText || '';

      const pdfDoc = await PDFDocument.create();

      let pageW = 595.28; // A4
      let pageH = 841.89;
      if (this.docPageSize() === 'letter') {
        pageW = 612.0;
        pageH = 792.0;
      } else if (this.docPageSize() === 'legal') {
        pageW = 612.0;
        pageH = 1008.0;
      }

      const fontType = this.fontFamily() === 'serif'
        ? StandardFonts.TimesRoman
        : this.fontFamily() === 'mono'
        ? StandardFonts.Courier
        : StandardFonts.Helvetica;

      const font = await pdfDoc.embedFont(fontType);
      const fontBold = await pdfDoc.embedFont(
        this.fontFamily() === 'serif' ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold
      );

      const margin = this.docMargin();
      const contentWidth = pageW - margin * 2;
      const fSize = this.fontSize();
      const lineHeight = fSize * 1.45;

      let page = pdfDoc.addPage([pageW, pageH]);
      let currentY = pageH - margin;

      if (this.docTitle()) {
        page.drawText(this.docTitle(), {
          x: margin,
          y: currentY - 20,
          size: 20,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.15)
        });
        currentY -= 45;
      }

      const paragraphs = innerText.split('\n');

      for (const paragraph of paragraphs) {
        if (!paragraph.trim()) {
          currentY -= lineHeight * 0.75;
          continue;
        }

        const words = paragraph.split(' ');
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const textWidth = font.widthOfTextAtSize(testLine, fSize);

          if (textWidth > contentWidth) {
            if (currentY - lineHeight < margin) {
              page = pdfDoc.addPage([pageW, pageH]);
              currentY = pageH - margin;
            }
            page.drawText(currentLine, {
              x: margin,
              y: currentY,
              size: fSize,
              font,
              color: rgb(0.15, 0.15, 0.2)
            });
            currentY -= lineHeight;
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }

        if (currentLine) {
          if (currentY - lineHeight < margin) {
            page = pdfDoc.addPage([pageW, pageH]);
            currentY = pageH - margin;
          }
          page.drawText(currentLine, {
            x: margin,
            y: currentY,
            size: fSize,
            font,
            color: rgb(0.15, 0.15, 0.2)
          });
          currentY -= lineHeight * 1.25;
        }
      }

      const pdfBytes = await pdfDoc.save();
      const filename = `${this.docTitle().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'document'}.pdf`;
      this.downloadPdf(pdfBytes, filename);
    } catch {
      alert('Error generating PDF document.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  // --- Upload Existing PDFs for Merge/Split/Rotate ---
  async onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files.length) return;

    this.isProcessing.set(true);
    const files = Array.from(input.files);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      try {
        const doc = await PDFDocument.load(bytes);
        const pageCount = doc.getPageCount();
        const item: PdfFileItem = {
          id: Date.now() + i,
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          pageCount,
          bytes
        };

        this.pdfFiles.update(list => [...list, item]);
        if (!this.activePdf()) {
          this.activePdf.set(item);
          this.pdfTitle.set(doc.getTitle() || '');
          this.pdfAuthor.set(doc.getAuthor() || '');
          this.pdfSubject.set(doc.getSubject() || '');
        }
      } catch {
        alert(`Could not parse ${file.name}. Ensure it is an unencrypted PDF.`);
      }
    }
    this.isProcessing.set(false);
  }

  removeFile(index: number) {
    this.pdfFiles.update(list => list.filter((_, i) => i !== index));
    if (this.pdfFiles().length === 0) this.activePdf.set(null);
  }

  async mergePdfs() {
    const list = this.pdfFiles();
    if (list.length < 2) {
      alert('Please select at least 2 PDF files to merge.');
      return;
    }

    this.isProcessing.set(true);
    try {
      const mergedDoc = await PDFDocument.create();

      for (const item of list) {
        const doc = await PDFDocument.load(item.bytes);
        const copiedPages = await mergedDoc.copyPages(doc, doc.getPageIndices());
        copiedPages.forEach(p => mergedDoc.addPage(p));
      }

      const mergedBytes = await mergedDoc.save();
      this.downloadPdf(mergedBytes, `merged-${Date.now()}.pdf`);
    } catch {
      alert('Error merging PDFs.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  async splitPdf() {
    const active = this.activePdf();
    if (!active) {
      alert('Please load a PDF to split.');
      return;
    }

    this.isProcessing.set(true);
    try {
      const sourceDoc = await PDFDocument.load(active.bytes);
      const totalPages = sourceDoc.getPageCount();

      const selectedIndices: number[] = [];
      const parts = this.splitRanges().split(',');

      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
          const [startStr, endStr] = trimmed.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (!isNaN(start) && !isNaN(end)) {
            for (let p = Math.max(1, start); p <= Math.min(totalPages, end); p++) {
              selectedIndices.push(p - 1);
            }
          }
        } else {
          const pageNum = parseInt(trimmed, 10);
          if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
            selectedIndices.push(pageNum - 1);
          }
        }
      }

      const uniqueIndices = Array.from(new Set(selectedIndices)).sort((a, b) => a - b);
      if (!uniqueIndices.length) {
        alert('Invalid page ranges specified.');
        this.isProcessing.set(false);
        return;
      }

      const newDoc = await PDFDocument.create();
      const copied = await newDoc.copyPages(sourceDoc, uniqueIndices);
      copied.forEach(p => newDoc.addPage(p));

      const splitBytes = await newDoc.save();
      this.downloadPdf(splitBytes, `split-${active.name}`);
    } catch {
      alert('Error extracting pages.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  async rotateAllPages() {
    const active = this.activePdf();
    if (!active) return;

    this.isProcessing.set(true);
    try {
      const doc = await PDFDocument.load(active.bytes);
      const pages = doc.getPages();
      const angle = this.rotationAngle();

      pages.forEach(p => {
        const current = p.getRotation().angle;
        p.setRotation(degrees((current + angle) % 360));
      });

      const rotatedBytes = await doc.save();
      this.downloadPdf(rotatedBytes, `rotated-${active.name}`);
    } catch {
      alert('Error rotating pages.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  async updateMetadata() {
    const active = this.activePdf();
    if (!active) return;

    this.isProcessing.set(true);
    try {
      const doc = await PDFDocument.load(active.bytes);
      doc.setTitle(this.pdfTitle());
      doc.setAuthor(this.pdfAuthor());
      doc.setSubject(this.pdfSubject());

      const bytes = await doc.save();
      this.downloadPdf(bytes, `updated-${active.name}`);
    } catch {
      alert('Error updating metadata.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  // Aliases for template bindings
  async exportDocumentAsPdf() {
    return this.exportDocumentToPdf();
  }

  async onMergeFilesSelected(event: Event) {
    return this.onFilesSelected(event);
  }

  moveMergeItem(index: number, direction: number) {
    const list = [...this.pdfFiles()];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const temp = list[index];
    list[index] = list[target];
    list[target] = temp;
    this.pdfFiles.set(list);
  }

  removeMergeItem(id: number) {
    this.pdfFiles.update(list => list.filter(item => item.id !== id));
  }

  async executeMerge() {
    return this.mergePdfs();
  }

  async onSplitFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const doc = await PDFDocument.load(bytes);
    const item: PdfFileItem = {
      id: Date.now(),
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      pageCount: doc.getPageCount(),
      bytes
    };
    this.splitPdfItem.set(item);
    this.activePdf.set(item);
  }

  async executeSplit() {
    return this.splitPdf();
  }

  async onRotateFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const doc = await PDFDocument.load(bytes);
    const item: PdfFileItem = {
      id: Date.now(),
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      pageCount: doc.getPageCount(),
      bytes
    };
    this.rotatePdfItem.set(item);
    this.activePdf.set(item);
  }

  async executeRotate(angle: number) {
    this.rotationAngle.set(angle);
    return this.rotateAllPages();
  }

  async onMetaFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const doc = await PDFDocument.load(bytes);
    this.metaTitle.set(doc.getTitle() || '');
    this.metaAuthor.set(doc.getAuthor() || '');
    this.metaSubject.set(doc.getSubject() || '');
    this.metaKeywords.set(doc.getKeywords() || '');
    this.metaPdfItem.set({
      id: Date.now(),
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      pageCount: doc.getPageCount(),
      bytes
    });
  }

  async saveMetadata() {
    const item = this.metaPdfItem();
    if (!item) return;
    this.isProcessing.set(true);
    try {
      const doc = await PDFDocument.load(item.bytes);
      doc.setTitle(this.metaTitle());
      doc.setAuthor(this.metaAuthor());
      doc.setSubject(this.metaSubject());
      doc.setKeywords(this.metaKeywords().split(',').map(s => s.trim()).filter(Boolean));
      const bytes = await doc.save();
      this.downloadPdf(bytes, `metadata-${item.name}`);
    } catch {
      alert('Error saving metadata');
    } finally {
      this.isProcessing.set(false);
    }
  }

  downloadPdf(bytes: Uint8Array, filename: string) {
    const blob = new Blob([bytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
