/* oxlint-disable react-hooks/exhaustive-deps, react/react-compiler, typescript/no-explicit-any, typescript/no-deprecated */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Expand, ListTree, Minus, Plus, RotateCcw, Settings2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Fb2SurfaceStable } from '@/features/reader/Fb2Surface';
import { toReadingPercent } from '@/lib/books/progress';
import { db } from '@/lib/storage/db';
import type { BookRecord, ReaderLocation, ReaderSettings, TocItem } from '@/types/books';

type Props = {
  book: BookRecord; settings: ReaderSettings; onSettings: (settings: ReaderSettings) => void;
  onClose: () => void; onProgress: (location: ReaderLocation, progress: number) => void;
  onEpubLocations: (locations: string) => void;
};

const themes: Record<string, { label: string; bg: string; text: string }> = {
  light: { label: 'Светлая', bg: '#ffffff', text: '#25201d' }, cream: { label: 'Кремовая', bg: '#fffaf0', text: '#3c2b22' },
  sepia: { label: 'Сепия', bg: '#f1dfbd', text: '#49301f' }, gray: { label: 'Серая', bg: '#e7e9eb', text: '#25292c' },
  dark: { label: 'Тёмная', bg: '#292522', text: '#eee7da' }, black: { label: 'Чёрная', bg: '#080808', text: '#efefef' },
  custom: { label: 'Своя', bg: '#fffaf0', text: '#3c2b22' },
};

const fonts = [
  ['Literata', 'С засечками'], ['PT Serif', 'С засечками'], ['Merriweather', 'С засечками'], ['Source Serif 4', 'С засечками'],
  ['Bitter', 'С засечками'], ['Lora', 'С засечками'], ['Lora Hand', 'Книжно-рукописный'], ['Noto Serif', 'С засечками'], ['Georgia', 'С засечками'],
  ['Manrope', 'Без засечек'], ['Open Sans', 'Без засечек'], ['Verdana', 'Без засечек'], ['Arial', 'Без засечек'],
] as const;

function readerColors(settings: ReaderSettings) {
  return settings.theme === 'custom' ? { bg: settings.customBackground, text: settings.customText } : themes[settings.theme] || themes.cream;
}

