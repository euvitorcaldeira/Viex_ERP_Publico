import { useScreenPreference } from '../components/screenPreferences';
import { sortTableRows, type ColumnSort } from '../components/tableSort';
import { SortableTable } from '../components/SortableTable';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, History as HistoryIcon, Pencil, Plus, Redo2, Undo2 } from 'lucide-react';
import { ActionIcon } from '../components/ActionIcon';
import { Modal } from '../components/Modal';
import { Stat } from '../components/Stat';
import { dateLabel, money, today } from '../format';
import { History, type Commit } from '../v3/common';
import type { State } from '../v3/domain';
import { BalanceExpenseDialog } from './BalanceExpenseDialog';
import { BALANCE_EXPENSE_CATEGORIES, balanceMonths, balanceMovements, balanceTotals, restoreBalanceExpense, reverseBalanceExpense, type BalanceExpense, type BalanceMovement } from './balance';
import './balance.css';

const chartPageSize = 12;
const tablePageSize = 20;
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const sourceLabel: Record<BalanceMovement['source'], string> = {
  manual: 'Lançamento manual', receipt: 'Contas a receber', employee: 'Funcionários', workshop: 'Oficinas', tax: 'Impostos',
};
type Period = { start: string; end: string };
type ChartView = 'Resultado' | 'Entradas e saídas';

function monthNumber(month: string) {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1;
}

