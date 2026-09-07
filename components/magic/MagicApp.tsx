/* oxlint-disable react/react-compiler, jsx-a11y/no-noninteractive-element-interactions, next/no-img-element, typescript/no-floating-promises */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, Grid2X2, Library, List, MoreHorizontal, Plus, Search, Settings, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { db, getLibraryPreferences, getReaderSettings, saveLibraryPreferences, saveReaderSettings } from '@/lib/storage/db';
import { importBook, recoverBookCover, upgradeLegacyFb2 } from '@/features/import/importBook';
import { Reader } from '@/features/reader/Reader';
import type { BookRecord, LibraryPreferences, ReaderSettings } from '@/types/books';
import { defaultLibraryPreferences, defaultReaderSettings } from '@/types/books';

type Section = 'library' | 'search' | 'settings';

const nav = [
  [Library, 'Библиотека', 'library'], [Search, 'Поиск', 'search'],
  [Settings, 'Настройки', 'settings'],
] as const;

const sortLabels: Array<[LibraryPreferences['sort'], string]> = [['added','Недавно добавленные'],['opened','Недавно открытые'],['title','По названию'],['author','По автору'],['progress','По прогрессу'],['reading','Сначала читаемые']];

function formatDate(timestamp?: number) { return timestamp ? new Intl.DateTimeFormat('ru', { day:'numeric', month:'short' }).format(timestamp) : 'Ещё не открывали'; }

