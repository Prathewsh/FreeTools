import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AudioService } from '../../services/audio.service';

@Component({
  selector: 'app-audio-cutter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audio-cutter.component.html',
  styleUrl: './audio-cutter.component.scss'
})
export class AudioCutterComponent implements OnDestroy {
  protected readonly Math = Math;

  @ViewChild('waveformCanvas', { static: false }) waveformCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false }) fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('audioPreview', { static: false }) audioPreviewRef!: ElementRef<HTMLAudioElement>;

  hasAudio = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  audioName = signal<string>('');
  audioDuration = signal<number>(0); // seconds
  sampleRate = signal<number>(44100);

  // Playback State
  isPlaying = signal<boolean>(false);
  isLooping = signal<boolean>(false);
  currentPlayheadTime = signal<number>(0);
  playbackSpeed = signal<number>(1.0);
  volumeBoost = signal<number>(1.0); // 0.1 to 3.0

  // Selection Trim Range
  trimStart = signal<number>(0);
  trimEnd = signal<number>(0);
  selectionDuration = computed(() => Math.max(0, this.trimEnd() - this.trimStart()));
  cutOperation = signal<'trim' | 'splice'>('trim');

  // Effects
  fadeInDuration = signal<number>(0.5); // seconds
  fadeOutDuration = signal<number>(0.8); // seconds

  // Export State
  exportedBlob = signal<Blob | null>(null);
  exportedUrl = signal<string | null>(null);
  exportedSize = signal<string>('');

  // Recording State
  isRecordingMic = signal<boolean>(false);

  // Raw Audio Buffer & Peaks
  private originalBuffer: AudioBuffer | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private peaks: Float32Array | null = null;

  // Animation Frame for Playhead
  private animFrameId: number | null = null;

  // Dragging handles
  isDraggingStart = false;
  isDraggingEnd = false;
  isDraggingRegion = false;
  dragStartX = 0;
  dragInitialStart = 0;
  dragInitialEnd = 0;

  constructor(private audioService: AudioService) {}

  ngOnDestroy() {
    this.stopPlayback();
    this.audioService.cancelMicRecording();
    if (this.exportedUrl()) URL.revokeObjectURL(this.exportedUrl()!);
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  onDropFile(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) this.loadFile(file);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.loadFile(input.files[0]);
    }
  }

  async loadFile(file: File) {
    this.isLoading.set(true);
    try {
      const buffer = await this.audioService.decodeAudio(file);
      this.setLoadedBuffer(buffer, file.name);
    } catch {
      alert('Could not decode audio file. Please try another format.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async toggleMicRecording() {
    if (this.isRecordingMic()) {
      // Stop recording
      this.isLoading.set(true);
      try {
        const buffer = await this.audioService.stopMicRecording();
        this.setLoadedBuffer(buffer, `mic_recording_${Date.now()}.wav`);
      } catch {
        alert('Microphone recording error');
      } finally {
        this.isRecordingMic.set(false);
        this.isLoading.set(false);
      }
    } else {
      // Start recording
      try {
        await this.audioService.startMicRecording();
        this.isRecordingMic.set(true);
      } catch {
        alert('Could not access microphone. Please allow permissions.');
      }
    }
  }

  private setLoadedBuffer(buffer: AudioBuffer, name: string) {
    this.stopPlayback();
    this.originalBuffer = buffer;
    this.currentBuffer = buffer;
    this.audioName.set(name);
    this.audioDuration.set(buffer.duration);
    this.sampleRate.set(buffer.sampleRate);
    this.hasAudio.set(true);

    // Initial trim handles: 15% to 65%
    const start = +(buffer.duration * 0.15).toFixed(3);
    const end = +(buffer.duration * 0.65).toFixed(3);
    this.trimStart.set(start);
    this.trimEnd.set(end);
    this.currentPlayheadTime.set(start);

    // Extract peaks for waveform
    this.peaks = this.audioService.extractWaveformPeaks(buffer, 1000);

    // Clear previous export
    this.exportedBlob.set(null);
    if (this.exportedUrl()) URL.revokeObjectURL(this.exportedUrl()!);
    this.exportedUrl.set(null);

    setTimeout(() => this.drawWaveform(), 50);
  }

  // --- PLAYBACK CONTROLS ---
  playSelection() {
    if (!this.currentBuffer) return;
    this.stopPlayback();

    const start = this.trimStart();
    const duration = this.selectionDuration();
    if (duration <= 0) return;

    this.isPlaying.set(true);
    this.audioService.playBuffer(
      this.currentBuffer,
      start,
      duration,
      this.volumeBoost(),
      this.playbackSpeed(),
      () => {
        if (this.isLooping()) {
          this.playSelection();
        } else {
          this.isPlaying.set(false);
          this.currentPlayheadTime.set(start);
          this.drawWaveform();
        }
      }
    );

    this.startPlayheadTracker();
  }

  playFull() {
    if (!this.currentBuffer) return;
    this.stopPlayback();

    this.isPlaying.set(true);
    this.audioService.playBuffer(
      this.currentBuffer,
      0,
      undefined,
      this.volumeBoost(),
      this.playbackSpeed(),
      () => {
        this.isPlaying.set(false);
        this.currentPlayheadTime.set(0);
        this.drawWaveform();
      }
    );

    this.startPlayheadTracker();
  }

  togglePlayPause() {
    if (this.isPlaying()) {
      this.stopPlayback();
    } else {
      this.playSelection();
    }
  }

  stopPlayback() {
    this.audioService.stopPlayback();
    this.isPlaying.set(false);
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.drawWaveform();
  }

  private startPlayheadTracker() {
    const update = () => {
      if (this.isPlaying()) {
        const time = this.audioService.getCurrentPlaybackTime(this.playbackSpeed());
        this.currentPlayheadTime.set(time);
        this.drawWaveform();
        this.animFrameId = requestAnimationFrame(update);
      }
    };
    this.animFrameId = requestAnimationFrame(update);
  }

  // --- WAVEFORM RENDERING & INTERACTION ---
  drawWaveform() {
    if (!this.waveformCanvasRef || !this.peaks || !this.currentBuffer) return;
    const canvas = this.waveformCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;

    // High DPI scaling (only update dimension if changed to avoid canvas reallocation)
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const totalDuration = this.audioDuration();

    ctx.clearRect(0, 0, w, h);

    // Background timeline grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const stepSeconds = totalDuration > 30 ? 5 : totalDuration > 10 ? 2 : 1;
    for (let t = 0; t <= totalDuration; t += stepSeconds) {
      const x = (t / totalDuration) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      // Timestamp labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '10px monospace';
      ctx.fillText(`${t}s`, x + 3, 12);
    }

    // Selected trim region bounds
    const startX = (this.trimStart() / totalDuration) * w;
    const endX = (this.trimEnd() / totalDuration) * w;

    // Draw non-selected darkened regions
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, startX, h);
    ctx.fillRect(endX, 0, w - endX, h);

    // Draw active selected region background
    ctx.fillStyle = 'rgba(99, 102, 241, 0.12)';
    ctx.fillRect(startX, 0, endX - startX, h);

    // Draw Waveform Bars
    const barWidth = 2;
    const gap = 1;
    const step = (barWidth + gap);
    const numBars = Math.floor(w / step);
    const centerY = h / 2;

    for (let i = 0; i < numBars; i++) {
      const barX = i * step;
      const peakIndex = Math.floor((i / numBars) * this.peaks.length);
      const amp = this.peaks[peakIndex] || 0.05;
      const barHeight = Math.max(3, amp * (h * 0.8));

      const isInsideSelection = barX >= startX && barX <= endX;

      if (isInsideSelection) {
        // Gradient color for selected region
        const grad = ctx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(1, '#818cf8');
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      }

      ctx.beginPath();
      ctx.roundRect(barX, centerY - barHeight / 2, barWidth, barHeight, 1);
      ctx.fill();
    }

    // Draw Trim Markers
    // Start Handle (Emerald)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, h);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(startX - 6, 0, 12, 20, [0, 0, 4, 4]);
    ctx.fill();

    // End Handle (Rose)
    ctx.strokeStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, h);
    ctx.stroke();

    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.roundRect(endX - 6, 0, 12, 20, [0, 0, 4, 4]);
    ctx.fill();

    // Draw Playhead
    if (this.currentPlayheadTime() >= 0) {
      const playX = (this.currentPlayheadTime() / totalDuration) * w;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, h);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // Mouse Interaction on Waveform
  onWaveformMouseDown(event: MouseEvent) {
    if (!this.waveformCanvasRef || !this.currentBuffer) return;
    const canvas = this.waveformCanvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const totalDuration = this.audioDuration();
    const clickedTime = (x / rect.width) * totalDuration;

    const startX = (this.trimStart() / totalDuration) * rect.width;
    const endX = (this.trimEnd() / totalDuration) * rect.width;

    // Check hit test for handles (tolerance ±12px)
    if (Math.abs(x - startX) <= 12) {
      this.isDraggingStart = true;
    } else if (Math.abs(x - endX) <= 12) {
      this.isDraggingEnd = true;
    } else if (x > startX && x < endX) {
      this.isDraggingRegion = true;
      this.dragStartX = x;
      this.dragInitialStart = this.trimStart();
      this.dragInitialEnd = this.trimEnd();
    } else {
      // Click outside moves playhead
      this.currentPlayheadTime.set(Math.max(0, Math.min(totalDuration, clickedTime)));
      this.drawWaveform();
      return;
    }

    const onMove = (e: MouseEvent) => {
      if (!this.waveformCanvasRef || !this.currentBuffer) return;
      const cRect = this.waveformCanvasRef.nativeElement.getBoundingClientRect();
      const curX = e.clientX - cRect.left;
      const mouseTime = Math.max(0, Math.min(totalDuration, (curX / cRect.width) * totalDuration));

      if (this.isDraggingStart) {
        const newStart = Math.min(this.trimEnd() - 0.05, mouseTime);
        this.trimStart.set(+newStart.toFixed(3));
        this.drawWaveform();
      } else if (this.isDraggingEnd) {
        const newEnd = Math.max(this.trimStart() + 0.05, mouseTime);
        this.trimEnd.set(+newEnd.toFixed(3));
        this.drawWaveform();
      } else if (this.isDraggingRegion) {
        const deltaX = curX - this.dragStartX;
        const deltaTime = (deltaX / cRect.width) * totalDuration;
        const duration = this.dragInitialEnd - this.dragInitialStart;

        let newStart = this.dragInitialStart + deltaTime;
        let newEnd = this.dragInitialEnd + deltaTime;

        if (newStart < 0) {
          newStart = 0;
          newEnd = duration;
        }
        if (newEnd > totalDuration) {
          newEnd = totalDuration;
          newStart = totalDuration - duration;
        }

        this.trimStart.set(+newStart.toFixed(3));
        this.trimEnd.set(+newEnd.toFixed(3));
        this.drawWaveform();
      }
    };

    const onUp = () => {
      this.isDraggingStart = false;
      this.isDraggingEnd = false;
      this.isDraggingRegion = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  onWaveformMouseMove(event: MouseEvent) {
    // Handled in window listener when dragging
  }

  onWaveformMouseUp() {
    this.isDraggingStart = false;
    this.isDraggingEnd = false;
    this.isDraggingRegion = false;
  }

  setStartAtPlayhead() {
    const playhead = this.currentPlayheadTime();
    if (playhead < this.trimEnd()) {
      this.trimStart.set(+playhead.toFixed(3));
      this.drawWaveform();
    }
  }

  setEndAtPlayhead() {
    const playhead = this.currentPlayheadTime();
    if (playhead > this.trimStart()) {
      this.trimEnd.set(+playhead.toFixed(3));
      this.drawWaveform();
    }
  }

  // --- CUTTING & EXPORTING ---
  trimAndKeepSelection() {
    if (!this.currentBuffer) return;
    this.stopPlayback();

    const trimmed = this.audioService.trimAudioBuffer(
      this.currentBuffer,
      this.trimStart(),
      this.trimEnd(),
      this.fadeInDuration(),
      this.fadeOutDuration(),
      this.volumeBoost()
    );

    this.setLoadedBuffer(trimmed, `trimmed_${this.audioName()}`);
  }

  removeSelectionAndStitch() {
    if (!this.currentBuffer) return;
    this.stopPlayback();

    const result = this.audioService.removeSegmentAudioBuffer(
      this.currentBuffer,
      this.trimStart(),
      this.trimEnd()
    );

    this.setLoadedBuffer(result, `spliced_${this.audioName()}`);
  }

  exportTrimmedWav() {
    if (!this.currentBuffer) return;
    this.stopPlayback();

    const trimmed = this.audioService.trimAudioBuffer(
      this.currentBuffer,
      this.trimStart(),
      this.trimEnd(),
      this.fadeInDuration(),
      this.fadeOutDuration(),
      this.volumeBoost()
    );

    const blob = this.audioService.audioBufferToWavBlob(trimmed);
    const url = URL.createObjectURL(blob);
    this.exportedBlob.set(blob);
    if (this.exportedUrl()) URL.revokeObjectURL(this.exportedUrl()!);
    this.exportedUrl.set(url);
    this.exportedSize.set(`${(blob.size / (1024 * 1024)).toFixed(2)} MB`);

    if (this.audioPreviewRef) {
      this.audioPreviewRef.nativeElement.src = url;
    }
  }

  downloadExportedWav() {
    const url = this.exportedUrl();
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `cut_${this.audioName().replace(/\.[^/.]+$/, '')}.wav`;
    link.click();
  }

  exportAndDownload() {
    if (!this.currentBuffer) return;
    this.stopPlayback();

    let outputBuffer: AudioBuffer;
    let prefix = 'trimmed_';

    if (this.cutOperation() === 'trim') {
      outputBuffer = this.audioService.trimAudioBuffer(
        this.currentBuffer,
        this.trimStart(),
        this.trimEnd(),
        this.fadeInDuration(),
        this.fadeOutDuration(),
        this.volumeBoost()
      );
      prefix = 'trimmed_';
    } else {
      outputBuffer = this.audioService.removeSegmentAudioBuffer(
        this.currentBuffer,
        this.trimStart(),
        this.trimEnd()
      );
      prefix = 'spliced_';
    }

    const blob = this.audioService.audioBufferToWavBlob(outputBuffer);
    const url = URL.createObjectURL(blob);
    this.exportedBlob.set(blob);
    if (this.exportedUrl()) URL.revokeObjectURL(this.exportedUrl()!);
    this.exportedUrl.set(url);
    this.exportedSize.set(`${(blob.size / (1024 * 1024)).toFixed(2)} MB`);

    if (this.audioPreviewRef) {
      this.audioPreviewRef.nativeElement.src = url;
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = `${prefix}${this.audioName().replace(/\.[^/.]+$/, '')}.wav`;
    link.click();
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    const padSecs = +secs < 10 ? `0${secs}` : secs;
    return `${mins}:${padSecs}`;
  }
}
