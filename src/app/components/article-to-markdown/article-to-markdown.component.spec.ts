import { vi } from 'vitest';
import { ArticleToMarkdownComponent } from './article-to-markdown.component';
import { extractArticle } from './article-extractor';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Article fetching', () => {
  it('stops loading after 20 seconds even if the response body hangs', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) });
    vi.stubGlobal('fetch', fetchMock);
    const component = new ArticleToMarkdownComponent();
    component.url.set('https://example.com/article');
    const pending = component.fetchArticle();
    await vi.advanceTimersByTimeAsync(20_000);
    await pending;
    expect(component.isLoading()).toBe(false);
    expect(component.errorMsg()).toContain('timed out');
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('fetches mobile Wikipedia through its API with redirects and CORS enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ parse: { title: 'Earth', text: '<div class="mw-parser-output"><p>Our <b>planet</b>.</p></div>' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const component = new ArticleToMarkdownComponent();
    component.url.set('https://en.m.wikipedia.org/wiki/Earth');
    await component.fetchArticle();
    const endpoint = new URL(fetchMock.mock.calls[0][0]);
    expect(endpoint.hostname).toBe('en.wikipedia.org');
    expect(endpoint.pathname).toBe('/w/api.php');
    expect(endpoint.searchParams.get('origin')).toBe('*');
    expect(endpoint.searchParams.get('page')).toBe('Earth');
    expect(component.markdownOutput()).toContain('Our **planet**.');
    expect(component.articleTitle()).toBe('Earth');
  });

  it('does not let a cancelled request overwrite pasted content', async () => {
    let resolve!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(done => { resolve = done; })));
    const component = new ArticleToMarkdownComponent();
    component.url.set('https://example.com');
    const pending = component.fetchArticle();
    component.rawHtmlInput.set('<h1>Pasted</h1><p>Keep this.</p>');
    component.processPastedHtml();
    resolve({ ok: true, json: async () => ({ contents: '<p>Old request</p>' }) });
    await pending;
    expect(component.markdownOutput()).toContain('Keep this.');
    expect(component.markdownOutput()).not.toContain('Old request');
    expect(component.isLoading()).toBe(false);
  });

  it('reports HTTP errors and rejects non-web URLs without fetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);
    const component = new ArticleToMarkdownComponent();
    component.url.set('https://example.com');
    await component.fetchArticle();
    expect(component.errorMsg()).toContain('503');
    component.url.set('javascript:alert(1)');
    await component.fetchArticle();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(component.errorMsg()).toContain('valid');
  });
});

describe('Article conversion', () => {
  it('avoids duplicate nested content and preserves links and formatting', () => {
    const { markdown } = extractArticle('<article><header><h1>Story</h1></header><p>A <strong>bold</strong> <a href="/next">link</a>.</p><ul><li>Parent<ul><li>Child</li></ul></li></ul><blockquote><p>Quote once</p></blockquote></article>', 'https://example.com/post');
    expect(markdown.match(/Story/g)).toHaveLength(1);
    expect(markdown.match(/Child/g)).toHaveLength(1);
    expect(markdown.match(/Quote once/g)).toHaveLength(1);
    expect(markdown).toContain('[link](https://example.com/next)');
    expect(markdown).toContain('**bold**');
    expect(markdown).toContain('  - Child');
  });

  it('extracts Wikipedia content without navigation, edit controls, or citation clutter', () => {
    const { markdown } = extractArticle('<nav>Menu</nav><h1>Earth</h1><main><div class="mw-parser-output"><table class="infobox"><tr><td>Sidebar</td></tr></table><p>Planet<sup class="reference">[1]</sup>.</p><h2>History<span class="mw-editsection">edit</span></h2><p>History text</p></div></main>');
    expect(markdown).toContain('Planet.');
    expect(markdown).toContain('## History');
    expect(markdown).not.toMatch(/Sidebar|Menu|\[1\]|edit/);
  });

  it('preserves code whitespace and uses a fence longer than code backticks', () => {
    const { markdown } = extractArticle('<article><pre>  first\n\n\n```\n  last</pre></article>');
    expect(markdown).toContain('````\n  first\n\n\n```\n  last\n````');
  });

  it('supports plain pasted text and reports empty or oversized content', () => {
    expect(extractArticle('Plain text').markdown).toContain('Plain text');
    expect(() => extractArticle('<script>hidden</script>')).toThrow('No readable');
    expect(() => extractArticle('x'.repeat(5_000_001))).toThrow('too large');
  });

  it('renders table cells once and rejects unsafe link schemes', () => {
    const { markdown } = extractArticle('<table><tr><th>A</th><th>B</th></tr><tr><td><p>Unique</p></td><td><a href="javascript:alert(1)">Text</a></td></tr></table>');
    expect(markdown.match(/Unique/g)).toHaveLength(1);
    expect(markdown).toContain('| A | B |');
    expect(markdown).not.toContain('javascript:');
  });
});
