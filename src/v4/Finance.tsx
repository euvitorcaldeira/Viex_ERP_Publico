import { useScreenPreference } from '../components/screenPreferences';
import { SortableTable } from '../components/SortableTable';
import { useFormError } from '../components/useFormError';
import { useId, useRef, useState } from 'react';
import { Check, FileText, Pencil, HandCoins, Undo2, Download, CalendarDays } from 'lucide-react';
import { type State, type Bill, type Receipt, installmentReceived, monthReceipts, receive, reverseReceipt } from '../v3/domain';
import { type Commit, History } from '../v3/common';
import { dateLabel, today, cents } from '../format';
import { Stat } from '../components/Stat';
import { Modal } from '../components/Modal';
import { compareFinancial, updateDueDate, type FinancialSort } from './domain';
import { OpenInvoicesDialog } from './OpenInvoicesDialog';
import { ReceivableStat, receivableAmount } from './ReceivableStat';
import { TaxControl } from './TaxControl';
import { Balance } from './BalancePanel';
import { ActionIcon } from '../components/ActionIcon';
import { ArchiveMovementButton } from './ArchiveMovementButton';
import './finance.css';

const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function FinanceMonthPicker({ label, value, allowUndated, onChange }: {
  label: string; value: string; allowUndated: boolean; onChange: (month: string) => void;
}) {
  const current = today().slice(0, 7);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(current.slice(0, 4)));
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = /^\d{4}-\d{2}$/.test(value);
  const caption = selected ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + '-01T00:00:00Z')) : value === 'undated' ? 'Sem data' : value === 'overdue' ? 'Vencidas' : 'Todos os meses';

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function choose(month: string) {
    onChange(month);
    close();
  }

  return <div className="finance-month-filter" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); close(); }
  }}>
    <span id={id}>{label}</span>
    <button type="button" className="finance-month-trigger" ref={trigger} aria-expanded={open} aria-labelledby={id + ' ' + id + '-value'} onClick={() => {
      if (!open) setYear(Number((selected ? value : current).slice(0, 4)));
      setOpen(!open);
    }}><span id={id + '-value'}>{caption}</span><CalendarDays size={15} /></button>
    {open && <div className="finance-month-popup" role="group" aria-label={label}>
      <div className="finance-month-year">
        <button type="button" aria-label="Ano anterior" disabled={year <= 1} onClick={() => setYear(year - 1)}>‹</button>
        <strong aria-live="polite">{year}</strong>
        <button type="button" aria-label="Próximo ano" disabled={year >= 9999} onClick={() => setYear(year + 1)}>›</button>
      </div>
      <div className="finance-month-grid">{monthNames.map((name, index) => {
        const month = String(year).padStart(4, '0') + '-' + String(index + 1).padStart(2, '0');
        return <button type="button" key={name} aria-pressed={value === month} onClick={() => choose(month)}>{name}</button>;
      })}</div>
      <div className="finance-month-actions">
        <button type="button" className="text-link" onClick={() => choose(allowUndated ? current : '')}>{allowUndated ? 'Redefinir' : 'Limpar'}</button>
        {allowUndated && <>
          <button type="button" className="text-link" onClick={() => choose('undated')}>Sem data</button>
          <button type="button" className="text-link" onClick={() => choose('overdue')}>Vencidas</button>
        </>}
        <button type="button" className="text-link" onClick={() => choose(current)}>Este mês</button>
      </div>
    </div>}
  </div>;
}

function ProductLinks({ state, recordIds, onOpen }: { state: State; recordIds: string[]; onOpen: (id: string) => void }) {
  return <div className="finance-product-list">{recordIds.map(id => {
    const record = state.records.find(item => item.id === id);
    const products = record ? [...new Map(record.items.map(item => [item.code.trim().toLocaleUpperCase(), item])).values()] : [];
    const first = products[0];
    return <button key={id} className="finance-product-link" title={first ? `${first.code} · ${first.description}${first.family ? ` · ${first.family}` : ''}${products.length > 1 ? ` · mais ${products.length - 1} item(ns)` : ''}` : 'Item sem detalhes'} onClick={() => onOpen(id)}>
      <b>{first?.code || 'Item'}</b>
      <small>{first ? `${first.description}${first.family ? ` · ${first.family}` : ''}${products.length > 1 ? ` · +${products.length - 1} itens` : ''}` : 'Sem descrição disponível'}</small>
    </button>;
  })}</div>;
}

