import { SortableTable } from '../components/SortableTable';
import { useFormError, clearFormErrors } from '../components/useFormError';
import { useState } from 'react';
import { Modal } from '../components/Modal';
import { cents, dateLabel, money, today } from '../format';
import { type State } from './domain';
import { useCapabilities } from '../security/context';
export type Commit=(change:(state:State)=>State,message?:string,options?:{inlineError?:boolean})=>string|null;
export const message=(error:unknown)=>error instanceof Error?error.message:'Não foi possível concluir a operação.';
function describe(value:unknown):string {
 if(!value||typeof value!=='object')return 'Sem registro.';
 const v=value as Record<string,unknown>,parts:string[]=[];
 for(const [key,label] of [['name','Nome'],['role','Função'],['status','Situação'],['stage','Produção'],['notes','Observações'],['divergence','Divergências'],['number','NF']] as const)if(typeof v[key]==='string')parts.push(`${label}: ${v[key]||'—'}`);
 if(typeof v.dailyCents==='number')parts.push(`Diária: ${money(v.dailyCents)}`);
 if(typeof v.amountCents==='number')parts.push(`Valor: ${money(v.amountCents)}`);
 if(typeof v.date==='string')parts.push(`Data: ${dateLabel(v.date)}`);
 if(typeof v.active==='boolean')parts.push(v.active?'Ativo':'Inativo');
 if(typeof v.reversedAt==='string')parts.push('Movimentação desfeita');
 if(v.removed===true)parts.push('Removida do histórico operacional.');
 if(Array.isArray(v.items))parts.push(`Modelos: ${v.items.map((i:{code:string})=>i.code).join(', ')}`);
 return parts.join(' · ')||'Registro preservado.';
}
export function History({state,id}:{state:State;id:string}){const {canViewFinance}=useCapabilities(),rows=state.audit.filter(a=>a.entityId===id).slice().reverse();return <div className="history-list"><h3>Histórico de alterações</h3>{!rows.length&&<p className="footnote">Sem alterações registradas nesta versão.</p>}{rows.map(a=><div key={a.id}><span><b>{a.action}</b><span className="history-author">{a.actor?.name||'Responsável não registrado · legado'}{a.actor?` · ${a.actor.role} · ${a.actor.source==='authenticated'?'autenticado':'perfil demonstrativo'}`:''}</span><details><summary>Detalhes da alteração</summary>{canViewFinance&&<><p>Antes: {describe(a.before)}</p><p>Depois: {describe(a.after)}</p></>}{!!a.changes?.length&&<div className="table-wrap audit-changes"><SortableTable><thead><tr><th>Código</th><th>Quantidade anterior → nova</th>{canViewFinance&&<><th>Unitário cliente anterior → novo</th><th>Total cliente anterior → novo</th><th>Unitário oficina anterior → novo</th><th>Total oficina anterior → novo</th></>}</tr></thead><tbody>{a.changes.map(c=><tr key={c.code}><td>{c.code}</td><td>{c.oldQuantity} → {c.newQuantity}</td>{canViewFinance&&<><td>{money(c.oldClientUnitCents)} → {money(c.newClientUnitCents)}</td><td>{money(c.oldRevenueCents)} → {money(c.newRevenueCents)}</td><td>{money(c.oldWorkshopUnitCents)} → {money(c.newWorkshopUnitCents)}</td><td>{money(c.oldCostCents)} → {money(c.newCostCents)}</td></>}</tr>)}</tbody></SortableTable></div>}{!canViewFinance&&<p>Valores e registros financeiros restritos ao Administrador.</p>}</details></span><small>{new Date(a.at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</small></div>)}</div>}
export function PaymentDialog({title,balance,onClose,onPay,allowAdvance=false}:{title:string;balance:number;onClose:()=>void;onPay:(date:string,amount:number,advance:boolean)=>string|null;allowAdvance?:boolean}){
 const [amount,setAmount]=useState(balance>0?(balance/100).toFixed(2):''),[date,setDate]=useState(today()),[advance,setAdvance]=useState(false),[error,setError]=useFormError();
 return <Modal title={title} subtitle="PAGAMENTO LOCAL DE DEMONSTRAÇÃO" onClose={onClose} footer={<><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={()=>{const err=onPay(date,cents(amount),advance);setError(err||'');if(!err)onClose()}}>Confirmar pagamento</button></>}><div className="modal-body"><p>Saldo atual: <b>{money(balance)}</b></p><div className="form-grid"><label>Data do pagamento<input type="date" value={date} max={today()} onChange={e=>setDate(e.target.value)}/></label><label>Valor do pagamento (R$)<input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label></div>{allowAdvance&&<label className="check-label"><input type="checkbox" checked={advance} onChange={e=>setAdvance(e.target.checked)}/> Registrar como adiantamento</label>}<p className="footnote">{allowAdvance?'Adiantamentos geram crédito e são descontados das próximas diárias.':'O pagamento será distribuído entre as produções selecionadas, sem exceder os saldos.'}</p>{error&&<p className="error" role="alert">{error}</p>}</div></Modal>
}
export function DataHistory({rows}:{rows:{id:string;date:string;description:string;amount:number}[]}){return <div className="table-wrap"><SortableTable><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{dateLabel(r.date)}</td><td>{r.description}</td><td>{money(r.amount)}</td></tr>)}</tbody></SortableTable>{!rows.length&&<div className="empty">Nenhum registro.</div>}</div>}
