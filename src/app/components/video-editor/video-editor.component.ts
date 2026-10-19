import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, ViewChild, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-video-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './video-editor.component.html',
  styleUrl: './video-editor.component.scss'
})
export class VideoEditorComponent implements OnDestroy {
  @ViewChild('videoPlayer') videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

  hasVideo = signal(false);
  videoUrl = signal('');
  fileName = signal('');
  fileSize = signal(0);
  duration = signal(0);
  currentTime = signal(0);
  trimStart = signal(0);
  trimEnd = signal(0);
  volume = signal(1);
  playbackRate = signal(1);
  muted = signal(false);
  rotation = signal<0 | 90 | 180 | 270>(0);
  flipHorizontal = signal(false);
  flipVertical = signal(false);
  isPlaying = signal(false);
  isExporting = signal(false);
  exportProgress = signal(0);
  statusMessage = signal('');
  errorMessage = signal('');

  selectionDuration = computed(() => Math.max(0, this.trimEnd() - this.trimStart()));
  transformStyle = computed(() =>
    `rotate(${this.rotation()}deg) scaleX(${this.flipHorizontal() ? -1 : 1}) scaleY(${this.flipVertical() ? -1 : 1})`
  );

  private objectUrl: string | null = null;
  private animationFrame = 0;

