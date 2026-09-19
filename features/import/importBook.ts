import type { BookRecord } from '@/types/books';

import { hashFile } from '@/lib/books/hash';

import { parseFb2 } from '@/lib/fb2/parseFb2';

import { readEpubMetadata } from '@/lib/epub/readMetadata';

function stableBlob(book: BookRecord) {
  if (book.fileBytes?.byteLength) {
    return new Blob([book.fileBytes], {
      type: book.format === 'epub' ? 'application/epub+zip' : 'application/xml',
    });
  }
  return book.file;
}

async function decodeFb2(file: Blob) {
  const buffer = await file.arrayBuffer();
  const header = new TextDecoder('ascii').decode(buffer.slice(0, 512));
  const declaredEncoding = header.match(/<\?xml[^>]*encoding=["']([^"']+)["']/i)?.[1] || 'utf-8';
  try {
    return new TextDecoder(declaredEncoding).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

export async function upgradeLegacyFb2(book: BookRecord): Promise<BookRecord> {
  if (book.format !== 'fb2' || book.fb2Images) return book;
  const parsed = parseFb2(await decodeFb2(stableBlob(book)));
  return { ...book, fb2Html: parsed.html, fb2Images: parsed.images, cover: book.cover || parsed.cover, toc: parsed.toc, updatedAt: Date.now() };
}

export async function recoverBookCover(book: BookRecord) {
  if (book.format === 'epub') return (await readEpubMetadata(stableBlob(book))).cover;
  return parseFb2(await decodeFb2(stableBlob(book))).cover;
}

export async function importBook(file: File): Promise<BookRecord> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'epub' && extension !== 'fb2') throw new Error('Поддерживаются только файлы EPUB и FB2');

  // Safari/iOS иногда перестаёт читать File/Blob из IndexedDB после полного закрытия PWA.
  // Поэтому сохраняем отдельную стабильную копию байтов книги как ArrayBuffer.
  const fileBytes = await file.arrayBuffer();
  if (!fileBytes.byteLength) throw new Error('Файл книги пуст');

  const mime = extension === 'epub' ? 'application/epub+zip' : (file.type || 'application/xml');
  const storedFile = new Blob([fileBytes], { type: mime });
  const hash = await hashFile(storedFile);
  const now = Date.now();

  if (extension === 'epub') {
    const metadata = await readEpubMetadata(storedFile);
    return {
      id: crypto.randomUUID(),
      hash,
      format: 'epub',
      file: storedFile,
      fileBytes: fileBytes.slice(0),
      ...metadata,
      dateAdded: now,
      progress: 0,
      updatedAt: now,
    };
  }

  const parsed = parseFb2(await decodeFb2(storedFile));
  return {
    id: crypto.randomUUID(),
    hash,
    format: 'fb2',
    file: storedFile,
    fileBytes: fileBytes.slice(0),
    title: parsed.title,
    authors: parsed.authors,
    cover: parsed.cover,
    toc: parsed.toc,
    fb2Html: parsed.html,
    fb2Images: parsed.images,
    dateAdded: now,
    progress: 0,
    updatedAt: now,
  };
}
