import { SortableTable } from '../components/SortableTable';
import { Undo2 } from 'lucide-react';
import { ActionIcon } from '../components/ActionIcon';
import { Modal } from '../components/Modal';
import { useFormError } from '../components/useFormError';
import { dateLabel, money } from '../format';
import type { Commit } from './common';
import { invoiceOpen, reverseReceipt, undoBilling, type State } from './domain';

interface Props {
 state: State;
 invoiceId: string;
 commit: Commit;
 onClose: () => void;
 onDone: () => void;
}

export function UndoBillingDialog({state, invoiceId, commit, onClose, onDone}: Props) {
 const [error, setError] = useFormError();
 const invoice = state.invoices.find(item => item.id === invoiceId);
 if (!invoice) return null;

 const active = state.receipts.filter(receipt => receipt.invoiceId === invoiceId && !receipt.reversedAt);
 const blocked = active.length > 0 || !!invoice.taxPaidAt;

 function undo() {
  const message = commit(current => undoBilling(current, invoiceId), 'Faturamento desfeito. Romaneios disponíveis em A faturar.', {inlineError: true});
  setError(message || '');
  if (!message) onDone();
 }

 return <Modal title="Desfazer faturamento" subtitle={`NF ${invoice.number}`} onClose={onClose} footer={<>
  <button className="secondary" onClick={onClose}>Voltar</button>
  <button className="primary" disabled={blocked} onClick={undo}>Confirmar desfazimento</button>
 </>}>
  <div className="modal-body">
   <p>Saldo em aberto: <b>{money(invoiceOpen(state, invoice))}</b> de {money(invoice.totalCents)}.</p>
   {active.length > 0 && <>
    <p>Estorne os recebimentos abaixo para devolver a NF ao saldo integral em aberto.</p>
    <div className="table-wrap"><SortableTable>
     <thead><tr><th>Recebido em</th><th>Valor</th><th>Ações</th></tr></thead>
     <tbody>{active.map(receipt => <tr key={receipt.id}>
      <td>{dateLabel(receipt.date)}</td><td>{money(receipt.amountCents)}</td>
      <td><ActionIcon icon={<Undo2 size={16}/>} label={`Estornar recebimento de ${money(receipt.amountCents)}`} onClick={() => {
       if (!window.confirm(`Estornar o recebimento de ${money(receipt.amountCents)}? O saldo da parcela será reaberto.`)) return;
       const message = commit(current => reverseReceipt(current, receipt.id), 'Recebimento estornado.', {inlineError: true});
       setError(message || '');
      }}/></td>
     </tr>)}</tbody>
    </SortableTable></div>
   </>}
   {invoice.taxPaidAt && <p>Desfaça a baixa deste imposto em Financeiro → Impostos antes de continuar.</p>}
   <p>Os romaneios voltarão para <b>A faturar</b>. A nota e seus recebimentos estornados ficarão guardados na auditoria. A alteração vale apenas para o registro interno do ERP.</p>
   {error && <p className="error" role="alert">{error}</p>}
  </div>
 </Modal>;
}
