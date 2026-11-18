import { type Romaneio, models } from '../domain';
import { seed } from '../data/seed';
import { localRepository } from '../data/repository';
import { type State, type Production, uid } from './domain';
export const storageKey='dalex-prototype-v3';
export function migrateV2(records:Romaneio[]):State {
 const state:State={version:3,records:[],invoices:[],receipts:[],employees:[{id:'employee-ana',name:'Ana · exemplo',role:'Costura',dailyCents:12000,pix:'PIX-DEMONSTRACAO-ANA',active:true},{id:'employee-carla',name:'Carla · exemplo',role:'Acabamento',dailyCents:10000,pix:'PIX-DEMONSTRACAO-CARLA',active:true}],attendance:[],employeePayments:[],workshops:[],workshopPayments:[],audit:[]};
 for(const name of ['Oficina Aurora','Ateliê Horizonte',...records.map(r=>r.workshop)].filter(n=>n.trim()&&n!=='Produção interna'))if(!state.workshops.some(w=>w.name===name))state.workshops.push({id:uid(),name,contact:'Contato de demonstração',pix:'PIX-DEMONSTRACAO',active:true});
 for(const r of records){
  const {invoice,...base}=r;const record:Production={...base,invoiceId:null,pricing:[]};
  if(invoice){const id=uid();record.invoiceId=id;record.pricing=models(r).map(m=>({code:m.code,clientCents:invoice.prices[m.code]||0,kind:'Interna',workshopId:null,workshopCents:0}));
   state.invoices.push({id,number:invoice.number,client:r.client,recordIds:[r.id],issueDate:invoice.issueDate,totalCents:invoice.totalCents,lines:models(r).map(m=>({romaneioId:r.id,code:m.code,description:m.description,quantity:m.quantity,unitCents:invoice.prices[m.code]||0})),installments:invoice.installments.map(({receivedOn,...part})=>part),consolidationAuthorized:false});
   for(const p of invoice.installments)if(p.receivedOn)state.receipts.push({id:uid(),invoiceId:id,installmentId:p.id,date:p.receivedOn,amountCents:p.amountCents,reversedAt:null});
  }
  state.records.push(record);
 }
 return state;
}
export function freshState():State {const state=migrateV2(structuredClone(seed));const ready=state.records.find(r=>r.id==='ROM-003')!;ready.pricing=models({...ready,invoice:null}).map(m=>({code:m.code,clientCents:2500,kind:'Interna',workshopId:null,workshopCents:0}));return state}
export function loadState():State {
 const current=localStorage.getItem(storageKey);
 if(current){const state=JSON.parse(current) as State;if(state.version!==3||!['records','invoices','receipts','employees','attendance','employeePayments','workshops','workshopPayments','audit'].every(key=>Array.isArray(state[key as keyof State])))throw new Error('Os dados V3 não puderam ser lidos. Exporte ou preserve o armazenamento antes de restaurar exemplos.');return state;}
 const previous=localStorage.getItem('dalex-prototype-v2')||localStorage.getItem('dalex-prototype-v1');
 const state=previous?migrateV2(localRepository.list()):freshState();localStorage.setItem(storageKey,JSON.stringify(state));return state;
}
export function saveState(state:State){localStorage.setItem(storageKey,JSON.stringify(state))}
