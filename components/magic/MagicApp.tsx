/* oxlint-disable react/react-compiler, jsx-a11y/no-noninteractive-element-interactions, next/no-img-element, typescript/no-floating-promises */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, Grid2X2, Library, List, MoreHorizontal, Plus, Search, Settings, SlidersHorizontal } from 'lucide-react';
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

type SavedChapterInfo = { title:string; remaining:number|null; updatedAt:number };

function chapterStorageKey(bookId:string) { return `magic-reader-chapter:${bookId}`; }

function readSavedChapter(bookId:string):SavedChapterInfo|null {
  if(typeof window==='undefined')return null;
  try{
    const raw=localStorage.getItem(chapterStorageKey(bookId));
    if(!raw)return null;
    const value=JSON.parse(raw) as Partial<SavedChapterInfo>;
    if(typeof value.title!=='string'||!value.title.trim())return null;
    return {title:value.title.trim(),remaining:typeof value.remaining==='number'?value.remaining:null,updatedAt:typeof value.updatedAt==='number'?value.updatedAt:0};
  }catch{return null}
}

export function MagicApp() {
  const inputRef = useRef<HTMLInputElement>(null); const searchRef = useRef<HTMLInputElement>(null); const readerBookRef=useRef<BookRecord|null>(null);
  const [books,setBooks]=useState<BookRecord[]>([]); const [readerBook,setReaderBook]=useState<BookRecord|null>(null);
  const [readerSettings,setReaderSettings]=useState<ReaderSettings>(defaultReaderSettings); const [prefs,setPrefs]=useState<LibraryPreferences>(defaultLibraryPreferences);
  const [section,setSection]=useState<Section>('library'); const [query,setQuery]=useState(''); const [loading,setLoading]=useState(true); const [dragging,setDragging]=useState(false);
  const [message,setMessage]=useState(''); const [duplicate,setDuplicate]=useState<{existing:BookRecord;incoming:BookRecord}|null>(null); const [deleteBook,setDeleteBook]=useState<BookRecord|null>(null);
  const [chapterInfoByBook,setChapterInfoByBook]=useState<Record<string,SavedChapterInfo>>({});

  const refresh = useCallback(async()=>setBooks(await db.books.toArray()),[]);
  useEffect(()=>{ Promise.all([refresh(),getReaderSettings().then(setReaderSettings),getLibraryPreferences().then(setPrefs)]).finally(()=>setLoading(false)); },[refresh]);
  useEffect(()=>{ const root=document.documentElement; const apply=()=>{ const dark=prefs.appTheme==='dark'||(prefs.appTheme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches); root.classList.toggle('dark',dark) }; apply(); const media=matchMedia('(prefers-color-scheme: dark)'); media.addEventListener('change',apply); return()=>media.removeEventListener('change',apply) },[prefs.appTheme]);
  useEffect(()=>{ const context=document.modelContext; if(!context?.registerTool)return; const lifecycle=new AbortController(); Promise.resolve(context.registerTool({name:'start_book_import',title:'Добавить книги',description:'Открывает выбор файлов EPUB или FB2 для добавления в библиотеку Magic Books.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async()=>{inputRef.current?.click();return{status:'file_picker_opened'}}},{signal:lifecycle.signal})).catch(console.error); return()=>lifecycle.abort() },[]);
  useEffect(()=>{ if(!('serviceWorker' in navigator))return;if(['localhost','127.0.0.1'].includes(location.hostname)){void navigator.serviceWorker.getRegistrations().then((items)=>items.forEach((item)=>void item.unregister()));return}navigator.serviceWorker.register('/sw.js').catch((error)=>console.error('Service worker:',error)); },[]);
  useEffect(()=>{
    const next:Record<string,SavedChapterInfo>={};
    for(const book of books){const info=readSavedChapter(book.id);if(info)next[book.id]=info}
    setChapterInfoByBook(next);
  },[books]);

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
  const remove=async(book:BookRecord)=>{await db.books.delete(book.id);if(typeof window!=='undefined'){try{localStorage.removeItem(chapterStorageKey(book.id))}catch{}}setDeleteBook(null);await refresh();announce('Книга удалена')};
  const repairCover=async(book:BookRecord)=>{try{const cover=await recoverBookCover(book);const updated={...book,cover:cover&&cover!==book.cover?cover:undefined,updatedAt:Date.now()};await db.books.put(updated);setBooks((items)=>items.map((item)=>item.id===book.id?updated:item))}catch{const updated={...book,cover:undefined,updatedAt:Date.now()};await db.books.put(updated);setBooks((items)=>items.map((item)=>item.id===book.id?updated:item))}};

  const visible=useMemo(()=>{
    const result=books.filter((book)=>`${book.title} ${book.authors.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
    return result.sort((a,b)=>prefs.sort==='title'?a.title.localeCompare(b.title,'ru'):prefs.sort==='author'?a.authors.join().localeCompare(b.authors.join(),'ru'):prefs.sort==='progress'?b.progress-a.progress:prefs.sort==='reading'?Number(b.progress>0&&b.progress<100)-Number(a.progress>0&&a.progress<100):prefs.sort==='added'?b.dateAdded-a.dateAdded:(b.lastOpened||0)-(a.lastOpened||0));
  },[books,query,prefs.sort]);
  const continueBook=useMemo(()=>books.filter((book)=>Boolean(book.lastOpened)).sort((a,b)=>(b.lastOpened||0)-(a.lastOpened||0))[0]||null,[books]);

  if(readerBook)return <Reader book={readerBook} settings={readerSettings} onSettings={changeReaderSettings} onClose={()=>{readerBookRef.current=null;setReaderBook(null);void refresh()}} onProgress={(location,progress)=>updateProgress(readerBook.id,location,progress)} onEpubLocations={(locations)=>cacheEpubLocations(readerBook.id,locations)}/>;
  return <main className={`magic-shell ${dragging?'is-dragging':''}`} onDragOver={(e)=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={(e)=>{e.preventDefault();setDragging(false);void processFiles(Array.from(e.dataTransfer.files))}}>
    <style>{`
      .magic-sidebar .magic-logo{display:block;width:154px;height:154px;max-width:78%;object-fit:contain;margin:6px auto 18px;border-radius:28px}\n      @media (max-width:820px){.magic-sidebar .magic-logo{width:118px;height:118px}}\n

      /* Текст библиотеки — чёрный/нейтральный вместо коричневого */
      .library-workspace,
      .library-workspace h1,
      .library-workspace h2,
      .library-workspace h3,
      .library-workspace p,
      .library-workspace span,
      .library-workspace small,
      .library-workspace label,
      .library-workspace .continue-reading-kicker,
      .library-workspace .continue-reading-author,
      .library-workspace .continue-reading-chapter,
      .library-workspace .continue-reading-progress b,
      .magic-sidebar .nav-item:not(.active){
        color:#171310 !important;
      }

      .magic-sidebar .nav-item.active,
      .primary-action,
      .continue-reading-action{
        color:#fff !important;
      }




      /* Подложка под сеткой книг — чуть плотнее, чтобы текст не терялся */
      .content-panel{
        background:
          linear-gradient(135deg,
            rgba(246,224,208,.78) 0%,
            rgba(229,193,169,.70) 48%,
            rgba(202,155,125,.60) 100%) !important;
        border:1px solid rgba(255,244,235,.64) !important;
        -webkit-backdrop-filter:blur(12px) saturate(118%) !important;
        backdrop-filter:blur(12px) saturate(118%) !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.46),
          0 10px 28px rgba(83,43,24,.12) !important;
      }


      /* Общая подложка под книгами — чуть прозрачнее основных стеклянных панелей */
      .book-collection{
        background:
          linear-gradient(135deg,
            rgba(246,224,208,.20) 0%,
            rgba(229,193,169,.18) 48%,
            rgba(202,155,125,.12) 100%) !important;
        border:1px solid rgba(255,244,235,.46) !important;
        border-radius:24px !important;
        padding:22px !important;
        -webkit-backdrop-filter:blur(28px) saturate(118%) !important;
        backdrop-filter:blur(4px) saturate(118%) !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.38),
          0 10px 26px rgba(83,43,24,.10) !important;
      }

      .book-collection .book-card h3,
      .book-collection .book-card p,
      .book-collection .book-card span,
      .book-collection .book-card small{
        color:#171310 !important;
        opacity:1 !important;
      }

      /* Повышенный контраст для бледных подписей */
      .search-box input{
        color:#171310 !important;
      }

      .search-box input::placeholder{
        color:#4a3a32 !important;
        opacity:1 !important;
      }

      .sidebar-footer,
      .sidebar-footer *,
      .magic-sidebar .sidebar-footer,
      .magic-sidebar .sidebar-footer *{
        color:#3a2c25 !important;
        opacity:1 !important;
      }

      .book-card .muted,
      .book-card small,
      .continue-reading-author{
        color:#4a3a32 !important;
        opacity:1 !important;
      }


      .magic-sidebar .guest-note,
      .magic-sidebar .guest-note *{
        color:#171310 !important;
        opacity:1 !important;
        text-shadow:none !important;
      }

      /* Явная полоса прогресса в блоке «Продолжить чтение» */
      .continue-reading-progress{
        width:100%;
        max-width:640px;
        gap:12px;
      }

      .continue-progress-track{
        position:relative;
        flex:1;
        height:10px;
        overflow:hidden;
        border-radius:999px;
        background:rgba(103,55,31,.18);
        box-shadow:inset 0 1px 3px rgba(73,39,23,.18);
      }

      .continue-progress-fill{
        height:100%;
        min-width:0;
        border-radius:inherit;
        background:linear-gradient(90deg,#6d351f 0%,#8b4a2c 55%,#a7603d 100%);
        box-shadow:0 0 8px rgba(112,70,47,.20);
        transition:width .25s ease;
      }

      .continue-reading-progress b{
        min-width:42px;
        font-weight:800;
      }

      /* Тёплое матовое стекло для Magic Books */
      .glass-panel,
      .continue-reading-card{
        background:
          linear-gradient(135deg,
            rgba(246,224,208,.52) 0%,
            rgba(229,193,169,.38) 46%,
            rgba(202,155,125,.30) 100%) !important;
        border:1px solid rgba(255,244,235,.52) !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.44),
          0 12px 32px rgba(83,43,24,.14) !important;
        -webkit-backdrop-filter:blur(22px) saturate(125%) !important;
        backdrop-filter:blur(22px) saturate(125%) !important;
      }

      .magic-sidebar{
        background:
          linear-gradient(160deg,
            rgba(244,224,212,.56) 0%,
            rgba(224,190,169,.40) 55%,
            rgba(199,150,120,.28) 100%) !important;
      }

      .library-header,
      .library-controls,
      .continue-reading-card,
      .content-panel{
        border-color:rgba(255,239,228,.48) !important;
      }

      .search-box,
      .view-controls select,
      .preference-grid select,
      .theme-choice button{
        background:rgba(255,242,233,.40) !important;
        border-color:rgba(255,239,228,.42) !important;
        -webkit-backdrop-filter:blur(12px) saturate(120%) !important;
        backdrop-filter:blur(12px) saturate(120%) !important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.30) !important;
      }

      .search-box input{
        background:transparent !important;
      }

      .nav-item:not(.active){
        background:transparent !important;
      }

      .nav-item.active,
      .primary-action,
      .continue-reading-action{
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.18),
          0 8px 20px rgba(83,43,24,.16) !important;
      }

      .dark .glass-panel,
      .dark .continue-reading-card{
        background:
          linear-gradient(135deg,
            rgba(74,52,42,.68),
            rgba(88,58,43,.56),
            rgba(58,39,32,.58)) !important;
        border-color:rgba(255,255,255,.10) !important;
      }

      .continue-reading-card{display:grid;grid-template-columns:108px minmax(0,1fr) auto;align-items:center;gap:22px;margin-bottom:18px;padding:18px 20px;border:1px solid rgba(122,82,58,.18);border-radius:24px;background:transparent;box-shadow:0 14px 38px rgba(73,48,32,.10);overflow:hidden}
      .dark .continue-reading-card{border-color:rgba(255,255,255,.10)}
      .continue-reading-cover{width:108px;aspect-ratio:2/3;border-radius:14px;overflow:hidden;background:rgba(122,82,58,.10);display:grid;place-items:center;box-shadow:0 8px 22px rgba(73,48,32,.16)}
      .continue-reading-cover img{width:100%;height:100%;object-fit:cover;display:block}
      .continue-reading-cover span{display:grid;place-items:center;gap:6px;text-align:center;font-size:11px;opacity:.7;padding:8px}
      .continue-reading-copy{min-width:0}
      .continue-reading-kicker{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.62}
      .continue-reading-copy h2{font-size:clamp(22px,2.6vw,34px);line-height:1.08;margin:7px 0 5px;font-family:Georgia,'Times New Roman',serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .continue-reading-author{font-size:14px;opacity:.68;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .continue-reading-chapter{margin-top:10px;font-size:14px;font-weight:700}
      .continue-reading-progress{display:flex;align-items:center;gap:10px;margin-top:12px;max-width:520px}
      .continue-reading-progress>div{flex:1}
      .continue-reading-progress b{font-size:13px;min-width:36px;text-align:right}
      .continue-reading-action{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 18px;border-radius:999px;background:#70462f;color:#fff;font-weight:800;white-space:nowrap;box-shadow:0 8px 20px rgba(84,50,30,.18)}
      .continue-reading-action:hover{filter:brightness(1.04)}
      .continue-reading-action svg{width:17px;height:17px}
      @media(max-width:760px){
        .continue-reading-card{grid-template-columns:78px minmax(0,1fr);gap:14px;padding:14px;border-radius:20px}
        .continue-reading-cover{width:78px;border-radius:11px}
        .continue-reading-copy h2{font-size:21px}
        .continue-reading-chapter{font-size:13px}
        .continue-reading-action{grid-column:1/-1;width:100%}
      }
    `}</style>
    {dragging&&<div className="drop-overlay"><BookOpen/><strong>Отпустите файлы, чтобы добавить книги</strong></div>}
    <aside className="magic-sidebar glass-panel"><img className="magic-logo" src="/magic-books-logo.png" alt="Magic Books" title="Magic Books"/><nav aria-label="Основная навигация">{nav.map(([Icon,label,key])=><button className={`nav-item ${section===key?'active':''}`} key={key} onClick={()=>{setSection(key);if(key==='search')setTimeout(()=>searchRef.current?.focus(),0)}}><Icon/><span>{label}</span></button>)}</nav><p className="guest-note">Локальный режим · книги хранятся на этом устройстве</p></aside>
    <section className="library-workspace"><header className="library-header glass-panel"><div>{section==='settings'?<><p className="eyebrow">Ваши предпочтения</p><h1>Настройки</h1></>:<h1>Моя Библиотека</h1>}</div><div className="header-actions"><button className="primary-action" onClick={()=>inputRef.current?.click()}><Plus/>Добавить книгу</button></div><input ref={inputRef} className="sr-only" type="file" accept=".epub,.fb2" multiple onChange={(e)=>{void processFiles(Array.from(e.target.files||[]));e.currentTarget.value=''}}/></header>
      {(section==='library'||section==='search')&&<LibraryView books={visible} allCount={books.length} prefs={prefs} query={query} setQuery={setQuery} searchRef={searchRef} changePrefs={changePrefs} openBook={openBook} setDeleteBook={setDeleteBook} repairCover={repairCover} addBook={()=>inputRef.current?.click()} loading={loading} continueBook={section==='library'?continueBook:null} chapterInfo={continueBook?chapterInfoByBook[continueBook.id]||null:null}/>} 
      {section==='settings'&&<AppSettings prefs={prefs} changePrefs={changePrefs}/>} 
    </section>
    <nav className="mobile-nav glass-panel" aria-label="Навигация на телефоне">{nav.map(([Icon,label,key])=><button className={section===key?'active':''} key={key} aria-label={label} onClick={()=>{setSection(key);if(key==='search')setTimeout(()=>searchRef.current?.focus(),0)}}><Icon/><span>{label}</span></button>)}</nav>
    <output className={`toast ${message?'show':''}`} aria-live="polite">{message}</output>
    <Dialog open={!!duplicate} onOpenChange={(open)=>!open&&setDuplicate(null)}><DialogContent><DialogHeader><DialogTitle>Эта книга уже есть в библиотеке</DialogTitle><DialogDescription>Откройте сохранённую книгу или замените её новым файлом.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={()=>setDuplicate(null)}>Отмена</Button><Button variant="secondary" onClick={()=>{if(duplicate)void openBook(duplicate.existing);setDuplicate(null)}}>Открыть</Button><Button onClick={async()=>{if(!duplicate)return;await db.books.put({...duplicate.incoming,id:duplicate.existing.id,progress:duplicate.existing.progress,location:duplicate.existing.location});setDuplicate(null);await refresh();announce('Книга заменена')}}>Заменить</Button></DialogFooter></DialogContent></Dialog>
    <AlertDialog open={!!deleteBook} onOpenChange={(open)=>!open&&setDeleteBook(null)}><AlertDialogContent className="delete-book-dialog"><AlertDialogHeader><AlertDialogTitle>Удалить книгу из библиотеки?</AlertDialogTitle><AlertDialogDescription>Файл, обложка и сохранённая позиция чтения будут удалены с этого устройства.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={()=>deleteBook&&void remove(deleteBook)}>Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}

function LibraryView({books,allCount,prefs,query,setQuery,searchRef,changePrefs,openBook,setDeleteBook,repairCover,addBook,loading,continueBook,chapterInfo}:{books:BookRecord[];allCount:number;prefs:LibraryPreferences;query:string;setQuery:(v:string)=>void;searchRef:React.RefObject<HTMLInputElement|null>;changePrefs:(v:Partial<LibraryPreferences>)=>void;openBook:(b:BookRecord)=>void;setDeleteBook:(b:BookRecord)=>void;repairCover:(b:BookRecord)=>void;addBook:()=>void;loading:boolean;continueBook:BookRecord|null;chapterInfo:SavedChapterInfo|null}) {
  if(loading)return <section className="empty-library glass-panel"><div className="empty-orbit"><BookOpen/></div><h2>Открываем библиотеку…</h2></section>;
  return <>{continueBook&&<ContinueReadingCard book={continueBook} chapterInfo={chapterInfo} onOpen={()=>openBook(continueBook)} onCoverError={()=>repairCover(continueBook)}/>}<section className="library-controls glass-panel"><label className="search-box"><Search/><input ref={searchRef} value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Название или автор" aria-label="Поиск по библиотеке"/></label><div className="view-controls"><label><SlidersHorizontal/>Сортировка<select value={prefs.sort} onChange={(e)=>changePrefs({sort:e.target.value as LibraryPreferences['sort']})}>{sortLabels.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button aria-label="Сетка" className={prefs.view!=='list'?'selected':''} onClick={()=>changePrefs({view:'grid'})}><Grid2X2/></button><button aria-label="Список" className={prefs.view==='list'?'selected':''} onClick={()=>changePrefs({view:'list'})}><List/></button></div></section>
    {!allCount?<section className="empty-library glass-panel"><div className="empty-orbit"><BookOpen/></div><p className="eyebrow">Ваша полка ждёт первой истории</p><h2>В библиотеке пока пусто</h2><p>Добавьте EPUB или FB2, чтобы начать чтение</p><button className="primary-action" onClick={addBook}><Plus/>Добавить книгу</button><p className="drop-hint">На компьютере файлы можно также перетащить сюда</p></section>:!books.length?<section className="empty-library glass-panel"><div className="empty-orbit"><Search/></div><h2>Ничего не найдено</h2><p>Попробуйте изменить поисковый запрос</p></section>:<div className={`book-collection ${prefs.view}`} style={{['--book-columns' as string]:prefs.columns==='auto'?undefined:`repeat(${prefs.columns}, minmax(0, 1fr))`}}>{books.map((book)=><BookCard key={book.id} book={book} onOpen={()=>openBook(book)} onDelete={()=>setDeleteBook(book)} onCoverError={()=>repairCover(book)}/>)}</div>}</>;
}


function ContinueReadingCard({book,chapterInfo,onOpen,onCoverError}:{book:BookRecord;chapterInfo:SavedChapterInfo|null;onOpen:()=>void;onCoverError:()=>void}) {
  const [brokenCover,setBrokenCover]=useState(false);
  useEffect(()=>setBrokenCover(false),[book.cover]);
  const hasCover=!!book.cover&&!brokenCover;
  const progress=Math.max(0,Math.min(100,Math.round(book.progress||0)));
  const chapterText=chapterInfo?.title
    ? `${chapterInfo.title}${chapterInfo.remaining===0?' · конец главы':chapterInfo.remaining!==null?` · ещё ${chapterInfo.remaining} стр.`:''}`
    : 'Продолжить с сохранённого места';
  return <section className="continue-reading-card" aria-label="Продолжить чтение">
    <div className="continue-reading-cover">{hasCover?<img src={book.cover} alt="" onError={()=>{setBrokenCover(true);onCoverError()}}/>:<span><BookOpen/><small>Обложки нет</small></span>}</div>
    <div className="continue-reading-copy">
      <div className="continue-reading-kicker">Продолжить чтение</div>
      <h2>{book.title}</h2>
      <div className="continue-reading-author">{book.authors.join(', ')}</div>
      <div className="continue-reading-chapter">{chapterText}</div>
      <div className="continue-reading-progress"><div className="continue-progress-track" aria-label={`Прочитано ${progress}%`}><div className="continue-progress-fill" style={{width:`${progress}%`}}/></div><b>{progress}%</b></div>
    </div>
    <button className="continue-reading-action" onClick={onOpen}>Продолжить<ArrowRight/></button>
  </section>;
}

function BookCard({book,onOpen,onDelete,onCoverError}:{book:BookRecord;onOpen:()=>void;onDelete:()=>void;onCoverError:()=>void}) { const [brokenCover,setBrokenCover]=useState(false);useEffect(()=>setBrokenCover(false),[book.cover]);const hasCover=!!book.cover&&!brokenCover;return <article className="book-card"><button className="cover-button" onClick={onOpen} aria-label={`Открыть «${book.title}»`}>{hasCover?<img src={book.cover} alt="" onError={()=>{setBrokenCover(true);onCoverError()}}/>:<span className="cover-placeholder" aria-label="Обложка отсутствует"><BookOpen/><small>Обложки нет</small></span>}</button><div className="book-meta"><div><h3>{book.title}</h3><p>{book.authors.join(', ')}</p></div><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Действия с книгой «${book.title}»`}/> }><MoreHorizontal/></DropdownMenuTrigger><DropdownMenuContent align="end" side="bottom" sideOffset={8} className="book-card-menu"><DropdownMenuItem onClick={onOpen}>Открыть</DropdownMenuItem><DropdownMenuItem onClick={onOpen}>Информация</DropdownMenuItem><DropdownMenuItem variant="destructive" onClick={onDelete}>Удалить</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><div className="book-progress"><span>{book.progress}%</span><Progress value={book.progress}/><small>{book.lastOpened?`Открывали ${formatDate(book.lastOpened)}`:`Добавлено ${formatDate(book.dateAdded)}`}</small></div></article> }

function AppSettings({prefs,changePrefs}:{prefs:LibraryPreferences;changePrefs:(v:Partial<LibraryPreferences>)=>void}) { return <section className="content-panel settings-page glass-panel"><h2>Вид библиотеки</h2><div className="preference-grid"><label>Режим<select value={prefs.view} onChange={(e)=>changePrefs({view:e.target.value as LibraryPreferences['view']})}><option value="grid">Сетка</option><option value="compact">Компактная сетка</option><option value="large">Крупные обложки</option><option value="list">Список</option></select></label><label>Книг в ряд<select value={prefs.columns} onChange={(e)=>changePrefs({columns:e.target.value==='auto'?'auto':Number(e.target.value) as 2|3|4|5|6})}><option value="auto">Автоматически</option>{[2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label></div><h2>Тема приложения</h2><div className="theme-choice">{([['light','Светлая'],['dark','Тёмная'],['system','Системная']] as const).map(([key,label])=><button className={prefs.appTheme===key?'selected':''} key={key} onClick={()=>changePrefs({appTheme:key})}>{prefs.appTheme===key&&<Check/>}{label}</button>)}</div></section> }
