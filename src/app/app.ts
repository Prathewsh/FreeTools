import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AudioService } from './services/audio.service';
import { BgRemoverComponent } from './components/bg-remover/bg-remover.component';
import { ImageStudioComponent } from './components/image-studio/image-studio.component';
import { AudioCutterComponent } from './components/audio-cutter/audio-cutter.component';
import { VideoEditorComponent } from './components/video-editor/video-editor.component';
import { BatchConverterComponent } from './components/batch-converter/batch-converter.component';
import { ColorPaletteComponent } from './components/color-palette/color-palette.component';
import { JsonFormatterComponent } from './components/json-formatter/json-formatter.component';
import { ColorReplacerComponent } from './components/color-replacer/color-replacer.component';
import { TextToolsComponent } from './components/text-tools/text-tools.component';
import { BinaryToolsComponent } from './components/binary-tools/binary-tools.component';
import { UnicodeToolsComponent } from './components/unicode-tools/unicode-tools.component';
import { MathToolsComponent } from './components/math-tools/math-tools.component';
import { TimeToolsComponent } from './components/time-tools/time-tools.component';
import { JsonDiffComponent } from './components/json-diff/json-diff.component';
import { GifToolsComponent } from './components/gif-tools/gif-tools.component';
import { PdfEditorComponent } from './components/pdf-editor/pdf-editor.component';
import { ImageCompressorComponent } from './components/image-compressor/image-compressor.component';
import { ArchiveExplorerComponent } from './components/archive-explorer/archive-explorer.component';
import { MetadataRemoverComponent } from './components/metadata-remover/metadata-remover.component';
import { Base64ToolComponent } from './components/base64-tool/base64-tool.component';
import { GradientGeneratorComponent } from './components/gradient-generator/gradient-generator.component';
import { ColourConverterComponent } from './components/colour-converter/colour-converter.component';
import { BoxShadowGeneratorComponent } from './components/box-shadow-generator/box-shadow-generator.component';
import { LoremIpsumComponent } from './components/lorem-ipsum/lorem-ipsum.component';
import { QrCodeGeneratorComponent } from './components/qr-code-generator/qr-code-generator.component';
import { WheelChanceComponent } from './components/wheel-chance/wheel-chance.component';
import { PasswordToolComponent } from './components/password-tool/password-tool.component';
import { AiImageInspectorComponent } from './components/ai-image-inspector/ai-image-inspector.component';
import { PdfSignerComponent } from './components/pdf-signer/pdf-signer.component';
import { ArticleToMarkdownComponent } from './components/article-to-markdown/article-to-markdown.component';
import { ScreenshotStudioComponent } from './components/screenshot-studio/screenshot-studio.component';
import { HashGeneratorComponent } from './components/hash-generator/hash-generator.component';
import { MarkdownEditorComponent } from './components/markdown-editor/markdown-editor.component';
import { RobotsGeneratorComponent } from './components/robots-generator/robots-generator.component';
import { DataFakerComponent } from './components/data-faker/data-faker.component';
import { BreakpointPreviewerComponent } from './components/breakpoint-previewer/breakpoint-previewer.component';
import { ClipPathBuilderComponent } from './components/clip-path-builder/clip-path-builder.component';
import { FileCryptoComponent } from './components/file-crypto/file-crypto.component';
import { CertInspectorComponent } from './components/cert-inspector/cert-inspector.component';
import { PdfInspectorComponent } from './components/pdf-inspector/pdf-inspector.component';
import { IpCheckerComponent } from './components/ip-checker/ip-checker.component';
import { SpeedTestComponent } from './components/speed-test/speed-test.component';
import { Php2shellCheckerComponent } from './components/php2shell-checker/php2shell-checker.component';
import { BreachRadarComponent } from './components/breach-radar/breach-radar.component';

