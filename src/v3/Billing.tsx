import { useScreenPreference } from '../components/screenPreferences';
import { SortableTable } from '../components/SortableTable';
import { useState } from 'react';
import { CheckSquare, Copy, HelpCircle, Square, Undo2 } from 'lucide-react';
import { useFormError } from '../components/useFormError';
import { ActionIcon } from '../components/ActionIcon';
import { Modal } from '../components/Modal';
import { type State, ready, projected, billingLines, summaryText, issueBill } from './domain';
import { type Commit } from './common';
import { dateLabel, money, today } from '../format';
import { UndoBillingDialog } from './UndoBillingDialog';
import './billing.css';

function recordLabel(state: State, id: string) {
  const record = state.records.find(item => item.id === id);
  if (!record) return 'Romaneio';
  return record.clientOrder || 'Pedido não informado';
}

function recordDescriptions(state: State, id: string) {
  const record = state.records.find(item => item.id === id);
  if (!record) return '';
  return [...new Map(record.items.map(item => [item.code, `${item.description}${item.family ? ` · ${item.family}` : ''}`])).values()].join(' · ');
}

function recordCodes(state: State, id: string) {
  const record=state.records.find(item=>item.id===id);
  return record?[...new Set(record.items.map(item=>item.code.trim()).filter(Boolean))].join(', ')||'Romaneio': 'Romaneio';
}

