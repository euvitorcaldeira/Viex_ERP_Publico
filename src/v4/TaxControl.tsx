import { SortableTable } from '../components/SortableTable';
import { useState, type ReactNode } from 'react';
import { CalendarDays, Check, Undo2 } from 'lucide-react';
import { type State, markInvoiceTaxExempt, markInvoiceTaxPaid, updateInvoiceTax } from '../v3/domain';
import { type Commit } from '../v3/common';
import { money, today, dateLabel } from '../format';
import { Stat } from '../components/Stat';
import { Modal } from '../components/Modal';

type TaxConfiguration = { invoiceId: string; rate: string; date: string; exempt: boolean };

export function TaxControl({ state, commit, navigation }: { state: State; commit: Commit; navigation: ReactNode }) {
  const [status, setStatus] = useState('Em aberto');
  const [period, setPeriod] = useState('Todas as datas');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [payment, setPayment] = useState<{ invoiceId: string; date: string } | null>(null);
  const [configuration, setConfiguration] = useState<TaxConfiguration | null>(null);
  const [error, setError] = useState('');

  const rows = state.invoices
    .filter(invoice => status === 'Todos'
      || (status === 'Pagos' ? !!invoice.taxPaidAt
        : status === 'Isentas' ? !!invoice.taxExempt
          : !invoice.taxPaidAt && !invoice.taxExempt))
    .filter(invoice => period === 'Todas as datas'
      || (period === 'Sem data' ? !invoice.taxDueDate : invoice.taxDueDate?.startsWith(month)));
  const total = rows.reduce((sum, invoice) => sum + (invoice.taxCents || 0), 0);
  const openTaxes = state.invoices.filter(invoice => !invoice.taxPaidAt && !invoice.taxExempt);
  const paidTaxes = state.invoices.filter(invoice => !!invoice.taxPaidAt);
  const exemptTaxes = state.invoices.filter(invoice => !!invoice.taxExempt);

  function updatePaid(invoiceId: string, paid: boolean, date: string) {
    const message = commit(s => markInvoiceTaxPaid(s, invoiceId, date, paid), paid
      ? 'Pagamento de imposto registrado.' : 'Baixa de imposto desfeita.');
    setError(message || '');
    if (!message) setPayment(null);
  }

  function configureInvoice(invoiceId: string) {
    const invoice = state.invoices.find(item => item.id === invoiceId);
    if (!invoice) return;
    setError('');
    setConfiguration({ invoiceId, rate: ((invoice.taxRateBps || 0) / 100).toFixed(2), date: invoice.taxDueDate || '', exempt: !!invoice.taxExempt });
  }

  function saveConfiguration() {
    if (!configuration) return;
    const invoice = state.invoices.find(item => item.id === configuration.invoiceId);
    if (!invoice) return;
    const rate = Math.round((Number(configuration.rate.replace(',', '.')) || 0) * 100);
    const message = commit(s => {
      let next = s;
      if (configuration.exempt) {
        if (!invoice.taxExempt) next = markInvoiceTaxExempt(next, invoice.id, true);
      } else {
        if (invoice.taxExempt) next = markInvoiceTaxExempt(next, invoice.id, false);
        if (rate > 0) next = updateInvoiceTax(next, invoice.id, rate, configuration.date);
      }
      return next;
    }, configuration.exempt ? 'NF marcada como isenta.' : 'Imposto atualizado sem alterar o valor da NF.');
    setError(message || '');
    if (!message) setConfiguration(null);
  }

  function toggleExempt(invoiceId: string, exempt: boolean) {
    const message = commit(s => markInvoiceTaxExempt(s, invoiceId, exempt), exempt
      ? 'NF marcada como isenta.' : 'Isenção removida. Informe a alíquota para calcular o imposto.');
    setError(message || '');
  }

  return <>
    <div className="stats">
      <Stat label="Total de impostos" value={money(state.invoices.reduce((sum, invoice) => sum + (invoice.taxCents || 0), 0))} icon={<CalendarDays />} note="Notas com imposto apurado" />
      <Stat label="Impostos em aberto" value={money(openTaxes.reduce((sum, invoice) => sum + (invoice.taxCents || 0), 0))} icon={<CalendarDays />} note={`${openTaxes.length} NF(s) sem baixa`} />
      <Stat label="Impostos pagos" value={money(paidTaxes.reduce((sum, invoice) => sum + (invoice.taxCents || 0), 0))} icon={<Check />} note={`${paidTaxes.length} NF(s) baixadas`} />
      <Stat label="Notas isentas" value={String(exemptTaxes.length)} icon={<Check />} note="Isenção registrada no histórico" />
    </div>
    {navigation}
    <section className="panel">
      <div className="toolbar">
        <div className="tabs">{['Em aberto', 'Pagos', 'Isentas', 'Todos'].map(item => <button key={item} className={status === item ? 'selected' : ''} onClick={() => setStatus(item)}>{item}</button>)}</div>
        <label>Período<select aria-label="Período dos impostos" value={period} onChange={event => setPeriod(event.target.value)}><option>Mês</option><option>Sem data</option><option>Todas as datas</option></select></label>
        {period === 'Mês' && <label>Mês da previsão<input aria-label="Mês da previsão de imposto" type="month" value={month} onChange={event => { if (event.target.value) setMonth(event.target.value); }} /></label>}
        <span className="filter-total">{rows.length} NF(s) · {money(total)}</span>
      </div>
      <div className="table-wrap"><SortableTable><thead><tr><th>Nota fiscal / Cliente</th><th>Emissão</th><th>Base da NF</th><th>Alíquota</th><th>Imposto</th><th>Previsão</th><th>Pagamento</th><th>Ações</th></tr></thead><tbody>
        {rows.map(invoice => <tr key={invoice.id}>
          <td><b>NF {invoice.number}</b><small>{invoice.client}</small></td>
          <td>{dateLabel(invoice.issueDate)}</td>
          <td>{money(invoice.totalCents)}</td>
          <td>{invoice.taxExempt ? 'Isenta' : (invoice.taxRateBps || 0) > 0 ? `${((invoice.taxRateBps || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : 'Pendente'}</td>
          <td><b>{invoice.taxExempt ? 'Isento' : (invoice.taxCents || 0) > 0 ? money(invoice.taxCents || 0) : '—'}</b></td>
          <td data-sort-value={invoice.taxDueDate || ''}>{invoice.taxExempt ? '—' : invoice.taxDueDate ? dateLabel(invoice.taxDueDate) : 'Sem data'}{!invoice.taxPaidAt && !invoice.taxExempt && <small><button className="text-link" onClick={() => configureInvoice(invoice.id)}>{(invoice.taxRateBps || 0) > 0 ? 'Editar apuração' : 'Informar alíquota'}</button></small>}</td>
          <td data-sort-value={invoice.taxPaidAt || ''}>{invoice.taxPaidAt ? <><span className="badge done"><Check size={14} /> Pago · {dateLabel(invoice.taxPaidAt)}</span><button className="text-link" onClick={() => updatePaid(invoice.id, false, today())}><Undo2 size={14} />Desfazer baixa</button></> : invoice.taxExempt ? <span className="badge done">Isenta</span> : (invoice.taxCents || 0) > 0 ? <button className="secondary" onClick={() => { setError(''); setPayment({ invoiceId: invoice.id, date: today() }); }}><CalendarDays size={15} />Registrar pagamento</button> : <span className="badge waiting">Alíquota pendente</span>}</td>
          <td><div className="inline-actions">{!invoice.taxPaidAt && <><button className="text-link" onClick={() => configureInvoice(invoice.id)}>{invoice.taxExempt ? 'Alterar isenção' : 'Configurar'}</button>{!invoice.taxExempt && <button className="text-link" onClick={() => toggleExempt(invoice.id, true)}>Marcar isenta</button>}</>}</div></td>
        </tr>)}
      </tbody></SortableTable>{!rows.length && <div className="empty">Nenhum imposto neste filtro.</div>}</div>
      <p className="footnote">Notas anteriores à inclusão do controle podem receber alíquota ou ser marcadas como isentas. Notas incluídas pela importação histórica já vêm marcadas como isentas. O controle é gerencial: imposto não altera o valor faturado, as parcelas ou Contas a Receber.</p>
      {error && !payment && !configuration && <p className="error" role="alert">{error}</p>}
      {payment && <Modal title="Registrar pagamento do imposto" subtitle={'NF ' + state.invoices.find(invoice => invoice.id === payment.invoiceId)?.number} onClose={() => setPayment(null)} footer={<><button className="secondary" onClick={() => setPayment(null)}>Cancelar</button><button className="primary" onClick={() => updatePaid(payment.invoiceId, true, payment.date)}>Confirmar pagamento</button></>}><div className="modal-body"><label>Data do pagamento<input type="date" max={today()} value={payment.date} onChange={event => setPayment({ ...payment, date: event.target.value })} /></label>{error && <p className="error" role="alert">{error}</p>}</div></Modal>}
      {configuration && <Modal title="Configurar imposto da NF" subtitle={'NF ' + state.invoices.find(invoice => invoice.id === configuration.invoiceId)?.number} onClose={() => setConfiguration(null)} footer={<><button className="secondary" onClick={() => setConfiguration(null)}>Cancelar</button><button className="primary" onClick={saveConfiguration}>Salvar controle</button></>}><div className="modal-body"><label className="check-label"><input type="checkbox" checked={configuration.exempt} onChange={event => setConfiguration({ ...configuration, exempt: event.target.checked })} /> NF isenta de imposto</label><label>Alíquota de imposto (%)<input type="number" min="0.01" max="100" step="0.01" disabled={configuration.exempt} value={configuration.rate} onChange={event => setConfiguration({ ...configuration, rate: event.target.value })} /></label><label>Data prevista de pagamento · opcional<input type="date" disabled={configuration.exempt} min={state.invoices.find(invoice => invoice.id === configuration.invoiceId)?.issueDate} value={configuration.date} onChange={event => setConfiguration({ ...configuration, date: event.target.value })} /></label><p className="footnote">Marcar isenção zera o apontamento de imposto e limpa previsão e baixa de imposto, sem alterar a nota ou o recebimento do cliente.</p>{error && <p className="error" role="alert">{error}</p>}</div></Modal>}
    </section>
  </>;
}
