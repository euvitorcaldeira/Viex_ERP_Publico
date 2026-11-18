import type { Romaneio, Item } from '../domain';
const item=(id:string,code:string,description:string,family:string,quantity:number,color=''):Item=>({id,code,description,family,color,grid:'Letras',sizes:[{size:'P',quantity:0},{size:'M',quantity},{size:'G',quantity:0}]});
const base={notes:'Exemplo fictício para avaliação.',attachments:[],divergence:'',deliveredOn:null,invoice:null};
export const seed: Romaneio[] = [
  {...base,id:'ROM-001',client:'Degaia (exemplo)',workshop:'Oficina Aurora',date:'2026-10-30',stage:'Em produção',items:[item('a','RG0256','Regata Mariana','Mariana',120,'Areia'),item('b','RG0256','Regata Mariana','Mariana',80,'Preto')]},
  {...base,id:'ROM-002',client:'Cliente demonstração',workshop:'Ateliê Horizonte',date:'2026-11-02',stage:'Em fila',items:[item('c','CM0100','Camisa Linho','Linho',150)]},
  {...base,id:'ROM-003',client:'Degaia (exemplo)',workshop:'Oficina Aurora',date:'2026-10-28',stage:'Concluído',items:[item('d','CL0042','Calça Reta','Reta',90)]},
  {...base,id:'ROM-004',client:'Cliente demonstração',workshop:'Ateliê Horizonte',date:'2026-10-27',stage:'Concluído',deliveredOn:'2026-10-28',items:[item('e','RG0300','Regata Luna','Luna',100)],invoice:{number:'DEMO-104',issueDate:'2026-10-28',prices:{RG0300:1800},totalCents:180000,installments:[{id:'demo-p1',dueDate:'2026-11-10',amountCents:90000,receivedOn:null},{id:'demo-p2',dueDate:'2026-12-10',amountCents:90000,receivedOn:null}]}}
];