export function Billing({ state, commit, onOpen, initialId, onPrice }: { state: State; commit: Commit; onOpen: (id: string) => void; initialId?: string; onPrice?: (id: string) => void }) {
  const [tab, setTab] = useScreenPreference('faturamento:aba','A faturar');
  const [jumpToPending, setJumpToPending] = useState(!!initialId);
  const activeTab = jumpToPending ? 'A faturar' : tab;
  const [selected, setSelected] = useState<string[]>(initialId ? [initialId] : []);
  const [dialog, setDialog] = useState(false);
  const [number, setNumber] = useState('');
  const [issueDate, setIssueDate] = useState(today());
  const [dates, setDates] = useState(['']);
  const [authorized, setAuthorized] = useState(false);
  const [taxRate, setTaxRate] = useState('');
  const [taxDueDate, setTaxDueDate] = useState('');
  const [error, setError] = useFormError();
  const [copied, setCopied] = useState(false);
  const [undoId, setUndoId] = useState('');
  const [registeredPeriod, setRegisteredPeriod] = useScreenPreference('faturamento:periodo','Mês');
  const [registeredMonth, setRegisteredMonth] = useScreenPreference('faturamento:mes',today().slice(0, 7));

  const pending = state.records.filter(record => record.stage === 'Concluído' && !record.invoiceId);
  const available = state.records.filter(record => ready(record, state));
  const ids = selected.filter(id => available.some(record => record.id === id));
  const lines = billingLines(state, ids);
  const text = summaryText(lines, state.invoiceSummaryPaymentText ?? '');
  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitCents, 0);
  const taxRateBps = Math.round((Number(taxRate.replace(',', '.')) || 0) * 100);
  const taxCents = Math.round(total * taxRateBps / 10000);
  const registeredInvoices = state.invoices.filter(invoice => registeredPeriod === 'Todas as datas' || invoice.issueDate.startsWith(registeredMonth)).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const allSelected = available.length > 0 && ids.length === available.length;

  function register() {
    const message = commit(s => issueBill(s, ids, number, issueDate, dates, authorized, taxRateBps, taxDueDate), 'NF registrada e contas a receber geradas.', { inlineError: true });
    setError(message || '');
    if (!message) {
      setDialog(false);
      setSelected([]);
      setJumpToPending(false);
      setTab('NFs registradas');
      setNumber('');
      setIssueDate(today());
      setDates(['']);
      setAuthorized(false);
      setTaxRate('');
      setTaxDueDate('');
      setRegisteredPeriod('Mês');
      setRegisteredMonth(issueDate.slice(0, 7));
    }
  }

  return <>
    <section className="panel">
      <div className="toolbar">
        <div className="tabs">{['A faturar', 'NFs registradas'].map(item => <button key={item} className={activeTab === item ? 'selected' : ''} onClick={() => { setJumpToPending(false); setTab(item); }}>{item}</button>)}</div>
        {activeTab === 'A faturar' ? <div className="inline-actions">
          <button className="secondary" disabled={!available.length} onClick={() => setSelected(allSelected ? [] : available.map(record => record.id))}>
            {allSelected ? <Square size={15} /> : <CheckSquare size={15} />}{allSelected ? 'Desselecionar todos' : 'Selecionar todos'}
          </button>
          <button className="primary" disabled={!ids.length} onClick={() => { setError(''); setAuthorized(false); setCopied(false); setIssueDate(today()); setDialog(true); }}>Faturar selecionados ({ids.length})</button>
        </div> : <div className="finance-actions">
          <label>Data de emissão<select aria-label="Período das NFs registradas" value={registeredPeriod} onChange={event => setRegisteredPeriod(event.target.value)}><option>Mês</option><option>Todas as datas</option></select></label>
          {registeredPeriod === 'Mês' && <label>Mês<input aria-label="Mês das NFs registradas" type="month" value={registeredMonth} onChange={event => { if (event.target.value) setRegisteredMonth(event.target.value); }} /></label>}
        </div>}
      </div>
      {activeTab === 'A faturar' ? <>
        <div className="table-wrap"><SortableTable key="pending" defaultSort={{column:4,direction:'desc'}}><thead><tr><th>Selecionar</th><th>Cliente</th><th>Código</th><th>Item / família</th><th>Recebimento</th><th>Total</th><th>Ações</th></tr></thead><tbody>
          {pending.map(record => <tr key={record.id}>
            <td><input type="checkbox" aria-label={`Selecionar ${recordLabel(state, record.id)}`} disabled={!ready(record,state)} checked={ids.includes(record.id)} onChange={event => setSelected(event.target.checked ? [...ids, record.id] : ids.filter(id => id !== record.id))} /></td>
            <td>{record.client}</td><td><button className="text-link" onClick={() => onOpen(record.id)}>{recordCodes(state, record.id)}</button></td>
            <td>{recordDescriptions(state, record.id)}</td>
            <td>{dateLabel(record.receivedOn||'')}</td>
            <td>{ready(record,state)?money(projected(record, state).revenue):'A definir'}</td>
            <td>{ready(record,state)?<button className="secondary" onClick={() => { setSelected([record.id]); setError(''); setAuthorized(false); setCopied(false); setIssueDate(today()); setDialog(true); }}>Faturar</button>:<button className="secondary" onClick={()=>(onPrice??onOpen)(record.id)}>Definir preços</button>}</td>
          </tr>)}
        </tbody></SortableTable>{!pending.length && <div className="empty">Nenhum romaneio concluído pendente de NF.</div>}</div>
        {ids.length > 0 && <div className="table-footer">Selecionados: {ids.map(id => state.records.find(record => record.id === id)?.clientOrder || recordCodes(state, id)).join(', ')} · {money(total)}</div>}
      </> : <div className="table-wrap"><SortableTable key="registered" defaultSort={{column:0,direction:'desc'}}><thead><tr><th>NF / Cliente</th><th>Código</th><th>Item / família</th><th>Emissão</th><th>Total</th><th>Ações</th></tr></thead><tbody>
        {registeredInvoices.map(invoice => <tr key={invoice.id}>
          <td data-sort-value={invoice.number}><b>NF {invoice.number}</b><small>{invoice.client}</small></td>
          <td>{[...new Map(invoice.lines.map(line => [JSON.stringify([line.romaneioId, line.code]), line])).values()].map(line =>
            <button key={JSON.stringify([line.romaneioId, line.code])} className="text-link linked-record" title="Abrir romaneio" onClick={() => onOpen(line.romaneioId)}>{line.code}</button>
          )}</td>
          <td>{[...new Set(invoice.lines.map(line => { const item = state.records.find(record => record.id === line.romaneioId)?.items.find(entry => entry.code.trim().toLocaleUpperCase() === line.code.trim().toLocaleUpperCase()); return `${line.description}${item?.family ? ` · ${item.family}` : ''}`; }))].join(' · ')}</td>
          <td>{invoice.issueDate.split('-').reverse().join('/')}</td>
          <td>{money(invoice.totalCents)}</td>
          <td><ActionIcon label={`Desfazer faturamento da NF ${invoice.number}`} icon={<Undo2 size={16} />} onClick={() => setUndoId(invoice.id)} /></td>
        </tr>)}
      </tbody></SortableTable>{!registeredInvoices.length && <div className="empty">Nenhuma NF registrada neste período.</div>}</div>}
    </section>
    {activeTab === 'A faturar' && <p className="footnote">Defina os preços pendentes antes de registrar a nota. Consolide somente romaneios do mesmo cliente, com a autorização dele.</p>}
    {undoId && <UndoBillingDialog state={state} invoiceId={undoId} commit={commit} onClose={() => setUndoId('')} onDone={() => { setUndoId(''); setTab('A faturar'); }} />}
    {dialog && <Modal title="Registrar nota fiscal" subtitle={ids.map(id => recordCodes(state, id)).join(' · ')} subtitleClassName="billing-record-codes" onClose={() => { if (window.confirm('Descartar os dados de registro desta NF?')) setDialog(false); }} footer={<><button className="secondary" onClick={() => setDialog(false)}>Voltar</button><button className="primary" onClick={register}>Registrar NF e gerar contas a receber</button></>}>
      <div className="modal-body billing-register">
        <div className="billing-summary-row"><label>Resumo para NF<textarea className="nf-summary" aria-label="Resumo para NF" rows={3} value={text} readOnly /></label><button className="secondary copy-summary" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setError('Não foi possível copiar automaticamente. Selecione o texto acima e use Ctrl+C.'); } }}><Copy size={14} />{copied ? 'Copiado' : 'Copiar'}</button></div>
        <div className="billing-fields">
          <label><span>Número da NF<button type="button" className="billing-help" title="Emita a nota no portal fiscal e use o resumo acima. Depois, registre aqui o número e os dados fiscais." aria-label="Ajuda para emitir a nota fiscal"><HelpCircle size={14}/></button></span><input aria-label="Número da NF" autoFocus value={number} onChange={event => setNumber(event.target.value)} /></label>
          <label>Data de emissão<input aria-label="Data de emissão" type="date" value={issueDate} onChange={event => setIssueDate(event.target.value)} /></label>
          <div className="billing-amount"><span>Total da NF</span><b>{money(total)}</b></div>
          <label>Parcelas<select aria-label="Quantidade de parcelas" value={dates.length} onChange={event => setDates(Array.from({ length: Number(event.target.value) }, (_, index) => dates[index] || ''))}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></label>
          <label>{dates.length===1?'Data da parcela':'1º vencimento'}<input aria-label="Vencimento parcela 1" type="date" min={issueDate || undefined} value={dates[0]} onChange={event=>setDates([event.target.value,...dates.slice(1)])}/></label>
        </div>
        {ids.length > 1 && <label className="check-label"><input type="checkbox" checked={authorized} onChange={event => setAuthorized(event.target.checked)} />Cliente autorizou consolidar estes romaneios em uma NF</label>}
        {dates.length>1&&<div className="billing-payment-dates">{dates.slice(1).map((date,index)=><label key={index}>Vencimento {index+2}<input type="date" min={issueDate||undefined} value={date} onChange={event=>setDates(dates.map((current,position)=>position===index+1?event.target.value:current))}/></label>)}</div>}
        <div className="billing-section-title"><b>Impostos</b><span>Somente para controle</span></div>
        <div className="billing-tax-fields"><label>Alíquota · opcional<span className="billing-percent"><input aria-label="Alíquota de imposto (%)" type="number" min="0" max="100" step="0.01" inputMode="decimal" value={taxRate} onChange={event => setTaxRate(event.target.value)} /><span aria-hidden="true">%</span></span></label><label>Previsão do pagamento · opcional<input aria-label="Previsão de pagamento do imposto" type="date" min={issueDate || undefined} value={taxDueDate} onChange={event => setTaxDueDate(event.target.value)} /></label><div className="billing-amount"><span>Imposto previsto</span><b>{money(taxCents)}</b></div></div>
        <p className="billing-tax-note">A alíquota não altera o total da NF nem das parcelas.</p>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </Modal>}
  </>;
}
