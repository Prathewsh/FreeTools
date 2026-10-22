import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream } from 'pdf-lib';

interface SecurityFinding {
  name: string;
  category: 'JavaScript' | 'Action' | 'Hidden Layer' | 'External Link' | 'Embedded File' | 'Form';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  description: string;
  snippet?: string;
  occurrences: number;
}

interface PdfMetadataInfo {
  pageCount: number;
  pdfVersion: string;
  hasJavaScript: boolean;
  hasHiddenLayers: boolean;
  hasEmbeddedFiles: boolean;
  hasLaunchActions: boolean;
  hasExternalUris: boolean;
  fileSizeBytes: number;
}

@Component({
  selector: 'app-pdf-inspector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pdf-inspector.component.html',
  styleUrl: './pdf-inspector.component.scss'
})
export class PdfInspectorComponent {
  fileName = signal<string>('');
  fileSize = signal<string>('');
  isAnalyzing = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  metadata = signal<PdfMetadataInfo | null>(null);
  findings = signal<SecurityFinding[]>([]);
  extractedScripts = signal<string[]>([]);
  extractedLayers = signal<string[]>([]);
  rawPayloadSnippet = signal<string>('');

  copiedIndex = signal<number | null>(null);

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    this.processFile(file);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      this.processFile(event.dataTransfer.files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  async processFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      this.errorMessage.set('Please select a valid PDF file.');
      return;
    }

    this.fileName.set(file.name);
    this.fileSize.set((file.size / 1024).toFixed(1) + ' KB');
    this.isAnalyzing.set(true);
    this.errorMessage.set(null);
    this.findings.set([]);
    this.extractedScripts.set([]);
    this.extractedLayers.set([]);
    this.metadata.set(null);

