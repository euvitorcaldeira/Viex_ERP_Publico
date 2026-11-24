import { SortableTable } from '../components/SortableTable';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useFormError } from '../components/useFormError';
import { newRomaneio, total, validate } from '../domain';
import { type State, type ProductionInput, nextRecordId, viewRecord, financiallyLocked, saveProduction } from '../v3/domain';
import { type Commit } from '../v3/common';
import { today, dateLabel, cents, money } from '../format';
import { executionLabel, internalWorkshopName } from './domain';
import { Modal } from '../components/Modal';
import { ItemsEditor } from '../components/ItemsEditor';
import { ItemTable } from '../components/ItemTable';
import { PriceReview } from './PriceReview';
import { uploadLocalAttachment } from '../localApi';

function attachmentName(entry:string){return entry.includes('|')?entry.split('|').slice(1).join('|'):entry}
function attachmentView(entry:string){
 const [id,...parts]=entry.split('|');
 return /^[a-f0-9]{32}$/i.test(id)&&parts.length>0?<a href={`/api/attachments/${encodeURIComponent(id)}`} download>{parts.join('|')}</a>:<span>{entry}</span>;
}

export function RecordForm({state,initial,commit,onClose,localMode=false}:{state:State;initial?:ProductionInput;commit:Commit;onClose:(saved?:boolean)=>void;localMode?:boolean}){
 const [draft,setDraft]=useState<ProductionInput>(()=>initial?structuredClone(initial):{...newRomaneio(state.records.map(r=>viewRecord(r,state))),id:nextRecordId(state),workshop:internalWorkshopName(state),date:today(),receivedOn:today(),clientId:state.clients?.find(client=>client.active&&client.isDefault)?.id||'',client:state.clients?.find(client=>client.active&&client.isDefault)?.name||'',clientOrder:'',execution:{kind:'Interna',workshopId:null}});
 const [priceInputs,setPriceInputs]=useState<Record<string,{client:string;workshop:string}>>(()=>Object.fromEntries((draft.pricing||[]).map(price=>[price.code.trim().toUpperCase(),{client:price.clientCents? (price.clientCents/100).toFixed(2).replace('.',','):'',workshop:price.workshopCents?(price.workshopCents/100).toFixed(2).replace('.',','):''}])));
 const [step,setStep]=useState(1),[error,setError]=useFormError(),[uploading,setUploading]=useState(false);
 const old=state.records.find(r=>r.id===draft.id),locked=!!old&&financiallyLocked(old,state);
 function close(){if(window.confirm('Descartar as alterações deste cadastro?'))onClose()}
 function enterCents(event:KeyboardEvent<HTMLInputElement>){
  if(event.key!==',')return;
  const input=event.currentTarget;
  const separator=input.value.indexOf(',');
  if(separator<0)return;
  event.preventDefault();
  input.setSelectionRange(separator+1,input.value.length);
 }
 function updateMaskedPrice(code:string,field:'client'|'workshop',input:HTMLInputElement){
  const raw=input.value.replace(/R\$|[\s.]/g,'');
  if(!/^\d*(,\d{0,2})?$/.test(raw))return;
  const [whole,fraction='']=raw.split(',');
  const amount=cents((whole||'0')+','+fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(amount))return;
  const cursor=input.selectionStart??input.value.length;
  const comma=input.value.indexOf(',');
  const fractional=comma>=0&&cursor>comma;
  const digitsAfterCursor=input.value.slice(cursor,comma>=cursor?comma:undefined).replace(/\D/g,'').length;
  updatePrice(code,field,amount?(amount/100).toFixed(2).replace('.',','):'');
  requestAnimationFrame(()=>{
   if(document.activeElement!==input)return;
   const separator=input.value.indexOf(',');
   if(separator<0)return;
   let position=fractional?Math.min(input.value.length,separator+cursor-comma):separator;
   if(!fractional){
    let remaining=digitsAfterCursor;
    while(remaining>0&&position>0){
     position--;
     if(/\d/.test(input.value[position]))remaining--;
    }
   }
   input.setSelectionRange(position,fractional&&fraction.length===1?input.value.length:position);
  });
 }
 function updatePrice(code:string,field:'client'|'workshop',raw:string){
  setPriceInputs(current=>({...current,[code]:{client:current[code]?.client||'',workshop:current[code]?.workshop||'', [field]:raw}}));
  const parsed=raw.trim()===''?0:cents(raw);if(!Number.isSafeInteger(parsed)||parsed<0)return;
  setDraft(current=>{const prior=current.pricing?.find(price=>price.code.trim().toUpperCase()===code);const external=current.execution?.kind==='Terceirizada';const next={code,clientCents:field==='client'?parsed:prior?.clientCents||0,kind:external?'Terceirizada' as const:'Interna' as const,workshopId:external?current.execution?.workshopId||null:null,workshopCents:external?(field==='workshop'?parsed:prior?.workshopCents||0):0};const remaining=(current.pricing||[]).filter(price=>price.code.trim().toUpperCase()!==code);return {...current,pricingReentered:true,pricing:next.clientCents>0||next.workshopCents>0?[...remaining,next]:remaining};});
 }
 const confirmButton=useRef<HTMLButtonElement>(null);
 const firstClientPrice=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  if(step!==2)return;
  if(firstClientPrice.current){
   firstClientPrice.current.focus();
   firstClientPrice.current.select();
  }else confirmButton.current?.focus();
 },[step]);
 function confirm(){
  if(uploading)return;
  const err=commit(s=>saveProduction(s,draft),initial?'Romaneio atualizado.':'Romaneio cadastrado em fila.');
  setError(err||'');
  if(!err)onClose(true);
 }
 function renderReviewPrice(item:ProductionInput['items'][number],index:number){
  const code=item.code.trim().toUpperCase(),price=draft.pricing?.find(entry=>entry.code.trim().toUpperCase()===code),inputs=priceInputs[code]||{client:price?.clientCents?(price.clientCents/100).toFixed(2).replace('.',','):'',workshop:price?.workshopCents?(price.workshopCents/100).toFixed(2).replace('.',','):''},external=draft.execution?.kind==='Terceirizada';
  return <div className="review-price-inputs"><label><input ref={index===0?firstClientPrice:undefined} aria-label={`Preço cliente ${code}`} inputMode="decimal" onKeyDown={enterCents} value={money(inputs.client ? cents(inputs.client) : 0)} onFocus={event=>event.currentTarget.select()} onChange={event=>updateMaskedPrice(code,'client',event.currentTarget)}/></label>{external&&<label>Custo unitário da oficina (R$)<input aria-label={`Custo oficina ${code}`} inputMode="decimal" onKeyDown={enterCents} value={money(inputs.workshop ? cents(inputs.workshop) : 0)} onFocus={event=>event.currentTarget.select()} onChange={event=>updateMaskedPrice(code,'workshop',event.currentTarget)}/></label>}</div>;
 }
 function advance(){if(!draft.clientId){setError('Selecione um cliente cadastrado.');return}if(!draft.receivedOn){setError('Informe a data de recebimento do romaneio.');return}const err=validate(draft);setError(err||'');if(!err)setStep(2)}
 const origin=draft.execution?.kind==='Mista'?'mixed':draft.execution?.kind==='Terceirizada'?draft.execution.workshopId||'':'internal';
 async function addFiles(files:File[]){
  if(!files.length)return;
  const mimeOf=(file:File)=>file.type||({'.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif','.webp':'image/webp'} as Record<string,string>)[file.name.slice(file.name.lastIndexOf('.')).toLowerCase()]||'';
  const allowed=['application/pdf','image/jpeg','image/png','image/gif','image/webp'];
  if(files.some(file=>!allowed.includes(mimeOf(file)))){setError('Selecione um PDF, JPEG, PNG, GIF ou WebP.');return}
  if(files.some(file=>file.size>5*1024*1024)){setError('Cada arquivo pode ter no máximo 5 MB.');return}
  if(!localMode){setDraft(current=>({...current,attachments:[...current.attachments,...files.map(file=>file.name)]}));return}
  setUploading(true);setError('');
  try{const references:string[]=[];for(const file of files)references.push(await uploadLocalAttachment(file,draft.id,mimeOf(file)));setDraft(current=>({...current,attachments:[...current.attachments,...references]}))}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível guardar o anexo.');}
  finally{setUploading(false)}
 }
 return <Modal title={step===2?'Revise seu romaneio':initial?'Editar romaneio':'Cadastrar romaneio'} subtitle={draft.clientOrder||draft.client||'Novo registro'} onClose={close} footer={<><button className="secondary" onClick={()=>step===2?setStep(1):close()}>{step===2?'Voltar e editar':'Cancelar'}</button><button ref={confirmButton} className="primary" disabled={uploading} onKeyDown={event=>{if(event.key==='Enter'&&event.repeat)event.preventDefault()}} onClick={step===1?advance:confirm}>{uploading?'Enviando anexo…':step===1?'Revisar romaneio':initial?'Salvar alterações':'Confirmar cadastro'}</button></>}>
  <div className="stepper"><span className={step===1?'current':''}>1. Informações e peças</span><span className={step===2?'current':''}>2. Revisão</span></div>
  <div className={step===1?"modal-body record-form-compact":"modal-body record-review-compact"} onKeyDown={event => {
    const field = event.target;
    if (event.key !== 'Enter' || event.defaultPrevented || event.repeat || event.nativeEvent.isComposing || uploading) return;
    if (!(field instanceof HTMLInputElement) || !['text', 'number'].includes(field.type)) return;
    event.preventDefault();
    if(step===1)advance();
    else confirm();
  }}>{step===1?<>
   {locked&&<div className="notice compact">NF ou pagamento já registrado: cliente, local e itens estão protegidos. Recebimento, pedido e observações podem ser corrigidos com histórico.</div>}
   <div className="form-grid"><label>Cliente *<select aria-label="Cliente" disabled={locked} value={draft.clientId||''} onChange={e=>{const c=state.clients?.find(c=>c.id===e.target.value);const changed=c?.id!==draft.clientId;setDraft(current=>({...current,clientId:c?.id||'',client:c?.name||'',pricing:changed?[]:current.pricing,pricingReentered:changed?false:current.pricingReentered}));if(changed)setPriceInputs({})}}><option value="">Selecione um cliente</option>{state.clients?.filter(c=>c.active||c.id===draft.clientId).map(c=><option key={c.id} value={c.id}>{c.name}{c.active?'':' · inativo'}</option>)}</select></label>
    <label>Local de produção<select aria-label="Local de produção" disabled={locked} value={origin} onChange={e=>{const execution=e.target.value==='internal'?{kind:'Interna' as const,workshopId:null}:{kind:'Terceirizada' as const,workshopId:e.target.value};const changed=JSON.stringify(draft.execution)!==JSON.stringify(execution);setDraft(current=>({...current,execution,workshop:executionLabel(state,execution),pricing:changed?[]:current.pricing,pricingReentered:changed?false:current.pricingReentered}));if(changed)setPriceInputs({})}}><option value="internal">Interna · {internalWorkshopName(state)}</option>{origin==='mixed'&&<option value="mixed" disabled>Produção mista · histórico V3</option>}{state.workshops.filter(w=>w.active||w.id===draft.execution?.workshopId).map(w=><option key={w.id} value={w.id}>{w.name}{w.active?'':' · inativa'}</option>)}</select></label>
    <label>Data de recebimento *<input aria-label="Data de recebimento do romaneio" type="date" max={today()} value={draft.receivedOn||''} onChange={e=>setDraft({...draft,receivedOn:e.target.value,date:e.target.value})}/></label>
    <label>Pedido / romaneio do cliente<input value={draft.clientOrder||''} placeholder="Numeração informada pelo cliente" onChange={e=>setDraft({...draft,clientOrder:e.target.value})}/></label>
    <label>Observações<input value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label></div>
   {locked?<ItemTable record={draft}/>:<><ItemsEditor items={draft.items} onChange={items=>{const kept=new Set(items.map(item=>item.code.trim().toUpperCase()));setPriceInputs(current=>Object.fromEntries(Object.entries(current).filter(([code])=>kept.has(code))));setDraft(current=>({...current,items,pricing:(current.pricing||[]).filter(price=>kept.has(price.code.trim().toUpperCase()))}))}}/></>}
   <label className="attachment"><b>Foto ou PDF · opcional</b><span>{locked?'Os anexos deste romaneio estão protegidos por faturamento ou pagamento.':localMode?'Arquivo guardado neste computador e vinculado ao romaneio.':'Arquivo demonstrativo; não é enviado para armazenamento.'}</span><input type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.pdf" multiple disabled={uploading||locked} onChange={e=>{void addFiles(Array.from(e.target.files||[]));e.currentTarget.value=''}}/></label>
   <p className="footnote">{draft.attachments.length?draft.attachments.map((entry,index)=><span key={`${entry}-${index}`}>{attachmentView(entry)}{index<draft.attachments.length-1?' · ':''}</span>):'Sem anexos.'}</p>
  </>:<><div className="review-summary"><span><small>Cliente</small><b>{draft.client}</b></span><span><small>Pedido do cliente</small><b>{draft.clientOrder||'Não informado'}</b></span><span><small>Local de produção</small><b>{executionLabel(state,draft.execution)}</b></span><span><small>Recebido em</small><b>{dateLabel(draft.receivedOn||'')}</b></span><span><small>Total</small><b>{total(draft)} peças</b></span></div><ItemTable record={draft} review renderPrice={locked?undefined:renderReviewPrice}/>{!locked&&<p className="footnote">O valor é por peça e vale para todas as cores do mesmo código. Você também pode definir o preço ao concluir a produção.</p>}{locked&&(draft.pricing||[]).length>0&&<section className="price-review"><h3>Valores já informados</h3><div className="table-wrap"><SortableTable><thead><tr><th>Código</th><th>Valor unitário do cliente</th><th>Custo unitário da oficina</th></tr></thead><tbody>{[...new Map(draft.items.map(item=>[item.code.trim().toUpperCase(),item])).values()].map(item=>{const price=draft.pricing?.find(entry=>entry.code.trim().toUpperCase()===item.code.trim().toUpperCase());return <tr key={item.code}><td>{item.code} · {item.description}</td><td>{price?.clientCents?money(price.clientCents):'A definir'}</td><td>{price?.kind==='Terceirizada'?(price.workshopCents?money(price.workshopCents):'A definir'):'—'}</td></tr>})}</tbody></SortableTable></div></section>}<PriceReview state={state} draft={draft}/><p>{draft.notes||'Sem observações.'}</p>{draft.attachments.length>0&&<p className="footnote">Anexos: {draft.attachments.map(attachmentName).join(' · ')}</p>}<p className="footnote">Quantidades recalculam os totais com os preços dos códigos mantidos. Trocar cliente/local exige novos preços. Notas já registradas não são recalculadas.</p></>}
   {error&&<p className="error" role="alert">{error}</p>}
  </div>
 </Modal>
}
