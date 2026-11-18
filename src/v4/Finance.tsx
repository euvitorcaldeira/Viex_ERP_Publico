import { SortableTable } from '../components/SortableTable';
import { useFormError } from '../components/useFormError';
import { useState } from 'react';
import { Check, FileText, Pencil, HandCoins, Undo2, Download } from 'lucide-react';
import { type State, type Bill, type Receipt, receivableTotal, installmentReceived, monthReceipts, receive, reverseReceipt } from '../v3/domain';
import { type Commit, History } from '../v3/common';
import { money, dateLabel, today, cents } from '../format';
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
  const [sort, setSort] = useState<FinancialSort>('Previsão mais próxima');
  const [schedule, setSchedule] = useState<{ invoiceId: string; partId: string; date: string } | null>(null);
  const [filter, setFilter] = useState('Em aberto');
  const [period, setPeriod] = useState(today().slice(0, 7));
  const [payment, setPayment] = useState<{ invoice: Bill; partId: string } | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [error, setError] = useFormError();
  const [historyId, setHistoryId] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [view, setView] = useState('Contas a Receber');

  const rows = state.invoices.flatMap(invoice => invoice.installments.map((part, index) => ({ invoice, part, index, paid: installmentReceived(state, part.id) })));
  const visible = rows.filter(row => filter === 'Todas' || row.paid < row.part.amountCents);
  const received = monthReceipts(state, period);
  const periodRows = state.receipts.filter(receipt => receipt.date.startsWith(period));
  const balanceByInvoice = new Map<string, number>();
  for (const { invoice, part, paid } of rows) {
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
    if (window.confirm(`Desfazer o recebimento de ${money(receipt.amountCents)}? O saldo será reaberto e a correção ficará no histórico.`)) {
      commit(state => reverseReceipt(state, receipt.id), 'Recebimento desfeito com histórico.');
    }
  }

  return <>
    {view === 'Impostos'
      ? <TaxControl state={state} commit={commit} navigation={financeNavigation} />
      : view === 'Balanço mensal'
        ? <Balance state={state} commit={commit} navigation={financeNavigation} />
      : <>
        <div className="stats three">
          <ReceivableStat
            label="A receber"
            total={receivableTotal(state)}
            note="Saldo pendente de todas as NFs"
            visible={showReceivableTotal}
            onToggle={onToggleReceivableTotal}
            onActivate={() => setFilter('Em aberto')}
          />
          <button className="stat-button" onClick={() => setFilter('Recebidas')}><Stat label="Recebido" value={money(received.reduce((sum, row) => sum + row.amountCents, 0))} icon={<Check />} note={`Recebimentos efetivos em ${period.split('-').reverse().join('/')}`} /></button>
          <Stat label="Parcelas em aberto" value={String(rows.filter(row => row.paid < row.part.amountCents).length)} icon={<FileText />} note="Inclui parcelas parcialmente recebidas" />
        </div>
        {financeNavigation}
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Contas a Receber</h2><p>Uma NF consolidada gera um único conjunto de parcelas.</p></div>
            <div className="finance-actions">
              <button className="secondary prepare-message" disabled={!openInvoices.length} onClick={() => setExportOpen(true)}>
                <Download size={15} />Exportar em aberto · {openInvoices.length}
              </button>
              <label>Período dos recebimentos<input aria-label="Período dos recebimentos" type="month" value={period} onChange={event => { if (event.target.value) { setPeriod(event.target.value); setFilter('Recebidas'); } }} /></label>
            </div>
          </div>
          <div className="toolbar">
            <div className="tabs">{['Em aberto', 'Recebidas', 'Todas'].map(item => <button key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
            <label>Ordenar por<select aria-label="Ordenar financeiro" value={sort} onChange={event => setSort(event.target.value as FinancialSort)}>{['Maior valor', 'Menor valor', 'Número da NF', 'Previsão mais próxima', 'Previsão mais distante'].map(item => <option key={item}>{item}</option>)}</select></label>
            <span className="filter-total">{filter === 'Recebidas'
              ? `${received.length} recebimento(s) · ${money(received.reduce((sum, row) => sum + row.amountCents, 0))}`
              : `${visible.length} parcela(s) · ${receivableAmount(visible.reduce((sum, row) => sum + row.part.amountCents - row.paid, 0), showReceivableTotal)}`}</span>
          </div>
          <div className="table-wrap">
            {filter === 'Recebidas'
              ? <SortableTable key={sort+"-"+filter} className="finance-table"><thead><tr><th>NF / Cliente</th><th>Código / Item</th><th>Recebido em</th><th>Valor</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
                {periodRows.map(receipt => {
                  const invoice = state.invoices.find(item => item.id === receipt.invoiceId)!;
                  return <tr key={receipt.id}>
                    <td><button className="text-link" onClick={() => setHistoryId(invoice.id)}>NF {invoice.number}</button><small>{invoice.client}</small></td>
                    <td data-sort-value={invoice.recordIds.flatMap(id => state.records.find(record => record.id === id)?.items.map(item => item.code) ?? []).join(" ")}><ProductLinks state={state} recordIds={invoice.recordIds} onOpen={onOpen} /></td>
                    <td>{dateLabel(receipt.date)}</td><td>{money(receipt.amountCents)}</td>
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
                  <td>{money(part.amountCents)}<small>Saldo: {money(part.amountCents - paid)}</small></td>
                  <td><span className={'badge ' + (paid === part.amountCents ? 'done' : 'waiting')}>{paid === part.amountCents ? 'Recebido' : paid > 0 ? 'Parcialmente recebido' : 'Em aberto'}</span></td>
                  <td><div className="inline-actions"><ActionIcon label="Editar previsão" icon={<Pencil size={16} />} onClick={() => { setSchedule({ invoiceId: invoice.id, partId: part.id, date: part.dueDate }); setError(''); }} />{paid < part.amountCents && <ActionIcon label="Registrar recebimento" icon={<HandCoins size={16} />} onClick={() => openPayment(invoice, part.id, part.amountCents - paid)} />}</div></td>
                </tr>)}
              </tbody></SortableTable>}
            {(filter === 'Recebidas' ? !periodRows.length : !visible.length) && <div className="empty">Nenhum registro neste filtro.</div>}
          </div>
        </section>
        <p className="footnote">O período considera a data efetiva do recebimento. Em aberto e Todas mantêm os saldos completos, sem ocultar parcelas de outros meses.</p>
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
