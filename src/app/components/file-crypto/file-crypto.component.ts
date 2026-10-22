import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type CryptoMode = 'encrypt' | 'decrypt';
type CipherAlgorithm = 'AES-GCM' | 'AES-CBC';

@Component({
  selector: 'app-file-crypto',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './file-crypto.component.html',
  styleUrl: './file-crypto.component.scss'
})
export class FileCryptoComponent {
  mode = signal<CryptoMode>('encrypt');
  algorithm = signal<CipherAlgorithm>('AES-GCM');
  passphrase = signal<string>('');
  showPassphrase = signal<boolean>(false);
  pbkdf2Iterations = signal<number>(250000);

  selectedFile = signal<File | null>(null);
  fileName = signal<string>('');
  fileSize = signal<string>('');
  fileRawBytes = signal<number>(0);

  isProcessing = signal<boolean>(false);
  progressStatus = signal<string>('');
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  // Result metadata
  resultBlob = signal<Blob | null>(null);
  resultFileName = signal<string>('');
  resultFileSize = signal<string>('');
  computedSaltHex = signal<string>('');
  computedIvHex = signal<string>('');
  executionTimeMs = signal<number>(0);

  // Magic header for FreeTools encrypted files
  private readonly MAGIC = new Uint8Array([0x46, 0x54, 0x43, 0x52, 0x59, 0x50, 0x54]); // "FTCRYPT"
  private readonly VERSION = 0x01;

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    this.loadFile(file);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      this.loadFile(event.dataTransfer.files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  private loadFile(file: File) {
    this.selectedFile.set(file);
    this.fileName.set(file.name);
    this.fileRawBytes.set(file.size);
    this.fileSize.set((file.size / 1024).toFixed(1) + ' KB');
    this.errorMsg.set(null);
    this.successMsg.set(null);
    this.resultBlob.set(null);

    // Auto-switch mode based on extension
    if (file.name.endsWith('.ftenc') || file.name.endsWith('.enc')) {
      this.mode.set('decrypt');
    }
  }

  generateStrongPassphrase() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+';
    const arr = new Uint8Array(20);
    crypto.getRandomValues(arr);
    let str = '';
    for (let i = 0; i < arr.length; i++) {
      str += chars[arr[i] % chars.length];
    }
    this.passphrase.set(str);
  }

  private bufToHex(buf: Uint8Array): string {
    return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async runOperation() {
    const file = this.selectedFile();
    const pass = this.passphrase().trim();

    if (!file) {
      this.errorMsg.set('Please select a file first.');
      return;
    }
    if (!pass) {
      this.errorMsg.set('Please enter a secret passphrase or generate one.');
      return;
    }

    this.isProcessing.set(true);
    this.errorMsg.set(null);
    this.successMsg.set(null);
    this.resultBlob.set(null);
    const startTime = performance.now();

    try {
      if (this.mode() === 'encrypt') {
        await this.encryptFile(file, pass);
      } else {
        await this.decryptFile(file, pass);
      }
      this.executionTimeMs.set(Math.round(performance.now() - startTime));
    } catch (err: any) {
      console.error(err);
      this.errorMsg.set(err.message || 'Operation failed. Authentication tag mismatch or invalid password.');
    } finally {
      this.isProcessing.set(false);
      this.progressStatus.set('');
    }
  }

  private async deriveKey(pass: string, salt: Uint8Array, algoName: 'AES-GCM' | 'AES-CBC', iterations: number): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(pass),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: algoName, length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async encryptFile(file: File, pass: string) {
    this.progressStatus.set('Reading file payload...');
    const plainBuffer = await file.arrayBuffer();

    this.progressStatus.set('Deriving cryptographic key via PBKDF2 (SHA-256)...');
    const salt = new Uint8Array(16);
    window.crypto.getRandomValues(salt);

    const iv = new Uint8Array(12); // standard 96-bit IV for AES-GCM
    window.crypto.getRandomValues(iv);

    const key = await this.deriveKey(pass, salt, 'AES-GCM', this.pbkdf2Iterations());

    this.progressStatus.set('Encrypting file with AES-256-GCM authentication...');
    const cipherBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      key,
      plainBuffer
    );

    // Format container:
    // [0-6]: MAGIC "FTCRYPT" (7 bytes)
    // [7]: VERSION 0x01 (1 byte)
    // [8-9]: Original file name length (2 bytes, Uint16)
    // [...]: Original file name utf8
    // [...]: Salt (16 bytes)
    // [...]: IV (12 bytes)
    // [...]: Ciphertext + Auth Tag
    const nameBytes = new TextEncoder().encode(file.name);
    const nameLen = nameBytes.length;

    const totalHeaderLen = 7 + 1 + 2 + nameLen + 16 + 12;
    const finalBuffer = new Uint8Array(totalHeaderLen + cipherBuffer.byteLength);

    finalBuffer.set(this.MAGIC, 0);
    finalBuffer[7] = this.VERSION;
    finalBuffer[8] = (nameLen >> 8) & 0xff;
    finalBuffer[9] = nameLen & 0xff;
    finalBuffer.set(nameBytes, 10);

    const saltOffset = 10 + nameLen;
    finalBuffer.set(salt, saltOffset);

    const ivOffset = saltOffset + 16;
    finalBuffer.set(iv, ivOffset);

    const cipherOffset = ivOffset + 12;
    finalBuffer.set(new Uint8Array(cipherBuffer), cipherOffset);

    const blob = new Blob([finalBuffer], { type: 'application/octet-stream' });
    this.resultBlob.set(blob);
    this.resultFileName.set(file.name + '.ftenc');
    this.resultFileSize.set((blob.size / 1024).toFixed(1) + ' KB');
    this.computedSaltHex.set(this.bufToHex(salt));
    this.computedIvHex.set(this.bufToHex(iv));
    this.successMsg.set('File successfully encrypted with authenticated AES-256-GCM.');
  }

