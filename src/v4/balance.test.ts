import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoActors, assertTransition, stampActor } from '../security/policy';
import type { Bill, State } from '../v3/domain';
import {
  balanceMonths, balanceMovements, balanceTotals, filterBalanceMovements,
  restoreBalanceExpense, reverseBalanceExpense, saveBalanceExpense, type BalanceExpenseInput,
} from './balance';

const emptyState: State = {
  version: 4, records: [], invoices: [], receipts: [], employees: [], attendance: [],
  employeePayments: [], workshops: [], workshopPayments: [], audit: [],
};

const bill: Bill = {
  id: 'invoice-id', number: '55', client: 'Cliente A', recordIds: [], lines: [],
  issueDate: '2026-09-18', totalCents: 25000, consolidationAuthorized: false,
  installments: [{ id: 'part', dueDate: '2026-09-25', amountCents: 25000 }],
  taxCents: 1150, taxDueDate: '2026-10-05', taxPaidAt: '2026-11-03',
};

const expense: BalanceExpenseInput = {
  date: '2026-10-22', description: 'Aluguel do galpão', category: 'Aluguel', amountCents: 12000,
};

describe('balanço de caixa', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T14:00:00Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('usa datas efetivas, mantém parcelas parciais e soma cada pagamento apenas uma vez', () => {
    const state: State = {
      ...emptyState,
      invoices: [bill, { ...bill, id: 'tax-open', taxPaidAt: '' }],
      receipts: [
        { id: 'part-paid', date: '2026-10-03', amountCents: 10000, invoiceId: bill.id, installmentId: 'part', reversedAt: null },
        { id: 'part-reversed', date: '2026-10-04', amountCents: 7000, invoiceId: bill.id, installmentId: 'part', reversedAt: '2026-10-05T15:00:00Z' },
        { id: 'part-paid2', date: '2026-11-09', amountCents: 5000, invoiceId: bill.id, installmentId: 'part', reversedAt: null },
      ],
      employees: [{ id: 'employee', name: 'Joana', active: false, dailyCents: 1000, role: 'Costura', pix: '' }],
      employeePayments: [
        { id: 'pay-1', employeeId: 'employee', date: '2026-10-06', amountCents: 400, advance: true, groupId: null },
        { id: 'pay-2', employeeId: 'employee', date: '2026-10-08', amountCents: 600, advance: false, groupId: 'group' },
        { id: 'pay-3', employeeId: 'employee', date: '2026-10-09', amountCents: 500, advance: false, groupId: null, reversedAt: '2026-10-10T12:00:00Z' },
      ],
      workshopPayments: [{ id: 'workshop-pay', workshopId: 'office', date: '2026-11-04', amountCents: 3000,
        allocations: [{ chargeId: 'charge1', amountCents: 1200 }, { chargeId: 'charge2', amountCents: 1800 }] }],
      balanceExpenses: [{ id: 'rent', ...expense }],
    };
    const movements = balanceMovements(state);
    const autumn = filterBalanceMovements(movements, '2026-09', '2026-11');
    expect(autumn).toHaveLength(7);
    expect(balanceTotals(autumn)).toEqual({ receivedCents: 15000, paidCents: 17150, resultCents: -2150 });
    expect(balanceMonths(autumn, '2026-09', '2026-11')).toEqual([
      { month: '2026-09', receivedCents: 0, paidCents: 0, resultCents: 0 },
      { month: '2026-10', receivedCents: 10000, paidCents: 13000, resultCents: -3000 },
      { month: '2026-11', receivedCents: 5000, paidCents: 4150, resultCents: 850 },
    ]);
    const payroll = filterBalanceMovements(movements, '2026-10', '2026-11', 'Funcionários');
    expect(balanceTotals(payroll)).toEqual({ receivedCents: 0, paidCents: 1000, resultCents: -1000 });
    expect(payroll.map(payment => payment.description)).toEqual(['Pagamento · Joana', 'Adiantamento · Joana']);
    expect(filterBalanceMovements(movements, '2026-10', '2026-11', 'Aluguel')).toHaveLength(1);
  });

  it('inclui todos os meses do intervalo mesmo na mudança de ano e rejeita ordem inválida', () => {
    expect(balanceMonths([], '2026-12', '2027-02').map(item => item.month)).toEqual(['2026-12', '2027-01', '2027-02']);
    expect(balanceMonths([], '2027-01', '2026-12')).toEqual([]);
    expect(balanceMonths([], '2026-00', '2026-12')).toEqual([]);
  });

  it('registra criação, edição e estorno de uma despesa sem apagar seu histórico', () => {
    const created = saveBalanceExpense(emptyState, { ...expense, description: ' Aluguel ', supplier: ' Associação ' });
    const manual = created.balanceExpenses![0];
    expect(saveBalanceExpense(created, manual)).toBe(created);
    expect(manual).toMatchObject({ description: 'Aluguel', supplier: 'Associação' });
    expect(created.audit.at(-1)).toMatchObject({ entityId: manual.id, action: 'Despesa lançada', after: manual });
    const updated = saveBalanceExpense(created, { ...manual, amountCents: 13000 });
    expect(updated.audit.at(-1)).toMatchObject({ entityId: manual.id, action: 'Despesa atualizada', before: manual });
    expect(balanceTotals(balanceMovements(updated)).paidCents).toBe(13000);
    const reversed = reverseBalanceExpense(updated, manual.id);
    expect(reversed.balanceExpenses![0].reversedAt).toBeTruthy();
    expect(reversed.audit.map(entry => entry.action)).toEqual(['Despesa lançada', 'Despesa atualizada', 'Despesa estornada']);
    expect(balanceMovements(reversed)).toEqual([]);
    expect(() => saveBalanceExpense(reversed, manual)).toThrow(/estornada/);
    expect(() => reverseBalanceExpense(reversed, manual.id)).toThrow(/estornada/);
  });

  it('rejeita valor impreciso, data futura, descrição vazia e edição de despesa inexistente', () => {
    expect(() => saveBalanceExpense(emptyState, { ...expense, amountCents: 1.25 })).toThrow(/valor/);
    expect(() => saveBalanceExpense(emptyState, { ...expense, date: '2026-11-18' })).toThrow(/data/);
    expect(() => saveBalanceExpense(emptyState, { ...expense, description: ' ' })).toThrow(/descrição/);
    expect(() => saveBalanceExpense(emptyState, { ...expense, id: 'missing' })).toThrow(/encontrada/);
  });

  it('desfaz um estorno, restaura o resultado e conserva todos os eventos anteriores', () => {
    const created = saveBalanceExpense(emptyState, expense);
    const manual = created.balanceExpenses![0];
    const reversed = reverseBalanceExpense(created, manual.id);
    const restored = restoreBalanceExpense(reversed, manual.id);
    expect(restored.balanceExpenses![0].reversedAt).toBeNull();
    expect(balanceTotals(balanceMovements(restored))).toEqual({ receivedCents: 0, paidCents: expense.amountCents, resultCents: -expense.amountCents });
    expect(restored.audit.map(event => event.action)).toEqual(['Despesa lançada', 'Despesa estornada', 'Estorno de despesa desfeito']);
    expect(restored.audit.at(-1)).toMatchObject({ before: reversed.balanceExpenses![0], after: restored.balanceExpenses![0] });
    expect(() => restoreBalanceExpense(restored, manual.id)).toThrow(/sem estorno/);
    expect(reverseBalanceExpense(restored, manual.id).balanceExpenses![0].reversedAt).toBeTruthy();
  });

  it('reserva o lançamento ao Administrador e identifica o autor na auditoria', () => {
    const [admin, operation, consult] = demoActors;
    const created = saveBalanceExpense(emptyState, expense);
    expect(() => assertTransition(emptyState, created, admin)).not.toThrow();
    expect(() => assertTransition(emptyState, created, operation)).toThrow(/Administrador/);
    expect(() => assertTransition(emptyState, created, consult)).toThrow(/somente leitura/);
    expect(stampActor(emptyState, created, admin).audit.at(-1)?.actor).toEqual(admin);
  });
});
