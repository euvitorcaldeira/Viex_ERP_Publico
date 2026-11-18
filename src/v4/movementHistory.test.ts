import { describe, expect, it } from 'vitest';
import {
  employeeBalance, finishProduction, issueBill, markAttendance, payEmployee, payWorkshop,
  receivableTotal, receive, reverseReceipt, workshopBalance, workshopCharges,
} from '../v3/domain';
import { archiveMovement } from './movementHistory';
import { freshState } from './store';

describe('exclusão de movimentações do histórico operacional', () => {
  it('reabre o saldo de um recebimento ativo e arquiva o lançamento original', () => {
    const state = freshState();
    const invoice = state.invoices[0];
    const installment = invoice.installments.find(part => !state.receipts.some(receipt => receipt.installmentId === part.id));
    expect(installment).toBeTruthy();
    const received = receive(state, invoice.id, installment!.id, invoice.issueDate, 100);
    const receipt = received.receipts.at(-1)!;
    const archived = archiveMovement(received, 'receipts', receipt.id);
    expect(receivableTotal(archived)).toBe(receivableTotal(state));
    expect(archived.audit.at(-1)?.before).toEqual(receipt);
    expect(archived.receipts).not.toContainEqual(receipt);

    const reversed = reverseReceipt(received, receipt.id);
    const removedReversal = archiveMovement(reversed, 'receipts', receipt.id);
    expect(receivableTotal(removedReversal)).toBe(receivableTotal(reversed));
    expect(removedReversal.audit.at(-1)?.before).toEqual(reversed.receipts.at(-1));
  });

  it('retira um pagamento de funcionário sem alterar os demais pagamentos', () => {
    let state = freshState();
    const id = state.employees[0].id;
    state = markAttendance(state, id, '2026-10-28', 'Presente');
    const previousBalance = employeeBalance(state, id);
    const paid = payEmployee(state, id, '2026-10-28', 100);
    const payment = paid.employeePayments.at(-1)!;
    const archived = archiveMovement(paid, 'employeePayments', payment.id);
    expect(employeeBalance(archived, id)).toBe(previousBalance);
    expect(archived.audit.at(-1)?.before).toEqual(payment);
    expect(archived.employeePayments).toEqual(state.employeePayments);
  });

  it('reabre as produções de uma oficina e preserva as alocações na auditoria', () => {
    const initial = freshState();
    const record = initial.records[0];
    const id = initial.workshops[0].id;
    const state = finishProduction({
      ...initial,
      records: initial.records.map(item => item.id === record.id
        ? { ...item, execution: { kind: 'Terceirizada', workshopId: id } }
        : item),
    }, record.id, [{ code: record.items[0].code, clientCents: 100, kind: 'Terceirizada', workshopId: id, workshopCents: 40 }]);
    const charges = workshopCharges(state, id).filter(charge => charge.open > 0);
    const paid = payWorkshop(state, id, '2026-10-28', 100, charges.map(charge => charge.id));
    const payment = paid.workshopPayments.at(-1)!;
    const archived = archiveMovement(paid, 'workshopPayments', payment.id);
    expect(workshopBalance(archived, id)).toBe(workshopBalance(state, id));
    expect(archived.audit.at(-1)?.before).toEqual(payment);
    expect(archived.workshopPayments).toEqual(state.workshopPayments);
  });
});
