// Rebuild page content using only passive document elements and safe resource URLs.
export function buildPrintablePage(html: string, title: string, sourceUrl = ''): string {
  const source = new DOMParser().parseFromString(html, 'text/html');
  source.querySelectorAll('script,style,noscript,iframe,object,embed,form,button,input,select,textarea,template,[hidden]').forEach(node => node.remove());
  const output = document.implementation.createHTMLDocument(title);
  const allowed = new Set('article main section header footer nav aside div span p h1 h2 h3 h4 h5 h6 ul ol li dl dt dd blockquote pre code strong b em i u s small sub sup br hr table thead tbody tfoot tr th td caption figure figcaption a img'.split(' '));
  const copy = (node: Node, parent: Node, depth = 0) => {
    if (depth > 100) return;
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(output.createTextNode(node.textContent || ''));
      return;
    }
    if (!(node instanceof Element)) return;
    const tag = node.tagName.toLowerCase();
    const target = allowed.has(tag) ? output.createElement(tag) : output.createElement('span');
    for (const attribute of ['href', 'src']) {
      if ((tag !== 'a' || attribute !== 'href') && (tag !== 'img' || attribute !== 'src')) continue;
      try {
        const value = node.getAttribute(attribute);
        if (!value) continue;
        const url = sourceUrl ? new URL(value, sourceUrl) : new URL(value);
        if (['https:', 'http:'].includes(url.protocol) || (attribute === 'href' && url.protocol === 'mailto:')) {
          target.setAttribute(attribute, url.href);
        }
      } catch { /* Ignore unresolved or unsafe URLs. */ }
    }
    if (tag === 'img') target.setAttribute('alt', node.getAttribute('alt') || '');
    if (tag === 'td' || tag === 'th') {
      for (const attribute of ['colspan', 'rowspan']) {
        const value = Number(node.getAttribute(attribute));
        if (Number.isInteger(value) && value > 0 && value <= 100) target.setAttribute(attribute, String(value));
      }
    }
    parent.appendChild(target);
    node.childNodes.forEach(child => copy(child, target, depth + 1));
  };
  source.body.childNodes.forEach(node => copy(node, output.body));
  const policy = output.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = "default-src 'none'; img-src https: http:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
  output.head.prepend(policy);
  const style = output.createElement('style');
  style.textContent = '@page{size:A4;margin:18mm}body{font:12pt/1.55 system-ui,sans-serif;color:#111;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px;text-align:left}pre{white-space:pre-wrap;background:#f4f4f4;padding:10px}h1,h2,h3,h4{break-after:avoid}tr,figure,img{break-inside:avoid}a{color:#174ea6}blockquote{border-left:3px solid #aaa;margin-left:0;padding-left:16px}';
  output.head.appendChild(style);
  return '<!doctype html>\n' + output.documentElement.outerHTML;
}
