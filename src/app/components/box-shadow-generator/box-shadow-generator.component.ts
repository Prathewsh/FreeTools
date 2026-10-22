import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-box-shadow-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './box-shadow-generator.component.html',
  styleUrl: './box-shadow-generator.component.scss'
})
export class BoxShadowGeneratorComponent {
  xOffset = signal<number>(0);
  yOffset = signal<number>(10);
  blur = signal<number>(25);
  spread = signal<number>(-5);
  shadowColor = signal<string>('#000000');
  shadowOpacity = signal<number>(0.2);
  inset = signal<boolean>(false);
  copied = signal<boolean>(false);

  boxColor = signal<string>('#ffffff');
  stageBg = signal<'light'>('light');

  shadowCss = computed(() => {
    // Hex to RGBA
    let r = 0, g = 0, b = 0;
    const hex = this.shadowColor();
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      const num = parseInt(hex.slice(1), 16);
      r = (num >> 16) & 255;
      g = (num >> 8) & 255;
      b = num & 255;
    }
    const colorStr = `rgba(${r}, ${g}, ${b}, ${this.shadowOpacity()})`;
    const insetText = this.inset() ? 'inset ' : '';
    return `${insetText}${this.xOffset()}px ${this.yOffset()}px ${this.blur()}px ${this.spread()}px ${colorStr}`;
  });

  fullCode = computed(() => {
    return `box-shadow: ${this.shadowCss()};`;
  });

  copyCode() {
    navigator.clipboard.writeText(this.fullCode());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}

