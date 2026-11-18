import { afterEach, describe, expect, it, vi } from 'vitest';
import { seed } from '../data/seed';
import { loadState, saveState, storageKey, freshState } from './store';
afterEach(()=>vi.unstubAllGlobals());
describe('armazenamento V3',()=>{
 it('migra V2 uma vez e preserva o texto original sem criar NFs duplicadas',()=>{const old=JSON.stringify(seed),data=new Map([['dalex-prototype-v2',old]]);vi.stubGlobal('localStorage',{getItem:(key:string)=>data.get(key)||null,setItem:(key:string,value:string)=>data.set(key,value)});const first=loadState(),second=loadState();expect(first).toEqual(second);expect(second.invoices).toHaveLength(1);expect(data.get('dalex-prototype-v2')).toBe(old);expect(data.has(storageKey)).toBe(true)});
 it('recusa armazenamento V3 inválido em vez de apagar dados anteriores',()=>{const value='dados danificados';const setItem=vi.fn();vi.stubGlobal('localStorage',{getItem:()=>value,setItem});expect(()=>loadState()).toThrow();expect(setItem).not.toHaveBeenCalled()});
 it('falha de gravação é propagada, permitindo manter o estado anterior na tela',()=>{vi.stubGlobal('localStorage',{setItem:()=>{throw new Error('Sem espaço')}});expect(()=>saveState(freshState())).toThrow(/Sem espaço/)});
});
