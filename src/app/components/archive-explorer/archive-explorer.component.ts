import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import JSZip from 'jszip';
import { gunzipSync } from 'fflate';
import type { UnarchiveExtractEvent, UnarchiveErrorEvent } from '@codedread/bitjs';

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
  rawEntries = new Map<string, Uint8Array>();
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
    this.zipInstance = null;
    this.rawEntries.clear();

    try {
      const buffer = await file.arrayBuffer();
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith('.tar.gz') || lowerName.endsWith('.tgz') || lowerName.endsWith('.tar')) {
        await this.loadTarArchive(buffer, lowerName.endsWith('.tar.gz') || lowerName.endsWith('.tgz'));
      } else if (lowerName.endsWith('.rar')) {
        await this.loadRarArchive(buffer);
      } else {
        await this.loadZipArchive(buffer);
      }
    } catch (err: any) {
      this.errorMsg.set('Unable to parse archive. Make sure it is a valid ZIP, RAR, TAR, TAR.GZ, or unencrypted archive.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadZipArchive(buffer: ArrayBuffer) {
    const zip = new JSZip();
    const content = await zip.loadAsync(buffer);
    this.zipInstance = content;

    const list: ArchiveEntry[] = [];

    content.forEach((relativePath, fileObj) => {
      const isDir = fileObj.dir;
      const risk = this.analyzeEntryRisk(relativePath, isDir);

      const anyObj = fileObj as any;
      const uncompressedSize = anyObj._data?.uncompressedSize || 0;
      const compressedSize = anyObj._data?.compressedSize || 0;

      list.push({
        name: relativePath,
        size: uncompressedSize,
        compressedSize: compressedSize,
        dir: isDir,
        date: fileObj.date,
        isExecutable: risk.isExecutable,
        isSuspicious: risk.isSuspicious,
        riskReason: risk.riskReason
      });
    });

    this.entries.set(list);
  }

  private async loadRarArchive(buffer: ArrayBuffer) {
    // Serve BitJS as native modules so its workers retain their relative module paths.
    const bitjsUrl = new URL('vendor/bitjs/index.js', document.baseURI).href;
    const { Unrarrer, UnarchiveEventType } = await import(/* @vite-ignore */ bitjsUrl) as typeof import('@codedread/bitjs');
    return new Promise<void>((resolve, reject) => {
      try {
        const unrarrer = new Unrarrer(buffer);
        const list: ArchiveEntry[] = [];

        unrarrer.addEventListener(UnarchiveEventType.EXTRACT, (e: any) => {
          const evt = e as UnarchiveExtractEvent;
          const unarchived = evt.unarchivedFile;
          if (!unarchived) return;

          const isDir = unarchived.filename.endsWith('/') || (unarchived as any).header?.flags?.directory === true;
          const data = unarchived.fileData || new Uint8Array(0);
          this.rawEntries.set(unarchived.filename, data);

          const risk = this.analyzeEntryRisk(unarchived.filename, isDir);
          const size = data.length || (unarchived as any).header?.unpackedSize || 0;
          const compressedSize = (unarchived as any).header?.packSize || size;
          const fileTime = (unarchived as any).header?.fileTime;
          const date = typeof fileTime === 'number' ? new Date(fileTime * 1000) : new Date();

          list.push({
            name: unarchived.filename,
            size,
            compressedSize,
            dir: isDir,
            date,
            isExecutable: risk.isExecutable,
            isSuspicious: risk.isSuspicious,
            riskReason: risk.riskReason
          });
        });

        unrarrer.addEventListener(UnarchiveEventType.FINISH, () => {
          this.entries.set(list);
          resolve();
        });

        unrarrer.addEventListener(UnarchiveEventType.ERROR, (e: any) => {
          const errEvt = e as UnarchiveErrorEvent;
          reject(new Error(errEvt.msg || 'RAR extraction failed'));
        });

        unrarrer.start();
      } catch (err) {
        reject(err);
      }
    });
  }

  private async loadTarArchive(buffer: ArrayBuffer, isGzipped: boolean) {
    let u8 = new Uint8Array(buffer);
    if (isGzipped) {
      u8 = gunzipSync(u8);
    }

    const list: ArchiveEntry[] = [];
    let offset = 0;
    const decoder = new TextDecoder();
    let nextOverrideName = '';

    while (offset + 512 <= u8.length) {
      const header = u8.subarray(offset, offset + 512);
      let isZero = true;
      for (let i = 0; i < 512; i++) {
        if (header[i] !== 0) {
          isZero = false;
          break;
        }
      }
      if (isZero) break;

      const readStr = (start: number, length: number) => {
        let end = start;
        while (end < start + length && header[end] !== 0) end++;
        return decoder.decode(header.subarray(start, end)).trim();
      };

      let name = readStr(0, 100);
      const sizeStr = readStr(124, 12);
      const size = parseInt(sizeStr, 8) || 0;
      const mtimeStr = readStr(136, 12);
      const mtime = parseInt(mtimeStr, 8) ? new Date(parseInt(mtimeStr, 8) * 1000) : new Date();
      const typeflag = String.fromCharCode(header[156]);
      const prefix = readStr(345, 155);

      if (prefix && !nextOverrideName) {
        name = prefix + '/' + name;
      }

      const contentStart = offset + 512;
      const fileData = u8.subarray(contentStart, contentStart + size);

      if (typeflag === 'L') {
        nextOverrideName = decoder.decode(fileData).replace(/\0+$/, '');
        offset += 512 + Math.ceil(size / 512) * 512;
        continue;
      } else if (typeflag === 'x' || typeflag === 'g') {
        const paxText = decoder.decode(fileData);
        for (const line of paxText.split('\n')) {
          const match = /^\d+ ([^=]+)=(.*)$/.exec(line);
          if (match && match[1] === 'path') {
            nextOverrideName = match[2];
          }
        }
        offset += 512 + Math.ceil(size / 512) * 512;
        continue;
      }

      if (nextOverrideName) {
        name = nextOverrideName;
        nextOverrideName = '';
      }

      if (name.startsWith('./')) name = name.slice(2);
      const isDir = typeflag === '5' || name.endsWith('/');

      if (name && name !== '.' && !name.includes('PaxHeader/')) {
        const risk = this.analyzeEntryRisk(name, isDir);
        this.rawEntries.set(name, isDir ? new Uint8Array(0) : fileData);

        list.push({
          name,
          size,
          compressedSize: size,
          dir: isDir,
          date: mtime,
          isExecutable: risk.isExecutable,
          isSuspicious: risk.isSuspicious,
          riskReason: risk.riskReason
        });
      }

      offset += 512 + Math.ceil(size / 512) * 512;
    }

    this.entries.set(list);
  }

  private analyzeEntryRisk(relativePath: string, isDir: boolean) {
    if (isDir) {
      return { isExecutable: false, isSuspicious: false, riskReason: '' };
    }

    const lower = relativePath.toLowerCase();
    const parts = lower.split('/');
    const simpleName = parts[parts.length - 1] || parts[parts.length - 2] || '';
    const ext = simpleName.split('.').pop() || '';

    const isExecutable = this.executableExts.has(ext);
    const isDoubleExt = /\.(pdf|docx?|xlsx?|jpg|png|txt)\s*\.(exe|scr|bat|cmd|vbs|pif|jar)$/i.test(simpleName);
    const hasHiddenExt = simpleName.includes('\u202E') || simpleName.includes('%20');
    const isSuspicious = isDoubleExt || hasHiddenExt || (isExecutable && !simpleName.endsWith('.jar'));

    let riskReason = '';
    if (isDoubleExt) riskReason = 'Disguised extension (double extension)';
    else if (hasHiddenExt) riskReason = 'Suspicious unicode / hidden extension bypass';
    else if (isExecutable) riskReason = 'Executable payload';

    return { isExecutable, isSuspicious, riskReason };
  }

  async viewEntry(entry: ArchiveEntry) {
    if (entry.dir) return;
    this.selectedEntry.set(entry);
    this.previewText.set('Loading preview...');

    try {
      const ext = entry.name.split('.').pop()?.toLowerCase();
      const textExts = ['txt', 'json', 'md', 'xml', 'html', 'css', 'js', 'ts', 'yaml', 'yml', 'ini', 'cfg', 'properties', 'env'];
      const isTextFile = textExts.includes(ext || '') || entry.size < 50000;

      if (this.rawEntries.has(entry.name)) {
        const data = this.rawEntries.get(entry.name)!;
        if (isTextFile) {
          const text = new TextDecoder().decode(data.subarray(0, 10000));
          this.previewText.set(text);
        } else {
          this.previewText.set(`Binary file (${this.formatBytes(entry.size)}). Direct text preview unavailable.`);
        }
        return;
      }

      if (this.zipInstance) {
        const file = this.zipInstance.file(entry.name);
        if (!file) {
          this.previewText.set('Cannot read file');
          return;
        }

        if (isTextFile) {
          const text = await file.async('text');
          this.previewText.set(text.slice(0, 10000));
        } else {
          this.previewText.set(`Binary file (${this.formatBytes(entry.size)}). Direct text preview unavailable.`);
        }
      }
    } catch (e: any) {
      this.previewText.set('Failed to read content.');
    }
  }

  async downloadEntry(entry: ArchiveEntry) {
    if (entry.dir) return;

    let blob: Blob | null = null;
    if (this.rawEntries.has(entry.name)) {
      const data = this.rawEntries.get(entry.name)!;
      blob = new Blob([data as unknown as BlobPart]);
    } else if (this.zipInstance) {
      const file = this.zipInstance.file(entry.name);
      if (file) {
        blob = await file.async('blob');
      }
    }

    if (!blob) return;

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

