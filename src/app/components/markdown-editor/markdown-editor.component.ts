import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './markdown-editor.component.html',
  styleUrl: './markdown-editor.component.scss'
})
export class MarkdownEditorComponent {
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

  // Lightweight in-browser Markdown parser
  private parseMarkdown(md: string): string {
    let html = md
      // Code blocks
      .replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Blockquotes
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      // Bold & Italic
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Checkboxes
      .replace(/- \[x\] (.*$)/gim, '<div class="task-item checked">☑ $1</div>')
      .replace(/- \[ \] (.*$)/gim, '<div class="task-item">☐ $1</div>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // Horizontal rules
      .replace(/^\-\-\-$/gim, '<hr/>');

    // Simple table parser
    html = html.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (match) => {
      const rows = match.trim().split('\n').map(r => r.trim());
      if (rows.length < 2) return match;
      let tableHtml = '<table class="md-table"><thead><tr>';
      const headers = rows[0].split('|').filter(c => c.trim().length > 0);
      headers.forEach(h => tableHtml += `<th>${h.trim()}</th>`);
      tableHtml += '</tr></thead><tbody>';

      for (let i = 2; i < rows.length; i++) {
        const cells = rows[i].split('|').filter(c => c.trim().length > 0);
        tableHtml += '<tr>';
        cells.forEach(c => tableHtml += `<td>${c.trim()}</td>`);
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody></table>';
      return tableHtml;
    });

    // Paragraphs
    html = html.replace(/\n\n+/g, '</p><p>');
    return `<p>${html}</p>`;
  }

  downloadFile(format: 'md' | 'html') {
    const content = format === 'md' ? this.markdownText() : this.renderedHtml();
    const blob = new Blob([content], { type: format === 'md' ? 'text/markdown' : 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `document.${format}`;
    link.click();
  }
}

