import { TestBed } from '@angular/core/testing';
import { MarkdownEditorComponent } from './markdown-editor.component';

describe('Markdown preview', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [MarkdownEditorComponent] }));

  async function preview(markdown: string) {
    const fixture = TestBed.createComponent(MarkdownEditorComponent);
    fixture.componentInstance.markdownText.set(markdown);
    await fixture.whenStable();
    return fixture.nativeElement.querySelector('.markdown-body') as HTMLElement;
  }

  it('renders separate paragraphs, headings, and explicit hard breaks', async () => {
    const body = await preview('# Heading\n\nFirst paragraph.\n\nSecond paragraph.  \nNext line.\\\nAnother line.');
    expect(body.querySelector('h1')?.textContent).toBe('Heading');
    expect(body.querySelectorAll('p')).toHaveLength(2);
    expect(body.querySelectorAll('br')).toHaveLength(2);
    expect(body.querySelector('p h1')).toBeNull();
  });

  it('keeps soft line breaks within one paragraph like a Markdown file', async () => {
    const body = await preview('First line\nsecond line');
    expect(body.querySelectorAll('p')).toHaveLength(1);
    expect(body.querySelector('br')).toBeNull();
  });

  it('renders indented nested lists and visible task markers', async () => {
    const body = await preview('- Parent\n  - Child\n\n1. First\n2. Second\n\n- [x] Done\n- [ ] Pending');
    expect(body.querySelector('ul li ul li')?.textContent).toBe('Child');
    expect(body.querySelectorAll('ol > li')).toHaveLength(2);
    expect(body.querySelectorAll('.task-marker')).toHaveLength(2);
    expect(body.textContent).toContain('☑');
    expect(body.textContent).toContain('☐');
  });

  it('preserves code indentation and blank lines without interpreting Markdown or HTML', async () => {
    const code = '  <div>**literal**</div>\n\n    return `hello`;\n';
    const body = await preview('```html\n' + code + '```');
    expect(body.querySelector('pre code')?.textContent).toBe(code);
    expect(body.querySelector('pre div, pre strong, pre p')).toBeNull();
  });

  it('retains empty table cells and renders blockquotes', async () => {
    const body = await preview('| A | B |\n| --- | --- |\n| | value |\n\n> Quote');
    expect(body.querySelectorAll('tbody td')).toHaveLength(2);
    expect(body.querySelector('tbody td')?.textContent).toBe('');
    expect(body.querySelector('blockquote p')?.textContent).toBe('Quote');
  });

  it('sanitizes executable HTML in both the preview and exported markup', async () => {
    const fixture = TestBed.createComponent(MarkdownEditorComponent);
    fixture.componentInstance.markdownText.set('<img src="x" onerror="alert(1)"><script>alert(1)</script>');
    const html = fixture.componentInstance.renderedHtml();
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script');
  });
});
