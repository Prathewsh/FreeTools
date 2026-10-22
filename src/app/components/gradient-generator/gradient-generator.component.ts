import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ColorStop {
  color: string;
  position: number;
}

@Component({
  selector: 'app-gradient-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gradient-generator.component.html',
  styleUrl: './gradient-generator.component.scss'
})
export class GradientGeneratorComponent {
  type = signal<'linear' | 'radial'>('linear');
  angle = signal<number>(90);
  radialShape = signal<'circle' | 'ellipse'>('circle');
  
  stops = signal<ColorStop[]>([
    { color: '#3b82f6', position: 0 },
    { color: '#8b5cf6', position: 50 },
    { color: '#ec4899', position: 100 }
  ]);

  copied = signal<boolean>(false);

  gradientCss = computed(() => {
    const stopsStr = this.stops()
      .map(s => `${s.color} ${s.position}%`)
      .join(', ');

    if (this.type() === 'linear') {
      return `linear-gradient(${this.angle()}deg, ${stopsStr})`;
    } else {
      return `radial-gradient(${this.radialShape()}, ${stopsStr})`;
    }
  });

  fullCssCode = computed(() => {
    return `background: ${this.gradientCss()};`;
  });

  addStop() {
    this.stops.update(list => [
      ...list,
      { color: '#10b981', position: Math.min(100, (list[list.length - 1]?.position || 0) + 10) }
    ]);
  }

  removeStop(index: number) {
    if (this.stops().length <= 2) return;
    this.stops.update(list => list.filter((_, i) => i !== index));
  }

  updateStopColor(index: number, val: string) {
    this.stops.update(list => list.map((s, i) => i === index ? { ...s, color: val } : s));
  }

  updateStopPos(index: number, val: number) {
    this.stops.update(list => list.map((s, i) => i === index ? { ...s, position: val } : s));
  }

  copyCss() {
    navigator.clipboard.writeText(this.fullCssCode());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}

