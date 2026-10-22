import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

type SpeedPhase = 'idle' | 'ping' | 'download' | 'upload' | 'complete';

@Component({
  selector: 'app-speed-test',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './speed-test.component.html',
  styleUrl: './speed-test.component.scss'
})
export class SpeedTestComponent implements OnDestroy {
  phase = signal<SpeedPhase>('idle');
  isRunning = signal<boolean>(false);

  // Realtime & Final Metrics
  downloadSpeed = signal<number>(0);
  uploadSpeed = signal<number>(0);
  pingMs = signal<number>(0);
  jitterMs = signal<number>(0);

  // Gauge / UI progress state
  currentSpeedDisplay = signal<string>('0');
  speedUnit = signal<string>('Mbps');
  progressPercent = signal<number>(0);
  statusText = signal<string>('Ready to test your network speed');
  serverLocation = signal<string>('Cloudflare Global Edge Anycast');

  private abortController: AbortController | null = null;
  private animInterval: any = null;

  ngOnDestroy() {
    this.cancelTest();
  }

  cancelTest() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.animInterval) {
      clearInterval(this.animInterval);
      this.animInterval = null;
    }
    this.isRunning.set(false);
    this.phase.set('idle');
    this.statusText.set('Test aborted');
  }

  async startSpeedTest() {
    if (this.isRunning()) return;

    this.isRunning.set(true);
    this.phase.set('ping');
    this.downloadSpeed.set(0);
    this.uploadSpeed.set(0);
    this.pingMs.set(0);
    this.jitterMs.set(0);
    this.currentSpeedDisplay.set('0');
    this.progressPercent.set(0);
    this.abortController = new AbortController();

    try {
      // 1. Measure Ping & Jitter
      await this.runPingTest();

      // 2. Measure Download Speed
      await this.runDownloadTest();

      // 3. Measure Upload Speed
      await this.runUploadTest();

      this.phase.set('complete');
      this.statusText.set('Speed test completed');
      this.currentSpeedDisplay.set(this.downloadSpeed().toFixed(1));
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        this.statusText.set('Measurement interrupted. Click restart.');
      }
    } finally {
      this.isRunning.set(false);
    }
  }

  private async runPingTest() {
    this.phase.set('ping');
    this.statusText.set('Measuring unloaded latency & jitter...');
    const samples: number[] = [];

    for (let i = 0; i < 5; i++) {
      if (!this.isRunning()) return;
      const t0 = performance.now();
      try {
        await fetch(`https://speed.cloudflare.com/__down?bytes=0&r=${Math.random()}`, {
          cache: 'no-store',
          signal: this.abortController?.signal
        });
        const elapsed = performance.now() - t0;
        samples.push(elapsed);
        this.pingMs.set(Math.round(elapsed));
        this.currentSpeedDisplay.set(Math.round(elapsed).toString());
        this.speedUnit.set('ms');
        this.progressPercent.set(10 + i * 4);
      } catch (e: any) {
        if (e.name === 'AbortError') throw e;
      }
      await new Promise(r => setTimeout(r, 60));
    }

    if (samples.length > 0) {
      const minPing = Math.min(...samples);
      this.pingMs.set(Math.round(minPing));

      // Calculate Jitter (mean deviation between successive pings)
      let jitterSum = 0;
      for (let i = 1; i < samples.length; i++) {
        jitterSum += Math.abs(samples[i] - samples[i - 1]);
      }
      this.jitterMs.set(Math.round(jitterSum / Math.max(1, samples.length - 1)));
    }
  }

  private async runDownloadTest() {
    this.phase.set('download');
    this.speedUnit.set('Mbps');
    this.statusText.set('Testing download bandwidth...');

    // Download chunks progressively: 2MB, 5MB, 10MB
    const sizes = [2000000, 5000000, 10000000];
    let totalBytes = 0;
    const startTime = performance.now();

    for (let i = 0; i < sizes.length; i++) {
      if (!this.isRunning()) return;
      const size = sizes[i];
      const chunkStart = performance.now();

      const res = await fetch(`https://speed.cloudflare.com/__down?bytes=${size}&r=${Math.random()}`, {
        cache: 'no-store',
        signal: this.abortController?.signal
      });

      if (!res.body) {
        await res.blob();
      } else {
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.length;
            const now = performance.now();
            const elapsedSec = (now - startTime) / 1000;
            if (elapsedSec > 0.1) {
              const mbps = (totalBytes * 8) / (elapsedSec * 1000000);
              this.downloadSpeed.set(parseFloat(mbps.toFixed(1)));
              this.currentSpeedDisplay.set(mbps.toFixed(1));
            }
          }
        }
      }

      this.progressPercent.set(30 + (i + 1) * 20);
    }
  }

  private async runUploadTest() {
    this.phase.set('upload');
    this.speedUnit.set('Mbps');
    this.statusText.set('Testing upload bandwidth...');

    // Upload random payloads
    const payloadSizes = [1000000, 3000000]; // 1MB, 3MB
    let totalBytesUploaded = 0;
    const startTime = performance.now();

    for (let i = 0; i < payloadSizes.length; i++) {
      if (!this.isRunning()) return;
      const size = payloadSizes[i];
      const chunk = new Uint8Array(size);
      for (let j = 0; j < 100; j++) chunk[j] = Math.floor(Math.random() * 255);

      await fetch(`https://speed.cloudflare.com/__up?r=${Math.random()}`, {
        method: 'POST',
        body: chunk,
        cache: 'no-store',
        signal: this.abortController?.signal
      });

      totalBytesUploaded += size;
      const elapsedSec = (performance.now() - startTime) / 1000;
      if (elapsedSec > 0.1) {
        const mbps = (totalBytesUploaded * 8) / (elapsedSec * 1000000);
        this.uploadSpeed.set(parseFloat(mbps.toFixed(1)));
        this.currentSpeedDisplay.set(mbps.toFixed(1));
      }
      this.progressPercent.set(70 + (i + 1) * 15);
    }

    this.progressPercent.set(100);
  }
}