function SettingRange({ label, value, min, max, step = 1, suffix = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className="setting-row"><span>{label}<b>{value}{suffix}</b></span><Slider aria-label={label} min={min} max={max} step={step} value={[value]} onValueChange={(next) => onChange(Number(Array.isArray(next) ? next[0] : next))} /></label>;
}

function ReaderSettingsPanel({ value, onChange }: { value: ReaderSettings; onChange: (value: ReaderSettings) => void }) {
  const patch = (next: Partial<ReaderSettings>) => onChange({ ...value, ...next });
  return <div className="reader-settings-scroll">
    <details open><summary>Текст</summary><div className="settings-group">
      <label className="field-label">Шрифт<select value={value.fontFamily} onChange={(e) => patch({ fontFamily: e.target.value })}>{fonts.map(([font, group]) => <option key={font} value={font}>{font} · {group}</option>)}</select></label>
      <SettingRange label="Размер" value={value.fontSize} min={12} max={36} suffix=" px" onChange={(fontSize) => patch({ fontSize })} />
      <label className="field-label">Жирность<select value={value.fontWeight} onChange={(e) => patch({ fontWeight: Number(e.target.value) })}>{[300,400,500,600,700].map((weight) => <option key={weight}>{weight}</option>)}</select></label>
      <label className="field-label">Выравнивание<select value={value.alignment} onChange={(e) => patch({ alignment: e.target.value as ReaderSettings['alignment'] })}><option value="left">По левому краю</option><option value="justify">По ширине</option><option value="center">По центру</option></select></label>
    </div></details>
    <details><summary>Абзацы</summary><div className="settings-group">
      <SettingRange label="Межстрочный интервал" value={value.lineHeight} min={1} max={2.5} step={0.05} suffix="×" onChange={(lineHeight) => patch({ lineHeight })} />
      <SettingRange label="Между абзацами" value={value.paragraphSpacing} min={0} max={32} suffix=" px" onChange={(paragraphSpacing) => patch({ paragraphSpacing })} />
      <SettingRange label="Красная строка" value={value.textIndent} min={0} max={56} suffix=" px" onChange={(textIndent) => patch({ textIndent })} />
    </div></details>
    <details><summary>Страница</summary><div className="settings-group">
      <div className="setting-row"><span>Колонки</span><div className="segmented column-choice">{([1,2] as const).map((columns)=><button className={(value.pageColumns||1)===columns?'selected':''} key={columns} onClick={()=>patch({pageColumns:columns})}>{columns===1?'1 колонка':'2 колонки'}</button>)}</div><small className="setting-note">На узком экране всегда используется одна колонка</small></div>
      <SettingRange label="Ширина области чтения" value={value.contentWidth} min={600} max={1600} step={20} suffix=" px" onChange={(contentWidth) => patch({ contentWidth })} />
      <SettingRange label="Левое поле" value={value.marginLeft} min={12} max={120} suffix=" px" onChange={(marginLeft) => patch({ marginLeft })} />
      <SettingRange label="Правое поле" value={value.marginRight} min={12} max={120} suffix=" px" onChange={(marginRight) => patch({ marginRight })} />
      <SettingRange label="Верхнее поле" value={value.marginTop} min={12} max={100} suffix=" px" onChange={(marginTop) => patch({ marginTop })} />
      <SettingRange label="Нижнее поле" value={value.marginBottom} min={12} max={100} suffix=" px" onChange={(marginBottom) => patch({ marginBottom })} />
    </div></details>
    <details><summary>Иллюстрации</summary><div className="settings-group"><div className="segmented">{([['auto','Автоматически'],['compact','Компактнее'],['large','Крупнее']] as const).map(([key,label]) => <button className={value.imageScale===key?'selected':''} key={key} onClick={() => patch({ imageScale:key })}>{label}</button>)}</div></div></details>
    <details open><summary>Тема</summary><div className="theme-grid">{Object.entries(themes).map(([key, theme]) => <button className={value.theme===key?'selected':''} key={key} onClick={() => patch({ theme:key })}><i style={{background:theme.bg,color:theme.text}}>Aa</i><span>{theme.label}</span></button>)}</div>
      {value.theme === 'custom' && <div className="custom-colors"><label>Фон <input type="color" value={value.customBackground} onChange={(e)=>patch({customBackground:e.target.value})}/></label><label>Текст <input type="color" value={value.customText} onChange={(e)=>patch({customText:e.target.value})}/></label></div>}
    </details>
  </div>;
}

function flattenToc(items: TocItem[], depth = 0): Array<{ item: TocItem; depth: number }> {
  return items.flatMap((item) => [{ item, depth }, ...flattenToc(item.children || [], depth + 1)]);
}

function epubRules(settings: ReaderSettings) {
  const colors = readerColors(settings);
  const verticalSpace = settings.marginTop + settings.marginBottom + 12;
  const imageHeight = settings.imageScale === 'compact' ? 62 : settings.imageScale === 'large' ? 100 : 82;
  return {
    'html': { background: `${colors.bg} !important` },
    'html body': {
      margin: '0 !important',
      'box-sizing': 'border-box !important', background: `${colors.bg} !important`, color: `${colors.text} !important`,
      'font-family': `${settings.fontFamily}, serif !important`, 'font-size': `${settings.fontSize}px !important`,
      'font-weight': `${settings.fontWeight} !important`, 'line-height': `${settings.lineHeight} !important`, 'text-align': `${settings.alignment} !important`,
      'overflow-wrap': 'anywhere !important', 'word-break': 'normal !important',
    },
    'html body *': { 'box-sizing': 'border-box !important', 'max-width': '100% !important', 'overflow-wrap': 'anywhere !important' },
    'html body h1, html body h2, html body h3, html body h4, html body h5, html body h6': { 'white-space': 'normal !important', 'word-break': 'break-word !important', 'overflow-wrap': 'anywhere !important' },
    'html body p': { 'margin-top': '0 !important', 'margin-bottom': `${settings.paragraphSpacing}px !important`, 'text-indent': `${settings.textIndent}px !important`, 'line-height': `${settings.lineHeight} !important`, orphans: '2', widows: '2' },
    'html body li, html body blockquote': { 'line-height': `${settings.lineHeight} !important` },
    'html body img, html body svg, html body video, html body canvas': {
      display: 'block !important', 'max-width': '100% !important', 'max-height': `min(${imageHeight}vh, max(80px, calc(100vh - ${verticalSpace}px))) !important`,
      width: 'auto !important', height: 'auto !important', margin: '0 auto !important', 'object-fit': 'contain !important',
      'break-inside': 'avoid !important', 'page-break-inside': 'avoid !important',
    },
    'html body figure': { 'max-width': '100% !important', margin: '0 auto !important', 'break-inside': 'avoid !important', 'page-break-inside': 'avoid !important' },
    'html body table': { width: '100% !important', 'max-width': '100% !important', 'table-layout': 'fixed !important', 'overflow-wrap': 'anywhere !important' },
    'html body pre, html body code': { 'white-space': 'pre-wrap !important', 'overflow-wrap': 'anywhere !important' },
  };
}

function applyEpubSettings(rendition:any, settings:ReaderSettings) {
  const palette=readerColors(settings); rendition.themes.default(epubRules(settings));
  const overrides:Record<string,string>={
    margin:'0px',
    'font-family':`${settings.fontFamily}, serif`, 'font-size':`${settings.fontSize}px`, 'font-weight':String(settings.fontWeight),
    'line-height':String(settings.lineHeight), 'text-align':settings.alignment, color:palette.text, background:palette.bg,
  };
  for(const [property,value] of Object.entries(overrides))rendition.themes.override(property,value,true);
}

function applyEpubContent(contents:any, settings:ReaderSettings) {
  const palette=readerColors(settings); const values:Record<string,string>={
    margin:'0px',
    'font-family':`"${settings.fontFamily}", serif`,'font-size':`${settings.fontSize}px`,'font-weight':String(settings.fontWeight),
    'line-height':String(settings.lineHeight),'text-align':settings.alignment,color:palette.text,background:palette.bg,
  };
  for(const [property,value] of Object.entries(values))contents.css(property,value,true);

  // EPUB styles can set their own font-family on individual paragraphs/spans.
  // That can make the selected reader font disappear several pages later even
  // though the setting itself still says "Lora Hand". Force only the font
  // family inline with !important so the book cannot override it.
  const documentRef=contents?.document as Document|undefined;
  if(!documentRef)return;
  const family=String(settings.fontFamily).replace(/[\\"']/g,'');
  const forcedFamily=`"${family}", serif`;
  documentRef.documentElement?.style?.setProperty('font-family',forcedFamily,'important');
  documentRef.body?.style?.setProperty('font-family',forcedFamily,'important');
  for(const element of Array.from(documentRef.body?.querySelectorAll('*')||[]) as HTMLElement[]){
    const tag=element.tagName?.toLowerCase();
    if(tag==='svg'||tag==='path'||tag==='img'||tag==='video'||tag==='canvas')continue;
    element.style?.setProperty('font-family',forcedFamily,'important');
  }
}

function ensureReaderFonts(contents:any):Promise<void> {
  const documentRef=contents?.document as Document|undefined;
  const head=documentRef?.head;
  if(!documentRef||!head)return Promise.resolve();

  const existing=documentRef.querySelector('link[data-magic-reader-fonts="true"]') as HTMLLinkElement|null;
  if(existing?.sheet)return Promise.resolve();

  return new Promise<void>((resolve)=>{
    const link=existing||documentRef.createElement('link');
    let finished=false;
    const done=()=>{if(finished)return;finished=true;resolve()};
    const timer=window.setTimeout(done,2500);
    const finish=()=>{window.clearTimeout(timer);done()};

    link.addEventListener('load',finish,{once:true});
    link.addEventListener('error',finish,{once:true});
    if(!existing){
      link.rel='stylesheet';
      link.href=`${window.location.origin}/reader-fonts.css`;
      link.dataset.magicReaderFonts='true';
      head.appendChild(link);
    }
  });
}

async function ensureLoraHandFontFaces(contents:any):Promise<void> {
  const documentRef=contents?.document as Document|undefined;
  const fonts=documentRef?.fonts;
  if(!documentRef||!fonts||typeof FontFace==='undefined')return;

  // A new EPUB spine item is rendered in a fresh iframe. Relying only on a linked
  // stylesheet can leave that iframe on the serif fallback if the face itself has
  // not finished loading. Install the actual Lora Hand font faces into every iframe.
  if(documentRef.documentElement?.dataset.magicLoraHand==='ready'){
    try{if(fonts.check('400 18px "Lora Hand"'))return}catch{}
  }

  const origin=window.location.origin;
  const definitions=[
    ['/reader-fonts/lora-cyrillic-ext-400-italic.woff2','U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F'],
    ['/reader-fonts/lora-cyrillic-400-italic.woff2','U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116'],
    ['/reader-fonts/lora-latin-ext-400-italic.woff2','U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'],
    ['/reader-fonts/lora-latin-400-italic.woff2','U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
  ] as const;

  let loadedAny=false;
  for(const [path,unicodeRange] of definitions){
    try{
      const face=new FontFace('Lora Hand',`url("${origin}${path}") format("woff2")`,{
        style:'normal',
        weight:'400',
        unicodeRange,
      });
      const loaded=await Promise.race([
        face.load(),
        new Promise<never>((_,reject)=>window.setTimeout(()=>reject(new Error('Lora Hand face timeout')),3500)),
      ]);
      fonts.add(loaded);
      loadedAny=true;
    }catch(error){
      console.warn('EPUB Lora Hand face:',path,error);
    }
  }

  if(loadedAny){
    try{await Promise.race([fonts.load('400 18px "Lora Hand"'),new Promise<void>((resolve)=>window.setTimeout(resolve,1200))])}catch{}
    if(documentRef.documentElement)documentRef.documentElement.dataset.magicLoraHand='ready';
  }
}

async function prepareEpubContent(contents:any, settings:ReaderSettings) {
  // Every EPUB chapter is rendered in its own iframe. Load the reader stylesheet,
  // then explicitly install Lora Hand into that iframe before applying the styles.
  await ensureReaderFonts(contents);
  if(settings.fontFamily==='Lora Hand')await ensureLoraHandFontFaces(contents);
  applyEpubContent(contents,settings);

  try{
    const fonts=contents?.document?.fonts;
    if(fonts?.load){
      await Promise.race([
        fonts.load(`${settings.fontWeight} ${settings.fontSize}px "${settings.fontFamily}"`),
        new Promise<void>((resolve)=>window.setTimeout(resolve,2000)),
      ]);
    }
  }catch(error){
    console.warn('EPUB reader font load:',error);
  }

  // Re-apply once the actual face is available.
  applyEpubContent(contents,settings);
}

function applyAllEpubContent(rendition:any, settings:ReaderSettings) {
  const current = rendition.getContents() as any;
  for (const contents of Array.isArray(current) ? current : [current]) {
    if(contents){
      applyEpubContent(contents,settings);
      void prepareEpubContent(contents,settings);
    }
  }
}

function epubSpread(settings:ReaderSettings, width:number) { return (settings.pageColumns||1)===2&&width>=760?'always':'none'; }
function epubColumnCount(settings:ReaderSettings, width:number) { return epubSpread(settings,width)==='always'?2:1; }
function epubLayoutKey(settings:ReaderSettings, width:number, height:number) {
  return [width,height,epubColumnCount(settings,width),settings.fontFamily,settings.fontSize,settings.fontWeight,settings.lineHeight,settings.paragraphSpacing,settings.textIndent,settings.imageScale].join(':');
}

function withTimeout<T>(promise:Promise<T>, timeoutMs:number, label:string):Promise<T> {
  return new Promise<T>((resolve,reject)=>{
    const timer=window.setTimeout(()=>reject(new Error(`${label}: timeout`)),timeoutMs);
    promise.then((value)=>{window.clearTimeout(timer);resolve(value)},(error)=>{window.clearTimeout(timer);reject(error)});
  });
}

function readBlobWithFileReader(blob:Blob):Promise<ArrayBuffer> {
  return new Promise<ArrayBuffer>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      if(reader.result instanceof ArrayBuffer)resolve(reader.result);
      else reject(new Error('FileReader did not return ArrayBuffer'));
    };
    reader.onerror=()=>reject(reader.error||new Error('FileReader failed'));
    reader.onabort=()=>reject(new Error('FileReader aborted'));
    reader.readAsArrayBuffer(blob);
  });
}


async function readFreshStoredBook(fallback:BookRecord):Promise<BookRecord> {
  let lastError:unknown;
  for(let attempt=0;attempt<3;attempt++){
    try{
      if(!db.isOpen())await withTimeout(Promise.resolve(db.open()),5000,'IndexedDB open');
      const stored=await withTimeout(Promise.resolve(db.books.get(fallback.id)),5000,'IndexedDB book read');
      if(stored)return stored as BookRecord;
      return fallback;
    }catch(error){
      lastError=error;
      console.warn('IndexedDB book read retry:',error);
      try{db.close()}catch{}
      if(attempt<2)await new Promise<void>((resolve)=>window.setTimeout(resolve,180*(attempt+1)));
    }
  }
  console.warn('IndexedDB fresh read failed, using in-memory book record:',lastError);
  return fallback;
}

async function readStoredBookBytes(source:unknown):Promise<ArrayBuffer> {
  if(source instanceof ArrayBuffer)return source.slice(0);
  if(ArrayBuffer.isView(source))return source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength) as ArrayBuffer;
  if(!(source instanceof Blob))throw new Error('Сохранённый файл книги имеет неподдерживаемый формат');

  const fresh=source.slice(0,source.size,source.type);
  let lastError:unknown;
  const attempts:Array<()=>Promise<ArrayBuffer>>=[
    ()=>withTimeout(fresh.arrayBuffer(),6000,'Blob.arrayBuffer'),
    ()=>withTimeout(readBlobWithFileReader(fresh),8000,'FileReader'),
    ()=>withTimeout(new Response(fresh).arrayBuffer(),8000,'Response.arrayBuffer'),
  ];

  for(const attempt of attempts){
    try{
      const bytes=await attempt();
      if(bytes.byteLength>0)return bytes;
      lastError=new Error('Файл книги пуст');
    }catch(error){
      lastError=error;
      console.warn('EPUB stored file read retry:',error);
    }
  }
  throw lastError instanceof Error?lastError:new Error('Не удалось прочитать сохранённый файл книги');
}

