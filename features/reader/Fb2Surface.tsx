/* oxlint-disable react-hooks/exhaustive-deps, react/react-compiler, typescript/no-explicit-any */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { BookRecord, ReaderLocation, ReaderSettings } from '@/types/books';

type Navigation = { next: () => void; prev: () => void; display: (target: string) => void };
type Props = {
  book: BookRecord; settings: ReaderSettings;
  onProgress: (location: ReaderLocation, progress: number) => void;
  onVisual: (value: { current: number; total: number; label: string }) => void;
  navigationRef: React.RefObject<Navigation | null>;
};

const themeColors: Record<string, { bg: string; text: string }> = {
  light:{bg:'#ffffff',text:'#25201d'},cream:{bg:'#fffaf0',text:'#3c2b22'},sepia:{bg:'#f1dfbd',text:'#49301f'},
  gray:{bg:'#e7e9eb',text:'#25292c'},dark:{bg:'#292522',text:'#eee7da'},black:{bg:'#080808',text:'#efefef'},
};

function colors(settings: ReaderSettings) {
  return settings.theme === 'custom' ? { bg: settings.customBackground, text: settings.customText } : themeColors[settings.theme] || themeColors.cream;
}

function prepare(book: BookRecord) {
  const images = { ...book.fb2Images };
  const legacy = new Map<string, string>();
  const html = (book.fb2Html || '').replace(/\ssrc=(['"])(data:image\/[\s\S]*?)\1/gi, (_match, _quote, source:string) => {
    let id = legacy.get(source);
    if (!id) { id = `legacy-${legacy.size}`; legacy.set(source, id); images[id] = source; }
    return ` data-fb2-image="${id}"`;
  });
  const shell = document.createElement('div'); shell.innerHTML = html;
  const onlySection = shell.children.length === 1 && shell.firstElementChild?.matches('section[data-fb2-section]') ? shell.firstElementChild : shell;
  const chunks:string[]=[]; let current='';
  for (const node of Array.from(onlySection.childNodes)) {
    const value = node.nodeType === Node.ELEMENT_NODE ? (node as Element).outerHTML : node.textContent || '';
    if (current && current.length + value.length > 48_000) { chunks.push(`<section data-fb2-chunk>${current}</section>`); current=''; }
    current += value;
  }
  if (current) chunks.push(`<section data-fb2-chunk>${current}</section>`);
  return { chunks: chunks.length ? chunks : [html], images };
}

function hydrateImages(html:string, images:Record<string,string>) {
  return html.replace(/data-fb2-image="([^"]+)"/g,(attribute,id:string)=>images[id]?`src="${images[id]}" ${attribute}`:attribute);
}

function waitImages(root:{querySelectorAll:<T extends Element = Element>(selectors:string)=>NodeListOf<T>}) {
  const pending:Promise<void>[]=[];
  for(const image of Array.from(root.querySelectorAll<HTMLImageElement>('img[data-fb2-image]'))){
    if(!image.complete)pending.push(new Promise((resolve)=>{image.addEventListener('load',()=>resolve(),{once:true});image.addEventListener('error',()=>resolve(),{once:true})}));
  }
  return Promise.all(pending);
}

