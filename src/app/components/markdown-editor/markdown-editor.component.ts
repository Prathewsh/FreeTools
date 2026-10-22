import { Component, signal, computed, inject, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Marked } from 'marked';

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './markdown-editor.component.html',
  styleUrl: './markdown-editor.component.scss'
})
export class MarkdownEditorComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly parser = new Marked({
    gfm: true,
    breaks: false,
    // Angular removes input elements from innerHTML; keep task markers visible.
    renderer: {
      checkbox: ({ checked }) => `<span class="task-marker" role="img" aria-label="${checked ? 'Completed' : 'Not completed'}">${checked ? '☑' : '☐'}</span> `
    }
  });
  markdownText = signal<string>(`# Welcome to FreeTools Markdown Studio

Write markdown on the left, see instant rendered HTML on the right!

## Supported Markdown Elements

### 1. Formatting
**Bold text**, *italic text*, and \`inline code\`.

### 2. Lists & Checklist
- [x] 100% Client-side execution
- [x] Zero telemetry & no external servers
- [ ] Add more developer utilities

### 3. Data Tables
| Tool Name | Category | Status |
| :--- | :--- | :--- |
| Audio Studio | Video & Audio | Live |
| Matrix Suite | Math | Live |
| Hash Generator | Security | Live |

### 4. Code Blocks
\`\`\`typescript
const greet = (name: string): string => {
  return \`Hello, \${name}!\`;
};
\`\`\`

> "Simplicity is prerequisite for reliability." — Edsger W. Dijkstra
`);

  viewMode = signal<'split' | 'edit' | 'preview'>('split');

  renderedHtml = computed(() => {
    return this.parseMarkdown(this.markdownText());
  });

  stats = computed(() => {
    const text = this.markdownText();
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const lines = text.split('\n').length;
    return { words, chars, lines };
  });

  insertSnippet(type: string) {
    let snippet = '';
    switch (type) {
      case 'bold': snippet = '**bold text**'; break;
      case 'italic': snippet = '*italic text*'; break;
      case 'heading': snippet = '\n## Heading 2\n'; break;
      case 'link': snippet = '[Link text](https://example.com)'; break;
      case 'code': snippet = '\n```typescript\nconsole.log("hello");\n```\n'; break;
      case 'table':
        snippet = '\n| Header 1 | Header 2 |\n| :--- | :--- |\n| Cell 1 | Cell 2 |\n';
        break;
      case 'quote': snippet = '\n> Blockquote text\n'; break;
    }
    this.markdownText.update(t => t + snippet);
  }

  private parseMarkdown(md: string): string {
    const html = this.parser.parse(md, { async: false });
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }

  downloadFile(format: 'md' | 'html') {
    const content = format === 'md' ? this.markdownText() : this.renderedHtml();
    const blob = new Blob([content], { type: format === 'md' ? 'text/markdown' : 'text/html' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `document.${format}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