export function FinanceV4({ state, commit, onOpen, showReceivableTotal, onToggleReceivableTotal }: { state: State; commit: Commit; onOpen: (id: string) => void; showReceivableTotal: boolean; onToggleReceivableTotal: () => void }) {
  const [sort, setSort] = useScreenPreference<FinancialSort>('financeiro:ordem','Previsão mais próxima');
  const [schedule, setSchedule] = useState<{ invoiceId: string; partId: string; date: string } | null>(null);
  const [filter, setFilter] = useScreenPreference('financeiro:situacao','Em aberto');
  const [period, setPeriod] = useScreenPreference('financeiro:mes',today().slice(0, 7));
  const [openMode, setOpenMode] = useScreenPreference('financeiro:filtro-vencimento','');
  const [payment, setPayment] = useState<{ invoice: Bill; partId: string } | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [error, setError] = useFormError();
  const [historyId, setHistoryId] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [view, setView] = useScreenPreference('financeiro:aba','Contas a Receber');

  const rows = state.invoices.flatMap(invoice => invoice.installments.map((part, index) => ({ invoice, part, index, paid: installmentReceived(state, part.id) })));
  const openRows = rows.filter(row => row.paid < row.part.amountCents);
  const todayDate = today();
  const openPeriod = period || todayDate.slice(0, 7);
  const activeOpenMode = filter === 'Em aberto' ? openMode : '';
  const selectedOpenRows = openRows.filter(({ part }) => {
    if (activeOpenMode === 'undated') return !part.dueDate;
    if (activeOpenMode === 'overdue') return !!part.dueDate && part.dueDate < todayDate;
    return part.dueDate.startsWith(openPeriod);
  });
  const overdueRows = openRows.filter(({ part }) => part.dueDate && part.dueDate < todayDate);
  const undatedRows = openRows.filter(({ part }) => !part.dueDate);
  const openTotal = openRows.reduce((sum, row) => sum + row.part.amountCents - row.paid, 0);
  const openBalance = selectedOpenRows.reduce((sum, row) => sum + row.part.amountCents - row.paid, 0);
  const openScope = activeOpenMode === 'undated' ? 'Sem data' : activeOpenMode === 'overdue' ? 'Vencidas' : openPeriod.split('-').reverse().join('/');
  const visible = [...selectedOpenRows];
  const receivedPeriod = filter === 'Recebidas' ? period : openPeriod;
  const received = monthReceipts(state, receivedPeriod);
  const receivedAmount = receivableAmount(received.reduce((sum, row) => sum + row.amountCents, 0), showReceivableTotal);
  const periodRows = state.receipts.filter(receipt => receipt.date.startsWith(period));
  const balanceByInvoice = new Map<string, number>();
  for (const { invoice, part, paid } of selectedOpenRows) {
    balanceByInvoice.set(invoice.id, (balanceByInvoice.get(invoice.id) ?? 0) + part.amountCents - paid);
  }
  const openInvoices = state.invoices.flatMap(invoice => {
    const balanceCents = balanceByInvoice.get(invoice.id) ?? 0;
    return balanceCents > 0 ? [{ invoice, balanceCents }] : [];
  });

  visible.sort((a, b) => compareFinancial(
    { number: a.invoice.number, amount: a.part.amountCents, date: a.part.dueDate },
    { number: b.invoice.number, amount: b.part.amountCents, date: b.part.dueDate }, sort,
  ));
  periodRows.sort((a, b) => compareFinancial(
    { number: state.invoices.find(invoice => invoice.id === a.invoiceId)!.number, amount: a.amountCents, date: a.date },
    { number: state.invoices.find(invoice => invoice.id === b.invoiceId)!.number, amount: b.amountCents, date: b.date }, sort,
  ));

  const financeNavigation = <div className="tabs finance-tabs finance-tabs-bottom">
    {['Contas a Receber', 'Impostos', 'Balanço mensal'].map(tab => <button key={tab} className={view === tab ? 'selected' : ''} onClick={() => setView(tab)}>{tab}</button>)}
  </div>;

  function openPayment(invoice: Bill, partId: string, balance: number) {
    setPayment({ invoice, partId }); setAmount((balance / 100).toFixed(2)); setDate(today()); setError('');
  }

  function undo(receipt: Receipt) {
    if (window.confirm(`Desfazer o recebimento de ${receivableAmount(receipt.amountCents, showReceivableTotal)}? O saldo será reaberto e a correção ficará no histórico.`)) {
      commit(state => reverseReceipt(state, receipt.id), 'Recebimento desfeito com histórico.');
    }
  }

  return <>
    {view === 'Impostos'
      ? <TaxControl state={state} commit={commit} navigation={financeNavigation} />
      : view === 'Balanço mensal'
        ? <Balance state={state} commit={commit} navigation={financeNavigation} />
      : <>
        {financeNavigation}
        <section className="panel finance-filter-header">
          <h2>Contas a Receber</h2>
          <div className="finance-filter-row">
            <label>Situação<select value={filter} onChange={event => setFilter(event.target.value)}>
              <option>Em aberto</option><option>Recebidas</option>
            </select></label>
            <FinanceMonthPicker
              label={filter === 'Em aberto' ? 'Mês de vencimento' : 'Mês do recebimento'}
              value={filter === 'Em aberto' ? openMode || openPeriod : period}
              allowUndated={filter === 'Em aberto'}
              onChange={month => {
                const special = month === 'undated' || month === 'overdue';
                setOpenMode(special ? month : '');
                if (!special) setPeriod(month);
              }}
            />
            <label>Ordenar por<select aria-label="Ordenar financeiro" value={sort} onChange={event => setSort(event.target.value as FinancialSort)}>{['Maior valor', 'Menor valor', 'Número da NF', 'Previsão mais próxima', 'Previsão mais distante'].map(item => <option key={item}>{item}</option>)}</select></label>
            <button className="secondary prepare-message" disabled={!openInvoices.length} onClick={() => setExportOpen(true)}>
                <Download size={15} />Exportar em aberto · {openInvoices.length}
              </button>
            <span className="filter-total">{filter === 'Recebidas'
              ? `${received.length} recebimento(s) · ${receivedAmount}`
              : `${visible.length} parcela(s) · ${receivableAmount(visible.reduce((sum, row) => sum + row.part.amountCents - row.paid, 0), showReceivableTotal)}`}</span>
          </div>
        </section>
        <div className={filter === 'Recebidas' ? 'stats two' : 'stats three'}>
          {filter === 'Em aberto' ? <>
            <ReceivableStat
              label={`A receber · ${openScope}`}
              total={openBalance}
              note={<span className="finance-filter-subtotal"><span>Saldo total em aberto</span><b>{receivableAmount(openTotal, showReceivableTotal)}</b></span>}
              visible={showReceivableTotal}
              onToggle={onToggleReceivableTotal}
              onActivate={() => setOpenMode('')}
            />
            <Stat label="Vencidas" value={receivableAmount(overdueRows.reduce((sum, row) => sum + row.part.amountCents - row.paid, 0), showReceivableTotal)}
              icon={<CalendarDays />} note={`${overdueRows.length} parcela(s) vencida(s)`}
              onActivate={() => { setOpenMode('overdue'); setSort('Previsão mais próxima'); }} />
            <Stat label="Sem data" value={receivableAmount(undatedRows.reduce((sum, row) => sum + row.part.amountCents - row.paid, 0), showReceivableTotal)}
              icon={<FileText />} note={`${undatedRows.length} parcela(s) sem previsão`}
              onActivate={() => setOpenMode('undated')} />
          </> : <>
            <ReceivableStat label="Recebido" total={received.reduce((sum, row) => sum + row.amountCents, 0)}
              visible={showReceivableTotal} onToggle={onToggleReceivableTotal}
              note={receivedPeriod ? `Recebimentos efetivos em ${receivedPeriod.split('-').reverse().join('/')}` : 'Recebimentos de todos os meses'} />
            <Stat label="Pagamentos registrados" value={String(received.length)} icon={<Check />} note="Recebimentos ativos no período" />
          </>}
        </div>
        <section className="panel">
          <div className="table-wrap">
            {filter === 'Recebidas'
              ? <SortableTable key={sort+"-"+filter} className="finance-table"><thead><tr><th>NF / Cliente</th><th>Código / Item</th><th>Recebido em</th><th>Valor</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
                {periodRows.map(receipt => {
                  const invoice = state.invoices.find(item => item.id === receipt.invoiceId)!;
                  return <tr key={receipt.id}>
                    <td><button className="text-link" onClick={() => setHistoryId(invoice.id)}>NF {invoice.number}</button><small>{invoice.client}</small></td>
                    <td data-sort-value={invoice.recordIds.flatMap(id => state.records.find(record => record.id === id)?.items.map(item => item.code) ?? []).join(" ")}><ProductLinks state={state} recordIds={invoice.recordIds} onOpen={onOpen} /></td>
                    <td>{receipt.dateUnknown && !receipt.date ? 'Pago — data desconhecida' : dateLabel(receipt.date)}</td><td>{receivableAmount(receipt.amountCents, showReceivableTotal)}</td>
                    <td><span className={'badge ' + (receipt.reversedAt ? 'waiting' : 'done')}>{receipt.reversedAt ? 'Desfeito' : 'Recebido'}</span></td>
                    <td><div className="inline-actions">{!receipt.reversedAt && <ActionIcon label="Estornar recebimento" icon={<Undo2 size={16} />} onClick={() => undo(receipt)} />}<ArchiveMovementButton commit={commit} kind="receipts" movementId={receipt.id} reversed={!!receipt.reversedAt} /></div></td>
                  </tr>;
                })}
              </tbody></SortableTable>
              : <SortableTable key={sort+"-"+filter} className="finance-table"><thead><tr><th>NF / Cliente</th><th>Código / Item</th><th>Parcela</th><th>Vencimento</th><th>Valor / Saldo</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
                {visible.map(({ invoice, part, index, paid }) => <tr key={part.id}>
                  <td><button className="text-link" onClick={() => setHistoryId(invoice.id)}>NF {invoice.number}</button><small>{invoice.client}</small></td>
                  <td data-sort-value={invoice.recordIds.flatMap(id => state.records.find(record => record.id === id)?.items.map(item => item.code) ?? []).join(" ")}><ProductLinks state={state} recordIds={invoice.recordIds} onOpen={onOpen} /></td>
                  <td>{index + 1}/{invoice.installments.length}</td><td>{part.dueDate ? dateLabel(part.dueDate) : 'A definir'}</td>
                  <td>{receivableAmount(part.amountCents, showReceivableTotal)}<small>Saldo: {receivableAmount(part.amountCents - paid, showReceivableTotal)}</small></td>
                  <td><span className={'badge ' + (paid === part.amountCents ? 'done' : 'waiting')}>{paid === part.amountCents ? 'Recebido' : paid > 0 ? 'Parcialmente recebido' : 'Em aberto'}</span></td>
                  <td><div className="inline-actions"><ActionIcon label="Editar previsão" icon={<Pencil size={16} />} onClick={() => { setSchedule({ invoiceId: invoice.id, partId: part.id, date: part.dueDate }); setError(''); }} />{paid < part.amountCents && <ActionIcon label="Registrar recebimento" icon={<HandCoins size={16} />} onClick={() => openPayment(invoice, part.id, part.amountCents - paid)} />}</div></td>
                </tr>)}
              </tbody></SortableTable>}
            {((filter === 'Recebidas') ? !periodRows.length : !visible.length) && <div className="empty">Nenhum registro neste filtro.</div>}
          </div>
        </section>
        <p className="footnote">As parcelas em aberto seguem o mês do vencimento. Os recebimentos seguem o mês do pagamento.</p>
        {exportOpen && <OpenInvoicesDialog
          openInvoices={openInvoices}
          undatedIds={rows.filter(row => !row.part.dueDate && row.paid < row.part.amountCents).map(row => row.invoice.id)}
          commit={commit}
          onClose={() => setExportOpen(false)}
        />}
        {schedule && <Modal title="Editar previsão de pagamento" subtitle={'NF ' + state.invoices.find(invoice => invoice.id === schedule.invoiceId)?.number} onClose={() => setSchedule(null)} footer={<>
          <button className="secondary" onClick={() => setSchedule(null)}>Cancelar</button>
          <button className="primary" onClick={() => { const message = commit(current => updateDueDate(current, schedule.invoiceId, schedule.partId, schedule.date), 'Previsão atualizada sem alterar valores ou recebimentos.', { inlineError: true }); setError(message || ''); if (!message) setSchedule(null); }}>Salvar previsão</button>
        </>}><div className="modal-body"><label>Previsão de pagamento<input type="date" aria-label="Previsão de pagamento" value={schedule.date} min={state.invoices.find(invoice => invoice.id === schedule.invoiceId)?.issueDate} onChange={event => setSchedule({ ...schedule, date: event.target.value })} /></label><p className="footnote">Deixe em branco enquanto aguarda a programação do cliente. Esta alteração não registra nem desfaz recebimentos.</p>{error && <p className="error" role="alert">{error}</p>}</div></Modal>}
        {payment && <Modal title="Registrar recebimento" subtitle={`NF ${payment.invoice.number}`} onClose={() => setPayment(null)} footer={<><button className="secondary" onClick={() => setPayment(null)}>Cancelar</button><button className="primary" onClick={() => { const message = commit(current => receive(current, payment.invoice.id, payment.partId, date, cents(amount)), 'Recebimento registrado.', { inlineError: true }); setError(message || ''); if (!message) setPayment(null); }}>Confirmar recebimento</button></>}>
          <div className="modal-body"><div className="form-grid"><label>Data de recebimento<input type="date" max={today()} min={payment.invoice.issueDate} value={date} onChange={event => setDate(event.target.value)} /></label><label>Valor recebido (R$)<input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /></label></div><p className="footnote">Pode receber parte da parcela. O saldo restante continuará em aberto.</p>{error && <p className="error" role="alert">{error}</p>}</div>
        </Modal>}
        {historyId && <Modal title={`Histórico da NF ${state.invoices.find(invoice => invoice.id === historyId)?.number}`} subtitle="REGISTROS E CORREÇÕES" onClose={() => setHistoryId('')}><div className="modal-body"><History state={state} id={historyId} /></div></Modal>}
      </>}
  </>;
}
