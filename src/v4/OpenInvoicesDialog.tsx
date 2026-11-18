import { useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { Modal } from '../components/Modal';
import { dateLabel, money } from '../format';
import type { Commit } from '../v3/common';
import type { Bill } from '../v3/domain';
import { updateDueDate } from './domain';
import { buildInvoiceDateRequest, buildOpenInvoiceText } from './financeExport';

const modes = ['Notas em aberto', 'Solicitar datas', 'Preencher datas'] as const;

export function OpenInvoicesDialog({ openInvoices, undatedIds, commit, onClose }: {
  openInvoices: { invoice: Bill; balanceCents: number }[];
  undatedIds: string[];
  commit: Commit;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<typeof modes[number]>('Notas em aberto');
  const [dateCandidates] = useState(() => new Set(undatedIds));
  const [selectedIds, setSelectedIds] = useState(() => [...dateCandidates]);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);

  const filling = mode === 'Preencher datas';
  const exportingBalances = mode === 'Notas em aberto';
  const dateInvoices = openInvoices.map(row => row.invoice).filter(invoice => dateCandidates.has(invoice.id));
  const selected = dateInvoices.filter(invoice => selectedIds.includes(invoice.id) && (!filling || invoice.installments.length === 1));
  const filledDates = filling
    ? Object.fromEntries(selected.map(invoice => [invoice.id, dates[invoice.id] ?? invoice.installments[0].dueDate]))
    : {};
  const text = exportingBalances
    ? buildOpenInvoiceText(openInvoices.map(({ invoice, balanceCents }) => ({ number: invoice.number, balanceCents })), money)
    : buildInvoiceDateRequest(selected, selectedIds, money, filling ? filledDates : {}, dateLabel);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback({ text: 'Texto copiado. Você pode colar no WhatsApp.', error: false });
    } catch {
      setFeedback({ text: 'Não foi possível copiar automaticamente. Selecione e copie o texto na prévia.', error: true });
    }
  }

  function downloadText() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = exportingBalances ? 'notas-em-aberto.txt' : 'previsoes-de-pagamento.txt';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function saveDates() {
    const error = commit(
      current => selected.reduce((next, invoice) => updateDueDate(next, invoice.id, invoice.installments[0].id, filledDates[invoice.id]), current),
      'Previsões atualizadas para as notas selecionadas.',
      { inlineError: true },
    );
    setFeedback({ text: error || 'Previsões salvas.', error: !!error });
  }

  return <Modal title="Exportar em aberto" subtitle="CONTAS A RECEBER" onClose={onClose} footer={<>
    <button className="secondary" onClick={onClose}>Fechar</button>
    <div className="inline-actions">
      {filling && <button className="secondary" disabled={!selected.length || Object.values(filledDates).some(date => !date)} onClick={saveDates}>Salvar previsões</button>}
      <button className="secondary" disabled={!text} onClick={downloadText}><Download size={15} />Baixar .txt</button>
      <button className="primary" disabled={!text} onClick={copyText}><Copy size={15} />Copiar texto</button>
    </div>
  </>}>
    <div className="modal-body open-invoices-body">
      <div className="tabs">
        {modes.map(option => <button key={option} className={mode === option ? 'selected' : ''} aria-pressed={mode === option} onClick={() => { setMode(option); setFeedback(null); }}>{option}</button>)}
      </div>
      {exportingBalances ? <p>Notas parcialmente recebidas mostram o saldo restante.</p> : dateInvoices.length ? <>
        <p>{filling ? 'Preencha as previsões das notas selecionadas.' : 'Selecione as notas sem previsão que deseja enviar ao cliente.'}</p>
        <div className="undated-invoices">
          {dateInvoices.map(invoice => {
            const single = invoice.installments.length === 1;
            const selectable = !filling || single;
            const checked = selectable && selectedIds.includes(invoice.id);
            return <div className="invoice-date-row" key={invoice.id}>
              <label>
                <input type="checkbox" checked={checked} disabled={!selectable} onChange={event => {
                  const enabled = event.target.checked;
                  setSelectedIds(ids => enabled ? [...ids, invoice.id] : ids.filter(id => id !== invoice.id));
                  setFeedback(null);
                }} />
                <span>NF {invoice.number}</span>
              </label>
              <strong>{money(invoice.totalCents)}</strong>
              {filling && (single
                ? <input aria-label={`Previsão NF ${invoice.number}`} type="date" min={invoice.issueDate} disabled={!checked} value={dates[invoice.id] ?? invoice.installments[0].dueDate} onChange={event => {
                  const date = event.target.value;
                  setDates(values => ({ ...values, [invoice.id]: date }));
                  setFeedback(null);
                }} />
                : <small>Edite as datas por parcela na tabela do Financeiro.</small>)}
            </div>;
          })}
        </div>
      </> : <p>Todas as parcelas em aberto já têm previsão de pagamento.</p>}
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'error' : 'success'}>{feedback.text}</p>}
      <label>Prévia do texto
        <textarea rows={Math.max(3, Math.min(9, (exportingBalances ? openInvoices.length : selected.length) * 3))} readOnly value={text} />
      </label>
    </div>
  </Modal>;
}
