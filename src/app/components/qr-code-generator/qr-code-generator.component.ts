import { Component, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-qr-code-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './qr-code-generator.component.html',
  styleUrl: './qr-code-generator.component.scss'
})
export class QrCodeGeneratorComponent {
  qrText = signal<string>('https://google.com');
  size = signal<number>(300);
  darkColor = signal<string>('#000000');
  lightColor = signal<string>('#ffffff');
  errorCorrection = signal<'L' | 'M' | 'Q' | 'H'>('M');

  qrDataUrl = signal<string>('');

  constructor() {
    effect(() => {
      this.generateQR();
    });
  }

  async generateQR() {
    const text = this.qrText();
    if (!text.trim()) {
      this.qrDataUrl.set('');
      return;
    }

    try {
      const url = await QRCode.toDataURL(text, {
        width: this.size(),
        margin: 2,
        color: {
          dark: this.darkColor(),
          light: this.lightColor()
        },
        errorCorrectionLevel: this.errorCorrection()
      });
      this.qrDataUrl.set(url);
    } catch (e) {
      console.error(e);
    }
  }

  downloadQR() {
    if (!this.qrDataUrl()) return;
    const a = document.createElement('a');
    a.href = this.qrDataUrl();
    a.download = 'qrcode.png';
    a.click();
  }
}