function ImageZoomOverlay({image,onClose}:{image:{src:string;alt:string};onClose:()=>void}) {
  const [zoom,setZoom]=useState(0);
  useEffect(()=>setZoom(0),[image.src]);
  const change=(delta:number)=>setZoom((value)=>Math.max(.5,Math.min(5,(value||1)+delta)));
  return <div className="reader-image-zoom" role="dialog" aria-modal="true" aria-label="Просмотр изображения">
    <div className="reader-image-tools">
      <Button variant="secondary" size="icon" aria-label="Уменьшить" onClick={()=>change(-.25)}><Minus/></Button>
      <Button variant="secondary" size="icon" aria-label="Увеличить" onClick={()=>change(.25)}><Plus/></Button>
      <Button variant="secondary" onClick={()=>setZoom(1)}><RotateCcw/>100%</Button>
      <Button variant="secondary" onClick={()=>setZoom(0)}>Вписать</Button>
      <Button variant="secondary" size="icon" aria-label="Закрыть" onClick={onClose}><X/></Button>
    </div>
    <div className="reader-image-scroll" onWheel={(event)=>{if(!event.ctrlKey)return;event.preventDefault();change(event.deltaY<0?.25:-.25)}}>
      <img src={image.src} alt={image.alt}/>
    </div>
    <style>{`.reader-image-scroll img{${zoom===0?'max-width:100%;max-height:100%;width:auto;height:auto':'width:'+zoom*100+'%;max-width:none;max-height:none;height:auto'}}`}</style>
  </div>;
}

