import { Component, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-wheel-chance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wheel-chance.component.html',
  styleUrl: './wheel-chance.component.scss'
})
export class WheelChanceComponent implements AfterViewInit {
  @ViewChild('wheelCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  items = signal<string[]>([
    'Option A', 'Option B', 'Option C', 'Option D', 'Option E', 'Option F'
  ]);
  newOption = signal<string>('');
  removeWinner = signal<boolean>(true);
  isSpinning = signal<boolean>(false);
  winner = signal<string | null>(null);

  colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
    '#06b6d4', '#84cc16', '#6366f1', '#14b8a6', '#f97316', '#a855f7'
  ];

  private currentAngle = 0;

  ngAfterViewInit() {
    this.drawWheel();
  }

  addOption() {
    const text = this.newOption().trim();
    if (text) {
      this.items.update(list => [...list, text]);
      this.newOption.set('');
      this.drawWheel();
    }
  }

  removeItem(index: number) {
    if (this.items().length <= 2) return;
    this.items.update(list => list.filter((_, i) => i !== index));
    this.drawWheel();
  }

  drawWheel() {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const list = this.items();
    const count = list.length;
    const arc = (2 * Math.PI) / count;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = centerX - 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < count; i++) {
      const angle = this.currentAngle + i * arc;
      ctx.beginPath();
      ctx.fillStyle = this.colors[i % this.colors.length];
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, angle, angle + arc);
      ctx.lineTo(centerX, centerY);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;
      ctx.fillText(list[i].slice(0, 16), radius - 20, 5);
      ctx.restore();
    }

    // Center pin circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 22, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  spin() {
    if (this.isSpinning() || this.items().length === 0) return;
    this.isSpinning.set(true);
    this.winner.set(null);

    const spinRotations = 5 + Math.random() * 5; // 5 to 10 full turns
    const spinAngle = spinRotations * 2 * Math.PI + Math.random() * 2 * Math.PI;
    const startAngle = this.currentAngle;
    const duration = 4000;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      this.currentAngle = startAngle + spinAngle * ease;
      this.drawWheel();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isSpinning.set(false);
        this.calculateWinner();
      }
    };

    requestAnimationFrame(animate);
  }

  calculateWinner() {
    const list = this.items();
    const count = list.length;
    const arc = (2 * Math.PI) / count;
    // Pointer is fixed at 0 rad (right, or 3 o'clock). Normalize angle.
    const normalized = (2 * Math.PI - (this.currentAngle % (2 * Math.PI))) % (2 * Math.PI);
    const index = Math.floor(normalized / arc);
    const win = list[index];
    this.winner.set(win);

    if (this.removeWinner()) {
      setTimeout(() => {
        if (this.items().length > 2) {
          this.items.update(arr => arr.filter((_, i) => i !== index));
          this.drawWheel();
        }
      }, 2500);
    }
  }
}

