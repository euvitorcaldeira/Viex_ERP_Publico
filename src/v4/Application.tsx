import { useFormError, clearFormErrors } from '../components/useFormError';
import { useEffect, useState } from 'react';
import { ActorContext } from '../security/context';
import { demoActors, canViewFinance, canEditOperations, canAccessPage, assertTransition, stampActor, type Actor } from '../security/policy';
import { LayoutDashboard, Boxes, FileText, Wallet, Users, Factory, Settings, Search, Bell, ChevronLeft, Menu, Sun, Moon, Plus, ArrowUpRight, Check, Download } from 'lucide-react';
import { type Romaneio, stages } from '../domain';
import { Brand } from '../components/Brand';
import { Stat } from '../components/Stat';
import { ReceivableStat } from './ReceivableStat';
import { RomaneioTable } from '../components/RomaneioTable';
import { type State, ready, receivableTotal, unbilledPieceCount, viewRecord } from '../v3/domain';
import { loadState, saveState, freshState } from './store';
import { emptyLocalState, localActor } from '../localApi';
import { type Commit, message } from '../v3/common';
import { RecordForm } from './RecordForm';
import { ProductionDetails } from '../v3/Production';
import { Billing } from '../v3/Billing';
import { FinanceV4 } from './Finance';
import { Records } from './Records';
import { Configuration } from './Configuration';
import { Employees } from '../v3/Employees';
import { Workshops } from '../v3/Workshops';
import { systemDisplayName } from './domain';
import '../style.css';
import '../v3/style.css';
import './style.css';