export type ToolTab =
  | 'welcome'
  | 'pdf-editor'
  | 'pdf-signer'
  | 'bg-remover'
  | 'image-studio'
  | 'image-compressor'
  | 'screenshot-studio'
  | 'color-replacer'
  | 'gif-tools'
  | 'color-palette'
  | 'video-editor'
  | 'audio-cutter'
  | 'batch-converter'
  | 'base64-tool'
  | 'text-tools'
  | 'markdown-editor'
  | 'lorem-ipsum'
  | 'binary-tools'
  | 'unicode-tools'
  | 'json-formatter'
  | 'json-diff'
  | 'qr-code-generator'
  | 'data-faker'
  | 'breakpoint-previewer'
  | 'math-tools'
  | 'time-tools'
  | 'wheel-chance'
  | 'article-to-markdown'
  | 'robots-generator'
  | 'file-crypto'
  | 'cert-inspector'
  | 'pdf-inspector'
  | 'metadata-remover'
  | 'archive-explorer'
  | 'password-tool'
  | 'hash-generator'
  | 'ai-image-inspector'
  | 'gradient-generator'
  | 'box-shadow-generator'
  | 'colour-converter'
  | 'clip-path-builder'
  | 'ip-checker'
  | 'speed-test'
  | 'php2shell-checker'
  | 'breach-radar';

interface ToolItem {
  id: ToolTab;
  title: string;
  category: string;
  description: string;
  icon: string;
}

interface CategoryConfig {
  name: string;
  iconSvg: string;
  colorClass: string;
}

interface ToolCategory {
  name: string;
  iconSvg: string;
  colorClass: string;
  count: number;
  tools: ToolItem[];
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
    JsonFormatterComponent,
    ColorReplacerComponent,
    TextToolsComponent,
    BinaryToolsComponent,
    UnicodeToolsComponent,
    MathToolsComponent,
    TimeToolsComponent,
    JsonDiffComponent,
    GifToolsComponent,
    PdfEditorComponent,
    ImageCompressorComponent,
    ArchiveExplorerComponent,
    MetadataRemoverComponent,
    Base64ToolComponent,
    GradientGeneratorComponent,
    ColourConverterComponent,
    BoxShadowGeneratorComponent,
    LoremIpsumComponent,
    QrCodeGeneratorComponent,
    WheelChanceComponent,
    PasswordToolComponent,
    AiImageInspectorComponent,
    PdfSignerComponent,
    ArticleToMarkdownComponent,
    ScreenshotStudioComponent,
    HashGeneratorComponent,
    MarkdownEditorComponent,
    RobotsGeneratorComponent,
    DataFakerComponent,
    BreakpointPreviewerComponent,
    ClipPathBuilderComponent,
    FileCryptoComponent,
    CertInspectorComponent,
    PdfInspectorComponent,
    IpCheckerComponent,
    SpeedTestComponent,
    Php2shellCheckerComponent,
    BreachRadarComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  activeTab = signal<ToolTab>('welcome');
  searchQuery = signal<string>('');
  studioIncomingImage = signal<string | null>(null);
  railCollapsed = signal(false);
  // Default all categories to closed
  collapsedCategories = signal<Set<string>>(new Set([
    'PDF Tools',
    'Image Tools',
    'Video & Audio',
    'File Converters',
    'Text & Writing Tools',
    'Developer Tools',
    'Calculators & Finance',
    'SEO Tools',
    'Security & Privacy',
    'Documents & Templates',
    'AI Tools',
    'Design & Color Tools',
    'Pickers & Utilities',
    'Networking'
  ]));

  // Exact categories from user specification with LineIcons & badge colors
  categoryDefs: CategoryConfig[] = [
    {
      name: 'Text & Writing Tools',
      colorClass: 'cat-amber',
      iconSvg: 'lni lni-text-format'
    },
    {
      name: 'File Converters',
      colorClass: 'cat-cyan',
      iconSvg: 'lni lni-reload'
    },
    {
      name: 'Developer Tools',
      colorClass: 'cat-indigo',
      iconSvg: 'lni lni-code-alt'
    },
    {
      name: 'Security & Privacy',
      colorClass: 'cat-teal',
      iconSvg: 'lni lni-shield'
    },
    {
      name: 'Design & Color Tools',
      colorClass: 'cat-rose',
      iconSvg: 'lni lni-brush'
    },
    {
      name: 'Networking',
      colorClass: 'cat-cyan',
      iconSvg: 'lni lni-network'
    },
    {
      name: 'SEO Tools',
      colorClass: 'cat-pink',
      iconSvg: 'lni lni-stats-up'
    },
    {
      name: 'Image Tools',
      colorClass: 'cat-emerald',
      iconSvg: 'lni lni-image'
    },
    {
      name: 'Video & Audio',
      colorClass: 'cat-purple',
      iconSvg: 'lni lni-video'
    },
    {
      name: 'PDF Tools',
      colorClass: 'cat-red',
      iconSvg: 'lni lni-empty-file'
    },
    {
      name: 'Calculators & Finance',
      colorClass: 'cat-orange',
      iconSvg: 'lni lni-calculator'
    },
    {
      name: 'Documents & Templates',
      colorClass: 'cat-mint',
      iconSvg: 'lni lni-files'
    },
    {
      name: 'AI Tools',
      colorClass: 'cat-violet',
      iconSvg: 'lni lni-invention'
    },
    {
      name: 'Pickers & Utilities',
      colorClass: 'cat-amber',
      iconSvg: 'lni lni-spinner-arrow'
    }
  ];