function EpubSurface({ book, settings, onProgress, onVisual, onChapterInfo, onEpubLocations, navigationRef, seekRef }: { book: BookRecord; settings: ReaderSettings; onProgress: Props['onProgress']; onVisual:(value:{current:number;total:number;label:string})=>void; onChapterInfo:(value:{title:string;remaining:number|null}|null)=>void; onEpubLocations:Props['onEpubLocations']; navigationRef: React.MutableRefObject<{ next:()=>void; prev:()=>void; display:(target:string)=>void } | null>; seekRef:React.MutableRefObject<((progress:number)=>void)|null> }) {
  const host = useRef<HTMLDivElement>(null); const bookRef = useRef<any>(null); const renditionRef = useRef<any>(null);
  const settingsRef = useRef(settings); const progressRef = useRef(onProgress); const visualRef = useRef(onVisual); const cacheRef = useRef(onEpubLocations);
  settingsRef.current = settings; progressRef.current = onProgress; visualRef.current = onVisual; cacheRef.current = onEpubLocations;
  const [ready,setReady]=useState(false); const [openError,setOpenError]=useState(''); const [retryKey,setRetryKey]=useState(0);
  const [zoomImage,setZoomImage]=useState<{src:string;alt:string}|null>(null);const zoomOpenRef=useRef(false);
  const pageMapRef=useRef<{key:string;counts:number[];chapters:Array<{page:number;label:string}>}|null>(null); const mapVersionRef=useRef(0);
  const rebuildMapRef=useRef<(()=>void)|null>(null); const bytesRef=useRef<ArrayBuffer|null>(null);

  useEffect(() => {
    let active = true; let resizeFrame = 0; let generationTimer = 0; let idleId = 0; let mapTimer=0; let observer: ResizeObserver | undefined; let navigationQueue=Promise.resolve();
    setReady(false);setOpenError('');bytesRef.current=null;
    (async () => {
      if (!host.current) return;
      const { default: ePub } = await import('epubjs');
      const storedBook=await readFreshStoredBook(book);
      if(!active)return;
      const sourceFile=storedBook.file||book.file;
      const sourceBytes=(storedBook as BookRecord).fileBytes||(book as BookRecord).fileBytes;
      const sourceLocation=storedBook.location||book.location;
      const sourceProgress=typeof storedBook.progress==='number'?storedBook.progress:(book.progress||0);
      const sourceLocations=storedBook.epubLocations||book.epubLocations;
      const sourceToc=storedBook.toc||book.toc;
      const bytes=await readStoredBookBytes(sourceBytes||sourceFile);
      if(!active)return;
      bytesRef.current=bytes;
      if(!sourceBytes){
        try{
          await db.books.update(storedBook.id,{fileBytes:bytes.slice(0)});
        }catch(error){
          console.warn('EPUB stable bytes migration:',error);
        }
      }
      const instance = ePub(bytes.slice(0)); bookRef.current = instance; await withTimeout(Promise.resolve(instance.ready),10000,'EPUB ready');
      if (sourceLocations) { try { instance.locations.load(sourceLocations); } catch (error) { console.error('EPUB locations cache:', error); } }
      if (!active || !host.current) return;
      const rendition = instance.renderTo(host.current, { width: host.current.clientWidth, height: host.current.clientHeight, flow: 'paginated', spread: epubSpread(settingsRef.current,host.current.clientWidth), manager: 'default', allowScriptedContent: false });
      renditionRef.current = rendition;
      rendition.spread(epubSpread(settingsRef.current,host.current.clientWidth));
      applyEpubSettings(rendition,settingsRef.current);
      const wireImages=(contents:any)=>{
        for(const image of Array.from(contents?.document?.querySelectorAll?.('img')||[]) as HTMLImageElement[]){
          if(image.dataset.magicZoom==='true')continue;
          image.dataset.magicZoom='true'; image.style.cursor='zoom-in'; image.tabIndex=0;
          const open=()=>{const src=image.currentSrc||image.src;if(src){zoomOpenRef.current=true;setZoomImage({src,alt:image.alt||'Иллюстрация книги'})}};
          image.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();open()});
          image.addEventListener('keydown',(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}});
        }
      };
      const syncZoom=()=>{
        if(!zoomOpenRef.current)return;
        window.setTimeout(()=>{
          if(!active||!zoomOpenRef.current)return;
          const rendered=rendition.getContents() as any;let selected:HTMLImageElement|null=null;let selectedArea=0;
          for(const contents of Array.isArray(rendered)?rendered:[rendered]){
            const view=contents?.document?.defaultView;const viewWidth=view?.innerWidth||0;const viewHeight=view?.innerHeight||0;
            for(const image of Array.from(contents?.document?.querySelectorAll?.('img')||[]) as HTMLImageElement[]){
              const rect=image.getBoundingClientRect();const visibleWidth=Math.max(0,Math.min(rect.right,viewWidth)-Math.max(rect.left,0));const visibleHeight=Math.max(0,Math.min(rect.bottom,viewHeight)-Math.max(rect.top,0));const area=visibleWidth*visibleHeight;
              if(area>selectedArea){selected=image;selectedArea=area}
            }
          }
          const src=selected?.currentSrc||selected?.src;
          if(src)setZoomImage({src,alt:selected?.alt||'Иллюстрация книги'});else{zoomOpenRef.current=false;setZoomImage(null)}
        },60);
      };
      rendition.hooks.content.register(async(contents:any) => {
        await prepareEpubContent(contents,settingsRef.current);
        wireImages(contents);
      });
      const enqueue=(action:()=>Promise<unknown>)=>{navigationQueue=navigationQueue.then(async()=>{await action()}).catch((error)=>console.error('EPUB navigation:',error));};
      navigationRef.current = { next:()=>enqueue(()=>rendition.next()), prev:()=>enqueue(()=>rendition.prev()), display:(target)=>enqueue(()=>rendition.display(target)) };
      seekRef.current=(percent)=>{
        const target=Math.max(0,Math.min(100,percent))/100;
        enqueue(async()=>{
          try{
            let cfi=instance.locations?.cfiFromPercentage?.(target);
            if(!cfi){
              await instance.locations.generate(1800);
              if(active)cacheRef.current(instance.locations.save());
              cfi=instance.locations?.cfiFromPercentage?.(target);
            }
            if(cfi)await rendition.display(cfi);
          }catch(error){
            console.error('EPUB seek:',error);
          }
        });
      };
      const linearSpine = ((((instance.spine as any)?.spineItems) || []) as any[]).filter((item)=>item.linear!=='no');
      const report = (location:any) => {
        if (!location?.start?.cfi) return;
        syncZoom();
        const currentHost=host.current; const map=pageMapRef.current;
        const columns=currentHost?epubColumnCount(settingsRef.current,currentHost.clientWidth):1;
        const key=currentHost?epubLayoutKey(settingsRef.current,currentHost.clientWidth,currentHost.clientHeight):'';
        const spinePosition=linearSpine.findIndex((item)=>item.index===location.start.index||item.href===location.start.href);
        if(!map||map.key!==key||spinePosition<0){
          onChapterInfo(null);
          visualRef.current({current:0,total:0,label:'Пересчитываем страницы…'});
          progressRef.current({kind:'epub',cfi:location.start.cfi},sourceProgress||0);
          return;
        }
        const localPage=Math.max(1,Math.floor(((Number(location.start.displayed?.page)||1)-1)/columns)+1);
        const total=Math.max(1,map.counts.reduce((sum,value)=>sum+value,0));
        const current=Math.max(1,Math.min(total,map.counts.slice(0,spinePosition).reduce((sum,value)=>sum+value,0)+localPage));
        const currentChapter=[...map.chapters].reverse().find((chapter)=>chapter.page<=current)||null;
        const nextChapter=map.chapters.find((chapter)=>chapter.page>current)||null;
        const chapterRemaining=currentChapter?Math.max(0,(nextChapter?.page??(total+1))-current-1):null;
        onChapterInfo(currentChapter?{title:currentChapter.label,remaining:chapterRemaining}:null);
        const progress=Math.max(0,Math.min(100,Math.round(current/total*100)));
        visualRef.current({current,total,label:'Страница'});
        progressRef.current({ kind:'epub', cfi:location.start.cfi }, progress);
      };
      const scheduleMap=()=>{
        clearTimeout(mapTimer); const version=++mapVersionRef.current; pageMapRef.current=null;
        visualRef.current({current:0,total:0,label:'Пересчитываем страницы…'});
        mapTimer=window.setTimeout(()=>void (async()=>{
          const currentHost=host.current;if(!active||!currentHost)return;
          const measuredSettings=settingsRef.current; const width=currentHost.clientWidth; const height=currentHost.clientHeight;
          const key=epubLayoutKey(measuredSettings,width,height); const measureHost=document.createElement('div');
          Object.assign(measureHost.style,{position:'fixed',left:'-100000px',top:'0',width:`${width}px`,height:`${height}px`,visibility:'hidden',pointerEvents:'none'});document.body.appendChild(measureHost);
          let measureBook:any;let measureRendition:any;
          try{
            const sourceBytes=bytesRef.current||await readStoredBookBytes(book.file);
            if(!bytesRef.current)bytesRef.current=sourceBytes;
            measureBook=ePub(sourceBytes.slice(0));await measureBook.ready;if(!active||version!==mapVersionRef.current)return;
            measureRendition=measureBook.renderTo(measureHost,{width,height,flow:'paginated',spread:epubSpread(measuredSettings,width),manager:'default',allowScriptedContent:false});
            applyEpubSettings(measureRendition,measuredSettings);
            measureRendition.hooks.content.register(async(contents:any)=>{await prepareEpubContent(contents,measuredSettings);await contents.document?.fonts?.ready});
            const measureSpine=((((measureBook.spine as any)?.spineItems)||[]) as any[]).filter((item)=>item.linear!=='no');const counts:number[]=[];
            for(const item of measureSpine){
              if(!active||version!==mapVersionRef.current)return;
              await measureRendition.display(item.href);await new Promise<void>((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
              const location=measureRendition.currentLocation();const pageTotal=Math.max(1,Number(location?.start?.displayed?.total)||1);
              counts.push(Math.max(1,Math.ceil(pageTotal/epubColumnCount(measuredSettings,width))));
            }

            // EPUB-файл (spine item) может содержать сразу несколько настоящих глав.
            // Поэтому границы глав берём из оглавления, а не из displayed.total текущего spine item.
            const tocTargets=flattenToc(sourceToc||[])
              .map(({item})=>({target:item.href||item.sectionId||'',label:(item.label||'').trim()}))
              .filter(({target,label})=>Boolean(target&&label));
            const chapterPages=new Map<number,string>();
            const measuredColumns=epubColumnCount(measuredSettings,width);
            for(const {target,label} of tocTargets){
              if(!active||version!==mapVersionRef.current)return;
              try{
                await measureRendition.display(target);
                await new Promise<void>((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
                const tocLocation=measureRendition.currentLocation();
                const tocSpinePosition=measureSpine.findIndex((item)=>item.index===tocLocation?.start?.index||item.href===tocLocation?.start?.href);
                if(tocSpinePosition<0)continue;
                const tocLocalPage=Math.max(1,Math.floor(((Number(tocLocation?.start?.displayed?.page)||1)-1)/measuredColumns)+1);
                const globalPage=counts.slice(0,tocSpinePosition).reduce((sum,value)=>sum+value,0)+tocLocalPage;
                if(Number.isFinite(globalPage)&&globalPage>=1)chapterPages.set(globalPage,label);
              }catch(error){
                console.warn('EPUB TOC boundary:',target,error);
              }
            }
            const chapters=[...chapterPages.entries()].map(([page,label])=>({page,label})).sort((a,b)=>a.page-b.page);

            if(active&&version===mapVersionRef.current&&key===epubLayoutKey(settingsRef.current,currentHost.clientWidth,currentHost.clientHeight)){
              pageMapRef.current={key,counts,chapters};report(rendition.currentLocation());
            }
          }catch(error){if(active&&version===mapVersionRef.current)console.error('EPUB pagination map:',error)}finally{measureRendition?.destroy();measureBook?.destroy();measureHost.remove()}
        })(),180);
      };
      rebuildMapRef.current=scheduleMap;
      rendition.on('relocated', report);
      rendition.on('rendered', () => window.setTimeout(() => {
        if (!active) return;
        const renderedContents = rendition.getContents() as any;
        for (const contents of Array.isArray(renderedContents) ? renderedContents : [renderedContents]) {
          if(contents){
            applyEpubContent(contents,settingsRef.current);
            void prepareEpubContent(contents,settingsRef.current);
            wireImages(contents);
          }
        }
        syncZoom();
      }, 0));
      const savedCfi=sourceLocation?.kind==='epub'?sourceLocation.cfi:undefined;
      if(savedCfi&&retryKey===0){
        try{
          await withTimeout(Promise.resolve(rendition.display(savedCfi)),8000,'EPUB saved position');
        }catch(error){
          console.warn('EPUB saved position failed, retrying from progress:',error);
          if(active)setRetryKey(1);
          return;
        }
      }else{
        let fallbackCfi:string|undefined;
        if(sourceProgress>0){
          try{fallbackCfi=instance.locations?.cfiFromPercentage?.(Math.max(0,Math.min(100,sourceProgress))/100)}catch(error){console.warn('EPUB progress fallback CFI:',error)}
        }
        try{
          await withTimeout(Promise.resolve(rendition.display(fallbackCfi)),10000,'EPUB display');
        }catch(error){
          if(fallbackCfi){
            console.warn('EPUB progress position failed, opening first page:',error);
            await withTimeout(Promise.resolve(rendition.display()),10000,'EPUB first page');
          }else throw error;
        }
      }
      if (!active) return;
      const displayedContents=rendition.getContents() as any;
      const currentContents=(Array.isArray(displayedContents)?displayedContents:[displayedContents]).filter(Boolean);
      await Promise.all(currentContents.map((contents:any)=>prepareEpubContent(contents,settingsRef.current)));
      if(!active)return;
      setReady(true);
      scheduleMap();
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          if (!host.current || !renditionRef.current) return;
          const cfi = renditionRef.current.location?.start?.cfi;
          renditionRef.current.spread(epubSpread(settingsRef.current,host.current.clientWidth));
          renditionRef.current.resize(host.current.clientWidth, host.current.clientHeight, cfi);
          rebuildMapRef.current?.();
        });
      });
      observer.observe(host.current);
      if (!sourceLocations) {
        generationTimer = window.setTimeout(() => {
          const generate = async () => {
            try {
              await instance.locations.generate(1800);
              if (!active) return;
              cacheRef.current(instance.locations.save());
              report(rendition.currentLocation());
            } catch (error) { console.error('EPUB locations:', error); }
          };
          if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(() => void generate(), { timeout: 10000 });
          else void generate();
        }, 2500);
      } else report(rendition.currentLocation());
    })().catch((error) => {
      console.error('EPUB reader:', error);
      if(active)setOpenError('Не удалось прочитать старую сохранённую копию книги на этом iPhone. Нажмите «Повторить». Если не поможет, эту книгу нужно добавить заново один раз — новые копии будут сохраняться в более надёжном формате.');
    });
    return () => {
      active = false; clearTimeout(generationTimer);clearTimeout(mapTimer);mapVersionRef.current++;rebuildMapRef.current=null;if (idleId && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
      cancelAnimationFrame(resizeFrame); observer?.disconnect(); navigationRef.current = null; seekRef.current=null; renditionRef.current?.destroy(); bookRef.current?.destroy();
    };
  }, [book.id,retryKey]);

  useEffect(() => {
    const rendition = renditionRef.current; if (!rendition || !host.current) return;
    const timer = window.setTimeout(() => {
      const currentHost=host.current; if(!currentHost)return;
      const cfi = rendition.location?.start?.cfi;
      applyEpubSettings(rendition,settings);
      applyAllEpubContent(rendition,settings);
      rendition.spread(epubSpread(settings,currentHost.clientWidth));
      rendition.resize(currentHost.clientWidth,currentHost.clientHeight,cfi);
      window.setTimeout(()=>applyAllEpubContent(rendition,settings),50);
      window.setTimeout(()=>rebuildMapRef.current?.(),80);
    }, 120);
    return () => clearTimeout(timer);
  }, [settings]);
  const palette=readerColors(settings);
  return <div className="epub-surface-wrap" style={{boxSizing:'border-box',padding:`${settings.marginTop}px ${settings.marginRight}px ${settings.marginBottom}px ${settings.marginLeft}px`,background:palette.bg}}>
    <div ref={host} className="epub-surface" aria-label="Текст книги" />
    {!ready&&!openError&&<output className="reader-loading" aria-live="polite">Открываем книгу…</output>}
    {openError&&<div className="reader-loading" role="alert" style={{display:'grid',gap:12,justifyItems:'center',textAlign:'center',maxWidth:360}}><span>{openError}</span><Button variant="secondary" onClick={()=>setRetryKey((value)=>value+1)}>Повторить</Button></div>}
    {zoomImage&&<ImageZoomOverlay image={zoomImage} onClose={()=>{zoomOpenRef.current=false;setZoomImage(null)}}/>}
  </div>;
}

