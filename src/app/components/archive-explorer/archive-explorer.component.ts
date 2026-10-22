import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import JSZip from 'jszip';

interface ArchiveEntry {
  name: string;
  size: number;
  compressedSize: number;
  dir: boolean;
  date: Date;
  isExecutable: boolean;
  isSuspicious: boolean;
  riskReason: string;
}

@Component({
  selector: 'app-archive-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './archive-explorer.component.html',
  styleUrl: './archive-explorer.component.scss'
})
export class ArchiveExplorerComponent {
  fileName = signal<string>('');
  fileSize = signal<number>(0);
  entries = signal<ArchiveEntry[]>([]);
  isLoading = signal<boolean>(false);
  filterSuspicious = signal<boolean>(false);
  isDragging = signal<boolean>(false);
  selectedEntry = signal<ArchiveEntry | null>(null);
  zipInstance: JSZip | null = null;
  previewText = signal<string>('');
  errorMsg = signal<string>('');

  executableExts = new Set(['exe', 'bat', 'cmd', 'sh', 'com', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'scr', 'pif', 'hta', 'cpl', 'jar', 'apk', 'msi', 'ps1']);

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
    if (e.dataTransfer?.files?.[0]) {
      this.loadFile(e.dataTransfer.files[0]);
    }
  }

  onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.loadFile(input.files[0]);
      input.value = '';
    }
  }

  async loadFile(file: File) {
    this.isLoading.set(true);
    this.errorMsg.set('');
    this.fileName.set(file.name);
    this.fileSize.set(file.size);
    this.entries.set([]);
    this.selectedEntry.set(null);
    this.previewText.set('');

    try {
      const buffer = await file.arrayBuffer();
      const zip = new JSZip();
      const content = await zip.loadAsync(buffer);
      this.zipInstance = content;

      const list: ArchiveEntry[] = [];

      content.forEach((relativePath, fileObj) => {
        const isDir = fileObj.dir;
        const lower = relativePath.toLowerCase();
        const parts = lower.split('/');
        const simpleName = parts[parts.length - 1] || parts[parts.length - 2];
        const ext = simpleName.split('.').pop() || '';

        const isExecutable = this.executableExts.has(ext);
        
        // Disguised executable check: e.g. document.pdf.exe or hidden double extension, or space before exe
        const isDoubleExt = /\.(pdf|docx?|xlsx?|jpg|png|txt)\s*\.(exe|scr|bat|cmd|vbs|pif|jar)$/i.test(simpleName);
        const hasHiddenExt = simpleName.includes('\u202E') || simpleName.includes('%20'); // Right-to-left override or URL disguised
        const isSuspicious = isDoubleExt || hasHiddenExt || (isExecutable && !simpleName.endsWith('.jar'));

        let riskReason = '';
        if (isDoubleExt) riskReason = 'Disguised extension (double extension)';
        else if (hasHiddenExt) riskReason = 'Suspicious unicode / hidden extension bypass';
        else if (isExecutable) riskReason = 'Executable payload';

        // Internal sizes
        const anyObj = fileObj as any;
        const uncompressedSize = anyObj._data?.uncompressedSize || 0;
        const compressedSize = anyObj._data?.compressedSize || 0;

        list.push({
          name: relativePath,
          size: uncompressedSize,
          compressedSize: compressedSize,
          dir: isDir,
          date: fileObj.date,
          isExecutable,
          isSuspicious,
          riskReason
        });
      });

      this.entries.set(list);
    } catch (err: any) {
      this.errorMsg.set('Unable to parse archive. Make sure it is a valid ZIP, JAR, or unencrypted archive.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async viewEntry(entry: ArchiveEntry) {
    if (entry.dir || !this.zipInstance) return;
    this.selectedEntry.set(entry);
    this.previewText.set('Loading preview...');

    try {
      const file = this.zipInstance.file(entry.name);
      if (!file) {
        this.previewText.set('Cannot read file');
        return;
      }
      
      const ext = entry.name.split('.').pop()?.toLowerCase();
      const textExts = ['txt', 'json', 'md', 'xml', 'html', 'css', 'js', 'ts', 'yaml', 'yml', 'ini', 'cfg', 'properties', 'env'];

      if (textExts.includes(ext || '') || entry.size < 50000) {
        const text = await file.async('text');
        this.previewText.set(text.slice(0, 10000));
      } else {
        this.previewText.set(`Binary file (${this.formatBytes(entry.size)}). Direct text preview unavailable.`);
      }
    } catch (e: any) {
      this.previewText.set('Failed to read content.');
    }
  }

  async downloadEntry(entry: ArchiveEntry) {
    if (entry.dir || !this.zipInstance) return;
    const file = this.zipInstance.file(entry.name);
    if (!file) return;

    const blob = await file.async('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = entry.name.split('/').pop() || 'download';
    a.click();
    URL.revokeObjectURL(url);
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  get suspiciousCount(): number {
    return this.entries().filter(e => e.isSuspicious).length;
  }

  get displayedEntries(): ArchiveEntry[] {
    if (this.filterSuspicious()) {
      return this.entries().filter(e => e.isSuspicious);
    }
    return this.entries();
  }
}

