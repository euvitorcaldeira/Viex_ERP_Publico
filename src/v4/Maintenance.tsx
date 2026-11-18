import { useState } from 'react';
import { useCapabilities } from '../security/context';
import { money } from '../format';
import { audit, invoiceOpen, reverseReceipt, undoBilling, type State } from '../v3/domain';
import type { Commit } from '../v3/common';

export function Maintenance({state, commit}: {state: State; commit: Commit}) {
 const {actor} = useCapabilities();
 const [invoiceId, setInvoiceId] = useState('');
 const [recordId, setRecordId] = useState('');
 const [error, setError] = useState('');
 const invoice = state.invoices.find(item => item.id === invoiceId);
 const record = state.records.find(item => item.id === recordId);
 const active = state.receipts.filter(item => item.invoiceId === invoiceId && !item.reversedAt);
 const workshopLinked = !!record && state.workshopPayments.some(payment =>
  payment.allocations.some(allocation => allocation.chargeId.startsWith(record.id + '|')));
 if (actor.role !== 'Administrador' || actor.source !== 'authenticated') return null;

 function apply(change: (current: State) => State, message: string, onDone: () => void) {
  const failure = commit(change, message, {inlineError: true});
  setError(failure || '');
  if (!failure) onDone();
 }

 return <section className="panel settings">
  <h2>Manutenção de registros</h2>
  <p>Exclusões são gravadas no banco local. O D’ALEX cria um backup antes de excluir e guarda o registro na auditoria.</p>
  <div><label>Nota fiscal<select value={invoiceId} onChange={event => {setInvoiceId(event.target.value);setError('')}}>
   <option value="">Selecione uma NF</option>
   {state.invoices.map(item => <option key={item.id} value={item.id}>NF {item.number} · {item.client}</option>)}
  </select></label>{invoice && <button className="secondary danger" disabled={!!invoice.taxPaidAt} onClick={() => {
   if (!window.confirm(`Remover a NF ${invoice.number} do ERP${active.length ? ' e estornar seus recebimentos ativos' : ''}? Os romaneios voltarão para A faturar.`)) return;
   apply(current => {
    const receipts = current.receipts.filter(item => item.invoiceId === invoice.id && !item.reversedAt);
    const reversed = receipts.reduce((next, receipt) => reverseReceipt(next, receipt.id), current);
    return undoBilling(reversed, invoice.id);
   }, 'NF removida. Romaneios disponíveis para faturar.', () => setInvoiceId(''));
  }}>Remover registro da NF</button>}</div>
  {invoice && <p>Romaneios: {invoice.recordIds.join(', ')}. Parcelas: {invoice.installments.length}. Saldo em aberto: {money(invoiceOpen(state, invoice))}. Recebimentos ativos: {active.length}.
   {invoice.taxPaidAt && ' Desfaça a baixa do imposto no Financeiro para liberar a exclusão.'}
  </p>}
  <div><label>Romaneio sem NF<select value={recordId} onChange={event => {setRecordId(event.target.value);setError('')}}>
   <option value="">Selecione um romaneio</option>
   {state.records.filter(item => !item.invoiceId).map(item => <option key={item.id} value={item.id}>{item.id} · {item.client}</option>)}
  </select></label>{record && <button className="secondary danger" disabled={workshopLinked} onClick={() => {
   if (!window.confirm(`Excluir o romaneio ${record.id}?`)) return;
   apply(current => audit({...current, records: current.records.filter(item => item.id !== record.id)}, record.id,
    'Romaneio excluído pela manutenção', record), 'Romaneio excluído.', () => setRecordId(''));
  }}>Excluir romaneio</button>}</div>
  {workshopLinked && <p>Este romaneio tem pagamentos de oficina vinculados. Revise essas movimentações em Oficinas antes de excluir.</p>}
  {error && <p className="error" role="alert">{error}</p>}
 </section>;
}