// oxlint-disable-next-line no-unused-vars
function LegacyFb2Surface({ book, settings, page, setPage, onProgress, onVisual, navigationRef }: { book: BookRecord; settings: ReaderSettings; page:number; setPage:React.Dispatch<React.SetStateAction<number>>; onProgress:Props['onProgress']; onVisual:(value:{current:number;total:number;label:string})=>void; navigationRef:React.MutableRefObject<{next:()=>void;prev:()=>void;display:(target:string)=>void}|null> }) {
  const viewport = useRef<HTMLDivElement>(null); const article = useRef<HTMLElement>(null);
  const prepared = useMemo(() => {
    const images = { ...book.fb2Images };
    const legacyIds = new Map<string, string>();
    const html = (book.fb2Html || '').replace(/\ssrc=(['"])(data:image\/[\s\S]*?)\1/gi, (_match, _quote, source:string) => {
      let id = legacyIds.get(source);
      if (!id) { id = `legacy-${legacyIds.size}`; legacyIds.set(source, id); images[id] = source; }
      return ` data-fb2-image="${id}"`;
    });
    return { html, images };
  }, [book.id, book.fb2Html, book.fb2Images]);
  const initialRatio = book.location?.kind === 'fb2' ? book.location.ratio : 0;
  const ratioRef = useRef(initialRatio); const [pages,setPages]=useState(1); const [pageWidth,setPageWidth]=useState(1); const [pageHeight,setPageHeight]=useState(1); const [laidOut,setLaidOut]=useState(false); const [assetsReady,setAssetsReady]=useState(false);
  const compact = pageWidth < 600;
  const left = compact ? Math.min(settings.marginLeft, Math.max(12, pageWidth * .07)) : settings.marginLeft;
  const right = compact ? Math.min(settings.marginRight, Math.max(12, pageWidth * .07)) : settings.marginRight;
  const top = compact ? Math.min(settings.marginTop, Math.max(12, pageHeight * .045)) : settings.marginTop;
  const bottom = compact ? Math.min(settings.marginBottom, Math.max(12, pageHeight * .045)) : settings.marginBottom;
  const textWidth = Math.max(1, pageWidth - left - right); const contentHeight = Math.max(1, pageHeight - top - bottom); const gap = left + right;

  useEffect(()=>{ const observer=new ResizeObserver(([entry])=>{setPageWidth(Math.max(1,Math.floor(entry.contentRect.width)));setPageHeight(Math.max(1,Math.floor(entry.contentRect.height)))});if(viewport.current)observer.observe(viewport.current);return()=>observer.disconnect()},[]);
  useEffect(()=>{
    setAssetsReady(false); const urls:string[]=[]; const pending:Promise<void>[]=[];
    for(const image of Array.from(article.current?.querySelectorAll<HTMLImageElement>('img[data-fb2-image]')||[])){
      const source=prepared.images[image.dataset.fb2Image||'']; if(!source)continue;
      try{
        const comma=source.indexOf(','); const meta=source.slice(5,comma); const bytes=atob(source.slice(comma+1)); const data=new Uint8Array(bytes.length);
        for(let index=0;index<bytes.length;index++)data[index]=bytes.charCodeAt(index);
        const url=URL.createObjectURL(new Blob([data],{type:meta.split(';')[0]||'image/jpeg'})); urls.push(url); image.src=url;
        if(!image.complete)pending.push(new Promise((resolve)=>{image.addEventListener('load',()=>resolve(),{once:true});image.addEventListener('error',()=>resolve(),{once:true})}));
      }catch{ image.src=source; }
    }
    let active=true; void Promise.all(pending).then(()=>{if(active)setAssetsReady(true)}); if(!pending.length)setAssetsReady(true);
    return()=>{active=false;for(const url of urls)URL.revokeObjectURL(url)};
  },[prepared]);
  useEffect(()=>{
    if(!assetsReady)return; setLaidOut(false); let second=0;
    const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{
      if(!article.current||pageWidth<=1)return;
      const total=Math.max(1,Math.round((article.current.scrollWidth+gap)/pageWidth));
      const restored=Math.max(0,Math.min(total-1,Math.round(ratioRef.current*Math.max(0,total-1))));
      setPages(total);setPage(restored);setLaidOut(true);
    })});
    return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second)};
  },[book.id,prepared.html,assetsReady,pageWidth,pageHeight,textWidth,contentHeight,gap,settings]);
  useEffect(()=>{
    const next=()=>setPage((current)=>Math.min(pages-1,current+1));
    const prev=()=>setPage((current)=>Math.max(0,current-1));
    const display=(target:string)=>{const el=article.current?.querySelector(`#${CSS.escape(target)}`) as HTMLElement|null;if(!el)return;const targetPage=Math.max(0,Math.min(pages-1,Math.floor(el.offsetLeft/Math.max(1,pageWidth))));setPage(targetPage)};
    navigationRef.current={next,prev,display};return()=>{navigationRef.current=null};
  },[pages,pageWidth]);
  useEffect(()=>{if(!laidOut)return;const ratio=pages<=1?0:page/(pages-1);ratioRef.current=ratio;onVisual({current:page+1,total:pages,label:'Страница'});onProgress({kind:'fb2',ratio},Math.round(ratio*100))},[page,pages,laidOut]);
  const colors=readerColors(settings); const imageHeight=settings.imageScale==='compact'?Math.round(contentHeight*.62):settings.imageScale==='large'?contentHeight:Math.round(contentHeight*.82);
  return <div ref={viewport} className="fb2-viewport" style={{background:colors.bg}}><article ref={article} className="fb2-columns" style={{
    top, height:contentHeight, width:textWidth, transform:`translateX(${left-page*pageWidth}px)`, columnWidth:textWidth, columnGap:gap,
    color:colors.text,background:colors.bg,fontFamily:settings.fontFamily,fontSize:settings.fontSize,fontWeight:settings.fontWeight,lineHeight:settings.lineHeight,textAlign:settings.alignment,maxWidth:'none',
    ['--paragraph-gap' as string]:`${settings.paragraphSpacing}px`,['--text-indent' as string]:`${settings.textIndent}px`,['--image-height' as string]:`${imageHeight}px`,
  }} dangerouslySetInnerHTML={{__html:prepared.html}} />{!laidOut&&<output className="reader-loading" aria-live="polite">Подготавливаем страницы…</output>}</div>;
}

