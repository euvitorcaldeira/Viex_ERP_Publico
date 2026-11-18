import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({title,subtitle,subtitleClassName='',onClose,children,footer}:{title:string;subtitle:string;subtitleClassName?:string;onClose:()=>void;children:ReactNode;footer?:ReactNode}){
 const ref=useRef<HTMLElement>(null); const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;const before=document.body.style.overflow;document.body.style.overflow='hidden';
  const controls=()=>Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')||[]);
  controls()[0]?.focus();
  const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close.current()}if(e.key==='Tab'){const all=controls(),first=all[0],last=all[all.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};
  document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);document.body.style.overflow=before;document.dispatchEvent(new Event('dalex:clear-errors'));previous?.focus()};
 },[]);
 return <div className="overlay"><section ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><p className={`eyebrow ${subtitleClassName}`}>{subtitle}</p><h2 id="modal-title">{title}</h2></div><button className="icon-btn" aria-label="Fechar janela" onClick={onClose}><X/></button></div>{children}{footer&&<div className="modal-footer">{footer}</div>}</section></div>
}
