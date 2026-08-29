import { marked } from 'marked';

const ALLOWED_TAGS = new Set([
  'a', 'blockquote', 'br', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li',
  'ol', 'p', 'pre', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
]);

function isSafeHref(href: string): boolean {
  if (href.startsWith('#') || href.startsWith('/')) return true;
  try {
    const protocol = new URL(href, window.location.origin).protocol;
    return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:';
  } catch {
    return false;
  }
}

function sanitizeHtml(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const nodes = Array.from(document.body.querySelectorAll('*'));

  for (const node of nodes.reverse()) {
    if (!ALLOWED_TAGS.has(node.tagName.toLowerCase())) {
      node.replaceWith(document.createTextNode(node.textContent || ''));
      continue;
    }

    for (const attribute of Array.from(node.attributes)) {
      const isAllowedLinkAttribute =
        node.tagName.toLowerCase() === 'a' && ['href', 'title'].includes(attribute.name);
      if (!isAllowedLinkAttribute) node.removeAttribute(attribute.name);
    }

    if (node.tagName.toLowerCase() === 'a') {
      const href = node.getAttribute('href');
      if (!href || !isSafeHref(href)) node.removeAttribute('href');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }

  return document.body.innerHTML;
}

export function renderSafeMarkdown(content: string): string {
  return sanitizeHtml(marked.parse(content, { gfm: true, breaks: true }) as string);
}
