import { describe, it, expect } from 'vitest';
import { total, validate, newRomaneio, invoiceTotal, models, splitInstallments, validateInvoice, registerInvoice, isToInvoice, openCents, type Invoice } from './domain';
import { seed } from './data/seed';
import { cents } from './format';
describe('cadastro e produção',()=>{
 it('cadastra em fila e mantém total das cores',()=>{expect(newRomaneio(seed).stage).toBe('Em fila');expect(total(seed[0])).toBe(200)});
 it('aceita cor, família e anexo ausentes',()=>expect(validate({...seed[0],items:seed[0].items.map(i=>({...i,color:'',family:''})),attachments:[]})).toBeNull());
 it('exige código, descrição e cabeçalho',()=>{expect(validate({...seed[0],client:''})).toBeTruthy();expect(validate({...seed[0],items:[]})).toBeTruthy();expect(validate({...seed[0],items:[{...seed[0].items[0],code:''}]})).toBeTruthy();expect(validate({...seed[0],items:[{...seed[0].items[0],description:''}]})).toBeTruthy()});
 it('rejeita data impossível',()=>expect(validate({...seed[0],date:'2026-02-30'})).toBeTruthy());
 it.each([0,-2,1.5,NaN])('rejeita linha sem quantidade válida: %s',quantity=>expect(validate({...seed[0],items:[{...seed[0].items[0],sizes:[{size:'M',quantity}]}]})).toBeTruthy());
 it('aceita zeros nos tamanhos não utilizados',()=>expect(validate(seed[0])).toBeNull());
 it('aceita produto sem grade',()=>expect(validate({...seed[0],items:[{...seed[0].items[0],grid:'Sem grade',sizes:[{size:'Único',quantity:3}]}]})).toBeNull());
 it('rejeita tamanhos duplicados e descrição conflitante por código',()=>{expect(validate({...seed[0],items:[{...seed[0].items[0],sizes:[{size:'M',quantity:1},{size:'m',quantity:2}]}]})).toBeTruthy();expect(validate({...seed[0],items:[seed[0].items[0],{...seed[0].items[1],description:'Outro modelo'}]})).toBeTruthy()});
});
describe('faturamento e financeiro',()=>{
 const r={...seed[0],stage:'Concluído' as const};
 const invoice=():Invoice=>({number:'TEST-1',issueDate:'2026-10-28',prices:{RG0256:1234},totalCents:246800,installments:splitInstallments(246800,3,['2026-11-10','2026-12-10','2027-01-10'])});
 it('agrupa cores por código e calcula preços por modelo',()=>{expect(models(r)).toHaveLength(1);expect(models(r)[0].quantity).toBe(200);expect(invoiceTotal(r,{RG0256:1234})).toBe(246800)});
 it('divide centavos sem perda e aceita vírgula decimal',()=>{expect(splitInstallments(100,3,[]).map(p=>p.amountCents)).toEqual([34,33,33]);expect(cents('12,34')).toBe(1234);expect(cents('12.34')).toBe(1234);expect(cents('1.234')).toBeNaN()});
 it('impede faturar antes da conclusão e emitir duplicado',()=>{expect(validateInvoice(seed[0],invoice(),[])).toBeTruthy();expect(validateInvoice({...r,invoice:invoice()},invoice(),[])).toBeTruthy()});
 it('rejeita preço zero, soma divergente e vencimento anterior à emissão',()=>{expect(validateInvoice(r,{...invoice(),prices:{RG0256:0}},[])).toBeTruthy();const i=invoice();i.installments[0].amountCents++;expect(validateInvoice(r,i,[])).toMatch(/soma/);const j=invoice();j.installments[0].dueDate='2026-10-01';expect(validateInvoice(r,j,[])).toBeTruthy()});
 it('registra NF uma vez e gera recebíveis sem mudar produção ou entrega',()=>{const result=registerInvoice({...r,deliveredOn:'2026-10-28'},invoice(),[]);expect(result.stage).toBe('Concluído');expect(result.deliveredOn).toBe('2026-10-28');expect(isToInvoice(result)).toBe(false);expect(openCents(result)).toBe(246800);expect(r.invoice).toBeNull();expect(()=>registerInvoice(result,invoice(),[result])).toThrow()});
 it('recebimento reduz o saldo somente da parcela recebida',()=>{const result=registerInvoice(r,invoice(),[]);result.invoice!.installments[0].receivedOn='2026-11-10';expect(openCents(result)).toBe(246800-result.invoice!.installments[0].amountCents);expect(result.stage).toBe('Concluído');expect(result.deliveredOn).toBeNull()});
 it('rejeita parcelamento impossível',()=>{expect(()=>splitInstallments(1,2,[])).toThrow();expect(()=>splitInstallments(100,0,[])).toThrow()});
 it('impede duplicar a mesma NF já registrada',()=>expect(validateInvoice(r,invoice(),[{...r,id:'OUTRO',invoice:invoice()}])).toBeTruthy());
});