export function Reader({ book, settings, onSettings, onClose, onProgress, onEpubLocations }: Props) {
  const [visual,setVisual]=useState({current:1,total:1,label:book.format==='fb2'?'Страница':'Страница главы'});
  const [chapterInfo,setChapterInfo]=useState<{title:string;remaining:number|null}|null>(null);
  const [seekValue,setSeekValue]=useState(book.progress||0);
  const [seeking,setSeeking]=useState(false);
  const navigationRef=useRef<{next:()=>void;prev:()=>void;display:(target:string)=>void}|null>(null);
  const seekRef=useRef<((progress:number)=>void)|null>(null);
  const mobileGestureStart=useRef<{x:number;y:number}|null>(null);
  const suppressTapUntil=useRef(0);
  const progress=book.progress||0;
  const turn=(direction:'next'|'prev')=>navigationRef.current?.[direction]();
  useEffect(()=>setChapterInfo(null),[book.id]);
  useEffect(()=>{setSeekValue(book.progress||0);setSeeking(false)},[book.id]);
  useEffect(()=>{if(!seeking)setSeekValue(progress)},[progress,seeking]);
  useEffect(()=>{
    if(!chapterInfo?.title||typeof window==='undefined')return;
    try{
      localStorage.setItem(`magic-reader-chapter:${book.id}`,JSON.stringify({...chapterInfo,updatedAt:Date.now()}));
    }catch{}
  },[book.id,chapterInfo]);

  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if(['ArrowRight','PageDown'].includes(event.key)){
        event.preventDefault();
        turn('next');
        return;
      }
      if(['ArrowLeft','PageUp'].includes(event.key)){
        event.preventDefault();
        turn('prev');
      }
    };
    addEventListener('keydown',handler);
    return()=>removeEventListener('keydown',handler);
  },[]);

  const startMobileGesture=(event:React.TouchEvent<HTMLButtonElement>)=>{
    if(event.touches.length!==1)return;
    const touch=event.touches[0];
    mobileGestureStart.current={x:touch.clientX,y:touch.clientY};
  };

  const endMobileGesture=(event:React.TouchEvent<HTMLButtonElement>)=>{
    const start=mobileGestureStart.current;
    mobileGestureStart.current=null;
    if(!start||event.changedTouches.length!==1)return;

    const touch=event.changedTouches[0];
    const dx=touch.clientX-start.x;
    const dy=touch.clientY-start.y;

    if(Math.abs(dx)>=34&&Math.abs(dx)>Math.abs(dy)*1.1){
      suppressTapUntil.current=Date.now()+500;
      turn(dx<0?'next':'prev');
    }
  };

  const tapMobileZone=(direction:'next'|'prev',event:React.MouseEvent<HTMLButtonElement>)=>{
    event.stopPropagation();
    if(Date.now()<suppressTapUntil.current)return;
    turn(direction);
  };

  const pageWidth=settings.contentWidth>=1600?'100%':`min(100%, ${settings.contentWidth+settings.marginLeft+settings.marginRight}px)`;

  const commitSeek=(value:number)=>{
    const next=Math.max(0,Math.min(100,value));
    setSeekValue(next);
    setSeeking(false);
    if(book.format==='epub')seekRef.current?.(next);
  };

  const seekPercentFromPointer=(event:React.PointerEvent<HTMLDivElement>)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    if(rect.width<=0)return seekValue;
    return Math.max(0,Math.min(100,((event.clientX-rect.left)/rect.width)*100));
  };

  const handleSeekPointerDown=(event:React.PointerEvent<HTMLDivElement>)=>{
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const value=seekPercentFromPointer(event);
    setSeeking(true);
    setSeekValue(value);
  };

  const handleSeekPointerMove=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(!seeking)return;
    setSeekValue(seekPercentFromPointer(event));
  };

  const handleSeekPointerUp=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(!seeking)return;
    event.preventDefault();
    event.stopPropagation();
    commitSeek(seekPercentFromPointer(event));
  };

  const handleSeekKeyDown=(event:React.KeyboardEvent<HTMLDivElement>)=>{
    let next:number|null=null;
    if(event.key==='ArrowLeft'||event.key==='ArrowDown')next=seekValue-1;
    if(event.key==='ArrowRight'||event.key==='ArrowUp')next=seekValue+1;
    if(event.key==='PageDown')next=seekValue-5;
    if(event.key==='PageUp')next=seekValue+5;
    if(event.key==='Home')next=0;
    if(event.key==='End')next=100;
    if(next===null)return;
    event.preventDefault();
    event.stopPropagation();
    commitSeek(next);
  };

  return <main className="reader-shell">
    <style>{`
      .mobile-page-zone{display:none}
      .reader-seek-wrap{display:flex;align-items:center;width:100%;min-width:0;margin-top:6px}
      .reader-seek-track{
        position:relative!important;
        width:100%!important;
        height:22px!important;
        min-width:0!important;
        cursor:pointer!important;
        touch-action:none!important;
        user-select:none!important;
        -webkit-user-select:none!important;
      }
      .reader-seek-rail{
        position:absolute!important;
        left:0!important;right:0!important;top:50%!important;
        height:5px!important;
        transform:translateY(-50%)!important;
        border-radius:999px!important;
        background:#d9c9b8!important;
        box-shadow:inset 0 1px 2px rgba(74,43,27,.10)!important;
        pointer-events:none!important;
      }
      .reader-seek-fill{
        position:absolute!important;
        left:0!important;top:0!important;bottom:0!important;
        border-radius:999px!important;
        background:#a8643f!important;
        pointer-events:none!important;
      }
      .reader-seek-thumb{
        position:absolute!important;
        top:50%!important;
        width:18px!important;height:18px!important;
        transform:translate(-50%,-50%)!important;
        border-radius:50%!important;
        border:2px solid #fff8ee!important;
        background:#a8643f!important;
        box-shadow:0 1px 5px rgba(74,43,27,.38)!important;
        pointer-events:none!important;
        z-index:2!important;
      }
      .reader-seek-track:focus-visible{outline:2px solid rgba(168,100,63,.45)!important;outline-offset:2px!important;border-radius:999px!important}
      .turn-zone:focus,
      .turn-zone:focus-visible,
      .mobile-page-zone:focus,
      .mobile-page-zone:focus-visible{
        outline:none!important;
        box-shadow:none!important;
      }
      @media (max-width:820px){
        .reader-stage{position:relative!important}
        .mobile-page-zone{
          display:block!important;
          position:absolute!important;
          top:0!important;
          bottom:0!important;
          width:38%!important;
          z-index:30!important;
          border:0!important;
          margin:0!important;
          padding:0!important;
          background:transparent!important;
          opacity:0!important;
          -webkit-tap-highlight-color:transparent!important;
          touch-action:pan-y!important;
        }
        .mobile-page-zone.prev{left:0!important}
        .mobile-page-zone.next{right:0!important}
      }
    `}</style>

    <header className="reader-topbar"><Button variant="ghost" size="icon-lg" aria-label="Назад в библиотеку" onClick={onClose}><ArrowLeft/></Button><div className="reader-title"><strong>{book.title}</strong><span>{book.authors.join(', ')}</span></div><div className="reader-actions">
      <Sheet><SheetTrigger render={<Button variant="ghost" size="icon-lg" aria-label="Содержание"/>}><ListTree/></SheetTrigger><SheetContent side="left" className="reader-sheet"><SheetHeader><SheetTitle>Содержание</SheetTitle><SheetDescription>Переход к разделам книги</SheetDescription></SheetHeader><div className="toc-list">{flattenToc(book.toc||[]).map(({item,depth},index)=><button key={`${item.label}-${index}`} style={{paddingLeft:18+depth*18}} onClick={()=>navigationRef.current?.display(item.href||item.sectionId||'')}>{item.label}</button>)}</div></SheetContent></Sheet>
      <Sheet><SheetTrigger render={<Button variant="ghost" size="icon-lg" aria-label="Настройки чтения"/>}><Settings2/></SheetTrigger><SheetContent side="right" className="reader-sheet"><SheetHeader><SheetTitle>Настройки чтения</SheetTitle><SheetDescription>Изменения применяются сразу и сохраняются</SheetDescription></SheetHeader><ReaderSettingsPanel value={settings} onChange={onSettings}/></SheetContent></Sheet>
      <Button variant="ghost" size="icon-lg" aria-label="Полный экран" onClick={()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}><Expand/></Button>
    </div></header>

    <section className="reader-stage">
      <button className="turn-zone left" tabIndex={-1} aria-label="Предыдущая страница" onMouseDown={(event)=>event.preventDefault()} onClick={()=>turn('prev')}/>
      <div className="reader-page" style={{width:pageWidth}}>{book.format==='epub'?<EpubSurface book={book} settings={settings} onProgress={onProgress} onVisual={setVisual} onChapterInfo={setChapterInfo} onEpubLocations={onEpubLocations} navigationRef={navigationRef} seekRef={seekRef}/>:<Fb2SurfaceStable book={book} settings={settings} onProgress={onProgress} onVisual={setVisual} navigationRef={navigationRef}/>}</div>
      <button className="turn-zone right" tabIndex={-1} aria-label="Следующая страница" onMouseDown={(event)=>event.preventDefault()} onClick={()=>turn('next')}/>

      <button
        type="button"
        className="mobile-page-zone prev"
        aria-label="Предыдущая страница"
        onTouchStart={startMobileGesture}
        onTouchEnd={endMobileGesture}
        onClick={(event)=>tapMobileZone('prev',event)}
      />
      <button
        type="button"
        className="mobile-page-zone next"
        aria-label="Следующая страница"
        onTouchStart={startMobileGesture}
        onTouchEnd={endMobileGesture}
        onClick={(event)=>tapMobileZone('next',event)}
      />
    </section>

    <footer className="reader-bottombar"><Button variant="ghost" size="icon-lg" aria-label="Предыдущая страница" onClick={()=>turn('prev')}><ChevronLeft/></Button><div><span>{visual.total>0?`${visual.label} ${visual.current} из ${visual.total}`:visual.label}{book.format==='epub'&&chapterInfo?.title?` · ${chapterInfo.title}${chapterInfo.remaining===0?' · конец главы':chapterInfo.remaining!==null?` · ещё ${chapterInfo.remaining} стр.`:''}`:''}</span>{book.format==='epub'?<div className="reader-seek-wrap"><div className="reader-seek-track" role="slider" tabIndex={0} aria-label="Переход по книге" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(seekValue)} onPointerDown={handleSeekPointerDown} onPointerMove={handleSeekPointerMove} onPointerUp={handleSeekPointerUp} onPointerCancel={()=>{setSeeking(false);setSeekValue(progress)}} onKeyDown={handleSeekKeyDown}><div className="reader-seek-rail"><div className="reader-seek-fill" style={{width:`${seekValue}%`}}/></div><span className="reader-seek-thumb" style={{left:`${seekValue}%`}}/></div></div>:<Progress value={progress} aria-label={`Прочитано ${progress}%`}/>}<b>{Math.round(book.format==='epub'&&seeking?seekValue:progress)}%</b></div><Button variant="ghost" size="icon-lg" aria-label="Следующая страница" onClick={()=>turn('next')}><ChevronRight/></Button></footer>
  </main>;
}
