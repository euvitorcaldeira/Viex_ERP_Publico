import { SortableTable } from './SortableTable';
import { useState } from 'react';
import { type Romaneio, type Invoice, models, invoiceTotal, splitInstallments, validateInvoice } from '../domain';
import { cents, money, today } from '../format';
import { Modal } from './Modal';
import { ItemTable } from './ItemTable';
export function BillingForm({record,records,onSave,onClose}:{record:Romaneio;records:Romaneio[];onSave:(invoice:Invoice)=>boolean;onClose:()=>void}){
 const modelList=models(record),[priceText,setPriceText]=useState<Record<string,string>>({}),[number,setNumber]=useState(''),[issueDate,setIssueDate]=useState(''),[count,setCount]=useState(1),[dates,setDates]=useState<string[]>(['']),[error,setError]=useState('');
 const prices=Object.fromEntries(modelList.map(m=>[m.code,cents(priceText[m.code]||'')]));
 const amount=invoiceTotal(record,prices);
 const validPrices=modelList.every(m=>Number.isSafeInteger(prices[m.code])&&prices[m.code]>0);
 const installments=validPrices&&Number.isSafeInteger(amount)&&amount>=count?splitInstallments(amount,count,dates):[];
 function submit(){
  if(issueDate>today()){setError('A data de emissão não pode estar no futuro.');return}
  const invoice:Invoice={number,issueDate,prices,totalCents:amount,installments};
  const problem=validateInvoice(record,invoice,records);if(problem){setError(problem);return}setError('');if(!onSave(invoice))setError('Não foi possível registrar a NF. Verifique o armazenamento ou se ela já foi registrada.');
 }
 function close(){if(window.confirm('Sair sem registrar esta NF? Os dados de faturamento preenchidos serão descartados.'))onClose()}
 return <Modal title={`Faturar ${record.id}`} subtitle={record.client} onClose={close} footer={<><button className="secondary" onClick={close}>Cancelar</button><button className="primary" onClick={submit}>Registrar NF e gerar contas a receber</button></>}><div className="modal-body"><div className="notice compact">Emita a NF no portal externo. Depois registre aqui os dados emitidos. Este protótipo não emite notas fiscais.</div><ItemTable record={record}/><h3 className="billing-title">Valores negociados por modelo</h3><div className="table-wrap"><SortableTable><thead><tr><th>Código / Modelo</th><th>Peças</th><th>Valor unitário (R$)</th><th>Total</th></tr></thead><tbody>{modelList.map(m=><tr key={m.code}><td><b>{m.code}</b><small>{m.description}</small></td><td>{m.quantity}</td><td><input aria-label={`Valor unitário ${m.code}`} inputMode="decimal" placeholder="0,00" value={priceText[m.code]||''} onChange={e=>setPriceText({...priceText,[m.code]:e.target.value})}/></td><td>{money(m.quantity*(Number.isFinite(prices[m.code])?prices[m.code]:0))}</td></tr>)}</tbody></SortableTable></div><div className="invoice-total"><span>Total calculado</span><strong>{money(amount)}</strong></div><div className="form-grid"><label>Número da NF *<input value={number} onChange={e=>setNumber(e.target.value)}/></label><label>Data de emissão *<input type="date" value={issueDate} onChange={e=>setIssueDate(e.target.value)}/></label><label>Quantidade de parcelas<select aria-label="Quantidade de parcelas" value={count} onChange={e=>{const n=Number(e.target.value);setCount(n);setDates(Array.from({length:n},(_,i)=>dates[i]||''))}}>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label></div><h3 className="billing-title">Previsão de pagamento</h3><p className="footnote">Informe cada vencimento. O total é dividido igualmente; centavos restantes ficam nas primeiras parcelas.</p><div className="installments">{Array.from({length:count},(_,i)=><label key={i}>Parcela {i+1} · {money(installments[i]?.amountCents||0)}<input aria-label={`Vencimento parcela ${i+1}`} type="date" min={issueDate||undefined} value={dates[i]||''} onChange={e=>setDates(dates.map((d,j)=>j===i?e.target.value:d))}/></label>)}</div>{error&&<p role="alert" className="error">{error}</p>}</div></Modal>
}

