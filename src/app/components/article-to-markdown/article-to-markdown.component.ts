import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-article-to-markdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './article-to-markdown.component.html',
  styleUrl: './article-to-markdown.component.scss'
})
export class ArticleToMarkdownComponent {
  url = signal<string>('');
  rawHtmlInput = signal<string>('');
  markdownOutput = signal<string>('');
  articleTitle = signal<string>('');
  isLoading = signal<boolean>(false);
  errorMsg = signal<string>('');
  copied = signal<boolean>(false);
  activeTab = signal<'url' | 'paste'>('url');

  async fetchArticle() {
    const targetUrl = this.url().trim();
    if (!targetUrl) return;

    this.isLoading.set(true);
    this.errorMsg.set('');
    this.markdownOutput.set('');

    try {
      // Use AllOrigins / corsproxy client fallback for client-side web requests
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyUrl);
      const data = await res.json();

      if (!data.contents) {
        throw new Error('Could not retrieve article content. Site may block scraping or require authentication.');
      }

      this.parseHtmlToMarkdown(data.contents);
    } catch (err: any) {
      this.errorMsg.set(
        'Direct URL fetching was blocked by CORS or the website. You can also paste the article HTML/Page source directly in the "Paste HTML" tab!'
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  processPastedHtml() {
    if (!this.rawHtmlInput().trim()) return;
    this.parseHtmlToMarkdown(this.rawHtmlInput());
  }

  parseHtmlToMarkdown(htmlString: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // Extract title
    const title = doc.querySelector('title')?.innerText || doc.querySelector('h1')?.innerText || 'Article';
    this.articleTitle.set(title);

    // Remove scripts, styles, navigations, sidebars, cookie banners, footers, svg
    const unwantedSelectors = [
      'script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside',
      '.cookie-banner', '#cookie-banner', '.ads', '.advertisement', '.social-share',
      '.comments', '#comments', 'svg', 'iframe'
    ];

    unwantedSelectors.forEach(selector => {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Locate primary content container
    const article = doc.querySelector('article') || doc.querySelector('main') || doc.querySelector('.post-content') || doc.querySelector('.article-body') || doc.body;

    let md = `# ${title}\n\n`;

    // Process paragraphs, headings, lists, blockquotes, images
    const elements = article.querySelectorAll('h1, h2, h3, h4, p, ul, ol, blockquote, pre');

    elements.forEach(el => {
      const tag = el.tagName.toLowerCase();
      const text = el.textContent?.trim() || '';
      if (!text) return;

      switch (tag) {
        case 'h1':
          if (text !== title) md += `# ${text}\n\n`;
          break;
        case 'h2':
          md += `## ${text}\n\n`;
          break;
        case 'h3':
          md += `### ${text}\n\n`;
          break;
        case 'h4':
          md += `#### ${text}\n\n`;
          break;
        case 'p':
          md += `${text}\n\n`;
          break;
        case 'blockquote':
          md += `> ${text}\n\n`;
          break;
        case 'pre':
          md += `\`\`\`\n${text}\n\`\`\`\n\n`;
          break;
        case 'ul':
        case 'ol':
          const items = el.querySelectorAll('li');
          items.forEach((li, idx) => {
            const prefix = tag === 'ul' ? '- ' : `${idx + 1}. `;
            md += `${prefix}${li.textContent?.trim()}\n`;
          });
          md += '\n';
          break;
      }
    });

    this.markdownOutput.set(md);
  }

  copyMarkdown() {
    navigator.clipboard.writeText(this.markdownOutput());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  downloadMarkdown() {
    const blob = new Blob([this.markdownOutput()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = this.articleTitle().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'article';
    a.download = `${safeTitle}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

