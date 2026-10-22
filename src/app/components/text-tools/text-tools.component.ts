import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type TextSubtool = 'case' | 'counter' | 'replace' | 'cleaner' | 'diff';

@Component({
  selector: 'app-text-tools',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './text-tools.component.html',
  styleUrl: './text-tools.component.scss'
})
export class TextToolsComponent {
  activeSubtool = signal<TextSubtool>('case');
  inputText = signal('');
  outputText = signal('');

  // Find & Replace
  findText = signal('');
  replaceText = signal('');
  matchCase = signal(false);
  useRegex = signal(false);

  // Stats
  charCount = computed(() => this.inputText().length);
  charNoSpaces = computed(() => this.inputText().replace(/\s/g, '').length);
  wordCount = computed(() => {
    const text = this.inputText().trim();
    return text ? text.split(/\s+/).length : 0;
  });
  lineCount = computed(() => {
    const text = this.inputText();
    return text ? text.split('\n').length : 0;
  });
  sentenceCount = computed(() => {
    const text = this.inputText().trim();
    if (!text) return 0;
    const matches = text.match(/[^.!?]+[.!?]+/g);
    return matches ? matches.length : 1;
  });
  readingTime = computed(() => Math.ceil(this.wordCount() / 200));

  // Case transforms
  toUpperCase() {
    this.outputText.set(this.inputText().toUpperCase());
  }

  toLowerCase() {
    this.outputText.set(this.inputText().toLowerCase());
  }

  toTitleCase() {
    const text = this.inputText().toLowerCase();
    this.outputText.set(
      text.replace(/(?:^|\s|-)\w/g, match => match.toUpperCase())
    );
  }

  toSentenceCase() {
    const text = this.inputText().toLowerCase();
    this.outputText.set(
      text.replace(/(^\s*\w|[.!?]\s*\w)/g, match => match.toUpperCase())
    );
  }

  toCamelCase() {
    const text = this.inputText().trim();
    const words = text.split(/[\s_\-]+/);
    if (!words.length || !words[0]) {
      this.outputText.set('');
      return;
    }
    const result = words[0].toLowerCase() + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    this.outputText.set(result);
  }

  toSnakeCase() {
    const text = this.inputText().trim();
    this.outputText.set(
      text
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s\-]+/g, '_')
        .toLowerCase()
    );
  }

  toKebabCase() {
    const text = this.inputText().trim();
    this.outputText.set(
      text
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase()
    );
  }

  // Cleaner actions
  trimWhitespace() {
    this.outputText.set(
      this.inputText()
        .split('\n')
        .map(l => l.trim())
        .join('\n')
    );
  }

  removeEmptyLines() {
    this.outputText.set(
      this.inputText()
        .split('\n')
        .filter(l => l.trim().length > 0)
        .join('\n')
    );
  }

  removeDuplicateLines() {
    const lines = this.inputText().split('\n');
    const unique = Array.from(new Set(lines));
    this.outputText.set(unique.join('\n'));
  }

  sortLinesAsc() {
    const lines = this.inputText().split('\n');
    lines.sort((a, b) => a.localeCompare(b));
    this.outputText.set(lines.join('\n'));
  }

  sortLinesDesc() {
    const lines = this.inputText().split('\n');
    lines.sort((a, b) => b.localeCompare(a));
    this.outputText.set(lines.join('\n'));
  }

  reverseLines() {
    const lines = this.inputText().split('\n');
    lines.reverse();
    this.outputText.set(lines.join('\n'));
  }

  // Find & Replace
  executeReplace() {
    const find = this.findText();
    const rep = this.replaceText();
    if (!find) {
      this.outputText.set(this.inputText());
      return;
    }
    try {
      if (this.useRegex()) {
        const flags = this.matchCase() ? 'g' : 'gi';
        const regex = new RegExp(find, flags);
        this.outputText.set(this.inputText().replace(regex, rep));
      } else {
        if (this.matchCase()) {
          this.outputText.set(this.inputText().split(find).join(rep));
        } else {
          const regex = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          this.outputText.set(this.inputText().replace(regex, rep));
        }
      }
    } catch {
      alert('Invalid regular expression');
    }
  }

  copyOutput() {
    navigator.clipboard.writeText(this.outputText());
  }

  clear() {
    this.inputText.set('');
    this.outputText.set('');
  }
}

