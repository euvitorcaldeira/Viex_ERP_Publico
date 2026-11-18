import { type State } from '../v3/domain';
export type Role='Administrador'|'Operação'|'Consulta';
export interface Actor { id:string; name:string; role:Role; source:'demo'|'authenticated' }
export const demoActors:Actor[]=[{id:'demo-admin',name:'Alex · demonstração',role:'Administrador',source:'demo'},{id:'demo-operation',name:'Equipe · demonstração',role:'Operação',source:'demo'},{id:'demo-consult',name:'Visitante · demonstração',role:'Consulta',source:'demo'}];
export const canViewFinance=(actor:Actor)=>actor.role==='Administrador';
export const canEditOperations=(actor:Actor)=>actor.role==='Administrador'||actor.role==='Operação';
export const canAccessPage=(actor:Actor,page:string)=>canViewFinance(actor)||['Visão Geral','Romaneios e Produção'].includes(page);
export function assertTransition(before:State,next:State,actor:Actor){
 if(!canEditOperations(actor))throw new Error('O perfil Consulta permite somente leitura.');
 if(canViewFinance(actor))return;
 for(const key of ['invoices','receipts','employees','attendance','employeePayments','workshops','workshopPayments','clients','users','internalWorkshopName','systemDisplayName','invoiceSummaryPaymentText','balanceExpenses'] as const)if(JSON.stringify(before[key])!==JSON.stringify(next[key]))throw new Error('Esta operação exige o perfil Administrador.');
 for(const record of next.records){const old=before.records.find(r=>r.id===record.id);if((record.pricing.length&&JSON.stringify(record.pricing)!==JSON.stringify(old?.pricing||[]))||(record.stage==='Concluído'&&old?.stage!=='Concluído'))throw new Error('Preços e conclusão financeira exigem o perfil Administrador.');}
}
export function stampActor(before:State,next:State,actor:Actor):State {return {...next,audit:next.audit.map((entry,index)=>index<before.audit.length?entry:{...entry,actor:{...actor}})}}
