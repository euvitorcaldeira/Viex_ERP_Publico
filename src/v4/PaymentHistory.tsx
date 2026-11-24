import { SortableTable } from '../components/SortableTable';
import { History as HistoryIcon, Undo2 } from 'lucide-react';
import { ActionIcon } from '../components/ActionIcon';
import { money, dateLabel } from '../format';
import type { Commit } from '../v3/common';
import type { State } from '../v3/domain';
import { ArchiveMovementButton } from './ArchiveMovementButton';
import { reverseEmployeePayment, reverseWorkshopPayment } from './domain';

export function PaymentHistory({ state, id, type, commit }: {
  state: State;
  id: string;
  type: 'employee' | 'workshop';
  commit: Commit;
}) {
  const rows = type === 'employee'
    ? state.employeePayments.filter(p => p.employeeId === id).map(p => ({
      ...p,
      description: p.advance ? 'Adiantamento' : p.groupId ? 'Fechamento em grupo' : 'Pagamento individual',
      group: p.groupId,
    }))
    : state.workshopPayments.filter(p => p.workshopId === id).map(p => ({
      ...p,
      description: p.allocations.map(a => a.chargeId.split('|').slice(0, 2).join(' / ')).join(', '),
      group: null,
    }));

  function undo(paymentId: string, group = false) {
    const prompt = group
      ? 'Desfazer todo este fechamento? Os saldos dos funcionários serão reabertos e o histórico será preservado.'
      : 'Desfazer este pagamento? O saldo será recalculado e o lançamento permanecerá no histórico.';
    if (!window.confirm(prompt)) return;
    commit(
      state => type === 'employee'
        ? reverseEmployeePayment(state, paymentId, group)
        : reverseWorkshopPayment(state, paymentId),
      'Pagamento desfeito com histórico.',
    );
  }

  return (
    <div className="table-wrap">
      <SortableTable>
        <thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Situação</th><th>Ações</th></tr></thead>
        <tbody>
          {rows.slice().reverse().map(payment => (
            <tr key={payment.id}>
              <td>{dateLabel(payment.date)}</td>
              <td>{payment.description}</td>
              <td>{money(payment.amountCents)}</td>
              <td><span className={'badge ' + (payment.reversedAt ? 'waiting' : 'done')}>{payment.reversedAt ? 'Desfeito' : 'Pago'}</span></td>
              <td>
                <div className="row-actions">
                  {!payment.reversedAt && (
                    <>
                      <ActionIcon label="Desfazer pagamento" icon={<Undo2 size={16} />} onClick={() => undo(payment.id)} />
                      {payment.group && <ActionIcon label="Desfazer fechamento" icon={<HistoryIcon size={16} />} onClick={() => undo(payment.id, true)} />}
                    </>
                  )}
                  <ArchiveMovementButton
                    commit={commit}
                    kind={type === 'employee' ? 'employeePayments' : 'workshopPayments'}
                    movementId={payment.id}
                    reversed={!!payment.reversedAt}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </SortableTable>
      {!rows.length && <div className="empty">Nenhum pagamento registrado.</div>}
    </div>
  );
}
