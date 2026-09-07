import type { TocItem } from '@/types/books';

type Fb2Result = { title: string; authors: string[]; cover?: string; html: string; images: Record<string, string>; toc: TocItem[] };

const text = (node: Element | null | undefined) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const byLocal = (root: { querySelectorAll(selectors: string): NodeListOf<Element> }, name: string) => Array.from(root.querySelectorAll('*')).filter((el) => el.localName === name);

function binaryData(binary: Element) {
  const type = binary.getAttribute('content-type') || 'image/jpeg';
  return `data:${type};base64,${(binary.textContent || '').replace(/\s/g, '')}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export function parseFb2(source: string): Fb2Result {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Файл повреждён или имеет неподдерживаемую структуру');
  const titleInfo = byLocal(doc, 'title-info')[0];
  const title = text(byLocal(titleInfo || doc, 'book-title')[0]) || 'Без названия';
  const authors = byLocal(titleInfo || doc, 'author').map((author) =>
    ['first-name', 'middle-name', 'last-name'].map((part) => text(byLocal(author, part)[0])).filter(Boolean).join(' '),
  ).filter(Boolean);
  const binary = new Map(byLocal(doc, 'binary').map((item) => [item.getAttribute('id') || '', binaryData(item)]));
  const coverImage = byLocal(byLocal(titleInfo || doc, 'coverpage')[0] || doc, 'image')[0];
  const coverHref = coverImage?.getAttribute('l:href') || coverImage?.getAttribute('xlink:href') || coverImage?.getAttribute('href') || '';
  const cover = binary.get(coverHref.replace(/^#/, ''));
  const toc: TocItem[] = [];
  let sequence = 0;

  const render = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || '');
    if (!(node instanceof Element)) return '';
    const name = node.localName;
    if (name === 'image') {
      const href = node.getAttribute('l:href') || node.getAttribute('xlink:href') || node.getAttribute('href') || '';
      const imageId = href.replace(/^#/, '');
      return binary.has(imageId) ? `<figure><img data-fb2-image="${escapeHtml(imageId)}" alt="Иллюстрация книги" /></figure>` : '';
    }
    const children = Array.from(node.childNodes).map(render).join('');
    if (name === 'section') {
      const id = `fb2-section-${sequence++}`;
      const heading = text(Array.from(node.children).find((child) => child.localName === 'title')) || `Раздел ${sequence}`;
      if (node.parentElement?.localName === 'body') toc.push({ label: heading, sectionId: id });
      return `<section id="${id}" data-fb2-section><span class="stable-anchor" aria-hidden="true"></span>${children}</section>`;
    }
    if (name === 'title') return `<h2>${children}</h2>`;
    if (name === 'subtitle') return `<h3>${children}</h3>`;
    if (name === 'p') return `<p>${children}</p>`;
    if (name === 'emphasis') return `<em>${children}</em>`;
    if (name === 'strong') return `<strong>${children}</strong>`;
    if (name === 'empty-line') return '<div class="empty-line"></div>';
    if (name === 'poem') return `<blockquote class="poem">${children}</blockquote>`;
    if (name === 'stanza') return `<div class="stanza">${children}</div>`;
    if (name === 'v') return `<div>${children}</div>`;
    if (name === 'epigraph' || name === 'cite') return `<blockquote>${children}</blockquote>`;
    if (name === 'a') return `<span class="book-link">${children}</span>`;
    return children;
  };

  const bodies = byLocal(doc, 'body');
  const html = bodies.map((body) => Array.from(body.childNodes).map(render).join('')).join('');
  if (!html.trim()) throw new Error('В книге не найден текст');
  return { title, authors: authors.length ? authors : ['Автор не указан'], cover, html, images: Object.fromEntries(binary), toc };
}
