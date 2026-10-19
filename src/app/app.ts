import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BgRemoverComponent } from './components/bg-remover/bg-remover.component';
import { ImageStudioComponent } from './components/image-studio/image-studio.component';
import { AudioCutterComponent } from './components/audio-cutter/audio-cutter.component';
import { VideoEditorComponent } from './components/video-editor/video-editor.component';
import { BatchConverterComponent } from './components/batch-converter/batch-converter.component';
import { ColorPaletteComponent } from './components/color-palette/color-palette.component';
import { JsonFormatterComponent } from './components/json-formatter/json-formatter.component';

export type ToolTab = 'bg-remover' | 'image-studio' | 'video-editor' | 'audio-cutter' | 'batch-converter' | 'color-palette' | 'json-formatter';

interface ToolItem {
  id: ToolTab;
  title: string;
  category: string;
  badge: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BgRemoverComponent,
    ImageStudioComponent,
    VideoEditorComponent,
    AudioCutterComponent,
    BatchConverterComponent,
    ColorPaletteComponent,
    JsonFormatterComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  activeTab = signal<ToolTab>('bg-remover');
  searchQuery = signal<string>('');
  studioIncomingImage = signal<string | null>(null);

  tools: ToolItem[] = [
    {
      id: 'bg-remover',
      title: 'AI Background Remover',
      category: 'Image Tools',
      badge: 'remove.bg',
      description: 'Isolate subjects and swap backgrounds in 1-click.',
      icon: 'sparkles'
    },
    {
      id: 'image-studio',
      title: 'Image Studio & Manipulator',
      category: 'Image Tools',
      badge: 'Pro Editor',
      description: 'Crop, resize, rotate, filter adjustments, watermarks.',
      icon: 'image'
    },
    {
      id: 'video-editor',
      title: 'Basic Video Editor',
      category: 'Video Tools',
      badge: 'Trim & Export',
      description: 'Trim, rotate, flip, preview, and export video locally.',
      icon: 'video'
    },
    {
      id: 'audio-cutter',
      title: 'Audio Cutter & Sound Lab',
      category: 'Audio Tools',
      badge: 'Waveform Trimmer',
      description: 'Visual audio slicer, fade in/out, gain boost, WAV export.',
      icon: 'music'
    },
    {
      id: 'batch-converter',
      title: 'Batch Converter & Compressor',
      category: 'Batch Tools',
      badge: 'Multi-File',
      description: 'Convert and compress dozens of images at once.',
      icon: 'layers'
    },
    {
      id: 'color-palette',
      title: 'Color Palette & Eyedropper',
      category: 'Color Tools',
      badge: 'Hex & HSL',
      description: 'Extract dominant color schemes from any graphic.',
      icon: 'palette'
    },
    {
      id: 'json-formatter',
      title: 'JSON Formatter & Viewer',
      category: 'Developer Tools',
      badge: 'Format & Validate',
      description: 'Beautify, validate, minify, search, and inspect JSON trees.',
      icon: 'braces'
    }
  ];

  filteredTools() {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.tools;
    return this.tools.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }

  selectTool(id: ToolTab) {
    this.activeTab.set(id);
  }

  handleSendToStudio(imageUrl: string) {
    this.studioIncomingImage.set(imageUrl);
    this.activeTab.set('image-studio');
  }
}
