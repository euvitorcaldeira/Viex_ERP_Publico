import { useScreenPreference } from '../components/screenPreferences';
import { ActionIcon } from '../components/ActionIcon';
import type { Commit } from '../v3/common';
import { sortTableRows, type ColumnSort } from '../components/tableSort';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Pencil, Search, Trash2 } from 'lucide-react';
import { type State, deleteProduction, financiallyLocked, updateProductionInfo, viewRecord } from '../v3/domain';
import { type Romaneio, total } from '../domain';
import { today } from '../format';
import { filterProductions } from './domain';
import { itemDisplayLines, newestRomaneioSort, RomaneioTable, type ItemDisplay } from '../components/RomaneioTable';
export function Records({state,status,onStatus,query,onQuery,onOpen,onEdit,onComplete,commit,itemDisplay,allDates=false}:{state:State;status:string;onStatus:(s:string)=>void;query:string;onQuery:(q:string)=>void;onOpen:(id:string)=>void;onEdit?:(r:Romaneio)=>void;onComplete?:(id:string)=>void;commit:Commit;itemDisplay:ItemDisplay;allDates?:boolean}){
 const [mode,setMode]=useScreenPreference('romaneios:periodo:'+allDates,allDates?'Todas as datas':'Mês'),[month,setMonth]=useScreenPreference('romaneios:mes',today().slice(0,7)),[page,setPage]=useState(1),[size,setSize]=useScreenPreference('romaneios:tamanho',20);
 const [productionStatus,setProductionStatus]=useScreenPreference('romaneios:filtro-status','Todos');
 const [sort,setSort]=useScreenPreference<ColumnSort>('romaneios:ordem:'+status,newestRomaneioSort);
 const period=mode==='Mês'?month:mode,rows=filterProductions(state.records,period,query,status==='Todos'?productionStatus:status),countRows=filterProductions(state.records,period,query,'Todos'),counts={ 'Em fila':countRows.filter(record=>record.stage==='Em fila').length, 'Em produção':countRows.filter(record=>record.stage==='Em produção').length },pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.min(page,pages),slice=sortTableRows([...rows].reverse(),sort,r=>[r.items.map(item=>itemDisplayLines(item,itemDisplay).join(' ')).join(' '),viewRecord(r,state).workshop,total(viewRecord(r,state)),r.receivedOn,r.stage,r.invoiceId?state.invoices.find(invoice=>invoice.id===r.invoiceId)?.number:'Sem NF']).slice((current-1)*size,current*size);
 useEffect(()=>setPage(1),[period,query,status,productionStatus,size,sort]);
 function rowActions(r:Romaneio){
  if(!onEdit)return '—';
  const record=state.records.find(item=>item.id===r.id);
  if(!record)return null;
  const locked=financiallyLocked(record,state);
  return <div className="inline-actions">
   {r.stage==='Em fila'
    ? <ActionIcon label="Iniciar produção" icon={<ArrowRight size={16}/>} onClick={()=>commit(s=>updateProductionInfo(s,r.id,{stage:'Em produção'}),'Produção iniciada.')}/>
    : <>
      <ActionIcon label="Voltar para Em fila" icon={<ArrowLeft size={16}/>} disabled={locked} onClick={()=>{
       if(window.confirm(`Retornar o romaneio ${r.id} para Em fila?`))commit(s=>updateProductionInfo(s,r.id,{stage:'Em fila'}),'Romaneio voltou para a fila.');
      }}/>
      {onComplete&&<ActionIcon label="Concluir produção" icon={<Check size={16}/>} disabled={locked} onClick={()=>onComplete(r.id)}/>}
    </>}
   <ActionIcon label="Editar romaneio" icon={<Pencil size={16}/>} onClick={()=>onEdit(r)}/>
   <ActionIcon label="Excluir romaneio" icon={<Trash2 size={16}/>} danger disabled={locked} onClick={()=>{
    if(window.confirm(`Excluir o romaneio ${r.id}?`))commit(s=>deleteProduction(s,r.id),'Romaneio excluído.');
   }}/>
  </div>;
 }
 const tabOrder=['Em fila','Em produção','Concluído','Todos'];
 return <section className="panel">{state.records.some(r=>!r.receivedOn)&&<div className="notice compact registry-note"><span>Registros de versões anteriores ainda não têm data de recebimento confirmada.</span><button className="text-link" onClick={()=>setMode('Sem data')}>Ver registros sem data</button></div>}<div className="toolbar"><div className="tabs">{tabOrder.map(s=><button key={s} className={status===s?'selected':''} onClick={()=>onStatus(s)}>{s}{s==='Em fila'&&<span className="tab-count">{counts['Em fila']}</span>}{s==='Em produção'&&<span className="tab-count">{counts['Em produção']}</span>}</button>)}</div><label className="search"><Search size={17}/><input aria-label="Pesquisar romaneios" placeholder="Código, pedido ou cliente…" value={query} onChange={e=>onQuery(e.target.value)}/></label></div><div className="toolbar period-toolbar"><label>Período de recebimento<select aria-label="Período dos romaneios" value={mode} onChange={e=>setMode(e.target.value)}><option>Mês</option><option>Todas as datas</option><option>Sem data</option></select></label>{mode==='Mês'&&<label>Mês de recebimento<input aria-label="Mês dos romaneios" type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value)}}/></label>}{status==='Todos'&&<label>Status da produção<select value={productionStatus} onChange={event=>setProductionStatus(event.target.value)}><option>Todos</option><option>Em fila</option><option>Em produção</option><option>Concluído</option></select></label>}<label>Por página<select aria-label="Romaneios por página" value={size} onChange={e=>setSize(Number(e.target.value))}>{[10,20,50].map(n=><option key={n}>{n}</option>)}</select></label></div><RomaneioTable itemDisplay={itemDisplay} sort={sort} onSortChange={setSort} records={slice.map(r=>viewRecord(r,state))} onOpen={r=>onOpen(r.id)} rowActions={(status==='Em fila'||status==='Em produção')?rowActions:undefined} receivedMode/><div className="table-footer pagination"><span>{rows.length} romaneio(s) · {rows.reduce((sum,r)=>sum+total(viewRecord(r,state)),0)} peças · {rows.length?((current-1)*size+1):0}–{Math.min(current*size,rows.length)}</span><div><button className="secondary" disabled={current===1} onClick={()=>setPage(current-1)}>Anterior</button><span>Página {current} de {pages}</span><button className="secondary" disabled={current===pages} onClick={()=>setPage(current+1)}>Próxima</button></div></div></section>
}

