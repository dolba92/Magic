import Dexie, { type EntityTable } from 'dexie';
import type { BookRecord, LibraryPreferences, ReaderSettings } from '@/types/books';
import { defaultLibraryPreferences, defaultReaderSettings } from '@/types/books';

type PreferenceRow = { key: string; value: unknown };

class MagicDatabase extends Dexie {
  books!: EntityTable<BookRecord, 'id'>;
  preferences!: EntityTable<PreferenceRow, 'key'>;
  constructor() {
    super('magic-clean-20260906-01');
    this.version(1).stores({ books: 'id, &hash, title, dateAdded, lastOpened, progress, updatedAt', preferences: 'key' });
    this.version(2).stores({ books: 'id, &hash, title, dateAdded, lastOpened, progress, updatedAt', preferences: 'key' }).upgrade((transaction) =>
      transaction.table('books').toCollection().modify((book) => { delete book.bookmarks; }),
    );
  }
}

export const db = new MagicDatabase();

export async function getReaderSettings() {
  return { ...defaultReaderSettings, ...((await db.preferences.get('reader'))?.value as Partial<ReaderSettings> | undefined) };
}
export async function saveReaderSettings(value: ReaderSettings) { await db.preferences.put({ key: 'reader', value }); }
export async function getLibraryPreferences() {
  const stored = (await db.preferences.get('library'))?.value as Partial<LibraryPreferences> & { filter?: unknown; sort?: unknown } | undefined;
  const merged = { ...defaultLibraryPreferences, ...stored };
  if (!['added','opened','title','author','progress','reading'].includes(String(merged.sort))) merged.sort = 'opened';
  delete merged.filter;
  return merged as LibraryPreferences;
}
export async function saveLibraryPreferences(value: LibraryPreferences) { await db.preferences.put({ key: 'library', value }); }