  tools: ToolItem[] = [
    // PDF Tools
    {
      id: 'pdf-editor',
      title: 'PDF Studio & Merger',
      category: 'PDF Tools',
      description: 'Merge multiple PDFs, extract pages, rotate, and Word-style editor.',
      icon: '📄'
    },
    {
      id: 'pdf-signer',
      title: 'PDF Signature Studio',
      category: 'PDF Tools',
      description: 'Draw, type, or upload signatures and place anywhere on PDFs.',
      icon: '✍️'
    },

    // Image Tools
    {
      id: 'bg-remover',
      title: 'Background Remover',
      category: 'Image Tools',
      description: 'Isolate subjects and swap backgrounds in 1-click.',
      icon: '✦'
    },
    {
      id: 'screenshot-studio',
      title: 'Screenshot Studio',
      category: 'Image Tools',
      description: 'Capture browser screen, add arrows/rects/steps, blur text, device mockups.',
      icon: '📷'
    },
    {
      id: 'image-studio',
      title: 'Image Studio',
      category: 'Image Tools',
      description: 'Crop, resize, rotate, filter adjustments, watermarks.',
      icon: '▧'
    },
    {
      id: 'image-compressor',
      title: 'Image Compressor',
      category: 'Image Tools',
      description: 'Reduce JPEG, PNG, WebP, GIF, BMP file sizes instantly.',
      icon: '⚡'
    },
    {
      id: 'color-replacer',
      title: 'Color Replacer',
      category: 'Image Tools',
      description: 'Replace any color in PNG with a new one.',
      icon: '◑'
    },
    {
      id: 'gif-tools',
      title: 'Animation Studio',
      category: 'Image Tools',
      description: 'Create animated GIF sequences, sprite sheets, speed and reverse.',
      icon: '🎞'
    },
    {
      id: 'color-palette',
      title: 'Color Palette',
      category: 'Image Tools',
      description: 'Extract dominant color schemes from any graphic.',
      icon: '◉'
    },

    // Video & Audio
    {
      id: 'video-editor',
      title: 'Video Editor',
      category: 'Video & Audio',
      description: 'Trim, rotate, flip, preview, and export video locally.',
      icon: '▶'
    },
    {
      id: 'audio-cutter',
      title: 'Audio Studio & Converter',
      category: 'Video & Audio',
      description: 'Format converter (MP3/WAV/OGG/FLAC/AAC), mixer, silence remover, normalizer, pitch/EQ, spectrogram.',
      icon: '≋'
    },

    // File Converters
    {
      id: 'batch-converter',
      title: 'Batch Converter',
      category: 'File Converters',
      description: 'Convert and compress dozens of images at once.',
      icon: '▱'
    },
    {
      id: 'base64-tool',
      title: 'Base64 Tool',
      category: 'File Converters',
      description: 'Encode & decode text and binary files/images to Base64 data URLs.',
      icon: '🔤'
    },

    // Text & Writing Tools
    {
      id: 'text-tools',
      title: 'Text Tools & Cleaner',
      category: 'Text & Writing Tools',
      description: 'Case conversion, word counter, regex replacement, line sorting.',
      icon: 'T'
    },
    {
      id: 'markdown-editor',
      title: 'Markdown Studio',
      category: 'Text & Writing Tools',
      description: 'Write Markdown with real-time preview, tables, and code blocks.',
      icon: '📝'
    },
    {
      id: 'lorem-ipsum',
      title: 'Lorem Ipsum Builder',
      category: 'Text & Writing Tools',
      description: 'Generate customizable placeholder paragraphs, words, and lists.',
      icon: '¶'
    },

    // Developer Tools
    {
      id: 'binary-tools',
      title: 'Binary & Bitwise',
      category: 'Developer Tools',
      description: 'Text to binary, base converter (hex/oct/dec/bin), bitwise ops.',
      icon: '01'
    },
    {
      id: 'unicode-tools',
      title: 'Unicode & Symbols',
      category: 'Developer Tools',
      description: 'Inspect character codes, entities, and copy 250+ symbol palette.',
      icon: 'Ω'
    },
    {
      id: 'json-formatter',
      title: 'JSON Formatter & Tree',
      category: 'Developer Tools',
      description: 'Beautify, validate, minify, search, and inspect JSON trees.',
      icon: '{ }'
    },
    {
      id: 'json-diff',
      title: 'JSON Diff & CSV',
      category: 'Developer Tools',
      description: 'Compare two JSON objects side-by-side, CSV import/export.',
      icon: '⇄'
    },
    {
      id: 'qr-code-generator',
      title: 'QR Code Generator',
      category: 'Developer Tools',
      description: 'Generate high-res PNG QR codes with colors and error correction.',
      icon: '🏁'
    },
    {
      id: 'data-faker',
      title: 'Data Faker',
      category: 'Developer Tools',
      description: 'Generate realistic synthetic names, emails, addresses, dates, and datasets.',
      icon: '🎲'
    },
    {
      id: 'breakpoint-previewer',
      title: 'Breakpoint Previewer',
      category: 'Developer Tools',
      description: 'Preview websites at common viewport sizes and custom resolutions.',
      icon: '📱'
    },

    // Calculators & Finance
    {
      id: 'math-tools',
      title: 'Math & Statistics',
      category: 'Calculators & Finance',
      description: 'Expression evaluator, statistics (mean/median), percentages.',
      icon: '∑'
    },
    {
      id: 'time-tools',
      title: 'Time & Clocks',
      category: 'Calculators & Finance',
      description: 'Unix epoch timestamp converter, world clocks, stopwatch, date diff.',
      icon: '⏱'
    },

    // Pickers & Utilities
    {
      id: 'wheel-chance',
      title: 'Wheel of Chance',
      category: 'Pickers & Utilities',
      description: 'Spin a custom prize wheel with automatic winner elimination.',
      icon: '🎡'
    },

    // SEO Tools
    {
      id: 'article-to-markdown',
      title: 'Article to Markdown',
      category: 'SEO Tools',
      description: 'Paste any article URL or HTML, get clean Markdown without ads.',
      icon: '📑'
    },
    {
      id: 'robots-generator',
      title: 'Robots.txt Generator',
      category: 'SEO Tools',
      description: 'Build robots.txt crawler rules with syntax validation & sitemap directives.',
      icon: '🤖'
    },

    // Security & Privacy
    {
      id: 'file-crypto',
      title: 'File Crypto Studio',
      category: 'Security & Privacy',
      description: 'Encrypt & decrypt files locally via Web Crypto API with authenticated AES-256-GCM.',
      icon: '🔒'
    },
    {
      id: 'cert-inspector',
      title: 'Certificate Inspector',
      category: 'Security & Privacy',
      description: 'Audit SSL/TLS certificates, SANs, validity, and live Certificate Transparency logs.',
      icon: '📜'
    },
    {
      id: 'pdf-inspector',
      title: 'PDF Security Inspector',
      category: 'Security & Privacy',
      description: 'Dissect PDF structures to detect embedded JavaScript, /OpenAction triggers, & hidden layers.',
      icon: '🔍'
    },
    {
      id: 'metadata-remover',
      title: 'Metadata Remover',
      category: 'Security & Privacy',
      description: 'Strip EXIF, GPS location, camera serials, and timestamps.',
      icon: '🧹'
    },
    {
      id: 'archive-explorer',
      title: 'Archive Explorer',
      category: 'Security & Privacy',
      description: 'Peek inside ZIP, JAR, and packages; detect disguised executables.',
      icon: '📦'
    },
    {
      id: 'password-tool',
      title: 'Password Studio',
      category: 'Security & Privacy',
      description: 'Cryptographic generator & brute-force entropy crack time tester.',
      icon: '🔑'
    },
    {
      id: 'hash-generator',
      title: 'Hash Generator',
      category: 'Security & Privacy',
      description: 'Generate SHA-256, SHA-384, SHA-512 cryptographic hashes for text & files.',
      icon: '#️⃣'
    },
    {
      id: 'php2shell-checker',
      title: 'PHP2Shell Checker',
      category: 'Security & Privacy',
      description: 'Check which PHP version your site advertises and whether it is older than fixes 8.2.35, 8.3.36, 8.4.27, 8.5.12.',
      icon: '🐘'
    },
    {
      id: 'breach-radar',
      title: 'Breaches & CVE Radar',
      category: 'Security & Privacy',
      description: 'Explore the largest historic data breaches and notorious CVEs, backed by live CIRCL open-source API lookups.',
      icon: '🚨'
    },

    // AI Tools
    {
      id: 'ai-image-inspector',
      title: 'AI & Metadata Inspector',
      category: 'AI Tools',
      description: 'Verifiable C2PA credentials, Stable Diffusion prompts, camera EXIF.',
      icon: '🔬'
    },

    // Design & Color Tools
    {
      id: 'gradient-generator',
      title: 'CSS Gradient Generator',
      category: 'Design & Color Tools',
      description: 'Linear and radial gradient visualizer with instant CSS export.',
      icon: '🌈'
    },
    {
      id: 'box-shadow-generator',
      title: 'Box Shadow Generator',
      category: 'Design & Color Tools',
      description: 'Design soft, layered, and inset CSS box shadows visually.',
      icon: '❐'
    },
    {
      id: 'colour-converter',
      title: 'Colour Converter',
      category: 'Design & Color Tools',
      description: 'HEX, RGB, HSL, CMYK converter with WCAG contrast detection.',
      icon: '🎨'
    },
    {
      id: 'clip-path-builder',
      title: 'CSS Clip-Path Builder',
      category: 'Design & Color Tools',
      description: 'Draw polygons and custom shapes visually and export production CSS.',
      icon: '📐'
    },

    // Networking
    {
      id: 'ip-checker',
      title: 'IP Address Checker',
      category: 'Networking',
      description: 'Check your global IP address, ASN, ISP, geolocation, and connection metrics.',
      icon: '🌐'
    },
    {
      id: 'speed-test',
      title: 'Network Speed Test',
      category: 'Networking',
      description: 'Test broadband download, upload, ping latency, and jitter buffer in real-time.',
      icon: '⚡'
    }
  ];

