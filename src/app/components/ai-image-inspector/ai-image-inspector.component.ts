import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface VerificationResult {
  hasAiSignals: boolean;
  verdict: string;
  verdictDetail: string;
  foundTags: { key: string; value: string; origin: string }[];
  c2paPresent: boolean;
  exifPresent: boolean;
  cameraInfo: string | null;
  softwareInfo: string | null;
}

@Component({
  selector: 'app-ai-image-inspector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-image-inspector.component.html',
  styleUrl: './ai-image-inspector.component.scss'
})
export class AiImageInspectorComponent {
  fileName = signal<string>('');
  fileSize = signal<number>(0);
  previewUrl = signal<string>('');
  result = signal<VerificationResult | null>(null);
  isAnalyzing = signal<boolean>(false);
  isDragging = signal<boolean>(false);

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave() {
    this.isDragging.set(false);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(false);
    if (e.dataTransfer?.files?.[0]) {
      this.inspectFile(e.dataTransfer.files[0]);
    }
  }

  onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.inspectFile(input.files[0]);
      input.value = '';
    }
  }

  async inspectFile(file: File) {
    this.isAnalyzing.set(true);
    this.fileName.set(file.name);
    this.fileSize.set(file.size);
    this.previewUrl.set(URL.createObjectURL(file));

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // Scan raw binary chunk signatures and ASCII metadata blocks
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      // Sample first 1MB and last 256KB where metadata chunks (PNG tEXt/iTXt, JPEG APP1-APP15, C2PA JUMBF) reside
      const head = textDecoder.decode(bytes.slice(0, Math.min(bytes.length, 1024 * 1024)));
      const tail = bytes.length > 256 * 1024 
        ? textDecoder.decode(bytes.slice(bytes.length - 256 * 1024))
        : '';
      const combined = head + ' ' + tail;

      const foundTags: { key: string; value: string; origin: string }[] = [];
      let c2paPresent = false;
      let hasAiSignals = false;
      let cameraInfo: string | null = null;
      let softwareInfo: string | null = null;

      // 1. C2PA / Content Credentials verification
      if (combined.includes('c2pa') || combined.includes('jumbf') || combined.includes('cai:claim')) {
        c2paPresent = true;
        foundTags.push({
          key: 'Content Credentials (C2PA)',
          value: 'C2PA cryptographic manifest / JUMBF box found embedded in image container',
          origin: 'C2PA Manifest'
        });
      }

      // 2. Stable Diffusion / Midjourney / DALL-E / ComfyUI / Automatic1111 prompts & generation parameters
      if (combined.includes('parameters') && (combined.includes('Steps:') || combined.includes('Sampler:') || combined.includes('CFG scale:'))) {
        hasAiSignals = true;
        // Extract prompt line
        const m = combined.match(/parameters\x00?([^\x00]+)/);
        foundTags.push({
          key: 'Stable Diffusion Generation Parameters',
          value: m ? m[1].slice(0, 300) : 'Generation parameters block present',
          origin: 'PNG tEXt / A1111'
        });
      }

      if (combined.includes('prompt') && combined.includes('negative_prompt')) {
        hasAiSignals = true;
        foundTags.push({
          key: 'AI Text Prompt & Negative Prompt Data',
          value: 'Contains ComfyUI / WebUI generation graph JSON or prompt tags',
          origin: 'Metadata Chunk'
        });
      }

      if (combined.includes('Midjourney') || combined.includes('midjourney')) {
        hasAiSignals = true;
        foundTags.push({
          key: 'Midjourney Tag',
          value: 'Midjourney signature embedded in metadata header',
          origin: 'Software Tag'
        });
      }

      if (combined.includes('DALL·E') || combined.includes('DALLE') || combined.includes('dall-e')) {
        hasAiSignals = true;
        foundTags.push({
          key: 'OpenAI DALL-E Signature',
          value: 'DALL-E generation indicator or credit tag found',
          origin: 'Metadata Tag'
        });
      }

      if (combined.includes('Adobe Firefly')) {
        hasAiSignals = true;
        foundTags.push({
          key: 'Adobe Firefly AI',
          value: 'Adobe Firefly generative AI generation mark in XMP',
          origin: 'XMP Metadata'
        });
      }

      // Camera EXIF check
      const cameraMatches = combined.match(/(Canon|Nikon|Sony|Apple|Samsung|Google|FUJIFILM|OLYMPUS|Panasonic)\s+([A-Za-z0-9\-\s]{3,25})/i);
      if (cameraMatches) {
        cameraInfo = cameraMatches[0].trim();
      }

      const softwareMatches = combined.match(/(Software|ProcessingSoftware)\x00?([A-Za-z0-9\.\_\-\s]{3,35})/i);
      if (softwareMatches) {
        softwareInfo = softwareMatches[2]?.trim() || null;
      }

      let verdict = '';
      let verdictDetail = '';

      if (hasAiSignals) {
        verdict = 'Verified AI Generation Signatures Present';
        verdictDetail = 'Direct generation parameters, AI tool fingerprints, or prompt metadata were verified in the file header.';
      } else if (c2paPresent) {
        verdict = 'Content Credentials (C2PA) Container Present';
        verdictDetail = 'Contains C2PA manifest container. Inspect credentials details in the breakdown below.';
      } else if (cameraInfo) {
        verdict = 'Authentic Camera Hardware EXIF Detected';
        verdictDetail = `Physical capture device metadata discovered: ${cameraInfo}. No AI generator parameters found.`;
      } else {
        verdict = 'No AI Metadata or Camera EXIF Found';
        verdictDetail = 'The file does not contain embedded AI generation strings, C2PA claims, or hardware EXIF (often stripped by social media).';
      }

      this.result.set({
        hasAiSignals,
        verdict,
        verdictDetail,
        foundTags,
        c2paPresent,
        exifPresent: !!cameraInfo,
        cameraInfo,
        softwareInfo
      });
    } catch (e) {
      console.error(e);
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }
}