export function MagicApp() {
  const inputRef = useRef<HTMLInputElement>(null); const searchRef = useRef<HTMLInputElement>(null); const readerBookRef=useRef<BookRecord|null>(null);
  const [books,setBooks]=useState<BookRecord[]>([]); const [readerBook,setReaderBook]=useState<BookRecord|null>(null);
  const [readerSettings,setReaderSettings]=useState<ReaderSettings>(defaultReaderSettings); const [prefs,setPrefs]=useState<LibraryPreferences>(defaultLibraryPreferences);
  const [section,setSection]=useState<Section>('library'); const [query,setQuery]=useState(''); const [loading,setLoading]=useState(true); const [dragging,setDragging]=useState(false);
  const [message,setMessage]=useState(''); const [duplicate,setDuplicate]=useState<{existing:BookRecord;incoming:BookRecord}|null>(null); const [deleteBook,setDeleteBook]=useState<BookRecord|null>(null);

  const refresh = useCallback(async()=>setBooks(await db.books.toArray()),[]);
  useEffect(()=>{ Promise.all([refresh(),getReaderSettings().then(setReaderSettings),getLibraryPreferences().then(setPrefs)]).finally(()=>setLoading(false)); },[refresh]);
  useEffect(()=>{ const root=document.documentElement; const apply=()=>{ const dark=prefs.appTheme==='dark'||(prefs.appTheme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches); root.classList.toggle('dark',dark) }; apply(); const media=matchMedia('(prefers-color-scheme: dark)'); media.addEventListener('change',apply); return()=>media.removeEventListener('change',apply) },[prefs.appTheme]);
  useEffect(()=>{ const context=document.modelContext; if(!context?.registerTool)return; const lifecycle=new AbortController(); Promise.resolve(context.registerTool({name:'start_book_import',title:'Добавить книги',description:'Открывает выбор файлов EPUB или FB2 для добавления в библиотеку Magic.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async()=>{inputRef.current?.click();return{status:'file_picker_opened'}}},{signal:lifecycle.signal})).catch(console.error); return()=>lifecycle.abort() },[]);
  useEffect(()=>{ if(!('serviceWorker' in navigator))return;if(['localhost','127.0.0.1'].includes(location.hostname)){void navigator.serviceWorker.getRegistrations().then((items)=>items.forEach((item)=>void item.unregister()));return}navigator.serviceWorker.register('/sw.js').catch((error)=>console.error('Service worker:',error)); },[]);

  const changePrefs=(next:Partial<LibraryPreferences>)=>{ const value={...prefs,...next};setPrefs(value);void saveLibraryPreferences(value) };
  const changeReaderSettings=(value:ReaderSettings)=>{setReaderSettings(value);void saveReaderSettings(value)};
  const announce=(value:string)=>{setMessage(value);setTimeout(()=>setMessage(''),4200)};

  const processFiles=async(files:File[])=>{
    const supported=files.filter((file)=>/\.(epub|fb2)$/i.test(file.name)); if(!supported.length){announce('Поддерживаются только файлы EPUB и FB2');return}
    for(const file of supported){try{announce(`Сохраняем книгу «${file.name}»…`);const incoming=await importBook(file);const existing=await db.books.where('hash').equals(incoming.hash).first();if(existing){setDuplicate({existing,incoming});continue}await db.books.put(incoming)}catch(error){console.error(error);announce(error instanceof Error?error.message:'Не удалось сохранить книгу')}}
    await refresh();announce(supported.length===1?'Книга добавлена':'Книги добавлены');
  };
  const openBook=async(book:BookRecord)=>{const prepared=await upgradeLegacyFb2(book);const updated={...prepared,lastOpened:Date.now(),updatedAt:Date.now()};await db.books.put(updated);readerBookRef.current=updated;setReaderBook(updated);void refresh()};
  const updateProgress=async(bookId:string,location:BookRecord['location'],progress:number)=>{const current=readerBookRef.current;if(!current||current.id!==bookId||!location)return;const updated={...current,location,progress,lastOpened:Date.now(),updatedAt:Date.now()};readerBookRef.current=updated;setReaderBook(updated);await db.books.put(updated)};
  const cacheEpubLocations=async(bookId:string,locations:string)=>{const current=readerBookRef.current;if(!current||current.id!==bookId||current.epubLocations===locations)return;const updated={...current,epubLocations:locations,updatedAt:Date.now()};readerBookRef.current=updated;setReaderBook(updated);await db.books.put(updated)};
  const remove=async(book:BookRecord)=>{await db.books.delete(book.id);setDeleteBook(null);await refresh();announce('Книга удалена')};
  const repairCover=async(book:BookRecord)=>{try{const cover=await recoverBookCover(book);const updated={...book,cover:cover&&cover!==book.cover?cover:undefined,updatedAt:Date.now()};await db.books.put(updated);setBooks((items)=>items.map((item)=>item.id===book.id?updated:item))}catch{const updated={...book,cover:undefined,updatedAt:Date.now()};await db.books.put(updated);setBooks((items)=>items.map((item)=>item.id===book.id?updated:item))}};

  const visible=useMemo(()=>{
    const result=books.filter((book)=>`${book.title} ${book.authors.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
    return result.sort((a,b)=>prefs.sort==='title'?a.title.localeCompare(b.title,'ru'):prefs.sort==='author'?a.authors.join().localeCompare(b.authors.join(),'ru'):prefs.sort==='progress'?b.progress-a.progress:prefs.sort==='reading'?Number(b.progress>0&&b.progress<100)-Number(a.progress>0&&a.progress<100):prefs.sort==='added'?b.dateAdded-a.dateAdded:(b.lastOpened||0)-(a.lastOpened||0));
  },[books,query,prefs.sort]);

  if(readerBook)return <Reader book={readerBook} settings={readerSettings} onSettings={changeReaderSettings} onClose={()=>{readerBookRef.current=null;setReaderBook(null);void refresh()}} onProgress={(location,progress)=>updateProgress(readerBook.id,location,progress)} onEpubLocations={(locations)=>cacheEpubLocations(readerBook.id,locations)}/>;
  return <main className={`magic-shell ${dragging?'is-dragging':''}`} onDragOver={(e)=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={(e)=>{e.preventDefault();setDragging(false);void processFiles(Array.from(e.dataTransfer.files))}}>
    {dragging&&<div className="drop-overlay"><BookOpen/><strong>Отпустите файлы, чтобы добавить книги</strong></div>}
    <aside className="magic-sidebar glass-panel"><img className="magic-logo" src="/assets/magic-logo.png" alt="Magic"/><nav aria-label="Основная навигация">{nav.map(([Icon,label,key])=><button className={`nav-item ${section===key?'active':''}`} key={key} onClick={()=>{setSection(key);if(key==='search')setTimeout(()=>searchRef.current?.focus(),0)}}><Icon/><span>{label}</span></button>)}</nav><p className="guest-note">Локальный режим · книги хранятся на этом устройстве</p></aside>
    <section className="library-workspace"><header className="library-header glass-panel"><div><p className="eyebrow">{section==='settings'?'Ваши предпочтения':'Личная коллекция'}</p><h1>{nav.find(([, ,key])=>key===section)?.[1]}</h1></div><div className="header-actions"><button className="primary-action" onClick={()=>inputRef.current?.click()}><Plus/>Добавить книгу</button></div><input ref={inputRef} className="sr-only" type="file" accept=".epub,.fb2" multiple onChange={(e)=>{void processFiles(Array.from(e.target.files||[]));e.currentTarget.value=''}}/></header>
      {(section==='library'||section==='search')&&<LibraryView books={visible} allCount={books.length} prefs={prefs} query={query} setQuery={setQuery} searchRef={searchRef} changePrefs={changePrefs} openBook={openBook} setDeleteBook={setDeleteBook} repairCover={repairCover} addBook={()=>inputRef.current?.click()} loading={loading}/>} 
      {section==='settings'&&<AppSettings prefs={prefs} changePrefs={changePrefs}/>} 
    </section>
    <nav className="mobile-nav glass-panel" aria-label="Навигация на телефоне">{nav.map(([Icon,label,key])=><button className={section===key?'active':''} key={key} aria-label={label} onClick={()=>{setSection(key);if(key==='search')setTimeout(()=>searchRef.current?.focus(),0)}}><Icon/><span>{label}</span></button>)}</nav>
    <output className={`toast ${message?'show':''}`} aria-live="polite">{message}</output>
    <Dialog open={!!duplicate} onOpenChange={(open)=>!open&&setDuplicate(null)}><DialogContent><DialogHeader><DialogTitle>Эта книга уже есть в библиотеке</DialogTitle><DialogDescription>Откройте сохранённую книгу или замените её новым файлом.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={()=>setDuplicate(null)}>Отмена</Button><Button variant="secondary" onClick={()=>{if(duplicate)void openBook(duplicate.existing);setDuplicate(null)}}>Открыть</Button><Button onClick={async()=>{if(!duplicate)return;await db.books.put({...duplicate.incoming,id:duplicate.existing.id,progress:duplicate.existing.progress,location:duplicate.existing.location});setDuplicate(null);await refresh();announce('Книга заменена')}}>Заменить</Button></DialogFooter></DialogContent></Dialog>
    <AlertDialog open={!!deleteBook} onOpenChange={(open)=>!open&&setDeleteBook(null)}><AlertDialogContent className="delete-book-dialog"><AlertDialogHeader><AlertDialogTitle>Удалить книгу из библиотеки?</AlertDialogTitle><AlertDialogDescription>Файл, обложка и сохранённая позиция чтения будут удалены с этого устройства.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={()=>deleteBook&&void remove(deleteBook)}>Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}

function LibraryView({books,allCount,prefs,query,setQuery,searchRef,changePrefs,openBook,setDeleteBook,repairCover,addBook,loading}:{books:BookRecord[];allCount:number;prefs:LibraryPreferences;query:string;setQuery:(v:string)=>void;searchRef:React.RefObject<HTMLInputElement|null>;changePrefs:(v:Partial<LibraryPreferences>)=>void;openBook:(b:BookRecord)=>void;setDeleteBook:(b:BookRecord)=>void;repairCover:(b:BookRecord)=>void;addBook:()=>void;loading:boolean}) {
  if(loading)return <section className="empty-library glass-panel"><div className="empty-orbit"><BookOpen/></div><h2>Открываем библиотеку…</h2></section>;
  return <><section className="library-controls glass-panel"><label className="search-box"><Search/><input ref={searchRef} value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Название или автор" aria-label="Поиск по библиотеке"/></label><div className="view-controls"><label><SlidersHorizontal/>Сортировка<select value={prefs.sort} onChange={(e)=>changePrefs({sort:e.target.value as LibraryPreferences['sort']})}>{sortLabels.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button aria-label="Сетка" className={prefs.view!=='list'?'selected':''} onClick={()=>changePrefs({view:'grid'})}><Grid2X2/></button><button aria-label="Список" className={prefs.view==='list'?'selected':''} onClick={()=>changePrefs({view:'list'})}><List/></button></div></section>
    {!allCount?<section className="empty-library glass-panel"><div className="empty-orbit"><BookOpen/></div><p className="eyebrow">Ваша полка ждёт первой истории</p><h2>В библиотеке пока пусто</h2><p>Добавьте EPUB или FB2, чтобы начать чтение</p><button className="primary-action" onClick={addBook}><Plus/>Добавить книгу</button><p className="drop-hint">На компьютере файлы можно также перетащить сюда</p></section>:!books.length?<section className="empty-library glass-panel"><div className="empty-orbit"><Search/></div><h2>Ничего не найдено</h2><p>Попробуйте изменить поисковый запрос</p></section>:<div className={`book-collection ${prefs.view}`} style={{['--book-columns' as string]:prefs.columns==='auto'?undefined:`repeat(${prefs.columns}, minmax(0, 1fr))`}}>{books.map((book)=><BookCard key={book.id} book={book} onOpen={()=>openBook(book)} onDelete={()=>setDeleteBook(book)} onCoverError={()=>repairCover(book)}/>)}</div>}</>;
}

function BookCard({book,onOpen,onDelete,onCoverError}:{book:BookRecord;onOpen:()=>void;onDelete:()=>void;onCoverError:()=>void}) { const [brokenCover,setBrokenCover]=useState(false);useEffect(()=>setBrokenCover(false),[book.cover]);const hasCover=!!book.cover&&!brokenCover;return <article className="book-card"><button className="cover-button" onClick={onOpen} aria-label={`Открыть «${book.title}»`}>{hasCover?<img src={book.cover} alt="" onError={()=>{setBrokenCover(true);onCoverError()}}/>:<span className="cover-placeholder" aria-label="Обложка отсутствует"><BookOpen/><small>Обложки нет</small></span>}</button><div className="book-meta"><div><h3>{book.title}</h3><p>{book.authors.join(', ')}</p></div><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Действия с книгой «${book.title}»`}/> }><MoreHorizontal/></DropdownMenuTrigger><DropdownMenuContent align="end" side="bottom" sideOffset={8} className="book-card-menu"><DropdownMenuItem onClick={onOpen}>Открыть</DropdownMenuItem><DropdownMenuItem onClick={onOpen}>Информация</DropdownMenuItem><DropdownMenuItem variant="destructive" onClick={onDelete}>Удалить</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><div className="book-progress"><span>{book.progress}%</span><Progress value={book.progress}/><small>{book.lastOpened?`Открывали ${formatDate(book.lastOpened)}`:`Добавлено ${formatDate(book.dateAdded)}`}</small></div></article> }

function AppSettings({prefs,changePrefs}:{prefs:LibraryPreferences;changePrefs:(v:Partial<LibraryPreferences>)=>void}) { return <section className="content-panel settings-page glass-panel"><h2>Вид библиотеки</h2><div className="preference-grid"><label>Режим<select value={prefs.view} onChange={(e)=>changePrefs({view:e.target.value as LibraryPreferences['view']})}><option value="grid">Сетка</option><option value="compact">Компактная сетка</option><option value="large">Крупные обложки</option><option value="list">Список</option></select></label><label>Книг в ряд<select value={prefs.columns} onChange={(e)=>changePrefs({columns:e.target.value==='auto'?'auto':Number(e.target.value) as 2|3|4|5|6})}><option value="auto">Автоматически</option>{[2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label></div><h2>Тема приложения</h2><div className="theme-choice">{([['light','Светлая'],['dark','Тёмная'],['system','Системная']] as const).map(([key,label])=><button className={prefs.appTheme===key?'selected':''} key={key} onClick={()=>changePrefs({appTheme:key})}>{prefs.appTheme===key&&<Check/>}{label}</button>)}</div></section> }
