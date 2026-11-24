import { validDate } from '../domain';
import { today } from '../format';
import { audit, uid, type BalanceExpense, type State } from '../v3/domain';

export type { BalanceExpense } from '../v3/domain';
export type BalanceExpenseInput = Omit<BalanceExpense, 'id' | 'reversedAt'> & { id?: string };

export const BALANCE_EXPENSE_CATEGORIES = [
  'Aluguel', 'Energia', 'Água', 'Internet e telefone', 'Materiais', 'Frete',
  'Transporte', 'Manutenção', 'Contabilidade', 'Serviços', 'Equipamentos', 'Outros',
] as const;

export interface BalanceMovement {
  id: string;
  date: string;
  category: string;
  description: string;
  amountCents: number;
  source: 'manual' | 'receipt' | 'employee' | 'workshop' | 'tax';
  supplier?: string;
  note?: string;
  reversedAt?: string | null;
}

export interface BalanceTotals {
  receivedCents: number;
  paidCents: number;
  resultCents: number;
}

export type BalanceMonth = BalanceTotals & { month: string };

export function balanceMovements(state: State): BalanceMovement[] {
  const invoices = new Map(state.invoices.map(invoice => [invoice.id, invoice]));
  const employees = new Map(state.employees.map(employee => [employee.id, employee.name]));
  const workshops = new Map(state.workshops.map(workshop => [workshop.id, workshop.name]));
  const movements: BalanceMovement[] = [];

  for (const receipt of state.receipts) {
    if (receipt.reversedAt || !receipt.date) continue;
    const invoice = invoices.get(receipt.invoiceId);
    movements.push({
      id: receipt.id, date: receipt.date, category: 'Recebimentos', source: 'receipt',
      description: invoice ? `NF ${invoice.number} · ${invoice.client}` : 'Recebimento de cliente',
      amountCents: receipt.amountCents,
    });
  }
  for (const payment of state.employeePayments) {
    if (payment.reversedAt) continue;
    const employee = employees.get(payment.employeeId) ?? 'Funcionário';
    movements.push({
      id: payment.id, date: payment.date, category: 'Funcionários', source: 'employee',
      description: `${payment.advance ? 'Adiantamento' : 'Pagamento'} · ${employee}`,
      amountCents: -payment.amountCents,
    });
  }
  for (const payment of state.workshopPayments) {
    if (payment.reversedAt) continue;
    movements.push({
      id: payment.id, date: payment.date, category: 'Oficinas', source: 'workshop',
      description: workshops.get(payment.workshopId) ?? 'Pagamento de oficina',
      amountCents: -payment.amountCents,
    });
  }
  for (const invoice of state.invoices) {
    if (!invoice.taxPaidAt || !invoice.taxCents || invoice.taxExempt) continue;
    movements.push({
      id: invoice.id, date: invoice.taxPaidAt, category: 'Impostos', source: 'tax',
      description: `Imposto da NF ${invoice.number}`, amountCents: -invoice.taxCents,
    });
  }
  for (const expense of state.balanceExpenses ?? []) {
    if (expense.reversedAt) continue;
    movements.push({
      id: expense.id, date: expense.date, category: expense.category, source: 'manual',
      description: expense.description, amountCents: -expense.amountCents,
      supplier: expense.supplier, note: expense.note,
    });
  }
  return movements.sort((left, right) => right.date.localeCompare(left.date));
}

export function filterBalanceMovements(movements: BalanceMovement[], startMonth: string, endMonth: string, category = ''): BalanceMovement[] {
  return movements.filter(movement => {
    const month = movement.date.slice(0, 7);
    return month >= startMonth && month <= endMonth && (!category || movement.category === category);
  });
}

function emptyTotals(): BalanceTotals {
  return { receivedCents: 0, paidCents: 0, resultCents: 0 };
}

function addToTotals(totals: BalanceTotals, amountCents: number) {
  if (amountCents >= 0) totals.receivedCents += amountCents;
  else totals.paidCents -= amountCents;
  totals.resultCents = totals.receivedCents - totals.paidCents;
}

export function balanceTotals(movements: BalanceMovement[]): BalanceTotals {
  const totals = emptyTotals();
  for (const movement of movements) addToTotals(totals, movement.amountCents);
  return totals;
}

