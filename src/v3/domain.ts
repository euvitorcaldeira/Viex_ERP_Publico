import { models, total, validate, codeKey, validDate, splitInstallments, type Romaneio, type Installment } from '../domain';
import { money, today } from '../format';

export interface Pricing { code:string; clientCents:number; kind:'Interna'|'Terceirizada'; workshopId:string|null; workshopCents:number }
export interface Execution { kind:'Interna'|'Terceirizada'|'Mista'; workshopId:string|null }
export interface Client { id:string; name:string; active:boolean; isDefault?:boolean }
export interface UserProfile { id:string; name:string; email:string; role:'Administrador'|'Operação'|'Consulta'; active:boolean }
export interface Production extends Omit<Romaneio,'invoice'> { invoiceId:string|null; pricing:Pricing[]; clientId?:string; clientOrder?:string; receivedOn?:string|null; execution?:Execution }
export type ProductionInput=Romaneio&Partial<Pick<Production,'clientId'|'clientOrder'|'receivedOn'|'execution'|'pricing'>>&{pricingReentered?:boolean};
export interface InvoiceLine { romaneioId:string; code:string; description:string; quantity:number; unitCents:number }
export interface Bill { id:string; number:string; client:string; recordIds:string[]; issueDate:string; totalCents:number; lines:InvoiceLine[]; installments:Omit<Installment,'receivedOn'>[]; consolidationAuthorized:boolean; taxRateBps?:number; taxCents?:number; taxDueDate?:string; taxPaidAt?:string; taxExempt?:boolean }
export interface Receipt { id:string; invoiceId:string; installmentId:string; date:string; amountCents:number; reversedAt:string|null }
export interface Employee { id:string; name:string; role:string; dailyCents:number; pix:string; active:boolean; attendanceStartDate?:string }
export type AttendanceStatus='Presente'|'Falta'|'Não trabalhado';
export interface Attendance { employeeId:string; date:string; status:AttendanceStatus; dailyCents:number; overtimeCents?:number; earlyDepartureDeductionCents?:number; note?:string }
export interface EmployeePayment { id:string; employeeId:string; date:string; amountCents:number; advance:boolean; groupId:string|null; reversedAt?:string|null }
export interface Workshop { id:string; name:string; contact:string; pix:string; active:boolean }
export interface WorkshopPayment { id:string; workshopId:string; date:string; amountCents:number; allocations:{chargeId:string;amountCents:number}[]; reversedAt?:string|null }
export interface FinancialChange { code:string; oldQuantity:number; newQuantity:number; oldClientUnitCents:number; newClientUnitCents:number; oldRevenueCents:number; newRevenueCents:number; oldWorkshopUnitCents:number; newWorkshopUnitCents:number; oldCostCents:number; newCostCents:number }
export interface Audit { id:string; at:string; entityId:string; action:string; before?:unknown; after?:unknown; actor?:{id:string;name:string;role:string;source:string}; changes?:FinancialChange[] }
export interface BalanceExpense {
 id: string;
 date: string;
 category: string;
 description: string;
 amountCents: number;
 supplier?: string;
 note?: string;
 reversedAt?: string | null;
}
export interface State { version:3|4; records:Production[]; invoices:Bill[]; receipts:Receipt[]; employees:Employee[]; attendance:Attendance[]; employeePayments:EmployeePayment[]; workshops:Workshop[]; workshopPayments:WorkshopPayment[]; audit:Audit[]; clients?:Client[]; users?:UserProfile[]; internalWorkshopName?:string; systemDisplayName?:string; invoiceSummaryPaymentText?:string; balanceExpenses?:BalanceExpense[] }
export const uid=()=>crypto.randomUUID();
export const nextRecordId=(state:State)=>'ROM-'+String(Math.max(0,...[...state.records.map(r=>r.id),...state.audit.map(a=>a.entityId)].filter(id=>/^ROM-\d+$/.test(id)).map(id=>Number(id.split('-')[1])))+1).padStart(3,'0');
const requireThat=(condition:unknown,message:string)=>{if(!condition)throw new Error(message)};
const positive=(n:number)=>Number.isSafeInteger(n)&&n>0;
export function audit(state:State,entityId:string,action:string,before?:unknown,after?:unknown):State {
 return {...state,audit:[...state.audit,{id:uid(),at:new Date().toISOString(),entityId,action,before:structuredClone(before),after:structuredClone(after),actor:{id:'demo-unidentified',name:'Usuário não identificado',role:'Não informado',source:'local'},changes:financialChanges(before,after)}]};
}
export function financialChanges(before:unknown,after:unknown):FinancialChange[]{
 const read=(value:unknown)=>{const r=value as Production|undefined;if(!r||!Array.isArray(r.items))return [];return models(r as unknown as Romaneio).map(m=>{const p=r.pricing?.find(p=>codeKey(p.code)===m.code);return {code:m.code,quantity:m.quantity,client:p?.clientCents||0,workshop:p?.kind==='Terceirizada'?p.workshopCents:0}})};
 const a=read(before),b=read(after),codes=[...new Set([...a,...b].map(x=>x.code))];
 return codes.flatMap(code=>{const old=a.find(x=>x.code===code),next=b.find(x=>x.code===code);if(old&&next&&JSON.stringify(old)===JSON.stringify(next))return [];return [{code,oldQuantity:old?.quantity||0,newQuantity:next?.quantity||0,oldClientUnitCents:old?.client||0,newClientUnitCents:next?.client||0,oldRevenueCents:(old?.quantity||0)*(old?.client||0),newRevenueCents:(next?.quantity||0)*(next?.client||0),oldWorkshopUnitCents:old?.workshop||0,newWorkshopUnitCents:next?.workshop||0,oldCostCents:(old?.quantity||0)*(old?.workshop||0),newCostCents:(next?.quantity||0)*(next?.workshop||0)}]});
}
export function retainedPricing(old:Production|undefined,incoming:ProductionInput):Pricing[]{
 if(!old||old.clientId!==incoming.clientId||old.client!==incoming.client||JSON.stringify(old.execution)!==JSON.stringify(incoming.execution))return [];
 const codes=new Set(incoming.items.map(i=>codeKey(i.code)));return old.pricing.filter(p=>codes.has(codeKey(p.code))).map(p=>({...p}));
}
export function viewRecord(r:Production,state:State):Romaneio {
 const invoice=state.invoices.find(i=>i.id===r.invoiceId);
 const workshop=state.version===4&&r.execution?(r.execution.kind==='Interna'?(state.internalWorkshopName?.trim()||'D’ALEX'):r.execution.kind==='Terceirizada'?state.workshops.find(w=>w.id===r.execution!.workshopId)?.name||r.workshop:r.workshop):r.workshop;
 return {...r,workshop,invoice:invoice?{number:invoice.number,issueDate:invoice.issueDate,totalCents:invoice.totalCents,prices:{},installments:invoice.installments.map(p=>({...p,receivedOn:null}))}:null};
}
export function unbilledPieceCount(state:State):number {
 return state.records.filter(record=>!record.invoiceId).reduce((sum,record)=>sum+total(viewRecord(record,state)),0);
}
export function pricingError(r:Production,state:State,checkActive=false):string|null {
 for(const m of models(viewRecord(r,state))){const p=r.pricing.find(p=>codeKey(p.code)===m.code);
  if(!p||!positive(p.clientCents))return `Informe o valor unitário do cliente para ${m.code}.`;
  if(p.kind==='Terceirizada'&&(!p.workshopId||!positive(p.workshopCents)||!state.workshops.some(w=>w.id===p.workshopId&&(!checkActive||w.active))))return `Informe oficina responsável e custo unitário para ${m.code}.`;
  if(p.kind!=='Interna'&&p.kind!=='Terceirizada')return 'Escolha produção interna ou terceirizada.';
 }
 return null;
}
export const ready=(r:Production,state:State)=>r.stage==='Concluído'&&!r.invoiceId&&!pricingError(r,state);
export function projected(r:Production,state:State){return models(viewRecord(r,state)).reduce((a,m)=>{const p=r.pricing.find(p=>codeKey(p.code)===m.code);return {revenue:a.revenue+m.quantity*(p?.clientCents||0),cost:a.cost+(p?.kind==='Terceirizada'?m.quantity*p.workshopCents:0)}},{revenue:0,cost:0})}
export function financiallyLocked(r:Production,state:State){return !!r.invoiceId||state.workshopPayments.some(p=>!p.reversedAt&&p.allocations.some(a=>a.chargeId.startsWith(r.id+'|')))}
export function saveProduction(state:State,incoming:ProductionInput):State {
 const error=validate(incoming);requireThat(!error,error||'Romaneio inválido.');
 const old=state.records.find(r=>r.id===incoming.id);
 if(state.version===4){
  requireThat(validDate(incoming.receivedOn||'')&&incoming.receivedOn!<=today(),'Informe uma data de recebimento válida até hoje.');
  const client=state.clients?.find(c=>c.id===incoming.clientId);requireThat(client&&(client.active||old?.clientId===client.id)&&incoming.client===client.name,'Selecione um cliente cadastrado e ativo.');
  const execution=incoming.execution;requireThat(execution,'Selecione o local de produção.');
  if(execution!.kind==='Terceirizada')requireThat(state.workshops.some(w=>w.id===execution!.workshopId&&(w.active||old?.execution?.workshopId===w.id)),'Selecione uma oficina cadastrada e ativa.');
  if(execution!.kind==='Mista')requireThat(old?.execution?.kind==='Mista','Produção mista está disponível apenas para preservar registros históricos.');
 }
 if(old&&financiallyLocked(old,state)){
  requireThat(incoming.client===old.client&&JSON.stringify(incoming.items)===JSON.stringify(old.items),'Itens e cliente estão protegidos por NF ou pagamento de oficina. Altere apenas dados não financeiros.');
  requireThat(!old.execution||JSON.stringify(incoming.execution)===JSON.stringify(old.execution),'O local de produção está protegido por NF ou pagamento.');
 }
 const {invoice:legacyInvoice,pricingReentered,...fields}=incoming;
 const contextChanged=!!old&&(old.clientId!==incoming.clientId||old.client!==incoming.client||JSON.stringify(old.execution)!==JSON.stringify(incoming.execution));
 const suppliedPricing=incoming.pricing||[],pricing=pricingReentered?structuredClone(suppliedPricing):contextChanged?[]:suppliedPricing.length?structuredClone(suppliedPricing):retainedPricing(old,incoming),r:Production={...fields,invoiceId:old?.invoiceId||null,pricing,stage:old?.stage||'Em fila'};
 const totals=projected(r,state);requireThat(Number.isSafeInteger(totals.revenue)&&Number.isSafeInteger(totals.cost),'Totais muito grandes.');
 return audit({...state,records:old?state.records.map(x=>x.id===r.id?r:x):[...state.records,r]},r.id,old?'Romaneio editado':'Romaneio cadastrado',old,r);
}
export function deleteProduction(state:State,id:string):State {
 const r=state.records.find(r=>r.id===id);requireThat(r,'Romaneio não encontrado.');requireThat(r!.stage!=='Concluído','Retorne o romaneio para Em produção antes de excluir.');requireThat(!financiallyLocked(r!,state),'Não é permitido excluir romaneio vinculado a NF ou pagamento.');
 return audit({...state,records:state.records.filter(r=>r.id!==id)},id,'Romaneio excluído',r);
}
export function canDeleteBilledTest(state:State,recordId:string):boolean {
 const record=state.records.find(r=>r.id===recordId),invoice=record?.invoiceId?state.invoices.find(i=>i.id===record.invoiceId):undefined;
 return !!record&&!!invoice&&invoice.recordIds.length===1&&invoice.recordIds[0]===recordId&&!record.attachments?.length&&!state.receipts.some(r=>r.invoiceId===invoice.id)&&!state.workshopPayments.some(p=>p.allocations.some(a=>a.chargeId.startsWith(recordId+'|')));
}
export function deleteBilledTest(state:State,recordId:string):State {
 requireThat(canDeleteBilledTest(state,recordId),'Só é possível remover uma NF de teste sem recebimentos, pagamentos de oficina ou anexos e vinculada a um único romaneio.');
 const record=state.records.find(r=>r.id===recordId)!,invoice=state.invoices.find(i=>i.id===record.invoiceId)!;
 const next={...state,records:state.records.filter(r=>r.id!==recordId),invoices:state.invoices.filter(i=>i.id!==invoice.id)};
 return audit(next,invoice.id,'NF e romaneio faturados removidos',{invoice,record},undefined);
}
export function finishProduction(state:State,id:string,pricing:Pricing[]):State {
 const old=state.records.find(r=>r.id===id);requireThat(old,'Romaneio não encontrado.');requireThat(!financiallyLocked(old!,state),'Valores protegidos por NF ou pagamento.');requireThat(old!.stage!=='Em fila','Inicie a produção antes de concluí-la.');
 if(old!.execution&&old!.execution.kind!=='Mista')requireThat(pricing.every(p=>p.kind===old!.execution!.kind&&(p.kind==='Interna'||p.workshopId===old!.execution!.workshopId)),'O tipo e a oficina devem corresponder ao local cadastrado no romaneio.');
 const r={...old!,pricing:pricing.map(p=>({...p,code:codeKey(p.code),workshopId:p.kind==='Interna'?null:p.workshopId,workshopCents:p.kind==='Interna'?0:p.workshopCents})),stage:'Concluído' as const};
 const error=pricingError(r,state,true);requireThat(!error,error||'Preços inválidos.');const amounts=projected(r,state);requireThat(Number.isSafeInteger(amounts.revenue)&&Number.isSafeInteger(amounts.cost),'Totais muito grandes.');
 return audit({...state,records:state.records.map(x=>x.id===id?r:x)},id,'Produção concluída / preços registrados',old,r);
}
export function updateProductionInfo(state:State,id:string,patch:Partial<Pick<Production,'stage'|'deliveredOn'|'divergence'>>):State {
 const old=state.records.find(r=>r.id===id);requireThat(old,'Romaneio não encontrado.');
 if(patch.stage){requireThat(!financiallyLocked(old!,state),'Desfaça o faturamento ou pagamento da oficina antes de retornar a etapa.');requireThat((old!.stage==='Em fila'&&patch.stage==='Em produção')||(old!.stage==='Em produção'&&patch.stage==='Em fila')||(old!.stage==='Concluído'&&patch.stage==='Em produção'),'Transição de produção inválida.');}
 if(patch.deliveredOn)requireThat(validDate(patch.deliveredOn)&&patch.deliveredOn<=today(),'Informe uma data de entrega válida até hoje.');
 const next={...old!,...patch};return audit({...state,records:state.records.map(r=>r.id===id?next:r)},id,'Dados de produção atualizados',old,next);
}
export function billingLines(state:State,ids:string[]):InvoiceLine[]{return ids.flatMap(id=>{const r=state.records.find(r=>r.id===id);if(!r)return [];return models(viewRecord(r,state)).map(m=>({romaneioId:id,code:m.code,description:m.description,quantity:m.quantity,unitCents:r.pricing.find(p=>codeKey(p.code)===m.code)?.clientCents||0}))})}
export function summaryText(lines:InvoiceLine[],paymentText=''):string {
 const grouped=new Map<string,InvoiceLine>();for(const line of lines){const key=[line.code,line.description,line.unitCents].join('|'),prior=grouped.get(key);grouped.set(key,{...line,quantity:(prior?.quantity||0)+line.quantity})}
 const summary=[...grouped.values()].map(l=>`${l.code} - ${l.description.toUpperCase()} - ${l.quantity} PEÇAS - UNI ${money(l.unitCents)} - TOTAL ${money(l.quantity*l.unitCents)}`).join(' | ')+` | VALOR TOTAL: ${money(lines.reduce((s,l)=>s+l.quantity*l.unitCents,0))}`;
 return paymentText.trim()?`${summary} - ${paymentText.trim()}`:summary;
}
export function issueBill(state:State,ids:string[],number:string,issueDate:string,dates:string[],authorized:boolean,taxRateBps=0,taxDueDate=''):State {
 requireThat(ids.length&&new Set(ids).size===ids.length,'Selecione romaneios sem repetição.');
 const records=ids.map(id=>state.records.find(r=>r.id===id));requireThat(records.every(r=>r&&ready(r,state)),'Há romaneio não concluído, sem preço ou já faturado.');
 const clients=new Set(records.map(r=>r!.client.trim().toLowerCase()));requireThat(clients.size===1,'Consolide apenas romaneios do mesmo cliente.');requireThat(ids.length===1||authorized,'Confirme a autorização do cliente para consolidar.');
 requireThat(number.trim()&&validDate(issueDate)&&issueDate<=today(),'Informe número da NF e emissão válida até hoje.');requireThat(!state.invoices.some(i=>i.number.trim().toUpperCase()===number.trim().toUpperCase()),'Número de NF já registrado.');
 requireThat(dates.length&&dates.every(d=>(state.version===4&&!d)||(validDate(d)&&d>=issueDate)),'Informe vencimentos válidos a partir da emissão ou deixe a previsão em branco.');
 requireThat(Number.isInteger(taxRateBps)&&taxRateBps>=0&&taxRateBps<=10000,'Informe uma alíquota entre 0% e 100%.');
 requireThat(!taxDueDate||(validDate(taxDueDate)&&taxDueDate>=issueDate),'Informe uma previsão de imposto válida a partir da emissão.');
 const lines=billingLines(state,ids),totalCents=lines.reduce((s,l)=>s+l.quantity*l.unitCents,0);
 const invoice:Bill={id:uid(),number:number.trim(),client:records[0]!.client,recordIds:ids,issueDate,totalCents,lines:structuredClone(lines),installments:splitInstallments(totalCents,dates.length,dates).map(({receivedOn,...p})=>p),consolidationAuthorized:ids.length>1&&authorized,taxRateBps,taxCents:Math.floor((totalCents*taxRateBps+5000)/10000),taxDueDate,taxPaidAt:'',taxExempt:false};
 const next={...state,invoices:[...state.invoices,invoice],records:state.records.map(r=>ids.includes(r.id)?{...r,invoiceId:invoice.id}:r)};
 return audit(next,invoice.id,'NF registrada e parcelas geradas',undefined,invoice);
}
export function updateInvoiceTax(state:State,invoiceId:string,rateBps:number,dueDate:string):State {
 const invoice=state.invoices.find(i=>i.id===invoiceId);requireThat(invoice,'NF não encontrada.');
 requireThat(Number.isInteger(rateBps)&&rateBps>=0&&rateBps<=10000,'Informe uma alíquota entre 0% e 100%.');
 requireThat(!dueDate||(validDate(dueDate)&&dueDate>=invoice!.issueDate),'Informe uma previsão de imposto válida a partir da emissão.');
 requireThat(!invoice!.taxPaidAt,'A alíquota de um imposto já pago não pode ser alterada.');
 const nextInvoice={...invoice!,taxRateBps:rateBps,taxCents:Math.floor((invoice!.totalCents*rateBps+5000)/10000),taxDueDate:dueDate,taxExempt:false};
 return audit({...state,invoices:state.invoices.map(i=>i.id===invoiceId?nextInvoice:i)},invoiceId,'Apuração de imposto atualizada',invoice,nextInvoice);
}
export function markInvoiceTaxExempt(state:State,invoiceId:string,exempt:boolean):State {
 const invoice=state.invoices.find(i=>i.id===invoiceId);requireThat(invoice,'NF não encontrada.');
 requireThat(!invoice!.taxPaidAt,'Desfaça a baixa do imposto antes de alterar a isenção.');
 requireThat(Boolean(invoice!.taxExempt)!==exempt,exempt?'Esta NF já está marcada como isenta.':'Esta NF já não está marcada como isenta.');
 const nextInvoice=exempt?{...invoice!,taxRateBps:0,taxCents:0,taxDueDate:'',taxPaidAt:'',taxExempt:true}:{...invoice!,taxRateBps:0,taxCents:0,taxDueDate:'',taxPaidAt:'',taxExempt:false};
 return audit({...state,invoices:state.invoices.map(i=>i.id===invoiceId?nextInvoice:i)},invoiceId,exempt?'NF marcada como isenta de imposto':'Isenção de imposto removida',invoice,nextInvoice);
}
export function markInvoiceTaxPaid(state:State,invoiceId:string,date:string,paid:boolean):State {
 const invoice=state.invoices.find(i=>i.id===invoiceId);requireThat(invoice,'NF não encontrada.');
 requireThat((invoice!.taxCents||0)>0,'Informe uma alíquota para registrar o imposto.');
 requireThat(validDate(date)&&date>=invoice!.issueDate&&date<=today(),'Informe uma data de pagamento válida até hoje.');
 requireThat(Boolean(invoice!.taxPaidAt)!==paid,paid?'Este imposto já está marcado como pago.':'Este imposto já está em aberto.');
 const nextInvoice={...invoice!,taxPaidAt:paid?date:''};
 return audit({...state,invoices:state.invoices.map(i=>i.id===invoiceId?nextInvoice:i)},invoiceId,paid?'Imposto pago':'Pagamento de imposto desfeito',invoice,nextInvoice);
}
export const installmentReceived=(state:State,installmentId:string)=>state.receipts.filter(r=>r.installmentId===installmentId&&!r.reversedAt).reduce((s,r)=>s+r.amountCents,0);
export const invoiceOpen=(state:State,invoice:Bill)=>invoice.totalCents-invoice.installments.reduce((s,p)=>s+installmentReceived(state,p.id),0);
export const receivableTotal=(state:State)=>state.invoices.reduce((s,i)=>s+invoiceOpen(state,i),0);
export function receive(state:State,invoiceId:string,installmentId:string,date:string,amountCents:number):State {
 const invoice=state.invoices.find(i=>i.id===invoiceId),part=invoice?.installments.find(p=>p.id===installmentId);requireThat(invoice&&part,'Parcela não encontrada.');
 requireThat(validDate(date)&&date>=invoice!.issueDate&&date<=today(),'Informe recebimento entre a emissão e hoje.');requireThat(positive(amountCents)&&amountCents<=part!.amountCents-installmentReceived(state,installmentId),'Valor inválido ou maior que o saldo da parcela.');
 const receipt:Receipt={id:uid(),invoiceId,installmentId,date,amountCents,reversedAt:null};return audit({...state,receipts:[...state.receipts,receipt]},invoiceId,'Recebimento registrado',undefined,receipt);
}
export function reverseReceipt(state:State,id:string):State {
 const receipt=state.receipts.find(r=>r.id===id);requireThat(receipt&&!receipt.reversedAt,'Recebimento inexistente ou já desfeito.');const after={...receipt!,reversedAt:new Date().toISOString()};
 return audit({...state,receipts:state.receipts.map(r=>r.id===id?after:r)},receipt!.invoiceId,'Recebimento desfeito',receipt,after);
}
export const monthReceipts=(state:State,period:string)=>state.receipts.filter(r=>!r.reversedAt&&r.date.startsWith(period));
export function saveEmployee(state:State,employee:Employee):State {requireThat(employee.name.trim()&&employee.role.trim()&&positive(employee.dailyCents),'Informe nome, função e diária positiva.');const old=state.employees.find(e=>e.id===employee.id),start=employee.attendanceStartDate||(old?.attendanceStartDate||today());requireThat(validDate(start)&&start<=today(),'Informe uma data inicial válida até hoje.');const next={...employee,attendanceStartDate:start};return audit({...state,employees:old?state.employees.map(e=>e.id===next.id?next:e):[...state.employees,next]},next.id,old?'Funcionário atualizado':'Funcionário cadastrado',old,next)}
export function markAttendance(state:State,employeeId:string,date:string,status:AttendanceStatus,overtimeCents?:number,earlyDepartureDeductionCents?:number,note?:string):State {
 const employee=state.employees.find(e=>e.id===employeeId),old=state.attendance.find(a=>a.employeeId===employeeId&&a.date===date);requireThat(employee&&((employee.active&&employeeActivity(state,employee)(date))||old),'Funcionário em pausa nesta data ou inexistente.');requireThat(validDate(date)&&date<=today(),'Informe frequência em data válida até hoje.');
 const overtime=old?.overtimeCents??0,early=old?.earlyDepartureDeductionCents??0,extra=status==='Presente'?(overtimeCents??overtime):0,deduction=status==='Presente'?(earlyDepartureDeductionCents??early):0;requireThat(Number.isSafeInteger(extra)&&extra>=0&&Number.isSafeInteger(deduction)&&deduction>=0,'Informe valores positivos ou zero para hora extra e saída antecipada.');requireThat(deduction<=(old?.dailyCents??employee!.dailyCents)+extra,'O desconto não pode ultrapassar o valor da diária e das horas extras.');const record:Attendance={employeeId,date,status,dailyCents:old?.dailyCents??employee!.dailyCents,overtimeCents:extra,earlyDepartureDeductionCents:deduction,note:note??old?.note??''};const entries=state.attendance.filter(a=>!(a.employeeId===employeeId&&a.date===date));
 return audit({...state,attendance:[...entries,record]},employeeId,'Frequência registrada/corrigida',old,record);
}
export function employeeAttendanceStart(_state:State,employee:Employee):string {
 return employee.attendanceStartDate||today();
}
export function employeeActivity(state: State, employee: Employee) {
 const changes = state.audit.filter(event => event.entityId === employee.id).flatMap(event => {
  const before = event.before as Partial<Employee> | undefined;
  const after = event.after as Partial<Employee> | undefined;
  if (typeof before?.active !== 'boolean' || typeof after?.active !== 'boolean' || before.active === after.active) return [];
  const timestamp = new Date(event.at);
  if (!Number.isFinite(timestamp.getTime())) return [];
  const day = event.at.length === 10 ? event.at : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp);
  return [{ day, at: timestamp.getTime(), before: before.active, active: after.active }];
 }).sort((a, b) => a.at - b.at);
 return (day: string) => {
  let active = changes[0]?.before ?? employee.active;
  for (const change of changes) {
   if (change.day > day) break;
   active = change.active;
  }
  return active;
 };
}
export function employeeActiveOn(state: State, employee: Employee, day: string): boolean {
 return day >= employeeAttendanceStart(state, employee) && employeeActivity(state, employee)(day);
}
export function employeeEarned(state:State,id:string):number {
 const employee=state.employees.find(item=>item.id===id);if(!employee)return 0;
 const entries=state.attendance.filter(item=>item.employeeId===id),dates=new Set(entries.map(item=>item.date));
 let total=entries.filter(item=>item.status==='Presente').reduce((sum,item)=>sum+item.dailyCents+(item.overtimeCents||0)-(item.earlyDepartureDeductionCents||0),0);
 const first=employeeAttendanceStart(state,employee);
 const activeOn = employeeActivity(state, employee);
 for(let cursor=new Date(first+'T12:00:00');cursor<=new Date(today()+'T12:00:00');cursor.setDate(cursor.getDate()+1)){
  const day=`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;
  if(!dates.has(day)&&activeOn(day)&&cursor.getDay()>0&&cursor.getDay()<6)total+=employee.dailyCents;
 }
 return total;
}
export const employeePaid=(s:State,id:string)=>s.employeePayments.filter(p=>p.employeeId===id&&!p.reversedAt).reduce((sum,p)=>sum+p.amountCents,0);
export const employeeBalance=(s:State,id:string)=>employeeEarned(s,id)-employeePaid(s,id);
export function activeEmployeePayroll(state:State){return state.employees.filter(employee=>employee.active).reduce((totals,employee)=>{const balance=employeeBalance(state,employee.id);return {payableCents:totals.payableCents+Math.max(0,balance),creditCents:totals.creditCents+Math.max(0,-balance)}},{payableCents:0,creditCents:0})}
export function payEmployee(state:State,employeeId:string,date:string,amountCents:number,advance=false,groupId:string|null=null):State {
 requireThat(state.employees.some(e=>e.id===employeeId),'Funcionário não encontrado.');requireThat(validDate(date)&&date<=today()&&positive(amountCents),'Informe data válida até hoje e valor positivo.');requireThat(advance||amountCents<=employeeBalance(state,employeeId),'Pagamento excede saldo. Use Adiantamento para antecipar valores.');
 const payment:EmployeePayment={id:uid(),employeeId,date,amountCents,advance,groupId};return audit({...state,employeePayments:[...state.employeePayments,payment]},employeeId,advance?'Adiantamento registrado':'Pagamento de diárias registrado',undefined,payment);
}
export function payGroup(state:State,ids:string[],date:string):State {requireThat(ids.length&&new Set(ids).size===ids.length,'Selecione funcionários sem repetição.');requireThat(ids.every(id=>employeeBalance(state,id)>0),'O fechamento exige saldo positivo para todos os selecionados.');const groupId=uid();return ids.reduce((s,id)=>payEmployee(s,id,date,employeeBalance(s,id),false,groupId),state)}
export function saveWorkshop(state:State,workshop:Workshop):State {requireThat(workshop.name.trim(),'Informe o nome da oficina.');const old=state.workshops.find(w=>w.id===workshop.id);return audit({...state,workshops:old?state.workshops.map(w=>w.id===workshop.id?workshop:w):[...state.workshops,workshop]},workshop.id,old?'Oficina atualizada':'Oficina cadastrada',old,workshop)}
export function workshopCharges(state:State,workshopId:string){return state.records.filter(r=>r.stage==='Concluído').flatMap(r=>models(viewRecord(r,state)).flatMap(m=>{const p=r.pricing.find(p=>codeKey(p.code)===m.code);if(p?.kind!=='Terceirizada'||p.workshopId!==workshopId)return [];const id=[r.id,m.code,workshopId].join('|'),amountCents=m.quantity*p.workshopCents,paid=state.workshopPayments.filter(p=>!p.reversedAt).flatMap(p=>p.allocations).filter(a=>a.chargeId===id).reduce((s,a)=>s+a.amountCents,0);return [{id,recordId:r.id,code:m.code,description:m.description,quantity:m.quantity,unitCents:p.workshopCents,amountCents,paid,open:amountCents-paid}]}))}
export const workshopBalance=(s:State,id:string)=>workshopCharges(s,id).reduce((sum,c)=>sum+c.open,0);
export function payWorkshop(state:State,id:string,date:string,amountCents:number,chargeIds:string[]):State {
 const charges=workshopCharges(state,id).filter(c=>chargeIds.includes(c.id));requireThat(charges.length&&positive(amountCents)&&amountCents<=charges.reduce((s,c)=>s+c.open,0),'Selecione produções e informe um valor até o saldo disponível.');requireThat(validDate(date)&&date<=today(),'Informe uma data de pagamento válida até hoje.');
 let rest=amountCents;const allocations=charges.flatMap(c=>{const paid=Math.min(rest,c.open);rest-=paid;return paid>0?[{chargeId:c.id,amountCents:paid}]:[]});
 const payment:WorkshopPayment={id:uid(),workshopId:id,date,amountCents,allocations};return audit({...state,workshopPayments:[...state.workshopPayments,payment]},id,'Pagamento de oficina registrado',undefined,payment);
}

export function undoBilling(state:State,id:string):State {
 const invoice=state.invoices.find(i=>i.id===id);requireThat(invoice,'NF não encontrada.');
 requireThat(!state.receipts.some(r=>r.invoiceId===id&&!r.reversedAt),'Esta NF possui recebimentos ativos. Estorne todos antes de desfazer o faturamento.');
 requireThat(!invoice!.taxPaidAt,'Desfaça a baixa do imposto antes de desfazer o faturamento.');
 return audit({...state,receipts:state.receipts.filter(r=>r.invoiceId!==id),invoices:state.invoices.filter(i=>i.id!==id),records:state.records.map(r=>r.invoiceId===id?{...r,invoiceId:null}:r)},id,'Faturamento desfeito',invoice,{recordIds:invoice!.recordIds,archivedReceipts:state.receipts.filter(r=>r.invoiceId===id)});
}
