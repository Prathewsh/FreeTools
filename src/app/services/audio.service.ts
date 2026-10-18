import { Injectable } from '@angular/core';

export interface WaveformData {
  peaks: Float32Array;
  duration: number;
  sampleRate: number;
  channels: number;
}

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private startTimeOffset = 0;
  private playbackStartedAt = 0;
  private isCurrentlyPlaying = false;
  private currentBuffer: AudioBuffer | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  constructor() {}

  getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  async decodeAudio(file: File | Blob): Promise<AudioBuffer> {
    const ctx = this.getAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
  }

  extractWaveformPeaks(buffer: AudioBuffer, targetPoints: number = 800): Float32Array {
    const rawData = buffer.getChannelData(0);
    const step = Math.ceil(rawData.length / targetPoints);
    const peaks = new Float32Array(targetPoints);

    for (let i = 0; i < targetPoints; i++) {
      const start = i * step;
      let end = start + step;
      if (end > rawData.length) end = rawData.length;
      let min = 0;
      let max = 0;
      for (let j = start; j < end; j++) {
        const val = rawData[j];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      peaks[i] = Math.max(Math.abs(min), Math.abs(max));
    }
    return peaks;
  }

  playBuffer(
    buffer: AudioBuffer,
    startSec: number = 0,
    durationSec?: number,
    volume: number = 1.0,
    speed: number = 1.0,
    onEnded?: () => void
  ): void {
    this.stopPlayback();

    const ctx = this.getAudioContext();
    this.currentBuffer = buffer;
    this.currentSource = ctx.createBufferSource();
    this.currentSource.buffer = buffer;
    this.currentSource.playbackRate.value = speed;

    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = volume;

    this.currentSource.connect(this.gainNode);
    this.gainNode.connect(ctx.destination);

    this.startTimeOffset = startSec;
    this.playbackStartedAt = ctx.currentTime;
    this.isCurrentlyPlaying = true;

    this.currentSource.onended = () => {
      this.isCurrentlyPlaying = false;
      if (onEnded) onEnded();
    };

    if (durationSec !== undefined && durationSec > 0) {
      this.currentSource.start(0, startSec, durationSec);
    } else {
      this.currentSource.start(0, startSec);
    }
  }

  getCurrentPlaybackTime(speed: number = 1.0): number {
    if (!this.isCurrentlyPlaying || !this.audioCtx) return this.startTimeOffset;
    const elapsed = (this.audioCtx.currentTime - this.playbackStartedAt) * speed;
    return this.startTimeOffset + elapsed;
  }

  stopPlayback(): void {
    if (this.currentSource) {
      this.currentSource.onended = null;
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // ignore already stopped
      }
      this.currentSource = null;
    }
    this.gainNode?.disconnect();
    this.gainNode = null;
    this.isCurrentlyPlaying = false;
  }

  trimAudioBuffer(
    sourceBuffer: AudioBuffer,
    startSec: number,
    endSec: number,
    fadeInSec: number = 0,
    fadeOutSec: number = 0,
    gainMultiplier: number = 1.0
  ): AudioBuffer {
    const ctx = this.getAudioContext();
    const sampleRate = sourceBuffer.sampleRate;
    const channels = sourceBuffer.numberOfChannels;

    const startSample = Math.min(sourceBuffer.length - 1, Math.max(0, Math.floor(startSec * sampleRate)));
    const endSample = Math.max(startSample + 1, Math.min(sourceBuffer.length, Math.floor(endSec * sampleRate)));
    const newLength = Math.max(1, endSample - startSample);

    const trimmedBuffer = ctx.createBuffer(channels, newLength, sampleRate);
    const fadeInSamples = Math.floor(fadeInSec * sampleRate);
    const fadeOutSamples = Math.floor(fadeOutSec * sampleRate);

    for (let c = 0; c < channels; c++) {
      const srcChannel = sourceBuffer.getChannelData(c);
      const destChannel = trimmedBuffer.getChannelData(c);

      for (let i = 0; i < newLength; i++) {
        let sample = srcChannel[startSample + i] * gainMultiplier;

        // Apply Fade In
        if (fadeInSamples > 0 && i < fadeInSamples) {
          const factor = i / fadeInSamples;
          sample *= factor;
        }

        // Apply Fade Out
        if (fadeOutSamples > 0 && i >= newLength - fadeOutSamples) {
          const factor = (newLength - i) / fadeOutSamples;
          sample *= factor;
        }

        destChannel[i] = sample;
      }
    }

    return trimmedBuffer;
  }

  removeSegmentAudioBuffer(
    sourceBuffer: AudioBuffer,
    cutStartSec: number,
    cutEndSec: number
  ): AudioBuffer {
    const ctx = this.getAudioContext();
    const sampleRate = sourceBuffer.sampleRate;
    const channels = sourceBuffer.numberOfChannels;

    const cutStartSample = Math.min(sourceBuffer.length, Math.max(0, Math.floor(cutStartSec * sampleRate)));
    const cutEndSample = Math.max(cutStartSample, Math.min(sourceBuffer.length, Math.floor(cutEndSec * sampleRate)));
    const cutLen = Math.max(0, cutEndSample - cutStartSample);
    const newLength = Math.max(1, sourceBuffer.length - cutLen);

    const resultBuffer = ctx.createBuffer(channels, newLength, sampleRate);

    for (let c = 0; c < channels; c++) {
      const src = sourceBuffer.getChannelData(c);
      const dest = resultBuffer.getChannelData(c);

      // Part 1: before cut
      for (let i = 0; i < cutStartSample; i++) {
        dest[i] = src[i];
      }
      // Part 2: after cut
      for (let i = cutEndSample; i < sourceBuffer.length; i++) {
        dest[cutStartSample + (i - cutEndSample)] = src[i];
      }
    }

    return resultBuffer;
  }

  audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channels: Float32Array[] = [];
    let sampleRate = buffer.sampleRate;
    let offset = 0;
    let pos = 0;

    function setUint16(data: number) {
      out.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data: number) {
      out.setUint32(pos, data, true);
      pos += 4;
    }

    // RIFF chunk descriptor
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    // FMT sub-chunk
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // subchunk1size (16 for PCM)
    setUint16(1); // audio format (1 = PCM)
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2); // block align
    setUint16(16); // bits per sample

    // Data sub-chunk
    setUint32(0x61746164); // "data" chunk
    setUint32(length - pos - 4); // chunk length

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (offset < buffer.length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (sample < 0 ? sample * 32768 : sample * 32767) | 0;
        out.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  }

  cancelMicRecording(): void {
    const recorder = this.mediaRecorder;
    if (!recorder) return;
    recorder.ondataavailable = null;
    recorder.onstop = null;
    if (recorder.state !== 'inactive') recorder.stop();
    recorder.stream.getTracks().forEach(track => track.stop());
    this.mediaRecorder = null;
    this.recordedChunks = [];
  }

  async startMicRecording(): Promise<void> {
    this.recordedChunks = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };
    this.mediaRecorder.start();
  }

  async stopMicRecording(): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No media recorder active'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || this.recordedChunks[0]?.type });
        this.mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
        this.mediaRecorder = null;
        try {
          const buffer = await this.decodeAudio(blob);
          resolve(buffer);
        } catch (err) {
          reject(err);
        }
      };

      this.mediaRecorder.stop();
    });
  }
}
