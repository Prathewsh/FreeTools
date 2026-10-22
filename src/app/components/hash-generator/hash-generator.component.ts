import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-hash-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hash-generator.component.html',
  styleUrl: './hash-generator.component.scss'
})
export class HashGeneratorComponent {
  mode = signal<'text' | 'file'>('text');
  inputText = signal<string>('Hello FreeTools');
  fileName = signal<string>('');
  fileSize = signal<string>('');
  isHashing = signal<boolean>(false);

  sha256Hash = signal<string>('');
  sha384Hash = signal<string>('');
  sha512Hash = signal<string>('');
  sha1Hash = signal<string>('');

  copiedKey = signal<string | null>(null);

  constructor() {
    this.computeTextHashes();
  }

  async computeTextHashes() {
    const text = this.inputText();
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    await this.digestBuffer(data);
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    this.fileName.set(file.name);
    this.fileSize.set((file.size / 1024).toFixed(1) + ' KB');
    this.isHashing.set(true);

    try {
      const buffer = await file.arrayBuffer();
      await this.digestBuffer(buffer);
    } catch {
      alert('Could not compute file hash');
    } finally {
      this.isHashing.set(false);
    }
  }

  private async digestBuffer(buffer: ArrayBuffer | Uint8Array) {
    const rawBuffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    const [h256, h384, h512, h1] = await Promise.all([
      crypto.subtle.digest('SHA-256', rawBuffer as BufferSource),
      crypto.subtle.digest('SHA-384', rawBuffer as BufferSource),
      crypto.subtle.digest('SHA-512', rawBuffer as BufferSource),
      crypto.subtle.digest('SHA-1', rawBuffer as BufferSource)
    ]);

    this.sha256Hash.set(this.bufferToHex(h256));
    this.sha384Hash.set(this.bufferToHex(h384));
    this.sha512Hash.set(this.bufferToHex(h512));
    this.sha1Hash.set(this.bufferToHex(h1));
  }

  private bufferToHex(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  copyHash(key: string, val: string) {
    navigator.clipboard.writeText(val);
    this.copiedKey.set(key);
    setTimeout(() => this.copiedKey.set(null), 1500);
  }
}
