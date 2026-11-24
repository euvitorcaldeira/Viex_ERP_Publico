import { type State, type Client, type UserProfile, type Execution, audit, uid, type Production } from '../v3/domain';
import { validDate } from '../domain';
export const internalWorkshopName=(state:State)=>state.internalWorkshopName?.trim()||'D’ALEX';
export const systemDisplayName=(state:State)=>state.systemDisplayName?.trim()||'D’ALEX';
export const invoiceSummaryPaymentText=(state:State)=>state.invoiceSummaryPaymentText===undefined?'PIX 42655411862':state.invoiceSummaryPaymentText;
export function executionLabel(state:State,execution?:Execution){return !execution||execution.kind==='Interna'?internalWorkshopName(state):execution.kind==='Mista'?'Produção mista · histórico V3':state.workshops.find(w=>w.id===execution.workshopId)?.name||'Oficina não disponível'}
export function saveInternalWorkshopName(state:State,value:string):State{
 const name=value.trim(),current=internalWorkshopName(state);
 if(!name)throw new Error('Informe o nome da oficina interna.');
 if(name.length>48)throw new Error('Use até 48 caracteres para o nome da oficina interna.');
 if(name===current)return state;
 return audit({...state,internalWorkshopName:name},'settings:internalWorkshopName','Nome da oficina interna alterado',current,name);
}
export function saveSystemDisplayName(state:State,value:string):State{
 const name=value.trim(),current=systemDisplayName(state);
 if(!name)throw new Error('Informe o nome de exibição do sistema.');
 if(name.length>48)throw new Error('O nome do sistema deve ter até 48 caracteres.');
 if(name===current)return state;
 return audit({...state,systemDisplayName:name},'settings:systemDisplayName','Nome de exibição do sistema alterado',current,name);
}
export function saveInvoiceSummaryPaymentText(state:State,value:string):State{
 const text=value.trim(),current=invoiceSummaryPaymentText(state);
 if(text.length>120)throw new Error('O complemento do resumo da NF deve ter até 120 caracteres.');
 if(text===current)return state;
 return audit({...state,invoiceSummaryPaymentText:text},'settings:invoiceSummaryPaymentText','Complemento do resumo da NF alterado',current,text);
}
export function saveClient(state:State,client:Client):State {
 const name=client.name.trim();if(!name)throw new Error('Informe o nome do cliente.');if(state.clients?.some(c=>c.id!==client.id&&c.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error('Já existe um cliente com este nome.');
 const old=state.clients?.find(c=>c.id===client.id),next={...client,name};
 const clients=old?state.clients!.map(c=>c.id===client.id?next:c):[...(state.clients||[]),next];
 const normalized=next.isDefault?clients.map(item=>({...item,isDefault:item.id===next.id})):clients;
 return audit({...state,clients:normalized,records:state.records.map(r=>r.clientId===client.id?{...r,client:name}:r)},client.id,old?'Cliente atualizado':'Cliente cadastrado',old,next);
}
export function saveUser(state:State,user:UserProfile):State {
 const next={...user,name:user.name.trim(),email:user.email.trim().toLowerCase()};if(!next.name||!/^\S+@\S+\.\S+$/.test(next.email))throw new Error('Informe nome e e-mail válido.');if(state.users?.some(u=>u.id!==next.id&&u.email===next.email))throw new Error('E-mail já cadastrado.');
 const old=state.users?.find(u=>u.id===next.id);return audit({...state,users:old?state.users!.map(u=>u.id===next.id?next:u):[...(state.users||[]),next]},next.id,old?'Usuário demonstrativo atualizado':'Usuário demonstrativo cadastrado',old,next);
}
export function updateDueDate(state:State,invoiceId:string,partId:string,date:string):State {
 const invoice=state.invoices.find(i=>i.id===invoiceId),part=invoice?.installments.find(p=>p.id===partId);if(!invoice||!part)throw new Error('Parcela não encontrada.');if(date&&(!validDate(date)||date<invoice.issueDate))throw new Error('Informe previsão válida a partir da emissão ou deixe em branco.');
 const next={...invoice,installments:invoice.installments.map(p=>p.id===partId?{...p,dueDate:date}:p)};
 return audit({...state,invoices:state.invoices.map(i=>i.id===invoice.id?next:i)},invoice.id,'Previsão de pagamento alterada',{parcela:partId,date:part.dueDate},{parcela:partId,date});
}
export function reverseEmployeePayment(state:State,id:string,wholeGroup=false):State {
 const payment=state.employeePayments.find(p=>p.id===id);if(!payment||payment.reversedAt)throw new Error('Pagamento inexistente ou já desfeito.');
 const entries=wholeGroup&&payment.groupId?state.employeePayments.filter(p=>p.groupId===payment.groupId&&!p.reversedAt):[payment];
 return entries.reduce((next,p)=>{const after={...p,reversedAt:new Date().toISOString()};return audit({...next,employeePayments:next.employeePayments.map(x=>x.id===p.id?after:x)},p.employeeId,wholeGroup?'Fechamento de funcionários desfeito':'Pagamento de funcionário desfeito',p,after)},state);
}
export function reverseWorkshopPayment(state:State,id:string):State {
 const payment=state.workshopPayments.find(p=>p.id===id);if(!payment||payment.reversedAt)throw new Error('Pagamento inexistente ou já desfeito.');const after={...payment,reversedAt:new Date().toISOString()};return audit({...state,workshopPayments:state.workshopPayments.map(p=>p.id===id?after:p)},payment.workshopId,'Pagamento de oficina desfeito',payment,after);
}
export type FinancialSort='Maior valor'|'Menor valor'|'Número da NF'|'Previsão mais próxima'|'Previsão mais distante';
export function compareFinancial(a:{number:string;amount:number;date:string},b:{number:string;amount:number;date:string},sort:FinancialSort){
 if(sort==='Número da NF')return a.number.localeCompare(b.number,'pt-BR',{numeric:true});
 if(sort==='Maior valor'||sort==='Menor valor')return (a.amount-b.amount)*(sort==='Maior valor'?-1:1);
 if(!a.date||!b.date)return a.date?-1:b.date?1:0;
 return a.date.localeCompare(b.date)*(sort==='Previsão mais distante'?-1:1);
}
export function filterProductions(records:Production[],period:string,query:string,status:string){return records.filter(r=>(status==='Todos'||r.stage===status)&&(period==='Todas as datas'||(period==='Sem data'?!r.receivedOn:r.receivedOn?.startsWith(period)))&&`${r.id} ${r.clientOrder||''} ${r.client} ${r.workshop} ${r.items.map(i=>`${i.code} ${i.description} ${i.family} ${i.color}`).join(' ')}`.toLowerCase().includes(query.toLowerCase()))}
export const weekday=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'});

export const defaultAttendanceStatus=(date:string)=>{const day=new Date(date+'T12:00:00').getDay();return day===0||day===6?'Não trabalhado':'Presente'};
export const weekDates=(date:string)=>{const base=new Date(date+'T12:00:00');return Array.from({length:7},(_,index)=>{const day=new Date(base);day.setDate(base.getDate()-base.getDay()+index);return `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`})};
