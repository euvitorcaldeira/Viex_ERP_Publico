import type { ReactNode } from 'react';
import type { ColumnSort } from './tableSort';
import { SortableTable } from './SortableTable';
import { type Romaneio, total } from '../domain';
import { dateLabel, stageClass } from '../format';
export const newestRomaneioSort: ColumnSort = { column: 3, direction: 'desc' };
export const itemDisplayOptions = {
  code: 'Somente código',
  item: 'Somente item',
  family: 'Somente família',
  familyFirst: 'Família, com item e código abaixo',
  familyCode: 'Família, com código abaixo',
  codeFamily: 'Código, com família abaixo',
  codeFirst: 'Código, com item e família abaixo',
  itemFirst: 'Item, com código e família abaixo',
  codeFamilyFirst: 'Código e família, com descrição abaixo',
  singleLine: 'Código, item e família na mesma linha',
} as const;
export type ItemDisplay = keyof typeof itemDisplayOptions;

export function itemDisplayLines(item: Romaneio['items'][number], mode: ItemDisplay) {
  switch(mode) {
    case 'code': return [item.code];
    case 'item': return [item.description];
    case 'family': return [item.family];
    case 'familyFirst': return [item.family, [item.description,item.code].filter(Boolean).join(' · ')];
    case 'codeFamilyFirst': return [[item.code,item.family].filter(Boolean).join(' · '), item.description];
    case 'itemFirst': return [item.description, [item.code,item.family].filter(Boolean).join(' · ')];
    case 'singleLine': return [[item.code,item.description,item.family].filter(Boolean).join(' · ')];
    case 'familyCode': return [item.family, item.code];
    case 'codeFamily': return [item.code, item.family];
    case 'codeFirst': return [item.code, [item.description,item.family].filter(Boolean).join(' · ')];
  }
}

export function RomaneioTable({records,onOpen,receivedMode=false,sort,onSortChange,rowActions,itemDisplay='codeFirst'}:{records:Romaneio[];onOpen:(r:Romaneio)=>void;receivedMode?:boolean;itemDisplay?:ItemDisplay;rowActions?:(r:Romaneio)=>ReactNode;sort?:ColumnSort|null;onSortChange?:(sort:ColumnSort)=>void}){return <div className="table-wrap"><SortableTable sort={sort} defaultSort={newestRomaneioSort} onSortChange={onSortChange}><thead><tr><th>{({code:'Código',item:'Item',family:'Família',familyFirst:'Família / Item',familyCode:'Família / Código',codeFamily:'Código / Família',codeFirst:'Código / Item',itemFirst:'Item / Código',codeFamilyFirst:'Código / Família',singleLine:'Código / Item / Família'})[itemDisplay]}</th><th>Oficina</th><th>Peças</th><th>{receivedMode?'Recebimento':'Data prevista'}</th><th>Produção</th><th>{rowActions?'Ações':'NF / Entrega'}</th></tr></thead><tbody>{records.map(r=>{const items=[...new Map(r.items.map(item=>[item.code.trim().toLocaleUpperCase(),item])).values()];return <tr key={r.id}><td className="record-items-cell">{items.length?items.slice(0,2).map(item=>{const [title,subtitle]=itemDisplayLines(item,itemDisplay);return <button key={item.id||item.code} className="record-item-link" title={`${item.code} · ${item.description}${item.family?` · ${item.family}`:''} · ${r.client}`} onClick={()=>onOpen(r)}><b>{title||'—'}</b>{subtitle&&<span>{subtitle}</span>}</button>}):<button className="record-item-link" onClick={()=>onOpen(r)}><b>Ver itens</b><span>{r.client}</span></button>}{items.length>2&&<small className="record-items-more">+{items.length-2} itens</small>}</td><td>{r.workshop}</td><td>{total(r)}</td><td>{receivedMode?((r as Romaneio&{receivedOn?:string|null}).receivedOn?dateLabel((r as Romaneio&{receivedOn:string}).receivedOn):'Não informada · V3'):dateLabel(r.date)}</td><td><span className={'badge '+stageClass(r.stage)}>{r.stage}</span></td><td>{rowActions?rowActions(r):<><span>{r.invoice?`NF ${r.invoice.number}`:'Sem NF'}</span><small>{r.deliveredOn?`Entregue em ${dateLabel(r.deliveredOn)}`:'Entrega não registrada'}</small></>}</td></tr>})}</tbody></SortableTable>{!records.length&&<div className="empty">Nenhum romaneio encontrado para este filtro.</div>}</div>}
