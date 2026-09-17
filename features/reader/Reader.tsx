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
    'font-family':`${settings.fontFamily}, serif`,'font-size':`${settings.fontSize}px`,'font-weight':String(settings.fontWeight),
    'line-height':String(settings.lineHeight),'text-align':settings.alignment,color:palette.text,background:palette.bg,
  };
  for(const [property,value] of Object.entries(values))contents.css(property,value,true);
}

function applyAllEpubContent(rendition:any, settings:ReaderSettings) {
  const current = rendition.getContents() as any;
  for (const contents of Array.isArray(current) ? current : [current]) if (contents) applyEpubContent(contents, settings);
}

function epubSpread(settings:ReaderSettings, width:number) { return (settings.pageColumns||1)===2&&width>=760?'always':'none'; }
function epubColumnCount(settings:ReaderSettings, width:number) { return epubSpread(settings,width)==='always'?2:1; }
function epubLayoutKey(settings:ReaderSettings, width:number, height:number) {
  return [width,height,epubColumnCount(settings,width),settings.fontFamily,settings.fontSize,settings.fontWeight,settings.lineHeight,settings.paragraphSpacing,settings.textIndent,settings.imageScale].join(':');
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

function EpubSurface({ book, settings, onProgress, onVisual, onChapterRemaining, onEpubLocations, navigationRef }: { book: BookRecord; settings: ReaderSettings; onProgress: Props['onProgress']; onVisual:(value:{current:number;total:number;label:string})=>void; onChapterRemaining:(value:number|null)=>void; onEpubLocations:Props['onEpubLocations']; navigationRef: React.MutableRefObject<{ next:()=>void; prev:()=>void; display:(target:string)=>void } | null> }) {
  const host = useRef<HTMLDivElement>(null); const bookRef = useRef<any>(null); const renditionRef = useRef<any>(null);
  const settingsRef = useRef(settings); const progressRef = useRef(onProgress); const visualRef = useRef(onVisual); const cacheRef = useRef(onEpubLocations);
  settingsRef.current = settings; progressRef.current = onProgress; visualRef.current = onVisual; cacheRef.current = onEpubLocations;
  const [ready,setReady]=useState(false); const [zoomImage,setZoomImage]=useState<{src:string;alt:string}|null>(null);const zoomOpenRef=useRef(false);
  const pageMapRef=useRef<{key:string;counts:number[];boundaries:number[]}|null>(null); const mapVersionRef=useRef(0);
  const rebuildMapRef=useRef<(()=>void)|null>(null);

  useEffect(() => {
    let active = true; let resizeFrame = 0; let generationTimer = 0; let idleId = 0; let mapTimer=0; let observer: ResizeObserver | undefined; let navigationQueue=Promise.resolve();
    (async () => {
      if (!host.current) return;
      const { default: ePub } = await import('epubjs');
      const instance = ePub(await book.file.arrayBuffer()); bookRef.current = instance; await instance.ready;
      if (book.epubLocations) { try { instance.locations.load(book.epubLocations); } catch (error) { console.error('EPUB locations cache:', error); } }
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
      rendition.hooks.content.register((contents:any) => { void contents.addStylesheet('/reader-fonts.css'); applyEpubContent(contents,settingsRef.current); wireImages(contents); });
      const enqueue=(action:()=>Promise<unknown>)=>{navigationQueue=navigationQueue.then(async()=>{await action()}).catch((error)=>console.error('EPUB navigation:',error));};
      navigationRef.current = { next:()=>enqueue(()=>rendition.next()), prev:()=>enqueue(()=>rendition.prev()), display:(target)=>enqueue(()=>rendition.display(target)) };
      const linearSpine = ((((instance.spine as any)?.spineItems) || []) as any[]).filter((item)=>item.linear!=='no');
      const report = (location:any) => {
        if (!location?.start?.cfi) return;
        syncZoom();
        const currentHost=host.current; const map=pageMapRef.current;
        const columns=currentHost?epubColumnCount(settingsRef.current,currentHost.clientWidth):1;
        const key=currentHost?epubLayoutKey(settingsRef.current,currentHost.clientWidth,currentHost.clientHeight):'';
        const spinePosition=linearSpine.findIndex((item)=>item.index===location.start.index||item.href===location.start.href);
        if(!map||map.key!==key||spinePosition<0){
          onChapterRemaining(null);
          visualRef.current({current:0,total:0,label:'Пересчитываем страницы…'});
          progressRef.current({kind:'epub',cfi:location.start.cfi},book.progress||0);
          return;
        }
        const localPage=Math.max(1,Math.floor(((Number(location.start.displayed?.page)||1)-1)/columns)+1);
        const total=Math.max(1,map.counts.reduce((sum,value)=>sum+value,0));
        const current=Math.max(1,Math.min(total,map.counts.slice(0,spinePosition).reduce((sum,value)=>sum+value,0)+localPage));
        const nextBoundary=map.boundaries.find((page)=>page>current)??(total+1);
        onChapterRemaining(Math.max(0,nextBoundary-current-1));
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
            measureBook=ePub(await book.file.arrayBuffer());await measureBook.ready;if(!active||version!==mapVersionRef.current)return;
            measureRendition=measureBook.renderTo(measureHost,{width,height,flow:'paginated',spread:epubSpread(measuredSettings,width),manager:'default',allowScriptedContent:false});
            applyEpubSettings(measureRendition,measuredSettings);
            measureRendition.hooks.content.register(async(contents:any)=>{await contents.addStylesheet('/reader-fonts.css');applyEpubContent(contents,measuredSettings);await contents.document?.fonts?.ready});
            const measureSpine=((((measureBook.spine as any)?.spineItems)||[]) as any[]).filter((item)=>item.linear!=='no');const counts:number[]=[];
            for(const item of measureSpine){
              if(!active||version!==mapVersionRef.current)return;
              await measureRendition.display(item.href);await new Promise<void>((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
              const location=measureRendition.currentLocation();const pageTotal=Math.max(1,Number(location?.start?.displayed?.total)||1);
              counts.push(Math.max(1,Math.ceil(pageTotal/epubColumnCount(measuredSettings,width))));
            }

            // EPUB-файл (spine item) может содержать сразу несколько настоящих глав.
            // Поэтому границы глав берём из оглавления, а не из displayed.total текущего spine item.
            const tocTargets=flattenToc(book.toc||[])
              .map(({item})=>item.href||item.sectionId||'')
              .filter((target):target is string=>Boolean(target));
            const boundaryPages:number[]=[];
            const measuredColumns=epubColumnCount(measuredSettings,width);
            for(const target of tocTargets){
              if(!active||version!==mapVersionRef.current)return;
              try{
                await measureRendition.display(target);
                await new Promise<void>((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
                const tocLocation=measureRendition.currentLocation();
                const tocSpinePosition=measureSpine.findIndex((item)=>item.index===tocLocation?.start?.index||item.href===tocLocation?.start?.href);
                if(tocSpinePosition<0)continue;
                const tocLocalPage=Math.max(1,Math.floor(((Number(tocLocation?.start?.displayed?.page)||1)-1)/measuredColumns)+1);
                const globalPage=counts.slice(0,tocSpinePosition).reduce((sum,value)=>sum+value,0)+tocLocalPage;
                if(Number.isFinite(globalPage)&&globalPage>=1)boundaryPages.push(globalPage);
              }catch(error){
                console.warn('EPUB TOC boundary:',target,error);
              }
            }
            const boundaries=[...new Set(boundaryPages)].sort((a,b)=>a-b);

            if(active&&version===mapVersionRef.current&&key===epubLayoutKey(settingsRef.current,currentHost.clientWidth,currentHost.clientHeight)){
              pageMapRef.current={key,counts,boundaries};report(rendition.currentLocation());
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
          if (contents) { applyEpubContent(contents, settingsRef.current); wireImages(contents); }
        }
        syncZoom();
      }, 0));
      await rendition.display(book.location?.kind === 'epub' ? book.location.cfi : undefined);
      if (!active) return;
      window.setTimeout(() => {
        if (!active) return;
        const displayedContents = rendition.getContents() as any;
        for (const contents of Array.isArray(displayedContents) ? displayedContents : [displayedContents]) {
          if (contents) applyEpubContent(contents, settingsRef.current);
        }
      }, 50);
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
      if (!book.epubLocations) {
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
    })().catch((error) => console.error('EPUB reader:', error));
    return () => {
      active = false; clearTimeout(generationTimer);clearTimeout(mapTimer);mapVersionRef.current++;rebuildMapRef.current=null;if (idleId && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
      cancelAnimationFrame(resizeFrame); observer?.disconnect(); navigationRef.current = null; renditionRef.current?.destroy(); bookRef.current?.destroy();
    };
  }, [book.id]);

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
  return <div className="epub-surface-wrap" style={{boxSizing:'border-box',padding:`${settings.marginTop}px ${settings.marginRight}px ${settings.marginBottom}px ${settings.marginLeft}px`,background:palette.bg}}><div ref={host} className="epub-surface" aria-label="Текст книги" />{!ready&&<output className="reader-loading" aria-live="polite">Открываем книгу…</output>}{zoomImage&&<ImageZoomOverlay image={zoomImage} onClose={()=>{zoomOpenRef.current=false;setZoomImage(null)}}/>}</div>;
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
  const [chapterRemaining,setChapterRemaining]=useState<number|null>(null);
  const navigationRef=useRef<{next:()=>void;prev:()=>void;display:(target:string)=>void}|null>(null);
  const mobileGestureStart=useRef<{x:number;y:number}|null>(null);
  const suppressTapUntil=useRef(0);
  const progress=book.progress||0;
  const turn=(direction:'next'|'prev')=>navigationRef.current?.[direction]();
  useEffect(()=>setChapterRemaining(null),[book.id]);

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

  return <main className="reader-shell">
    <style>{`
      .mobile-page-zone{display:none}
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
      <div className="reader-page" style={{width:pageWidth}}>{book.format==='epub'?<EpubSurface book={book} settings={settings} onProgress={onProgress} onVisual={setVisual} onChapterRemaining={setChapterRemaining} onEpubLocations={onEpubLocations} navigationRef={navigationRef}/>:<Fb2SurfaceStable book={book} settings={settings} onProgress={onProgress} onVisual={setVisual} navigationRef={navigationRef}/>}</div>
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

    <footer className="reader-bottombar"><Button variant="ghost" size="icon-lg" aria-label="Предыдущая страница" onClick={()=>turn('prev')}><ChevronLeft/></Button><div><span>{visual.total>0?`${visual.label} ${visual.current} из ${visual.total}`:visual.label}{book.format==='epub'&&chapterRemaining!==null?(chapterRemaining===0?' · конец главы':` · в главе ещё ${chapterRemaining} стр.`):''}</span><Progress value={progress} aria-label={`Прочитано ${progress}%`}/><b>{progress}%</b></div><Button variant="ghost" size="icon-lg" aria-label="Следующая страница" onClick={()=>turn('next')}><ChevronRight/></Button></footer>
  </main>;
}