  private async decryptFile(file: File, pass: string) {
    this.progressStatus.set('Reading encrypted container...');
    const encBuffer = await file.arrayBuffer();
    const dataView = new DataView(encBuffer);
    const uint8 = new Uint8Array(encBuffer);

    // Verify magic header
    let isStandardContainer = true;
    for (let i = 0; i < this.MAGIC.length; i++) {
      if (uint8[i] !== this.MAGIC[i]) {
        isStandardContainer = false;
        break;
      }
    }

    let origName = file.name.replace(/\.(ftenc|enc)$/i, '') || 'decrypted_file';
    let salt: Uint8Array;
    let iv: Uint8Array;
    let cipherBytes: Uint8Array;

    if (isStandardContainer) {
      const nameLen = dataView.getUint16(8);
      const nameBytes = uint8.subarray(10, 10 + nameLen);
      try {
        origName = new TextDecoder().decode(nameBytes);
      } catch {}

      const saltOffset = 10 + nameLen;
      salt = uint8.subarray(saltOffset, saltOffset + 16);
      const ivOffset = saltOffset + 16;
      iv = uint8.subarray(ivOffset, ivOffset + 12);
      const cipherOffset = ivOffset + 12;
      cipherBytes = uint8.subarray(cipherOffset);
    } else {
      // Fallback for raw encrypted files (first 16 salt, next 12 IV, rest ciphertext)
      if (uint8.length < 44) {
        throw new Error('File payload too short for AES-GCM encrypted data.');
      }
      salt = uint8.subarray(0, 16);
      iv = uint8.subarray(16, 28);
      cipherBytes = uint8.subarray(28);
    }

    this.progressStatus.set('Deriving key from passphrase...');
    const key = await this.deriveKey(pass, salt, 'AES-GCM', this.pbkdf2Iterations());

    this.progressStatus.set('Decrypting payload & verifying authentication tag...');
    let decryptedBuf: ArrayBuffer;
    try {
      decryptedBuf = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
          tagLength: 128
        },
        key,
        cipherBytes as BufferSource
      );
    } catch {
      throw new Error('Decryption failed! Incorrect passphrase, wrong algorithm, or file was tampered with.');
    }

    const blob = new Blob([decryptedBuf]);
    this.resultBlob.set(blob);
    this.resultFileName.set(origName);
    this.resultFileSize.set((blob.size / 1024).toFixed(1) + ' KB');
    this.computedSaltHex.set(this.bufToHex(salt));
    this.computedIvHex.set(this.bufToHex(iv));
    this.successMsg.set('Integrity verified! File successfully decrypted.');
  }

  downloadResult() {
    const blob = this.resultBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.resultFileName();
    a.click();
    URL.revokeObjectURL(url);
  }
}