  categories: ToolCategory[] = this.buildCategories();

  private buildCategories(): ToolCategory[] {
    const map = new Map<string, ToolItem[]>();
    for (const tool of this.tools) {
      if (!map.has(tool.category)) map.set(tool.category, []);
      map.get(tool.category)!.push(tool);
    }

    return this.categoryDefs
      .filter(cat => map.has(cat.name) && map.get(cat.name)!.length > 0)
      .map(cat => ({
        name: cat.name,
        iconSvg: cat.iconSvg,
        colorClass: cat.colorClass,
        count: map.get(cat.name)!.length,
        tools: map.get(cat.name)!
      }));
  }

  filteredCategories(): ToolCategory[] {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.categories;
    return this.categories
      .map(cat => ({
        ...cat,
        tools: cat.tools.filter(
          t =>
            t.title.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q)
        )
      }))
      .filter(cat => cat.tools.length > 0);
  }

  constructor(private audioService: AudioService) {}

  selectTool(id: ToolTab) {
    this.audioService.stopPlayback();
    this.activeTab.set(id);
  }

  openWelcome() {
    this.audioService.stopPlayback();
    this.activeTab.set('welcome');
  }

  toggleCategory(catName: string) {
    this.collapsedCategories.update(set => {
      const next = new Set(set);
      if (next.has(catName)) {
        next.delete(catName);
      } else {
        next.add(catName);
      }
      return next;
    });
  }

  isCategoryCollapsed(catName: string): boolean {
    return this.collapsedCategories().has(catName);
  }

  toggleRail() {
    this.railCollapsed.update(v => !v);
  }

  focusSearch() {
    if (this.railCollapsed()) {
      this.railCollapsed.set(false);
    }
    setTimeout(() => {
      const input = document.querySelector('.rail-search-input') as HTMLInputElement | null;
      input?.focus();
    }, 50);
  }

  exploreTools() {
    if (this.railCollapsed()) {
      this.railCollapsed.set(false);
    }
    this.selectTool('pdf-editor');
  }

  handleSendToStudio(imageUrl: string) {
    this.studioIncomingImage.set(imageUrl);
    this.activeTab.set('image-studio');
  }
}