const pages=['Visão Geral','Romaneios e Produção','Faturamento','Financeiro','Funcionários','Oficinas','Configurações'];
const icons=[LayoutDashboard,Boxes,FileText,Wallet,Users,Factory,Settings];
const pageDescriptions:Record<string,string>={'Visão Geral':'Uma visão tranquila do que acontece na sua operação.','Romaneios e Produção':'Da fila à conclusão. Acompanhe cada lote.','Faturamento':'Produção concluída, valores e registro de notas fiscais.','Financeiro':'Das notas registradas aos recebimentos, sem recadastrar os lotes.'};
export default function Application({localMode=false,onLogout}:{localMode?:boolean;onLogout?:()=>void}={}){
 const [actor,setActor]=useState<Actor>(()=>localMode?localActor():demoActors[0]);
 const canFinance=canViewFinance(actor),canEdit=canEditOperations(actor);
 const [initial]=useState(()=>{try{return {state:loadState(),error:''}}catch(e){return {state:localMode?emptyLocalState():freshState(),error:message(e)}}});
 const [state,setState]=useState<State>(initial.state),[storageBlocked,setStorageBlocked]=useState(!!initial.error),[page,setPage]=useState(pages[0]),[collapsed,setCollapsed]=useState(()=>window.innerWidth<=760),[dark,setDark]=useState(()=>{try{return localStorage.getItem('dalex-theme')==='dark'}catch{return false}});
 const [allDates,setAllDates]=useState(false);
 const [showReceivableTotal,setShowReceivableTotal]=useState(true);
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('Todos'),[creating,setCreating]=useState(false),[editing,setEditing]=useState<Romaneio|undefined>(),[detailId,setDetailId]=useState<string|null>(null),[billId,setBillId]=useState<string|undefined>(),[billingVisit,setBillingVisit]=useState(0),[popover,setPopover]=useState(''),[toast,setToast]=useState(''),[error,setError]=useFormError(initial.error);
 const records=state.records.map(r=>viewRecord(r,state)),detail=state.records.find(r=>r.id===detailId),pending=state.records.filter(r=>ready(r,state)),count=unbilledPieceCount(state),open=receivableTotal(state),displayName=systemDisplayName(state);
 useEffect(()=>{document.title=`VIEX ERP · ${displayName}`},[displayName]);
 const visible=records.filter(r=>(filter==='Todos'||r.stage===filter)&&`${r.id} ${r.client} ${r.workshop} ${r.items.map(i=>`${i.code} ${i.description} ${i.family} ${i.color}`).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
 function notify(text:string){setToast(text);window.setTimeout(()=>setToast(''),4500)}
 const commit:Commit=(change,success,options)=>{try{if(storageBlocked)throw new Error('Armazenamento V4 inválido. Preserve os dados existentes antes de restaurar exemplos em Configurações.');const candidate=change(state);assertTransition(state,candidate,actor);const next=stampActor(state,candidate,actor);saveState(next);setState(next);setError('');if(success)notify(success);return null}catch(e){const text=message(e);setError(options?.inlineError?'':text);return text}};
 function navigate(next:string){setError('');clearFormErrors();if(!canAccessPage(actor,next)){notify('Acesso reservado ao Administrador.');return;}setAllDates(false);setPage(next);setQuery('');setFilter('Todos');setPopover('');setBillId(undefined);setBillingVisit(v=>v+1)}
 function toggleTheme(){setDark(!dark);try{localStorage.setItem('dalex-theme',dark?'light':'dark')}catch{notify('Tema alterado apenas para esta sessão.')}}
 function table(list:Romaneio[]){return <RomaneioTable receivedMode records={list} onOpen={r=>setDetailId(r.id)}/>}
 function openBill(id:string){setDetailId(null);navigate(pages[2]);setBillId(id)}
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='dalex-dados.json';a.click();URL.revokeObjectURL(url)}
 return <ActorContext.Provider value={actor}><div className={dark?'app dark':'app'}><aside className={collapsed?'sidebar collapsed':'sidebar'}><div className="sidebar-top"><button className="sidebar-toggle" onClick={()=>setCollapsed(!collapsed)} aria-label="Recolher ou expandir menu" aria-expanded={!collapsed} title={collapsed?'Expandir menu':'Recolher menu'}>{collapsed?<Menu size={18}/>:<ChevronLeft size={18}/>}</button><Brand compact={collapsed}/></div><div className="workspace">{collapsed?'ERP':displayName}</div><nav>{pages.map((p,i)=>{const Icon=icons[i];return <button key={p} className={page===p?'nav-item active':'nav-item'} onClick={()=>{navigate(p);if(p===pages[1])setFilter('Em produção')}} title={canAccessPage(actor,p)?p:'Acesso reservado ao Administrador'} disabled={!canAccessPage(actor,p)}><Icon size={20}/>{!collapsed&&<span>{p}</span>}</button>})}</nav><div className="sidebar-bottom">{!localMode&&!collapsed&&<div className="demo-card"><span className="live-dot"/> Ambiente de demonstração<small>Explore com dados fictícios.</small></div>}</div></aside>
 <div className="shell"><header><div className="header-page-context"><p className="header-eyebrow">GESTÃO COM CLAREZA</p><div className="header-title-line"><h1>{page}</h1><p className="header-page-description">{pageDescriptions[page]||'Seu espaço para acompanhar e organizar a operação.'}</p></div></div>{canEdit&&<button className="primary header-new-record" aria-label="Novo romaneio" title="Novo romaneio" onClick={()=>{setEditing(undefined);setCreating(true)}}><Plus size={17}/><span>Novo romaneio</span></button>}<label className="search global-search"><Search size={16}/><input aria-label="Busca global de romaneios" placeholder="Pesquisar romaneios…" value={query} onChange={e=>{setPage(pages[1]);setAllDates(!!e.target.value.trim());setQuery(e.target.value);setFilter('Todos')}}/></label><div className="header-actions"><button className="icon-btn" aria-label="Alternar tema" onClick={toggleTheme}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button><button className="icon-btn notification" aria-label="Notificações" onClick={()=>setPopover(popover==='notifications'?'':'notifications')}><Bell size={19}/><i/></button><button className="avatar" aria-label="Perfil" onClick={()=>setPopover(popover==='profile'?'':'profile')}>{actor.name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()}</button></div>{popover&&<div className="popover"><b>{popover==='profile'?(localMode?actor.name:'Perfil de demonstração'):'Seu dia em produção'}</b><p>{popover==='profile'?(localMode?`${actor.role} · acesso local autenticado`:''):`${pending.length} romaneio(s) concluído(s) a faturar.${localMode?'':' Notificações demonstrativas.'}`}</p>{popover==='profile'&&(localMode?<button className="secondary" onClick={onLogout}>Sair da conta</button>:<label>Perfil de teste<select aria-label="Perfil de teste" value={actor.id} onChange={e=>{const next=demoActors.find(a=>a.id===e.target.value)!;setActor(next);setPage(pages[0]);setCreating(false);setEditing(undefined);setDetailId(null);setError('');clearFormErrors();setPopover('')}}>{demoActors.map(a=><option key={a.id} value={a.id}>{a.role} · {a.name}</option>)}</select></label>)}</div>}</header>
 <main>{error&&<p className="error" role="alert">{error}</p>}
 {page===pages[0]&&<><div className="stats"><button className="stat-button" onClick={()=>navigate(pages[1])}><Stat label="Peças não faturadas" value={String(count)} icon={<Boxes/>} note="Exclui romaneios com NF registrada"/></button><button className="stat-button" onClick={()=>{navigate(pages[1]);setFilter('Em produção')}}><Stat label="Em produção" value={String(records.filter(r=>r.stage==='Em produção').length)} icon={<Factory/>} note="Ver os romaneios em andamento"/></button><button className="stat-button" disabled={!canFinance} onClick={()=>navigate(pages[2])}><Stat label="A faturar" value={String(pending.length)} icon={<FileText/>} note="Concluídos, ainda sem NF registrada"/></button><ReceivableStat
   label="Total a receber"
   total={open}
   note="Ver notas e parcelas pendentes"
   visible={showReceivableTotal}
   onToggle={canFinance ? () => setShowReceivableTotal(value => !value) : undefined}
   onActivate={canFinance ? () => navigate(pages[3]) : undefined}
 /></div><div className="overview-grid"><section className="panel"><div className="panel-heading"><div><h2>O ritmo da produção</h2><p>Distribuição atual dos romaneios</p></div></div><div className="flow">{stages.map((s,i)=><button key={s} onClick={()=>{navigate(pages[1]);setFilter(s)}}><span className="flow-number">0{i+1}</span><strong>{records.filter(r=>r.stage===s).length}</strong><span>{s}</span><div className="bar"><i style={{width:(records.filter(r=>r.stage===s).length/Math.max(records.length,1)*100)+'%'}}/></div></button>)}</div></section><section className="focus-card"><span className="focus-icon"><Plus/></span><h2>O próximo lote<br/>começa aqui.</h2><p>Cadastre códigos, modelos e quantidades em um fluxo simples.</p></section></div><section className="panel"><div className="panel-heading"><div><h2>Romaneios recentes</h2><p>Os últimos registros da sua operação</p></div><button className="text-link" onClick={()=>navigate(pages[1])}>Ver romaneios <ArrowUpRight size={16}/></button></div>{table([...records].reverse().slice(0,5))}</section></>}
 {page===pages[1]&&<Records key={billingVisit+'-'+allDates} state={state} status={filter} onStatus={setFilter} query={query} onQuery={setQuery} onOpen={setDetailId} allDates={allDates}/>}
 {canFinance&&page===pages[2]&&<Billing key={billingVisit} state={state} commit={commit} initialId={billId} onOpen={setDetailId}/>}
 {canFinance&&page===pages[3]&&<FinanceV4 state={state} commit={commit} onOpen={setDetailId} showReceivableTotal={showReceivableTotal} onToggleReceivableTotal={()=>setShowReceivableTotal(value=>!value)}/>}
 {canFinance&&page===pages[4]&&<Employees state={state} commit={commit} mode="operations"/>}
 {canFinance&&page===pages[5]&&<Workshops state={state} commit={commit} mode="operations" onOpen={setDetailId}/>}
 {canFinance&&page===pages[6]&&<Configuration state={state} commit={commit} dark={dark} localMode={localMode} onHistoryImported={setState} onUsersChange={users=>setState(current=>({...current,users}))} onTheme={toggleTheme} onExport={download} onReset={()=>{if(window.confirm('Restaurar os exemplos fictícios da V4?')){try{const next=freshState();saveState(next);setState(next);setStorageBlocked(false);setError('');notify('Exemplos V4 restaurados.')}catch(e){setError(message(e))}}}}/>}
 <footer><span>VIEX ERP · {displayName}</span><span>Feito para simplificar a rotina.</span><span className="footer-status">{localMode?'Aplicativo local · SQLite · dados guardados neste computador':'Protótipo interativo · dados fictícios'}</span></footer></main></div>
 {creating&&<RecordForm state={state} initial={editing} commit={commit} localMode={localMode} onClose={saved=>{setCreating(false);if(saved&&!editing)navigate(pages[1]);setEditing(undefined)}}/>}
 {detail&&<ProductionDetails key={detail.id} state={state} id={detail.id} commit={commit} onClose={()=>setDetailId(null)} onEdit={r=>{setDetailId(null);setEditing(r);setCreating(true)}} onBill={openBill}/>}
 {toast&&<div role="status" className="toast"><Check size={18}/>{toast}</div>}
 </div></ActorContext.Provider>
}

