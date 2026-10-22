import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-base64-tool',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './base64-tool.component.html',
  styleUrl: './base64-tool.component.scss'
})
export class Base64ToolComponent {
  mode = signal<'text' | 'file'>('text');
  
  // Text mode
  textInput = signal<string>('');
  textOutput = signal<string>('');
  textError = signal<string>('');
  
  // File mode
  fileName = signal<string>('');
  fileMime = signal<string>('');
  fileBase64 = signal<string>('');
  copied = signal<boolean>(false);

  encodeText() {
    try {
      this.textError.set('');
      const encoded = btoa(unescape(encodeURIComponent(this.textInput())));
      this.textOutput.set(encoded);
    } catch (e: any) {
      this.textError.set('Encoding failed: ' + e.message);
    }
  }

  decodeText() {
    try {
      this.textError.set('');
      const decoded = decodeURIComponent(escape(atob(this.textInput())));
      this.textOutput.set(decoded);
    } catch (e: any) {
      this.textError.set('Invalid Base64 string');
    }
  }

  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) {
      const file = input.files[0];
      this.fileName.set(file.name);
      this.fileMime.set(file.type || 'application/octet-stream');
      const reader = new FileReader();
      reader.onload = () => {
        this.fileBase64.set(reader.result as string);
      };
      reader.readAsDataURL(file);
      input.value = '';
    }
  }

  copy(val: string) {
    navigator.clipboard.writeText(val);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  downloadDecodedFile() {
    if (!this.fileBase64()) return;
    const a = document.createElement('a');
    a.href = this.fileBase64();
    a.download = this.fileName() || 'download';
    a.click();
  }
}