    try {
      const buffer = await file.arrayBuffer();
      await this.analyzePdfBuffer(buffer, file.size);
    } catch (err: any) {
      console.error(err);
      this.errorMessage.set(err.message || 'Failed to inspect PDF structure. File may be encrypted or corrupted.');
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  loadSampleMaliciousPdf() {
    // Generate a minimal virtual PDF containing JavaScript OpenAction & hidden layer for demonstration
    const sample = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (app.alert('Suspicious PDF Alert: FreeTools Security Lab detected automated script execution.');) >> >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Properties << /oc1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 20 >>
stream
BT /F1 12 Tf ET
endstream
endobj
5 0 obj
<< /Type /OCG /Name (Confidential_Watermark_HiddenLayer) /Usage << /View << /ViewState /OFF >> >> >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000155 00000 n 
0000000212 00000 n 
0000000330 00000 n 
0000000400 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
530
%%EOF`;

    const encoder = new TextEncoder();
    const buf = encoder.encode(sample).buffer;
    this.fileName.set('sample_js_hidden_layer.pdf');
    this.fileSize.set((sample.length / 1024).toFixed(1) + ' KB');
    this.isAnalyzing.set(true);
    this.errorMessage.set(null);

    setTimeout(() => {
      this.analyzePdfBuffer(buf, sample.length);
      this.isAnalyzing.set(false);
    }, 200);
  }

  private async analyzePdfBuffer(buffer: ArrayBuffer, byteLength: number) {
    const rawText = new TextDecoder('latin1').decode(new Uint8Array(buffer));
    const findingsList: SecurityFinding[] = [];
    const scriptsList: string[] = [];
    const layersList: string[] = [];

    // Parse with pdf-lib to get page count and object tree
    let pageCount = 1;
    let pdfDoc: PDFDocument | null = null;
    try {
      pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      pageCount = pdfDoc.getPageCount();
    } catch {
      // Non-fatal if pdf-lib fails on raw streams
    }

    // 1. JavaScript Detection (/JavaScript and /JS)
    const jsMatches = [...rawText.matchAll(/\/JS\s*(?:\(([\s\S]*?)\)|<([0-9a-fA-F]+)>)/g)];
    const jsKeywordMatches = rawText.match(/\/JavaScript\b/g) || [];
    const totalJsCount = jsMatches.length || jsKeywordMatches.length;

    if (totalJsCount > 0) {
      for (const m of jsMatches) {
        let code = m[1] || '';
        if (m[2]) {
          // Hex string decode
          code = this.hexDecode(m[2]);
        }
        if (code) {
          scriptsList.push(code.trim());
        }
      }

      findingsList.push({
        name: 'Embedded JavaScript Executable',
        category: 'JavaScript',
        severity: 'HIGH',
        description: 'Contains executable Adobe Acrobat JavaScript code that can trigger when the document is viewed or interacted with.',
        occurrences: totalJsCount,
        snippet: scriptsList[0] || 'Embedded /JS action detected in PDF trailer or object dictionary'
      });
    }

    // 2. OpenAction / AA (Automated Execution on Open)
    const openActionMatches = rawText.match(/\/(?:OpenAction|AA)\b/g);
    if (openActionMatches) {
      findingsList.push({
        name: 'Auto-Trigger on Open (/OpenAction or /AA)',
        category: 'Action',
        severity: 'CRITICAL',
        description: 'Configured to automatically run an action (such as launching an app or firing JavaScript) as soon as the user opens the file without clicking.',
        occurrences: openActionMatches.length
      });
    }

    // 3. Binary Launch (/Launch)
    const launchMatches = rawText.match(/\/Launch\b/g);
    if (launchMatches) {
      findingsList.push({
        name: 'System Binary / Command Execution (/Launch)',
        category: 'Action',
        severity: 'CRITICAL',
        description: 'Attempts to invoke external operating system binaries (e.g. cmd.exe, PowerShell, bash) or command strings.',
        occurrences: launchMatches.length
      });
    }

    // 4. Hidden Layers & Optional Content Groups (/OCG)
    const ocgMatches = [...rawText.matchAll(/\/Type\s*\/OCG[\s\S]*?\/Name\s*(?:\(([\s\S]*?)\)|\/([^\s\/>]+))/g)];
    const rawOcgCount = (rawText.match(/\/OCG\b/g) || []).length;

    if (rawOcgCount > 0 || ocgMatches.length > 0) {
      for (const m of ocgMatches) {
        const name = (m[1] || m[2] || '').trim();
        if (name && !layersList.includes(name)) {
          layersList.push(name);
        }
      }

      findingsList.push({
        name: 'Optional Content Groups (Hidden / Conditional Layers)',
        category: 'Hidden Layer',
        severity: 'MEDIUM',
        description: 'PDF utilizes OCG layers. Some layers can be hidden from view on screen but printed on paper, or obscured based on viewer state.',
        occurrences: ocgMatches.length || rawOcgCount,
        snippet: layersList.length ? `Layers: ${layersList.join(', ')}` : 'OCG dictionaries detected'
      });
    }

    // 5. Embedded File Payloads (/EmbeddedFiles)
    const embeddedMatches = rawText.match(/\/(?:EmbeddedFiles|EF)\b/g);
    if (embeddedMatches) {
      findingsList.push({
        name: 'Embedded File Payloads (/EmbeddedFiles)',
        category: 'Embedded File',
        severity: 'HIGH',
        description: 'Contains file attachments embedded inside the PDF object tree, often used by malware droppers to smuggle second-stage executables.',
        occurrences: embeddedMatches.length
      });
    }

    // 6. External Web URI Links (/URI)
    const uriMatches = [...rawText.matchAll(/\/URI\s*\((https?:\/\/[^\s\)]+)\)/g)];
    if (uriMatches.length > 0) {
      findingsList.push({
        name: 'Outbound Hyperlinks (/URI)',
        category: 'External Link',
        severity: 'INFO',
        description: 'Contains clickable links that navigate external browser windows to remote web addresses.',
        occurrences: uriMatches.length,
        snippet: uriMatches.slice(0, 3).map(m => m[1]).join(', ')
      });
    }

    // 7. Dynamic XFA / AcroForms
    const xfaMatches = rawText.match(/\/XFA\b/g);
    if (xfaMatches) {
      findingsList.push({
        name: 'Dynamic XML Forms Architecture (XFA)',
        category: 'Form',
        severity: 'MEDIUM',
        description: 'Contains Adobe XFA dynamic XML structures which expand the PDF attack surface through scriptable form calculations.',
        occurrences: xfaMatches.length
      });
    }

    this.findings.set(findingsList);
    this.extractedScripts.set(scriptsList);
    this.extractedLayers.set(layersList);

    // PDF Header version
    const verMatch = rawText.match(/%PDF-(\d+\.\d+)/);
    const pdfVersion = verMatch ? verMatch[1] : '1.4+';

    this.metadata.set({
      pageCount,
      pdfVersion,
      hasJavaScript: totalJsCount > 0,
      hasHiddenLayers: (rawOcgCount > 0 || layersList.length > 0),
      hasEmbeddedFiles: !!embeddedMatches,
      hasLaunchActions: !!launchMatches,
      hasExternalUris: uriMatches.length > 0,
      fileSizeBytes: byteLength
    });
  }

  private hexDecode(hex: string): string {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  }

  copyScript(text: string, index: number) {
    navigator.clipboard.writeText(text);
    this.copiedIndex.set(index);
    setTimeout(() => this.copiedIndex.set(null), 2000);
  }
}

