import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrateV1, localRepository } from './repository';
import { seed } from './seed';
const legacy=[{id:'ROM-001',client:'Teste',workshop:'Aurora',date:'2026-10-28',stage:'A conferir',items:[{id:'old',reference:'Regata',color:'',size:'M',quantity:20}],notes:'Original',attachments:['foto.png']}];
afterEach(()=>vi.unstubAllGlobals());
describe('persistência e compatibilidade',()=>{
 it('converte V1 sem perder peças, anexo e observação',()=>{const result=migrateV1(legacy)!;expect(result[0].stage).toBe('Concluído');expect(result[0].items[0].sizes[0].quantity).toBe(20);expect(result[0].attachments).toEqual(['foto.png']);expect(result[0].notes).toBe('Original');expect(result[0].invoice).toBeNull();expect(legacy[0].stage).toBe('A conferir')});
 it('preserva chave V1 e salva a cópia V2',()=>{const data=new Map([['dalex-prototype-v1',JSON.stringify(legacy)]]);vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v)});expect(localRepository.list()[0].stage).toBe('Concluído');expect(data.get('dalex-prototype-v1')).toBe(JSON.stringify(legacy));expect(data.has('dalex-prototype-v2')).toBe(true)});
 it('usa V2 quando já existe e persiste NFs e parcelas',()=>{const data=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v)});localRepository.save(seed);expect(localRepository.list()).toEqual(seed)});
 it('dados corrompidos não impedem abrir a demonstração',()=>{vi.stubGlobal('localStorage',{getItem:()=>'{quebrado'});expect(localRepository.list()).toEqual(seed);expect(migrateV1([{}])).toBeNull()});
});
