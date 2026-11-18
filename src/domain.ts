export const stages = ['Em fila', 'Em produção', 'Concluído'] as const;
export type Stage = typeof stages[number];
export const grids = {
  'Numérico adulto': ['34','36','38','40','42','44','46'],
  'Letras': ['PP','P','M','G','GG','XG'],
  'Infantil': ['2','4','6','8','10','12','14','16'],
  'Calçados': ['33','34','35','36','37','38','39','40','41','42','43','44'],
  'Personalizada': ['P','M','G'],
  'Sem grade': ['Único'],
};
export type GridName = keyof typeof grids;
export interface SizeQuantity { size: string; quantity: number }
export interface Item { id: string; code: string; description: string; family: string; color: string; grid: GridName; sizes: SizeQuantity[] }
export interface Installment { id: string; dueDate: string; amountCents: number; receivedOn: string | null }
export interface Invoice { number: string; issueDate: string; prices: Record<string, number>; totalCents: number; installments: Installment[] }
export interface Romaneio { id: string; client: string; workshop: string; date: string; notes: string; items: Item[]; stage: Stage; attachments: string[]; divergence: string; deliveredOn: string | null; invoice: Invoice | null }
export interface RomaneioRepository { list(): Romaneio[]; save(records: Romaneio[]): void }
export const codeKey = (code: string) => code.trim().toUpperCase();
export const itemTotal = (item: Item) => item.sizes.reduce((sum,s) => sum + s.quantity, 0);
export const total = (r: Romaneio) => r.items.reduce((sum,i) => sum + itemTotal(i), 0);
export const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export function newItem(): Item { return { id: crypto.randomUUID(), code:'', description:'', family:'', color:'', grid:'Numérico adulto', sizes: grids['Numérico adulto'].map(size=>({size,quantity:0})) }; }
export function newRomaneio(records: Romaneio[]): Romaneio {
  return { id:'ROM-'+String(Math.max(0,...records.map(r=>Number(r.id.split('-')[1])||0))+1).padStart(3,'0'), client:'',workshop:'',date:'',notes:'',items:[newItem()],stage:'Em fila',attachments:[],divergence:'',deliveredOn:null,invoice:null };
}
export function validate(r: Romaneio): string | null {
  if (!r.client.trim() || !r.workshop.trim() || !validDate(r.date)) return 'Informe cliente, oficina e uma data prevista válida.';
  if (!r.items.length) return 'Adicione pelo menos um modelo.';
  const descriptions = new Map<string,string>();
  for (const item of r.items) {
    if (!item.code.trim() || !item.description.trim()) return 'Preencha o código e a descrição de cada modelo.';
    if (!item.sizes.length || item.sizes.some(s=>!s.size.trim() || !Number.isSafeInteger(s.quantity) || s.quantity<0) || !Number.isSafeInteger(itemTotal(item)) || itemTotal(item)<=0) return 'Informe quantidades inteiras, sem valores negativos, e pelo menos uma peça por modelo/cor.';
    if (new Set(item.sizes.map(s=>s.size.trim().toUpperCase())).size!==item.sizes.length) return 'Não repita tamanhos na mesma grade.';
    const key=codeKey(item.code), description=item.description.trim().toLowerCase();
    if(descriptions.has(key)&&descriptions.get(key)!==description) return 'Use a mesma descrição para o mesmo código de produto.';
    descriptions.set(key,description);
  }
  if(!Number.isSafeInteger(total(r))) return 'A quantidade total é muito grande.';
  return null;
}
export function models(r: Romaneio) {
  const result=new Map<string,{code:string;description:string;quantity:number}>();
  r.items.forEach(item=>{const code=codeKey(item.code), old=result.get(code);result.set(code,{code,description:item.description,quantity:(old?.quantity||0)+itemTotal(item)})});
  return [...result.values()];
}
export function invoiceTotal(r: Romaneio, prices: Record<string,number>) { return models(r).reduce((sum,m)=>sum+m.quantity*(prices[m.code]||0),0); }
export function splitInstallments(totalCents:number,count:number,dueDates:string[]): Installment[] {
  if(!Number.isSafeInteger(totalCents)||totalCents<=0||!Number.isInteger(count)||count<1||count>12||totalCents<count) throw new Error('Informe um total positivo e de 1 a 12 parcelas, de pelo menos um centavo cada.');
  return Array.from({length:count},(_,i)=>({id:crypto.randomUUID(),amountCents:Math.floor(totalCents/count)+(i<totalCents%count?1:0),dueDate:dueDates[i]||'',receivedOn:null}));
}
export function validateInvoice(r:Romaneio,invoice:Invoice,records:Romaneio[]): string|null {
  if(r.stage!=='Concluído')return 'Conclua a produção antes de faturar.';
  if(r.invoice)return 'Este romaneio já possui NF registrada.';
  if(!invoice.number.trim()||!validDate(invoice.issueDate))return 'Informe o número da NF e uma data de emissão válida.';
  if(records.some(other=>other.id!==r.id&&other.invoice?.number.trim().toUpperCase()===invoice.number.trim().toUpperCase()))return 'Esta NF já foi registrada na demonstração.';
  if(models(r).some(m=>!Number.isSafeInteger(invoice.prices[m.code])||invoice.prices[m.code]<=0))return 'Informe um valor unitário positivo para cada modelo.';
  if(!Number.isSafeInteger(invoice.totalCents)||invoice.totalCents<=0||invoice.totalCents!==invoiceTotal(r,invoice.prices))return 'O total da NF precisa corresponder às peças e aos valores unitários.';
  if(!invoice.installments.length||invoice.installments.length>12||invoice.installments.some(p=>!validDate(p.dueDate)||p.dueDate<invoice.issueDate||!Number.isSafeInteger(p.amountCents)||p.amountCents<=0||p.receivedOn!==null))return 'Informe vencimentos a partir da emissão e valores positivos para todas as parcelas.';
  if(invoice.installments.reduce((s,p)=>s+p.amountCents,0)!==invoice.totalCents)return 'A soma das parcelas deve ser igual ao total da NF.';
  return null;
}
export const isToInvoice=(r:Romaneio)=>r.stage==='Concluído'&&!r.invoice;
export const openCents=(r:Romaneio)=>r.invoice?.installments.filter(p=>!p.receivedOn).reduce((sum,p)=>sum+p.amountCents,0)||0;
export function registerInvoice(r:Romaneio,invoice:Invoice,records:Romaneio[]):Romaneio {
  const error=validateInvoice(r,invoice,records);if(error)throw new Error(error);
  return {...r,invoice:structuredClone({...invoice,number:invoice.number.trim()})};
}
