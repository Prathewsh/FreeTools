import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { extractArticle } from './article-extractor';

@Component({
  selector: 'app-article-to-markdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './article-to-markdown.component.html',
  styleUrl: './article-to-markdown.component.scss'
})
export class ArticleToMarkdownComponent implements OnDestroy {
  private request: AbortController | null = null;
  url = signal<string>('');
  rawHtmlInput = signal<string>('');
  markdownOutput = signal<string>('');
  articleTitle = signal<string>('');
  isLoading = signal<boolean>(false);
  errorMsg = signal<string>('');
  copied = signal<boolean>(false);
  activeTab = signal<'url' | 'paste'>('url');

  cancelFetch() {
    this.request?.abort();
    this.request = null;
    this.isLoading.set(false);
  }

  ngOnDestroy() { this.cancelFetch(); }

  async fetchArticle() {
    this.cancelFetch();
    this.errorMsg.set('');
    let target: URL;
    try {
      target = new URL(this.url().trim());
      if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error();
    } catch {
      this.errorMsg.set('Enter a valid http:// or https:// article URL.');
      return;
    }
    const request = new AbortController();
    this.request = request;
    this.isLoading.set(true);
    this.markdownOutput.set('');
    this.articleTitle.set('');
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; request.abort(); }, 20_000);
    const aborted = new Promise<never>((_, reject) => {
      request.signal.addEventListener('abort', () => reject(new Error('Request cancelled')), { once: true });
    });
    try {
      const result = await Promise.race([this.retrieveArticle(target, request.signal), aborted]);
      if (this.request !== request || request.signal.aborted) return;
      this.parseHtmlToMarkdown(result.html, target.href, result.title);
    } catch (err: unknown) {
      if (this.request !== request) return;
      this.errorMsg.set(timedOut
        ? 'The request timed out after 20 seconds. Try again or paste the article HTML instead.'
        : `${err instanceof Error ? err.message : 'Unable to fetch this article.'} Try the Paste Article HTML tab if the site blocks access.`);
    } finally {
      clearTimeout(timer);
      if (this.request === request) {
        this.request = null;
        this.isLoading.set(false);
      }
    }
  }

  private async retrieveArticle(target: URL, signal: AbortSignal): Promise<{ html: string; title?: string }> {
    const wiki = /^(?:[a-z0-9-]+\.)?(?:m\.)?wikipedia\.org$/i.test(target.hostname);
    if (wiki) {
      const page = target.pathname.startsWith('/wiki/') ? decodeURIComponent(target.pathname.slice(6)) : target.searchParams.get('title');
      if (!page) throw new Error('Use a Wikipedia article URL, such as /wiki/Article_name.');
      const api = new URL('/w/api.php', target.origin.replace('.m.wikipedia.org', '.wikipedia.org'));
      api.search = new URLSearchParams({ action: 'parse', page, prop: 'text', redirects: '1', format: 'json', formatversion: '2', origin: '*' }).toString();
      const res = await fetch(api.href, { signal, credentials: 'omit' });
      if (!res.ok) throw new Error(`Wikipedia returned HTTP ${res.status}.`);
      const data = await res.json();
      if (data.error || typeof data.parse?.text !== 'string') throw new Error(data.error?.info || 'Wikipedia returned no article content.');
      return { html: data.parse.text, title: data.parse.title };
    }
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(target.href)}`, { signal, credentials: 'omit' });
    if (!res.ok) throw new Error(`The article fetch service returned HTTP ${res.status}.`);
    const data = await res.json();
    if (data.status?.http_code >= 400) throw new Error(`The website returned HTTP ${data.status.http_code}.`);
    if (typeof data.contents !== 'string' || !data.contents.trim()) throw new Error('No article content was returned.');
    return { html: data.contents };
  }

  processPastedHtml() {
    this.cancelFetch();
    this.errorMsg.set('');
    this.markdownOutput.set('');
    this.articleTitle.set('');
    try {
      this.parseHtmlToMarkdown(this.rawHtmlInput());
    } catch (err: unknown) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Unable to convert this HTML.');
    }
  }

  parseHtmlToMarkdown(htmlString: string, sourceUrl = '', title?: string) {
    const result = extractArticle(htmlString, sourceUrl, title);
    this.articleTitle.set(result.title);
    this.markdownOutput.set(result.markdown);
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

