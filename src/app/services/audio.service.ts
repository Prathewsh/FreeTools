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
  private analyserNode: AnalyserNode | null = null;
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
    onEnded?: () => void,
    analyserOut?: (analyser: AnalyserNode) => void
  ): void {
    this.stopPlayback();

    const ctx = this.getAudioContext();
    this.currentBuffer = buffer;
    this.currentSource = ctx.createBufferSource();
    this.currentSource.buffer = buffer;
    this.currentSource.playbackRate.value = speed;

    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = volume;

    const analyser = ctx.createAnalyser();
    this.analyserNode = analyser;
    analyser.fftSize = 256;
    if (analyserOut) analyserOut(analyser);

    this.currentSource.connect(this.gainNode);
    this.gainNode.connect(analyser);
    analyser.connect(ctx.destination);

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
    this.analyserNode?.disconnect();
    this.analyserNode = null;
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

  // Convert AudioBuffer to various target audio containers
  async exportFormattedBlob(buffer: AudioBuffer, format: 'wav' | 'mp3' | 'ogg' | 'flac' | 'aac'): Promise<{ blob: Blob; ext: string }> {
    if (format === 'wav') {
      return { blob: this.audioBufferToWavBlob(buffer), ext: 'wav' };
    }

    // Check MediaRecorder format availability
    const mimeMap: { [key: string]: string[] } = {
      mp3: ['audio/mp3', 'audio/mpeg'],
      ogg: ['audio/ogg; codecs=opus', 'audio/ogg', 'audio/webm; codecs=opus'],
      flac: ['audio/flac', 'audio/x-flac'],
      aac: ['audio/aac', 'audio/mp4; codecs=mp4a.40.2', 'audio/mp4']
    };

    let targetMime = '';
    const candidates = mimeMap[format] || [];
    for (const cand of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(cand)) {
        targetMime = cand;
        break;
      }
    }

    // If native MediaRecorder supports the format, render in real-time or fast offline stream
    if (targetMime) {
      const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
      const src = offlineCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(offlineCtx.destination);
      const rendered = await offlineCtx.startRendering();

      // Play through an Audio element captured stream to record in target mime
      const wavBlob = this.audioBufferToWavBlob(rendered);
      const audio = new Audio();
      audio.src = URL.createObjectURL(wavBlob);
      await audio.load();

      // Use MediaRecorder on audio stream
      return new Promise((resolve) => {
        try {
          const actx = this.getAudioContext();
          const mediaDest = actx.createMediaStreamDestination();
          const bSource = actx.createBufferSource();
          bSource.buffer = rendered;
          bSource.connect(mediaDest);

          const recorder = new MediaRecorder(mediaDest.stream, { mimeType: targetMime });
          const chunks: Blob[] = [];
          recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
          recorder.onstop = () => {
            resolve({ blob: new Blob(chunks, { type: targetMime }), ext: format });
          };

          recorder.start();
          bSource.start(0);
          bSource.onended = () => {
            setTimeout(() => recorder.stop(), 100);
          };
        } catch {
          // Fallback to WAV format if stream recording fails
          resolve({ blob: this.audioBufferToWavBlob(buffer), ext: 'wav' });
        }
      });
    }

    // If not directly supported by current browser MediaRecorder codecs, return standard lossless WAV
    return { blob: this.audioBufferToWavBlob(buffer), ext: 'wav' };
  }

  // --- Normalizer & Loudness Engine ---
  calculateLoudness(buffer: AudioBuffer): { peakDb: number; rmsDb: number; recommendedGain: number } {
    let sumSquares = 0;
    let maxPeak = 0;
    const channels = buffer.numberOfChannels;
    const totalSamples = buffer.length * channels;

    for (let c = 0; c < channels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) {
        const val = Math.abs(data[i]);
        if (val > maxPeak) maxPeak = val;
        sumSquares += val * val;
      }
    }

    const rms = Math.sqrt(sumSquares / totalSamples) || 1e-6;
    const peakDb = maxPeak > 0 ? 20 * Math.log10(maxPeak) : -96;
    const rmsDb = 20 * Math.log10(rms);
    // Standard target peak of -0.5 dBFS
    const targetPeak = Math.pow(10, -0.5 / 20);
    const recommendedGain = maxPeak > 0 ? targetPeak / maxPeak : 1;

    return {
      peakDb: Number(peakDb.toFixed(2)),
      rmsDb: Number(rmsDb.toFixed(2)),
      recommendedGain: Number(recommendedGain.toFixed(3))
    };
  }

  normalizeBuffer(buffer: AudioBuffer, targetPeakDb: number = -0.5): AudioBuffer {
    const targetAmp = Math.pow(10, targetPeakDb / 20);
    let maxPeak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) {
        const val = Math.abs(data[i]);
        if (val > maxPeak) maxPeak = val;
      }
    }

    if (maxPeak === 0) return buffer;
    const factor = targetAmp / maxPeak;

    const ctx = this.getAudioContext();
    const normalized = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const srcData = buffer.getChannelData(c);
      const dstData = normalized.getChannelData(c);
      for (let i = 0; i < srcData.length; i++) {
        dstData[i] = Math.max(-1, Math.min(1, srcData[i] * factor));
      }
    }
    return normalized;
  }

  // --- Silence Remover & Detector ---
  detectSilenceRegions(buffer: AudioBuffer, thresholdDb: number = -45, minDurationSec: number = 0.4): { start: number; end: number }[] {
    const threshold = Math.pow(10, thresholdDb / 20);
    const sampleRate = buffer.sampleRate;
    const minSamples = Math.floor(minDurationSec * sampleRate);
    const data = buffer.getChannelData(0);
    const regions: { start: number; end: number }[] = [];

    let inSilence = false;
    let silenceStart = 0;

    for (let i = 0; i < data.length; i++) {
      const isSilent = Math.abs(data[i]) < threshold;
      if (isSilent) {
        if (!inSilence) {
          inSilence = true;
          silenceStart = i;
        }
      } else {
        if (inSilence) {
          inSilence = false;
          if (i - silenceStart >= minSamples) {
            regions.push({
              start: Number((silenceStart / sampleRate).toFixed(3)),
              end: Number((i / sampleRate).toFixed(3))
            });
          }
        }
      }
    }

    if (inSilence && data.length - silenceStart >= minSamples) {
      regions.push({
        start: Number((silenceStart / sampleRate).toFixed(3)),
        end: Number((data.length / sampleRate).toFixed(3))
      });
    }

    return regions;
  }

  stripSilence(buffer: AudioBuffer, thresholdDb: number = -45, minDurationSec: number = 0.4): AudioBuffer {
    const regions = this.detectSilenceRegions(buffer, thresholdDb, minDurationSec);
    if (!regions.length) return buffer;

    const sampleRate = buffer.sampleRate;
    const keepMask = new Uint8Array(buffer.length);
    keepMask.fill(1);

    for (const r of regions) {
      const startIdx = Math.floor(r.start * sampleRate);
      const endIdx = Math.min(buffer.length, Math.floor(r.end * sampleRate));
      for (let i = startIdx; i < endIdx; i++) {
        keepMask[i] = 0;
      }
    }

    let keptLength = 0;
    for (let i = 0; i < keepMask.length; i++) {
      if (keepMask[i]) keptLength++;
    }

    if (keptLength === 0) return buffer;

    const ctx = this.getAudioContext();
    const cleanBuffer = ctx.createBuffer(buffer.numberOfChannels, keptLength, sampleRate);

    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const src = buffer.getChannelData(c);
      const dst = cleanBuffer.getChannelData(c);
      let writeIdx = 0;
      for (let i = 0; i < src.length; i++) {
        if (keepMask[i]) {
          dst[writeIdx++] = src[i];
        }
      }
    }

    return cleanBuffer;
  }

  // --- Track Mixer & Multi-track Concatenation ---
  mixTracks(tracks: { buffer: AudioBuffer; gain: number; offsetSec: number }[]): AudioBuffer {
    if (!tracks.length) throw new Error('No tracks to mix');

    const sampleRate = tracks[0].buffer.sampleRate;
    let maxChannels = 1;
    let maxDuration = 0;

    for (const t of tracks) {
      if (t.buffer.numberOfChannels > maxChannels) maxChannels = t.buffer.numberOfChannels;
      const endSec = t.offsetSec + t.buffer.duration;
      if (endSec > maxDuration) maxDuration = endSec;
    }

    const totalSamples = Math.ceil(maxDuration * sampleRate);
    const ctx = this.getAudioContext();
    const mixed = ctx.createBuffer(maxChannels, totalSamples, sampleRate);

    for (const t of tracks) {
      const startSample = Math.floor(t.offsetSec * sampleRate);
      for (let c = 0; c < maxChannels; c++) {
        const srcChan = c < t.buffer.numberOfChannels ? t.buffer.getChannelData(c) : t.buffer.getChannelData(0);
        const dstChan = mixed.getChannelData(c);
        const gain = t.gain;
        for (let i = 0; i < srcChan.length; i++) {
          const outIdx = startSample + i;
          if (outIdx < totalSamples) {
            dstChan[outIdx] += srcChan[i] * gain;
          }
        }
      }
    }

    // Soft clamp output to prevent harsh clipping
    for (let c = 0; c < maxChannels; c++) {
      const chan = mixed.getChannelData(c);
      for (let i = 0; i < chan.length; i++) {
        chan[i] = Math.tanh(chan[i]);
      }
    }

    return mixed;
  }

  // --- Pitch Shifter & EQ Filter Application ---
  applyEqAndPitch(
    buffer: AudioBuffer,
    pitchSemitones: number = 0,
    bassGainDb: number = 0,
    midGainDb: number = 0,
    trebleGainDb: number = 0
  ): AudioBuffer {
    // Pitch shift multiplier: 2^(semitones / 12)
    const pitchRatio = Math.pow(2, pitchSemitones / 12);
    const sampleRate = buffer.sampleRate;
    const channels = buffer.numberOfChannels;

    // Resample length for pitch adjustment
    const newLength = Math.round(buffer.length / pitchRatio);
    const ctx = this.getAudioContext();
    const resampled = ctx.createBuffer(channels, newLength, sampleRate);

    for (let c = 0; c < channels; c++) {
      const src = buffer.getChannelData(c);
      const dst = resampled.getChannelData(c);
      for (let i = 0; i < newLength; i++) {
        const srcIdx = i * pitchRatio;
        const i0 = Math.floor(srcIdx);
        const i1 = Math.min(src.length - 1, i0 + 1);
        const frac = srcIdx - i0;
        dst[i] = src[i0] * (1 - frac) + src[i1] * frac;
      }
    }

    // Apply 3-Band Biquad EQ (Bass, Mid, Treble)
    if (bassGainDb !== 0 || midGainDb !== 0 || trebleGainDb !== 0) {
      // 3-band simple digital shelving filter
      const bassAmp = Math.pow(10, bassGainDb / 20);
      const midAmp = Math.pow(10, midGainDb / 20);
      const trebleAmp = Math.pow(10, trebleGainDb / 20);

      for (let c = 0; c < channels; c++) {
        const data = resampled.getChannelData(c);
        let lowPrev = 0;
        let highPrev = 0;
        for (let i = 0; i < data.length; i++) {
          const sample = data[i];
          // simple single-pole crossover filters
          const low = lowPrev + 0.05 * (sample - lowPrev);
          lowPrev = low;
          const high = sample - (highPrev + 0.25 * (sample - highPrev));
          highPrev = sample - high;
          const mid = sample - low - high;

          data[i] = Math.max(-1, Math.min(1, low * bassAmp + mid * midAmp + high * trebleAmp));
        }
      }
    }

    return resampled;
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
