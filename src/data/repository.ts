import { type RomaneioRepository, type Romaneio, type Item, stages } from '../domain';
import { seed } from './seed';
const key = 'dalex-prototype-v2';
// V1 is kept untouched so evaluation data is never overwritten by migration.
export function migrateV1(value:unknown):Romaneio[]|null {
  if(!Array.isArray(value))return null;
  try {return value.map((r,index)=>{
    if(typeof r.id!=='string'||!Array.isArray(r.items)||!['Em produção','A conferir','Conferido'].includes(r.stage))throw new Error('Invalid legacy data');
    const items:Item[]=r.items.map((i:Record<string,unknown>,j:number)=>({id:String(i.id||`legacy-${index}-${j}`),code:`DEMO-V1-${index+1}-${j+1}`,description:String(i.reference||'Modelo anterior'),family:'',color:String(i.color||''),grid:'Personalizada',sizes:[{size:String(i.size||'Único'),quantity:Number(i.quantity)||0}]}));
    return {...r,items,stage:r.stage==='Em produção'?'Em produção':'Concluído',divergence:'',deliveredOn:null,invoice:null,attachments:Array.isArray(r.attachments)?r.attachments:[],notes:String(r.notes||'')};
  })}catch{return null}
}
// Adapter boundary: a future remote repository can replace this local implementation.
export const localRepository: RomaneioRepository = {
  list() { try {
    const saved=localStorage.getItem(key);
    if(saved){const value=JSON.parse(saved);if(Array.isArray(value)&&value.every(r=>typeof r.id==='string'&&Array.isArray(r.items)&&r.items.every((i:Item)=>Array.isArray(i.sizes))&&Array.isArray(r.attachments)&&stages.includes(r.stage)))return value;}
    const legacy=migrateV1(JSON.parse(localStorage.getItem('dalex-prototype-v1')||'null'));
    if(legacy){localStorage.setItem(key,JSON.stringify(legacy));return legacy;}
  }catch{/* Corrupt/blocked storage must not prevent opening the prototype. */}return structuredClone(seed); },
  save(records) { localStorage.setItem(key, JSON.stringify(records)); }
};