function monthString(index: number) {
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`;
}

function monthLabel(month: string) {
  return monthFormatter.format(new Date(`${month}-01T12:00:00Z`)).replace('.', '');
}

function periodLabel(start: string, end: string) {
  return start === end ? monthLabel(start) : `${monthLabel(start)} – ${monthLabel(end)}`;
}

export function Balance({ state, commit, navigation }: { state: State; commit: Commit; navigation: ReactNode }) {
  const categoryMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeMenu(event: PointerEvent) {
      if (categoryMenu.current && !categoryMenu.current.contains(event.target as Node)) categoryMenu.current.open = false;
    }
    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, []);
  const currentDate = today();
  const currentMonth = currentDate.slice(0, 7);
  const [period, setPeriod] = useScreenPreference<Period>('balanco:periodo',{ start: monthString(monthNumber(currentMonth) - 5), end: currentMonth });
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedCategories, setSelectedCategories] = useScreenPreference<string[]>('balanco:categorias',[]);
  const [chartView, setChartView] = useScreenPreference<ChartView>('balanco:grafico','Resultado');
  const [showReversed, setShowReversed] = useState(false);
  const [chartPage, setChartPage] = useState(0);
  const [tablePage, setTablePage] = useState(0);
  const [tableSort, setTableSort] = useScreenPreference<ColumnSort | null>('balanco:ordem',null);
  const [editor, setEditor] = useState<{ expense?: BalanceExpense } | null>(null);
  const [history, setHistory] = useState<BalanceExpense | null>(null);

  const active = useMemo(() => balanceMovements(state), [state]);
  const expenses = state.balanceExpenses ?? [];
  const expensesById = new Map(expenses.map(expense => [expense.id, expense]));
  const categories = [...new Set(['Recebimentos', 'Funcionários', 'Oficinas', 'Impostos', ...BALANCE_EXPENSE_CATEGORIES, ...expenses.map(expense => expense.category)])]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const inPeriod = (date: string) => date.slice(0, 7) >= period.start && date.slice(0, 7) <= period.end;
  const inMonth = (date: string) => !selectedMonth || date.startsWith(selectedMonth);
  const inCategory = (value: string) => !selectedCategories.length || selectedCategories.includes(value);
  const periodMovements = active.filter(row => inPeriod(row.date) && inCategory(row.category));
  const detailMovements = periodMovements.filter(row => inMonth(row.date));
  const totals = balanceTotals(detailMovements);
  const billedTotal = state.invoices.reduce((sum, invoice) => sum + invoice.totalCents, 0);
  const scopeLabel = selectedMonth ? monthLabel(selectedMonth) : periodLabel(period.start, period.end);
  const periodLength = monthNumber(period.end) - monthNumber(period.start) + 1;
  const chartPages = Math.ceil(periodLength / chartPageSize);
  const chartEnd = monthNumber(period.end) - chartPage * chartPageSize;
  const chartStart = Math.max(monthNumber(period.start), chartEnd - chartPageSize + 1);
  const months = balanceMonths(periodMovements, monthString(chartStart), monthString(chartEnd));
  const barScale = chartView === 'Resultado'
    ? Math.max(1, ...months.map(month => Math.abs(month.resultCents)))
    : Math.max(1, ...months.flatMap(month => [month.receivedCents, month.paidCents]));
  const hasCategoryFilter = selectedCategories.length > 0;
  const resultLabel = hasCategoryFilter ? 'Entradas menos saídas da seleção' : totals.resultCents === 0 ? 'Em equilíbrio' : totals.resultCents > 0 ? 'Positivo' : 'Negativo';

  const categoryCosts = new Map<string, number>();
  for (const row of active) {
    if (row.amountCents < 0 && inPeriod(row.date) && inMonth(row.date)) {
      categoryCosts.set(row.category, (categoryCosts.get(row.category) ?? 0) - row.amountCents);
    }
  }
  const costs = [...categoryCosts].sort((a, b) => b[1] - a[1]);
  const maxCost = costs[0]?.[1] ?? 1;

  const reversed: BalanceMovement[] = showReversed ? expenses
    .filter(expense => expense.reversedAt && inPeriod(expense.date) && inMonth(expense.date) && inCategory(expense.category))
    .map(expense => ({ ...expense, source: 'manual', amountCents: -expense.amountCents })) : [];
  const rows = sortTableRows([...detailMovements, ...reversed].sort((a, b) => b.date.localeCompare(a.date)), tableSort,
    row => [row.date,row.category,row.description,sourceLabel[row.source],row.amountCents]);
  const tablePages = Math.max(1, Math.ceil(rows.length / tablePageSize));
  const page = Math.min(tablePage, tablePages - 1);

  function updatePeriod(next: Period) {
    setPeriod(next);
    setSelectedMonth('');
    setChartPage(0);
    setTablePage(0);
  }

  function toggleCategory(value: string) {
    setSelectedCategories(selectedCategories.includes(value) ? selectedCategories.filter(category => category !== value) : [...selectedCategories, value]);
    setTablePage(0);
  }

  function resetFilters() {
    setPeriod({ start: monthString(monthNumber(currentMonth) - 5), end: currentMonth });
    setSelectedMonth('');
    setSelectedCategories([]);
    setTablePage(0);
    setChartPage(0);
  }

  function focusMonth(month: string) {
    setSelectedMonth(previous => previous === month ? '' : month);
    setTablePage(0);
  }

  function reverse(expense: BalanceExpense) {
    if (window.confirm(`Estornar “${expense.description}” (${money(expense.amountCents)})? O lançamento ficará disponível no histórico.`)) {
      commit(current => reverseBalanceExpense(current, expense.id), 'Despesa estornada.');
    }
  }

  if (typeof __DALEX_LOCAL__ !== 'undefined' && __DALEX_LOCAL__ && !Array.isArray(state.balanceExpenses)) {
    return <>{navigation}<section className="panel balance-panel">
      <h2>Reabra o aplicativo para ativar o Balanço</h2>
      <p className="footnote">Feche a janela de execução do D’ALEX e abra DALEX.py novamente. Depois atualize esta página para carregar a estrutura de despesas.</p>
    </section></>;
  }

  return <div className="balance">
    {navigation}
    <section className="panel balance-filters finance-filter-header" aria-label="Filtros do balanço">
      <h2>Balanço mensal</h2>
      <div className="finance-filter-row balance-filter-row">
        <label>Período<select value={period.end === currentMonth ? [1, 3, 6, 12].find(length =>
          period.start === monthString(monthNumber(currentMonth) - length + 1)) ?? '' : ''}
          onChange={event => {
            const length = Number(event.target.value);
            if (length) updatePeriod({ start: monthString(monthNumber(currentMonth) - length + 1), end: currentMonth });
          }}>
          <option value="" disabled>Personalizado</option>
          <option value={1}>Mês atual</option>
          <option value={3}>Últimos 3 meses</option>
          <option value={6}>Últimos 6 meses</option>
          <option value={12}>Últimos 12 meses</option>
        </select></label>
        <label>De<input type="month" value={period.start} max={currentMonth} onChange={event => {
          const start = event.target.value;
          if (/^\d{4}-\d{2}$/.test(start) && start >= '0001-01' && start <= currentMonth) updatePeriod({ start, end: start > period.end ? start : period.end });
        }} /></label>
        <label>Até<input type="month" value={period.end} max={currentMonth} onChange={event => {
          const end = event.target.value;
          if (/^\d{4}-\d{2}$/.test(end) && end >= '0001-01' && end <= currentMonth) updatePeriod({ end, start: end < period.start ? end : period.start });
        }} /></label>
        <div className="balance-category-filter">
          <span>Categorias</span>
          <details ref={categoryMenu} onKeyDown={event => { if (event.key === 'Escape' && categoryMenu.current) { categoryMenu.current.open = false; categoryMenu.current.querySelector('summary')?.focus(); } }}>
            <summary>{hasCategoryFilter ? `${selectedCategories.length} selecionada(s)` : 'Todas as categorias'}</summary>
            <div className="balance-category-options">
              <button type="button" className="text-link" onClick={() => setSelectedCategories([])}>Todas as categorias</button>
              {categories.map(value => <label key={value}><input type="checkbox" checked={selectedCategories.includes(value)} onChange={() => toggleCategory(value)} />{value}</label>)}
            </div>
          </details>
        </div>
        <button className="secondary" onClick={resetFilters}>Limpar filtros</button>
        <button className="primary" onClick={() => setEditor({})}><Plus size={16} />Lançar despesa</button>
      </div>
      {selectedMonth && <div className="balance-scope" aria-live="polite">
        <strong>{scopeLabel}</strong>
        <button className="text-link" onClick={() => focusMonth(selectedMonth)}>Voltar ao período completo</button>
      </div>}
    </section>
    <div className="stats balance-stats" aria-live="polite">
      <Stat label="Recebido" value={money(totals.receivedCents)} note="Entradas confirmadas" />
      <Stat label="Pago" value={money(totals.paidCents)} note="Saídas confirmadas" />
      <div className={`balance-result ${totals.resultCents < 0 ? 'balance-negative' : totals.resultCents > 0 ? 'balance-positive' : ''}`}>
        <Stat label={hasCategoryFilter ? 'Fluxo selecionado' : 'Resultado de caixa'} value={money(totals.resultCents)} note={resultLabel} />
      </div>
      <Stat label="Faturamento acumulado" value={money(billedTotal)} note={billedTotal >= 100000000 ? 'Marco de R$ 1 milhão atingido' : `${money(100000000 - billedTotal)} para o marco de R$ 1 milhão`} />
    </div>

    <div className="balance-panels">
      <section className="panel balance-panel">
        <div className="balance-panel-heading">
          <h2>Resultado por mês</h2>
          {chartPages > 1 && <div className="inline-actions">
            <ActionIcon label="Mostrar meses anteriores" icon={<ChevronLeft size={16} />} disabled={chartPage + 1 >= chartPages} onClick={() => setChartPage(chartPage + 1)} />
            <small>{periodLabel(monthString(chartStart), monthString(chartEnd))}</small>
            <ActionIcon label="Mostrar meses seguintes" icon={<ChevronRight size={16} />} disabled={chartPage === 0} onClick={() => setChartPage(chartPage - 1)} />
          </div>}
        </div>
        <div className="tabs balance-chart-tabs" aria-label="Visualização do gráfico">
          {(['Resultado', 'Entradas e saídas'] as ChartView[]).map(view => <button key={view} type="button" aria-pressed={view === chartView} className={view === chartView ? 'selected' : ''} onClick={() => setChartView(view)}>{view}</button>)}
        </div>
        <div className="balance-chart" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(46px, 1fr))` }}>
          {months.map(({ month, resultCents, receivedCents, paidCents }) => <button
            type="button" key={month} className="balance-month" aria-pressed={selectedMonth === month}
            aria-label={`${monthLabel(month)}, recebido ${money(receivedCents)}, pago ${money(paidCents)}, resultado ${money(resultCents)}`}
            title={`${monthLabel(month)} · Recebido ${money(receivedCents)} · Pago ${money(paidCents)} · Resultado ${money(resultCents)}`} onClick={() => focusMonth(month)}
          >
            {chartView === 'Resultado'
              ? <span className="balance-bar-track"><span className={`balance-bar ${resultCents < 0 ? 'balance-bar-negative' : ''}`} style={{ height: `${48 * Math.abs(resultCents) / barScale}%` }} /></span>
              : <span className="balance-bar-track balance-pair-track">
                <span className="balance-pair-income" style={{ height: `${96 * receivedCents / barScale}%` }} />
                <span className="balance-pair-expense" style={{ height: `${96 * paidCents / barScale}%` }} />
              </span>}
            <small>{monthLabel(month)}</small>
          </button>)}
        </div>
        {chartView === 'Entradas e saídas' && <div className="balance-legend"><span>Entradas <i className="balance-income-dot" /></span><span>Saídas <i className="balance-expense-dot" /></span></div>}
        <p className="footnote">Clique em um mês para ver os detalhes. Clique novamente para limpar a seleção.</p>
      </section>
      <section className="panel balance-panel">
        <h2>Despesas por categoria</h2>
        {costs.length ? <ul className="balance-categories">{costs.map(([name, value]) => <li key={name}>
          <button type="button" aria-pressed={selectedCategories.includes(name)} onClick={() => toggleCategory(name)}>
            <span>{name}</span><strong>{money(value)}</strong>
            <span className="balance-category-track" aria-hidden="true"><span style={{ width: `${100 * value / maxCost}%` }} /></span>
          </button>
        </li>)}</ul> : <p className="footnote">Sem despesas no período selecionado.</p>}
      </section>
    </div>

    <section className="panel">
      <div className="panel-heading balance-panel-heading">
        <div><h2>Lançamentos</h2><p>{rows.length} movimento(s) · {scopeLabel}</p></div>
        <label className="check-label"><input type="checkbox" checked={showReversed} onChange={event => { setShowReversed(event.target.checked); setTablePage(0); }} />Mostrar despesas estornadas</label>
      </div>
      <div className="table-wrap">
        <SortableTable sort={tableSort} onSortChange={sort => { setTableSort(sort); setTablePage(0); }}><thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Origem</th><th>Valor</th><th>Ações</th></tr></thead>
          <tbody>{rows.slice(page * tablePageSize, (page + 1) * tablePageSize).map(row => {
            const expense = row.source === 'manual' ? expensesById.get(row.id) : undefined;
            return <tr key={`${row.source}-${row.id}`}>
              <td>{dateLabel(row.date)}</td><td>{row.category}</td>
              <td>{row.description}{(row.supplier || row.note) && <small className="balance-note">{[row.supplier, row.note].filter(Boolean).join(' · ')}</small>}</td>
              <td>{sourceLabel[row.source]}{row.reversedAt && <small>Estornada</small>}</td>
              <td className="balance-amount">{money(row.amountCents)}</td>
              <td>{expense && <div className="inline-actions">
                {!expense.reversedAt && <>
                  <ActionIcon label="Editar despesa" icon={<Pencil size={16} />} onClick={() => setEditor({ expense })} />
                  <ActionIcon label="Estornar despesa" icon={<Undo2 size={16} />} onClick={() => reverse(expense)} />
                </>}
                {expense.reversedAt && <ActionIcon label="Desfazer estorno da despesa" icon={<Redo2 size={16} />} onClick={() => {
                  if (window.confirm('Restaurar esta despesa no balanço?')) commit(current => restoreBalanceExpense(current, expense.id), 'Despesa restaurada.');
                }} />}
                <ActionIcon label="Ver histórico da despesa" icon={<HistoryIcon size={16} />} onClick={() => setHistory(expense)} />
              </div>}</td>
            </tr>;
          })}</tbody>
        </SortableTable>
        {!rows.length && <div className="empty">Nenhum movimento com os filtros selecionados.</div>}
      </div>
      {tablePages > 1 && <div className="table-footer pagination">
        <span>Página {page + 1} de {tablePages}</span>
        <div><button className="secondary" disabled={page === 0} onClick={() => setTablePage(page - 1)}>Anterior</button><button className="secondary" disabled={page + 1 === tablePages} onClick={() => setTablePage(page + 1)}>Próxima</button></div>
      </div>}
    </section>
    <p className="footnote">O balanço usa as datas efetivas de recebimento e pagamento registradas no ERP.</p>
    {editor && <BalanceExpenseDialog expense={editor.expense} knownCategories={expenses.map(expense => expense.category)} defaultDate={selectedMonth && selectedMonth !== currentMonth ? `${selectedMonth}-01` : currentDate} commit={commit} onClose={() => setEditor(null)} />}
    {history && <Modal title="Histórico da despesa" subtitle={history.description} onClose={() => setHistory(null)}><div className="modal-body"><History state={state} id={history.id} /></div></Modal>}
  </div>;
}