function validMonth(month: string): boolean {
  return !month.startsWith('0000-') && validDate(`${month}-01`);
}

export function balanceMonths(movements: BalanceMovement[], startMonth: string, endMonth: string): BalanceMonth[] {
  if (!validMonth(startMonth) || !validMonth(endMonth) || startMonth > endMonth) return [];
  const totals = new Map<string, BalanceTotals>();
  for (const movement of filterBalanceMovements(movements, startMonth, endMonth)) {
    const month = movement.date.slice(0, 7);
    const monthTotals = totals.get(month) ?? emptyTotals();
    addToTotals(monthTotals, movement.amountCents);
    totals.set(month, monthTotals);
  }
  const [startYear, startNumber] = startMonth.split('-').map(Number);
  const [endYear, endNumber] = endMonth.split('-').map(Number);
  const months: BalanceMonth[] = [];
  for (let index = startYear * 12 + startNumber - 1; index <= endYear * 12 + endNumber - 1; index++) {
    const year = String(Math.floor(index / 12)).padStart(4, '0');
    const month = `${year}-${String(index % 12 + 1).padStart(2, '0')}`;
    months.push({ month, ...(totals.get(month) ?? emptyTotals()) });
  }
  return months;
}

export function saveBalanceExpense(state: State, input: BalanceExpenseInput): State {
  const expenses = state.balanceExpenses ?? [];
  const previous = expenses.find(expense => expense.id === input.id);
  if (input.id && !previous) throw new Error('Despesa não encontrada.');
  if (previous?.reversedAt) throw new Error('Uma despesa estornada não pode ser editada.');

  const { date, amountCents } = input;
  const category = input.category.trim();
  const description = input.description.trim();
  const supplier = input.supplier?.trim();
  const note = input.note?.trim();
  if (date.startsWith('0000-') || !validDate(date) || date > today()) throw new Error('Informe uma data de pagamento válida até hoje.');
  if (!category || category.length > 80) throw new Error('Informe uma categoria de até 80 caracteres.');
  if (!description || description.length > 200) throw new Error('Informe uma descrição de até 200 caracteres.');
  if (supplier && supplier.length > 120) throw new Error('Informe um fornecedor de até 120 caracteres.');
  if (note && note.length > 1000) throw new Error('Informe uma observação de até 1000 caracteres.');
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('Informe um valor maior que zero em reais.');

  if (previous && previous.date === date && previous.category === category && previous.description === description
      && previous.amountCents === amountCents && (previous.supplier ?? '') === (supplier ?? '') && (previous.note ?? '') === (note ?? '')) {
    return state;
  }

  const expense: BalanceExpense = {
    id: previous?.id ?? uid(), date, category, description, amountCents,
    ...(supplier ? { supplier } : {}),
    ...(note ? { note } : {}),
  };
  const next = previous ? expenses.map(item => item.id === expense.id ? expense : item) : [...expenses, expense];
  return audit({ ...state, balanceExpenses: next }, expense.id, previous ? 'Despesa atualizada' : 'Despesa lançada', previous, expense);
}

export function reverseBalanceExpense(state: State, id: string): State {
  const expenses = state.balanceExpenses ?? [];
  const previous = expenses.find(expense => expense.id === id);
  if (!previous || previous.reversedAt) throw new Error('Despesa inexistente ou já estornada.');
  const expense = { ...previous, reversedAt: new Date().toISOString() };
  const next = expenses.map(item => item.id === id ? expense : item);
  return audit({ ...state, balanceExpenses: next }, id, 'Despesa estornada', previous, expense);
}

export function restoreBalanceExpense(state: State, id: string): State {
  const expenses = state.balanceExpenses ?? [];
  const previous = expenses.find(expense => expense.id === id);
  if (!previous?.reversedAt) throw new Error('Despesa inexistente ou sem estorno para desfazer.');
  const expense = { ...previous, reversedAt: null };
  const next = expenses.map(item => item.id === id ? expense : item);
  return audit({ ...state, balanceExpenses: next }, id, 'Estorno de despesa desfeito', previous, expense);
}
