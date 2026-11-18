import { type State, type Execution, uid } from '../v3/domain';
import { loadState as loadV3, freshState as freshV3 } from '../v3/store';
import { today } from '../format';
import { loadLocalState, saveLocalState } from '../localApi';
const isLocalApp=typeof __DALEX_LOCAL__!=='undefined'&&__DALEX_LOCAL__;
export const isSharedDemo=typeof __DALEX_DEMO__!=='undefined'&&__DALEX_DEMO__;
export const storageKey=isSharedDemo?'dalex-public-demo-v4-final':'dalex-prototype-v4';
const memory=new Map<string,string>();
function read(key:string){try{return localStorage.getItem(key)}catch(error){if(!isSharedDemo)throw error;return memory.get(key)||null}}
function write(key:string,value:string){try{localStorage.setItem(key,value)}catch(error){if(!isSharedDemo)throw error;memory.set(key,value)}}
function ensureLocalSettings(state:State):{state:State;changed:boolean}{let changed=false;const employees=state.employees.map(employee=>{if(employee.attendanceStartDate)return employee;changed=true;return {...employee,attendanceStartDate:today()}});const internalWorkshopName=state.internalWorkshopName?.trim()||'D’ALEX';if(internalWorkshopName!==state.internalWorkshopName)changed=true;const systemDisplayName=state.systemDisplayName?.trim()||'D’ALEX';if(systemDisplayName!==state.systemDisplayName)changed=true;const invoiceSummaryPaymentText=state.invoiceSummaryPaymentText===undefined?'PIX 42655411862':state.invoiceSummaryPaymentText;if(invoiceSummaryPaymentText!==state.invoiceSummaryPaymentText)changed=true;return {state:changed?{...state,employees,internalWorkshopName,systemDisplayName,invoiceSummaryPaymentText}:state,changed}}
export function migrateV3(source:State):State {
 const state=structuredClone(source);state.version=4;state.clients||=[];state.users||=[];state.internalWorkshopName=state.internalWorkshopName?.trim()||'D’ALEX';state.systemDisplayName=state.systemDisplayName?.trim()||'D’ALEX';state.invoiceSummaryPaymentText=state.invoiceSummaryPaymentText===undefined?'PIX 42655411862':state.invoiceSummaryPaymentText;state.employees=state.employees.map(employee=>({...employee,attendanceStartDate:employee.attendanceStartDate||today()}));
 state.records=state.records.map(r=>{
  let client=state.clients!.find(c=>c.name.trim().toLocaleLowerCase()===r.client.trim().toLocaleLowerCase());if(!client){client={id:uid(),name:r.client.trim(),active:true};state.clients!.push(client)}
  const external=r.pricing.filter(p=>p.kind==='Terceirizada'),office=state.workshops.find(w=>w.name===r.workshop);
  const execution:Execution=r.execution||(!r.pricing.length?(office?{kind:'Terceirizada',workshopId:office.id}:{kind:'Interna',workshopId:null}):external.length===0?{kind:'Interna',workshopId:null}:external.length===r.pricing.length&&new Set(external.map(p=>p.workshopId)).size===1?{kind:'Terceirizada',workshopId:external[0].workshopId}:{kind:'Mista',workshopId:null});
  return {...r,clientId:client.id,clientOrder:r.clientOrder||'',receivedOn:r.receivedOn||null,execution};
 });return state;
}
export function freshState():State {const state=migrateV3(freshV3());for(const r of state.records){r.receivedOn=isSharedDemo?today():r.date>today()?today():r.date;if(isSharedDemo){r.date=today();if(r.deliveredOn)r.deliveredOn=today()}}if(isSharedDemo)for(const bill of state.invoices){bill.issueDate=today();bill.installments.forEach((p,i)=>{const date=new Date(today()+'T12:00:00');date.setDate(date.getDate()+14*(i+1));p.dueDate=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`})}return state}
export function loadState():State {
 if(isLocalApp){const loaded=loadLocalState(),normalized=ensureLocalSettings(loaded);if(normalized.changed)saveLocalState(normalized.state);return normalized.state}
 const text=read(storageKey);if(text){const state=JSON.parse(text) as State;if(state.version!==4||!['records','invoices','receipts','employees','attendance','employeePayments','workshops','workshopPayments','audit','clients','users'].every(key=>Array.isArray(state[key as keyof State])))throw new Error('Os dados V4 não puderam ser lidos. Preserve o armazenamento antes de restaurar exemplos.');const normalized=ensureLocalSettings(state);if(normalized.changed)saveState(normalized.state);return normalized.state;}
 const prior=!isSharedDemo&&(localStorage.getItem('dalex-prototype-v3')||localStorage.getItem('dalex-prototype-v2')||localStorage.getItem('dalex-prototype-v1'));const state=prior?migrateV3(loadV3()):freshState();saveState(state);return state;
}
export function saveState(state:State){if(isLocalApp){saveLocalState(state);return}write(storageKey,JSON.stringify(state))}
