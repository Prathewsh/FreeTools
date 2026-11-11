import { Component, OnDestroy, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { pixelsToAscii } from './ascii-renderer';

@Component({
  selector: 'app-ascii-art',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './ascii-art.component.html',
  styleUrl: './ascii-art.component.scss'
})
export class AsciiArtComponent implements OnDestroy {
  mode = signal<'text' | 'image'>('text');
  text = signal('HELLO');
  columns = signal(100);
  contrast = signal(1);
  inverted = signal(false);
  preset = signal('standard');
  customCharacters = signal('@%#*+=-:. ');
  fontSize = signal(10);
  fileName = signal('');
  image = signal<HTMLImageElement | null>(null);
  loading = signal(false);
  error = signal('');
  copyStatus = signal('');
  private imageUrl: string | null = null;
  private loadVersion = 0;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;
  readonly presets = [
    { id: 'standard', label: 'Standard', characters: '@%#*+=-:. ' },
    { id: 'detailed', label: 'Detailed', characters: '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`. ' },
    { id: 'blocks', label: 'Simple', characters: '@#*:. ' },
    { id: 'binary', label: 'Binary', characters: '10 ' }
  ];

  rendered = computed(() => {
    const mode = this.mode();
    const image = this.image();
    const text = this.text().slice(0, 640);
    const columns = Math.max(40, Math.min(240, Math.round(this.columns())));
    const characters = this.preset() === 'custom' ? this.customCharacters()
      : this.presets.find(item => item.id === this.preset())!.characters;
    const options = { characters, contrast: this.contrast(), inverted: this.inverted() };
    if (!/^[\x20-\x7e]{2,100}$/.test(characters)) return { text: '', rows: 0, columns, error: 'Enter 2–100 printable ASCII characters, ordered from dense to light. Spaces are allowed.' };
    if (mode === 'image' && !image || mode === 'text' && !text.trim()) return { text: '', rows: 0, columns, error: '' };
    try {
      let source: CanvasImageSource;
      let width: number;
      let height: number;
      if (mode === 'text') {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable in this browser.');
        const lines = text.split('\n').slice(0, 8).map(line => line.slice(0, 80));
        context.font = 'bold 100px monospace';
        canvas.width = Math.ceil(Math.max(...lines.map(line => context.measureText(line).width), 1)) + 40;
        canvas.height = lines.length * 120 + 40;
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.font = 'bold 100px monospace';
        context.textBaseline = 'top';
        context.fillStyle = '#000';
        lines.forEach((line, index) => context.fillText(line, 20, 20 + index * 120));
        source = canvas;
        width = canvas.width;
        height = canvas.height;
      } else {
        source = image!;
        width = image!.naturalWidth;
        height = image!.naturalHeight;
      }
      // A monospace glyph is roughly half as wide as it is tall.
      const rows = Math.max(1, Math.min(300, Math.round(columns * height / width * 0.5)));
      const canvas = document.createElement('canvas');
      canvas.width = columns;
      canvas.height = rows;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas is unavailable in this browser.');
      context.drawImage(source, 0, 0, columns, rows);
      return { text: pixelsToAscii(context.getImageData(0, 0, columns, rows).data, columns, rows, options), rows, columns, error: '' };
    } catch (error) {
      return { text: '', rows: 0, columns, error: error instanceof Error ? error.message : 'Unable to generate ASCII art.' };
    }
  });

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.loadImage(file);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) this.loadImage(file);
  }

  loadImage(file: File) {
    const version = ++this.loadVersion;
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
    this.imageUrl = null;
    this.image.set(null);
    this.fileName.set('');
    this.loading.set(false);
    this.error.set('');
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/avif'].includes(file.type)) {
      this.error.set('Choose a PNG, JPEG, WebP, GIF, BMP, or AVIF image.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) { this.error.set('Choose an image under 20 MB.'); return; }
    this.loading.set(true);
    const url = URL.createObjectURL(file);
    this.imageUrl = url;
    const image = new Image();
    image.onload = () => {
      if (version !== this.loadVersion) return;
      this.loading.set(false);
      if (!image.naturalWidth || !image.naturalHeight) { this.error.set('This image has no usable dimensions.'); return; }
      this.image.set(image);
      this.fileName.set(file.name);
    };
    image.onerror = () => {
      if (version !== this.loadVersion) return;
      this.loading.set(false);
      this.error.set('Unable to read this image. Try a PNG or JPEG.');
    };
    image.src = url;
  }

  async copy() {
    if (!this.rendered().text) return;
    if (this.copyTimer) clearTimeout(this.copyTimer);
    try { await navigator.clipboard.writeText(this.rendered().text); this.copyStatus.set('Copied!'); }
    catch { this.copyStatus.set('Clipboard unavailable. Select the output and copy it manually.'); }
    this.copyTimer = setTimeout(() => this.copyStatus.set(''), 3000);
  }

  download() {
    if (!this.rendered().text) return;
    const url = URL.createObjectURL(new Blob([this.rendered().text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ascii-art.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  ngOnDestroy() {
    this.loadVersion++;
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
    if (this.copyTimer) clearTimeout(this.copyTimer);
  }
}
