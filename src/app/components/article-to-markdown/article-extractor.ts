// Convert each node once, so nested paragraphs and lists are never emitted twice.
export function extractArticle(html: string, sourceUrl = '', providedTitle?: string) {
  if (!html.trim()) throw new Error('Paste some article HTML or text first.');
  if (html.length > 5_000_000) throw new Error('This page is too large. Paste just the article content (under 5 MB).');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = (providedTitle || doc.querySelector('h1')?.textContent || doc.title || 'Article').trim();
  doc.querySelectorAll('script,style,noscript,nav,footer,aside,svg,iframe,form,button,[hidden],.cookie-banner,#cookie-banner,.ads,.advertisement,.social-share,.comments,#comments,.mw-editsection,.navbox,.infobox,.sidebar,.toc,#toc,.reflist,sup.reference,.metadata,.mw-indicators').forEach(el => el.remove());
  const article = doc.querySelector('.mw-parser-output') || doc.querySelector('article') || doc.querySelector('.post-content,.article-body') || doc.querySelector('main') || doc.body;
  const escape = (text: string) => text.replace(/([\\`*_\[\]<>#])/g, '\\$1');
  const url = (value: string | null) => {
    if (!value) return '';
    if (value.startsWith('#')) return value;
    try {
      const resolved = sourceUrl ? new URL(value, sourceUrl) : new URL(value);
      return ['https:', 'http:', 'mailto:'].includes(resolved.protocol) ? resolved.href.replace(/[()<>]/g, char => '%' + char.charCodeAt(0).toString(16)) : '';
    } catch { return ''; }
  };
  const children = (node: Node, depth: number): string => Array.from(node.childNodes).reduce((result, child) => {
    const next = render(child, depth + 1);
    // Normalize only block boundaries, never the interior of preformatted code.
    if (/\n\s*$/.test(result) && /^\s*\n/.test(next)) return result.trimEnd() + '\n\n' + next.trimStart();
    return result + next;
  }, '');
  const render = (node: Node, depth = 0): string => {
    if (depth > 100) return '';
    if (node.nodeType === Node.TEXT_NODE) return escape((node.textContent || '').replace(/\s+/g, ' '));
    if (!(node instanceof Element)) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'pre') {
      const text = node.textContent || '';
      const fence = '`'.repeat(Math.max(3, ...Array.from(text.matchAll(/`+/g), match => match[0].length + 1)));
      return `\n\n${fence}\n${text.replace(/\n$/, '')}\n${fence}\n\n`;
    }
    if (tag === 'code') {
      const text = (node.textContent || '').replace(/\n/g, ' ');
      const fence = '`'.repeat(Math.max(1, ...Array.from(text.matchAll(/`+/g), match => match[0].length + 1)));
      return `${fence} ${text} ${fence}`;
    }
    if (tag === 'br') return '  \n';
    if (tag === 'hr') return '\n\n---\n\n';
    if (tag === 'img') {
      const src = url(node.getAttribute('src'));
      return src ? `![${escape(node.getAttribute('alt') || '')}](${src})` : '';
    }
    if (tag === 'ul' || tag === 'ol') {
      let number = Number(node.getAttribute('start')) || 1;
      return '\n\n' + Array.from(node.children).filter(child => child.tagName === 'LI').map(li => {
        const prefix = tag === 'ul' ? '- ' : `${number++}. `;
        const text = children(li, depth).trim();
        return prefix + text.replace(/\n/g, '\n' + ' '.repeat(prefix.length));
      }).join('\n') + '\n\n';
    }
    if (tag === 'table') {
      const rows = Array.from(node.querySelectorAll('tr')).filter(row => row.closest('table') === node).map(row => Array.from(row.children).filter(cell => ['TH', 'TD'].includes(cell.tagName)).map(cell => children(cell, depth).trim().replace(/\n+/g, '<br>').replace(/\|/g, '\\|')));
      const width = Math.max(0, ...rows.map(row => row.length));
      if (!width) return '';
      const line = (row: string[]) => '| ' + Array.from({ length: width }, (_, i) => row[i] || '').join(' | ') + ' |';
      return '\n\n' + [line(rows[0]), line(Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n') + '\n\n';
    }
    const content = children(node, depth);
    if (/^h[1-6]$/.test(tag)) return tag === 'h1' && node.textContent?.trim() === title ? '' : `\n\n${'#'.repeat(Number(tag[1]))} ${content.trim()}\n\n`;
    if (tag === 'a') { const href = url(node.getAttribute('href')); return href ? `[${content.trim()}](${href})` : content; }
    if (tag === 'strong' || tag === 'b') return `**${content.trim()}**`;
    if (tag === 'em' || tag === 'i') return `*${content.trim()}*`;
    if (tag === 'blockquote') return '\n\n' + content.trim().split('\n').map(line => '> ' + line).join('\n') + '\n\n';
    if (['p', 'div', 'section', 'article', 'main', 'header', 'figure', 'figcaption', 'dl', 'dt', 'dd'].includes(tag)) return '\n\n' + content.trim() + '\n\n';
    return content;
  };
  // Do not globally collapse whitespace: code blocks must retain blank lines and indentation.
  const body = render(article).trim();
  if (!body) throw new Error('No readable article content found. The page may require JavaScript or block access.');
  return { title, markdown: `# ${escape(title)}\n\n${body}\n` };
}
