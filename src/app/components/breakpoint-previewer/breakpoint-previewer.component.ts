import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface DevicePreset {
  name: string;
  width: number;
  height: number;
  icon: string;
}

@Component({
  selector: 'app-breakpoint-previewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './breakpoint-previewer.component.html',
  styleUrl: './breakpoint-previewer.component.scss'
})
export class BreakpointPreviewerComponent {
  targetUrl = signal<string>('https://example.com');
  safeUrl = signal<SafeResourceUrl>('');
  viewportWidth = signal<number>(375);
  viewportHeight = signal<number>(667);
  isLandscape = signal<boolean>(false);
  zoomScale = signal<number>(100); // 100%

  presets: DevicePreset[] = [
    { name: 'iPhone SE', width: 375, height: 667, icon: 'lni lni-mobile' },
    { name: 'iPhone 15 Pro', width: 393, height: 852, icon: 'lni lni-mobile' },
    { name: 'iPad Mini', width: 768, height: 1024, icon: 'lni lni-tab' },
    { name: 'iPad Pro 11"', width: 834, height: 1194, icon: 'lni lni-tab' },
    { name: 'Laptop', width: 1280, height: 800, icon: 'lni lni-laptop' },
    { name: 'Full HD Desktop', width: 1920, height: 1080, icon: 'lni lni-display' }
  ];

  constructor(private sanitizer: DomSanitizer) {
    this.updateUrl();
  }

  updateUrl() {
    let url = this.targetUrl().trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
  }

  selectPreset(p: DevicePreset) {
    this.viewportWidth.set(p.width);
    this.viewportHeight.set(p.height);
    this.isLandscape.set(false);
  }

  toggleOrientation() {
    const w = this.viewportWidth();
    const h = this.viewportHeight();
    this.viewportWidth.set(h);
    this.viewportHeight.set(w);
    this.isLandscape.set(!this.isLandscape());
  }
}

