import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Vertex {
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
}

@Component({
  selector: 'app-clip-path-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clip-path-builder.component.html',
  styleUrl: './clip-path-builder.component.scss'
})
export class ClipPathBuilderComponent {
  shapeType = signal<'polygon' | 'circle' | 'ellipse'>('polygon');
  activePreset = signal<string>('triangle');

  vertices = signal<Vertex[]>([
    { x: 50, y: 0 },
    { x: 0, y: 100 },
    { x: 100, y: 100 }
  ]);

  circleRadius = signal<number>(50);
  ellipseRx = signal<number>(50);
  ellipseRy = signal<number>(25);

  activeVertexIndex = signal<number | null>(null);
  copied = signal<boolean>(false);

  clipPathCss = computed(() => {
    const type = this.shapeType();
    if (type === 'circle') {
      return `clip-path: circle(${this.circleRadius()}% at 50% 50%);`;
    }
    if (type === 'ellipse') {
      return `clip-path: ellipse(${this.ellipseRx()}% ${this.ellipseRy()}% at 50% 50%);`;
    }
    const points = this.vertices()
      .map(v => `${Math.round(v.x)}% ${Math.round(v.y)}%`)
      .join(', ');
    return `clip-path: polygon(${points});`;
  });

  applyPreset(preset: string) {
    this.activePreset.set(preset);
    this.shapeType.set('polygon');

    switch (preset) {
      case 'triangle':
        this.vertices.set([{ x: 50, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }]);
        break;
      case 'trapezoid':
        this.vertices.set([{ x: 20, y: 0 }, { x: 80, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
        break;
      case 'star':
        this.vertices.set([
          { x: 50, y: 0 }, { x: 61, y: 35 }, { x: 98, y: 35 }, { x: 68, y: 57 },
          { x: 79, y: 91 }, { x: 50, y: 70 }, { x: 21, y: 91 }, { x: 32, y: 57 },
          { x: 2, y: 35 }, { x: 39, y: 35 }
        ]);
        break;
      case 'hexagon':
        this.vertices.set([
          { x: 25, y: 0 }, { x: 75, y: 0 }, { x: 100, y: 50 },
          { x: 75, y: 100 }, { x: 25, y: 100 }, { x: 0, y: 50 }
        ]);
        break;
      case 'circle':
        this.shapeType.set('circle');
        break;
      case 'ellipse':
        this.shapeType.set('ellipse');
        break;
    }
  }

  addVertex() {
    this.vertices.update(v => [...v, { x: 50, y: 50 }]);
  }

  removeVertex(index: number) {
    if (this.vertices().length <= 3) return;
    this.vertices.update(v => v.filter((_, i) => i !== index));
  }

  onCanvasMouseDown(e: MouseEvent, index: number) {
    e.stopPropagation();
    this.activeVertexIndex.set(index);
  }

  onCanvasMouseMove(e: MouseEvent, stageEl: HTMLElement) {
    const idx = this.activeVertexIndex();
    if (idx === null) return;

    const rect = stageEl.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;

    const x = Math.max(0, Math.min(100, Math.round(rawX)));
    const y = Math.max(0, Math.min(100, Math.round(rawY)));

    this.vertices.update(v =>
      v.map((point, i) => (i === idx ? { x, y } : point))
    );
  }

  onCanvasMouseUp() {
    this.activeVertexIndex.set(null);
  }

  copyCss() {
    navigator.clipboard.writeText(this.clipPathCss());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }
}

