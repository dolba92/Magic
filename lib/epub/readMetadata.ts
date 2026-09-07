import type { TocItem } from '@/types/books';
import { blobToDataUrl } from '@/lib/books/hash';

type EpubMetadata = { title: string; authors: string[]; cover?: string; toc: TocItem[] };

function normalizeToc(items: Array<Record<string, unknown>> = []): TocItem[] {
  return items.map((item) => ({
    label: (typeof item.label === 'string' ? item.label : 'Раздел').trim(),
    href: typeof item.href === 'string' ? item.href : undefined,
    children: Array.isArray(item.subitems) ? normalizeToc(item.subitems as Array<Record<string, unknown>>) : undefined,
  }));
}

export async function readEpubMetadata(file: Blob): Promise<EpubMetadata> {
  const { default: ePub } = await import('epubjs');
  const book = ePub(await file.arrayBuffer());
  try {
    await book.ready;
    const metadata = await book.loaded.metadata;
    const navigation = await book.loaded.navigation;
    let cover: string | undefined;
    const coverUrl = await book.coverUrl();
    if (coverUrl) {
      try { cover = await blobToDataUrl(await (await fetch(coverUrl)).blob()); } catch { cover = undefined; }
    }
    const creator = String(metadata.creator || '').trim();
    return {
      title: String(metadata.title || 'Без названия').trim(),
      authors: creator ? creator.split(/\s*[;,]\s*/).filter(Boolean) : ['Автор не указан'],
      cover,
      toc: normalizeToc((navigation?.toc || []) as unknown as Array<Record<string, unknown>>),
    };
  } finally { book.destroy(); }
}