export function Fb2SurfaceStable({book,settings,onProgress,onVisual,navigationRef}:Props) {
  const viewport=useRef<HTMLDivElement>(null); const article=useRef<HTMLElement>(null);
  const prepared=useMemo(()=>prepare(book),[book.id,book.fb2Html,book.fb2Images]);
  const initialRatio=book.location?.kind==='fb2'?book.location.ratio:0;
  const initialChunk=book.location?.kind==='fb2'&&book.location.sectionId?.startsWith('fb2-chunk-')?Number(book.location.sectionId.slice(10)):Math.floor(initialRatio*prepared.chunks.length);
  const initialOffset=book.location?.kind==='fb2'&&book.location.offset!==undefined?book.location.offset:Math.max(0,Math.min(1,initialRatio*prepared.chunks.length-initialChunk));
  const safeInitialChunk=Math.max(0,Math.min(prepared.chunks.length-1,initialChunk));
  const locatorRef=useRef({chunk:safeInitialChunk,offset:Math.max(0,Math.min(1,initialOffset))});
  const [position,setPosition]=useState({index:0,chunk:safeInitialChunk,page:0}); const positionRef=useRef(position);positionRef.current=position;
  const [width,setWidth]=useState(1); const [height,setHeight]=useState(1); const [ready,setReady]=useState(false); const [counts,setCounts]=useState<{key:string;values:number[]}|null>(null);const countsRef=useRef(counts);countsRef.current=counts;const layoutKeyRef=useRef('');
  const compact=width<600; const left=compact?Math.min(settings.marginLeft,Math.max(12,width*.07)):settings.marginLeft; const right=compact?Math.min(settings.marginRight,Math.max(12,width*.07)):settings.marginRight;
  const top=compact?Math.min(settings.marginTop,Math.max(12,height*.045)):settings.marginTop; const bottom=compact?Math.min(settings.marginBottom,Math.max(12,height*.045)):settings.marginBottom;
  const columns=!compact&&(settings.pageColumns||1)===2?2:1; const gap=left+right;
  const textWidth=Math.max(1,columns===2?(width-left-right-gap)/2:width-left-right); const contentHeight=Math.max(1,height-top-bottom); const palette=colors(settings);
  const layoutKey=`${width}:${height}:${textWidth}:${contentHeight}:${gap}:${settings.fontFamily}:${settings.fontSize}:${settings.fontWeight}:${settings.lineHeight}:${settings.paragraphSpacing}:${settings.textIndent}:${settings.imageScale}:${columns}`;
  const imageHeight=settings.imageScale==='compact'?Math.round(contentHeight*.62):settings.imageScale==='large'?contentHeight:Math.round(contentHeight*.82);
  layoutKeyRef.current=layoutKey;
  const currentHtml=useMemo(()=>hydrateImages(prepared.chunks[position.chunk],prepared.images),[prepared,position.chunk]);
  const articleStyle:React.CSSProperties & Record<string,string|number>={top,height:contentHeight,width:textWidth,transform:`translateX(${left-position.page*width}px)`,columnWidth:textWidth,columnGap:gap,color:palette.text,background:palette.bg,fontFamily:settings.fontFamily,fontSize:settings.fontSize,fontWeight:settings.fontWeight,lineHeight:settings.lineHeight,textAlign:settings.alignment,maxWidth:'none','--paragraph-gap':`${settings.paragraphSpacing}px`,'--text-indent':`${settings.textIndent}px`,'--image-height':`${imageHeight}px`};

  const locate=(index:number,values:number[])=>{
    const total=Math.max(1,values.reduce((sum,value)=>sum+value,0));const safe=Math.max(0,Math.min(total-1,index));let start=0;
    for(let chunk=0;chunk<values.length;chunk++){const end=start+values[chunk];if(safe<end)return{index:safe,chunk,page:safe-start};start=end}
    const chunk=Math.max(0,values.length-1);return{index:total-1,chunk,page:Math.max(0,(values[chunk]||1)-1)};
  };
  const applyIndex=(index:number,values:number[])=>{const next=locate(index,values);positionRef.current=next;setPosition(next)};

  useEffect(()=>{const observer=new ResizeObserver(([entry])=>{setWidth(Math.max(1,Math.floor(entry.contentRect.width)));setHeight(Math.max(1,Math.floor(entry.contentRect.height)))});if(viewport.current)observer.observe(viewport.current);return()=>observer.disconnect()},[]);
  useEffect(()=>{let active=true;setReady(false);void waitImages(article.current||document).then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(active)setReady(true)})));return()=>{active=false}},[position.chunk,currentHtml,layoutKey]);

  useEffect(()=>{
    if(width<=1)return;let active=true;const previous=countsRef.current;if(previous?.key&&previous.values.length){const current=locate(positionRef.current.index,previous.values);locatorRef.current={chunk:current.chunk,offset:previous.values[current.chunk]<=1?0:current.page/(previous.values[current.chunk]-1)}}setCounts(null);countsRef.current=null;const measure=document.createElement('article');measure.className='fb2-columns';Object.assign(measure.style,articleStyle,{position:'fixed',visibility:'hidden',pointerEvents:'none',left:'-100000px',top:'0',transform:'none'});document.body.appendChild(measure);
    const run=async()=>{const result:number[]=[];for(const html of prepared.chunks){if(!active)return;measure.innerHTML=hydrateImages(html,prepared.images);await waitImages(measure);await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));result.push(Math.max(1,Math.round((measure.scrollWidth+gap)/width)));await new Promise(resolve=>setTimeout(resolve,0))}if(active)setCounts({key:layoutKey,values:result})};void run().finally(()=>measure.remove());return()=>{active=false;measure.remove()};
  },[prepared,layoutKey]);

  useEffect(()=>{const values=counts?.key===layoutKey?counts.values:null;if(!values||values.length!==prepared.chunks.length){onVisual({current:0,total:0,label:'Пересчитываем страницы…'});return}const locator=locatorRef.current;const chunk=Math.max(0,Math.min(values.length-1,locator.chunk));const page=Math.round(Math.max(0,Math.min(1,locator.offset))*Math.max(0,values[chunk]-1));const index=values.slice(0,chunk).reduce((sum,value)=>sum+value,0)+page;applyIndex(index,values)},[counts,layoutKey]);
  useEffect(()=>{if(!ready)return;const values=counts?.key===layoutKey?counts.values:null;if(!values||values.length!==prepared.chunks.length)return;const total=Math.max(1,values.reduce((sum,value)=>sum+value,0));const current=Math.max(1,Math.min(total,position.index+1));const chunkPages=Math.max(1,values[position.chunk]||1);const offset=chunkPages<=1?0:position.page/(chunkPages-1);locatorRef.current={chunk:position.chunk,offset};const ratio=total>1?(current-1)/(total-1):0;const progress=Math.max(0,Math.min(100,Math.round(current/total*100)));onVisual({current,total,label:'Страница'});onProgress({kind:'fb2',ratio,sectionId:`fb2-chunk-${position.chunk}`,offset},progress)},[position,counts,ready,layoutKey]);
  useEffect(()=>{const move=(delta:number)=>{const map=countsRef.current;if(!map||map.key!==layoutKeyRef.current)return;applyIndex(positionRef.current.index+delta,map.values)};navigationRef.current={next:()=>move(1),prev:()=>move(-1),display:(target)=>{const map=countsRef.current;if(!map||map.key!==layoutKeyRef.current)return;const chunk=prepared.chunks.findIndex(value=>value.includes(`id="${target}"`));if(chunk>=0)applyIndex(map.values.slice(0,chunk).reduce((sum,value)=>sum+value,0),map.values)}};return()=>{navigationRef.current=null}},[prepared]);

  return <div ref={viewport} className="fb2-viewport" data-fb2-assets={Object.keys(prepared.images).length} style={{background:palette.bg}}><article ref={article} className="fb2-columns" style={articleStyle} dangerouslySetInnerHTML={{__html:currentHtml}} />{!ready&&<output className="reader-loading" aria-live="polite">Подготавливаем страницы…</output>}</div>;
}
