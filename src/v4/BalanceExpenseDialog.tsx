import { useState, type FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { cents, today } from '../format';
import type { Commit } from '../v3/common';
import { BALANCE_EXPENSE_CATEGORIES, saveBalanceExpense, type BalanceExpense } from './balance';

export function BalanceExpenseDialog({ expense, defaultDate, knownCategories, commit, onClose }: {
  expense?: BalanceExpense;
  defaultDate: string;
  knownCategories: string[];
  commit: Commit;
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  const [customCategory, setCustomCategory] = useState(false);
  const categories = [...new Set([...BALANCE_EXPENSE_CATEGORIES, ...knownCategories, ...(expense ? [expense.category] : [])])].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const value = (key: string) => String(fields.get(key) ?? '');
    const categoryName = value(customCategory ? 'customCategory' : 'category').trim();
    const message = commit(current => saveBalanceExpense(current, {
      id: expense?.id,
      date: value('date'),
      category: categories.find(category => category.toLocaleLowerCase('pt-BR') === categoryName.toLocaleLowerCase('pt-BR')) ?? categoryName,
      description: value('description'),
      amountCents: cents(value('amount')),
      supplier: value('supplier'),
      note: value('note'),
    }), expense ? 'Despesa atualizada.' : 'Despesa lançada.', { inlineError: true });
    setError(message ?? '');
    if (!message) onClose();
  }

  return <Modal title={expense ? 'Editar despesa' : 'Lançar despesa'} subtitle="BALANÇO MENSAL" onClose={onClose} footer={<>
    <button className="secondary" onClick={onClose}>Cancelar</button>
    <button className="primary" form="balance-expense" type="submit">Salvar despesa</button>
  </>}>
    <form id="balance-expense" className="modal-body balance-expense-form" onSubmit={save} onChange={() => setError('')}>
      <div className="form-grid">
        <label>Data do pagamento<input type="date" name="date" required max={today()} defaultValue={expense?.date ?? defaultDate} /></label>
        <label>Valor (R$)<input name="amount" inputMode="decimal" required maxLength={18} placeholder="0,00" defaultValue={expense ? (expense.amountCents / 100).toFixed(2).replace('.', ',') : ''} /></label>
        <label>Categoria<select name="category" required defaultValue={expense?.category ?? ''} onChange={event => setCustomCategory(event.target.selectedOptions[0]?.dataset.custom === 'true')}>
          <option value="" disabled>Selecione uma categoria</option>
          {categories.map(category => <option key={category} value={category}>{category}</option>)}
          <option data-custom="true">Nova categoria…</option>
        </select>
        </label>
        <label>Fornecedor · opcional<input name="supplier" maxLength={120} defaultValue={expense?.supplier} /></label>
      </div>
      {customCategory && <label>Nome da nova categoria<input name="customCategory" required maxLength={80} autoComplete="off" /></label>}
      <label>Descrição<input name="description" required maxLength={200} placeholder="Ex.: Compra de linhas" defaultValue={expense?.description} /></label>
      <label>Observação · opcional<textarea name="note" rows={2} maxLength={1000} defaultValue={expense?.note} /></label>
      <p className="footnote">Use este formulário para despesas que ainda não foram registradas em outro módulo.</p>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  </Modal>;
}