  ngOnDestroy() {
    this.releaseVideoUrl();
    cancelAnimationFrame(this.animationFrame);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.loadFile(file);
    input.value = '';
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) this.loadFile(file);
  }

  loadFile(file: File) {
    if (!file.type.startsWith('video/')) {
      this.errorMessage.set('Please choose a supported video file.');
      return;
    }
    this.releaseVideoUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.videoUrl.set(this.objectUrl);
    this.fileName.set(file.name);
    this.fileSize.set(file.size);
    this.hasVideo.set(true);
    this.errorMessage.set('');
    this.statusMessage.set('');
    this.rotation.set(0);
    this.flipHorizontal.set(false);
    this.flipVertical.set(false);
  }

  onMetadataLoaded() {
    const video = this.videoRef?.nativeElement;
    if (!video || !Number.isFinite(video.duration)) return;
    this.duration.set(video.duration);
    this.trimStart.set(0);
    this.trimEnd.set(video.duration);
    this.applyPlaybackSettings();
  }

  onTimeUpdate() {
    const video = this.videoRef?.nativeElement;
    if (!video) return;
    this.currentTime.set(video.currentTime);
    if (!this.isExporting() && video.currentTime >= this.trimEnd()) {
      video.pause();
      video.currentTime = this.trimStart();
    }
    if (this.isExporting()) {
      const total = this.selectionDuration();
      this.exportProgress.set(total ? Math.min(100, ((video.currentTime - this.trimStart()) / total) * 100) : 0);
    }
  }

  onPlayState(playing: boolean) {
    this.isPlaying.set(playing);
  }

  togglePlayback() {
    const video = this.videoRef?.nativeElement;
    if (!video) return;
    if (video.paused) {
      if (video.currentTime < this.trimStart() || video.currentTime >= this.trimEnd()) video.currentTime = this.trimStart();
      void video.play();
    } else {
      video.pause();
    }
  }

  seek(value: number) {
    const video = this.videoRef?.nativeElement;
    if (!video) return;
    video.currentTime = Number(value);
    this.currentTime.set(video.currentTime);
  }

  updateTrimStart(value: number) {
    const next = Math.min(Number(value), Math.max(0, this.trimEnd() - 0.1));
    this.trimStart.set(next);
    this.seek(next);
  }

  updateTrimEnd(value: number) {
    const next = Math.max(Number(value), Math.min(this.duration(), this.trimStart() + 0.1));
    this.trimEnd.set(next);
    this.seek(next);
  }

  setStartAtPlayhead() {
    this.updateTrimStart(Math.min(this.currentTime(), this.trimEnd() - 0.1));
  }

  setEndAtPlayhead() {
    this.updateTrimEnd(Math.max(this.currentTime(), this.trimStart() + 0.1));
  }

  applyPlaybackSettings() {
    const video = this.videoRef?.nativeElement;
    if (!video) return;
    video.volume = this.volume();
    video.playbackRate = this.playbackRate();
    video.muted = this.muted();
  }

  rotate() {
    this.rotation.update((angle) => ((angle + 90) % 360) as 0 | 90 | 180 | 270);
  }

  resetEdits() {
    this.trimStart.set(0);
    this.trimEnd.set(this.duration());
    this.volume.set(1);
    this.playbackRate.set(1);
    this.muted.set(false);
    this.rotation.set(0);
    this.flipHorizontal.set(false);
    this.flipVertical.set(false);
    this.applyPlaybackSettings();
    this.seek(0);
  }

  captureFrame() {
    const video = this.videoRef?.nativeElement;
    if (!video || !video.videoWidth) return;
    const canvas = this.createOutputCanvas(video);
    this.drawFrame(canvas, video);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${this.baseName()}-frame-${Math.round(video.currentTime * 1000)}ms.png`;
    link.click();
  }

  async exportVideo() {
    const video = this.videoRef?.nativeElement;
    if (!video || this.selectionDuration() <= 0 || this.isExporting()) return;
    const canvas = this.createOutputCanvas(video);
    const captureStream = (canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }).captureStream;
    const videoCapture = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream;
    if (!captureStream || typeof MediaRecorder === 'undefined') {
      this.errorMessage.set('Video export requires a browser with Canvas Capture and MediaRecorder support.');
      return;
    }

    this.errorMessage.set('');
    this.statusMessage.set('Rendering the selected clip in real time…');
    this.isExporting.set(true);
    this.exportProgress.set(0);
    const stream = captureStream.call(canvas, 30);
    if (!this.muted() && videoCapture) {
      videoCapture.call(video).getAudioTracks().forEach((track) => stream.addTrack(track));
    }
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };

    const finished = new Promise<void>((resolve) => {
      recorder.onstop = () => {
        cancelAnimationFrame(this.animationFrame);
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.baseName()}-edited.webm`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.isExporting.set(false);
        this.exportProgress.set(100);
        this.statusMessage.set(`Export complete · ${this.formatBytes(blob.size)}`);
        this.applyPlaybackSettings();
        resolve();
      };
    });

    video.pause();
    video.currentTime = this.trimStart();
    video.playbackRate = 1;
    video.muted = this.muted();
    const draw = () => {
      this.drawFrame(canvas, video);
      if (!video.paused && video.currentTime < this.trimEnd()) this.animationFrame = requestAnimationFrame(draw);
    };
    recorder.start(250);
    await video.play();
    draw();
    const stopAtEnd = () => {
      if (video.currentTime >= this.trimEnd() || video.ended) {
        video.pause();
        video.removeEventListener('timeupdate', stopAtEnd);
        if (recorder.state !== 'inactive') recorder.stop();
      }
    };
    video.addEventListener('timeupdate', stopAtEnd);
    await finished;
  }

  private createOutputCanvas(video: HTMLVideoElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const swapped = this.rotation() === 90 || this.rotation() === 270;
    canvas.width = swapped ? video.videoHeight : video.videoWidth;
    canvas.height = swapped ? video.videoWidth : video.videoHeight;
    return canvas;
  }

  private drawFrame(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
    const ctx = canvas.getContext('2d')!;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(this.rotation() * Math.PI / 180);
    ctx.scale(this.flipHorizontal() ? -1 : 1, this.flipVertical() ? -1 : 1);
    ctx.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2);
    ctx.restore();
  }

  formatTime(seconds: number): string {
    if (!Number.isFinite(seconds)) return '00:00.0';
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${remaining.toFixed(1).padStart(4, '0')}`;
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  private baseName(): string {
    return this.fileName().replace(/\.[^.]+$/, '') || 'video';
  }

  private releaseVideoUrl() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
}
