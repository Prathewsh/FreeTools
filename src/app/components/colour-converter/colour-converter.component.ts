import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-colour-converter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './colour-converter.component.html',
  styleUrl: './colour-converter.component.scss'
})
export class ColourConverterComponent {
  hexInput = signal<string>('#3b82f6');
  copiedField = signal<string>('');

  // Parsed RGB (0-255)
  r = signal<number>(59);
  g = signal<number>(130);
  b = signal<number>(246);

  onHexChange(hex: string) {
    hex = hex.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    this.hexInput.set(hex);

    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      const num = parseInt(hex.slice(1), 16);
      this.r.set((num >> 16) & 255);
      this.g.set((num >> 8) & 255);
      this.b.set(num & 255);
    }
  }

  onRgbChange(r: number, g: number, b: number) {
    this.r.set(Math.max(0, Math.min(255, r)));
    this.g.set(Math.max(0, Math.min(255, g)));
    this.b.set(Math.max(0, Math.min(255, b)));
    this.hexInput.set(
      '#' + [this.r(), this.g(), this.b()].map(x => x.toString(16).padStart(2, '0')).join('')
    );
  }

  hsl = computed(() => {
    const r = this.r() / 255;
    const g = this.g() / 255;
    const b = this.b() / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  });

  cmyk = computed(() => {
    const r = this.r() / 255;
    const g = this.g() / 255;
    const b = this.b() / 255;
    const k = 1 - Math.max(r, g, b);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
    return {
      c: Math.round(((1 - r - k) / (1 - k)) * 100),
      m: Math.round(((1 - g - k) / (1 - k)) * 100),
      y: Math.round(((1 - b - k) / (1 - k)) * 100),
      k: Math.round(k * 100)
    };
  });

  // Relative luminance for WCAG contrast
  contrastWhite = computed(() => {
    return this.calculateContrast([this.r(), this.g(), this.b()], [255, 255, 255]).toFixed(2);
  });

  contrastBlack = computed(() => {
    return this.calculateContrast([this.r(), this.g(), this.b()], [0, 0, 0]).toFixed(2);
  });

  calculateLuminance(rgb: number[]): number {
    const [r, g, b] = rgb.map(v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  calculateContrast(rgb1: number[], rgb2: number[]): number {
    const lum1 = this.calculateLuminance(rgb1);
    const lum2 = this.calculateLuminance(rgb2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  copyVal(field: string, text: string) {
    navigator.clipboard.writeText(text);
    this.copiedField.set(field);
    setTimeout(() => this.copiedField.set(''), 2000);
  }
}

