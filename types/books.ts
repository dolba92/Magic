export type BookFormat = 'epub' | 'fb2';
export type ReaderLocation = { kind: 'epub'; cfi: string } | { kind: 'fb2'; ratio: number; sectionId?: string; offset?: number };

export type ReaderSettings = {
  fontFamily: string; fontSize: number; fontWeight: number; lineHeight: number;
  paragraphSpacing: number; textIndent: number; contentWidth: number;
  marginLeft: number; marginRight: number; marginTop: number; marginBottom: number;
  alignment: 'left' | 'justify' | 'center'; theme: string; customBackground: string;
  customText: string; imageScale: 'auto' | 'compact' | 'large'; pageColumns: 1 | 2;
};

export type LibraryPreferences = {
  view: 'grid' | 'compact' | 'large' | 'list'; columns: 'auto' | 2 | 3 | 4 | 5 | 6;
  sort: 'added' | 'opened' | 'title' | 'author' | 'progress' | 'reading'; appTheme: 'light' | 'dark' | 'system';
};

export type TocItem = { label: string; href?: string; sectionId?: string; children?: TocItem[] };

export type BookRecord = {
  id: string; hash: string; title: string; authors: string[]; format: BookFormat; file: Blob;
  cover?: string; dateAdded: number; lastOpened?: number; progress: number; location?: ReaderLocation;
  toc?: TocItem[]; fb2Html?: string; fb2Images?: Record<string, string>; epubLocations?: string; updatedAt: number;
};

export const defaultReaderSettings: ReaderSettings = {
  fontFamily: 'Literata', fontSize: 19, fontWeight: 400, lineHeight: 1.6,
  paragraphSpacing: 10, textIndent: 28, contentWidth: 1600,
  marginLeft: 24, marginRight: 24, marginTop: 24, marginBottom: 24,
  alignment: 'justify', theme: 'cream', customBackground: '#fffaf0', customText: '#3d2a20', imageScale: 'auto', pageColumns: 1,
};

export const defaultLibraryPreferences: LibraryPreferences = {
  view: 'grid', columns: 'auto', sort: 'opened', appTheme: 'system',
};
