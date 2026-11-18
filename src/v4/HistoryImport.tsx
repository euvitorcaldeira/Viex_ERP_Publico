import { useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import {
  downloadLocalFile, importLocalHistory, previewLocalHistory, type HistoryPreview,
} from '../localApi';
import type { State } from '../v3/domain';

const labels: Record<string, string> = {
  clients: 'Clientes', workshops: 'Oficinas', employees: 'Funcionários',
  records: 'Romaneios', invoices: 'Notas fiscais', receipts: 'Recebimentos',
  attendance: 'Registros de frequência', employeePayments: 'Pagamentos de funcionários',
  workshopPayments: 'Pagamentos de oficinas',
};

export function HistoryImport({ onImported }: { onImported: (state: State) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<HistoryPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível concluir a operação.');
    } finally {
      setBusy(false);
    }
  }

  async function validate() {
    if (!file) return;
    setPreview(null);
    await perform(async () => setPreview(await previewLocalHistory(file)));
  }

  async function confirmImport() {
    if (!file || !preview) return;
    if (!window.confirm(`Importar o histórico de “${file.name}” para o D’ALEX?`)) return;
    await perform(async () => {
      setPreview(null);
      const state = await importLocalHistory(file, preview.token);
      onImported(state);
      setFile(null);
      setMessage('Histórico incluído. Os registros já estão disponíveis nas telas do D’ALEX.');
    });
  }

  return <section className="panel settings data-protection">
    <h2>Importar histórico</h2>
    <p>Inclua dados de vários meses de uma vez. A planilha reúne grades, romaneios, notas, parcelas,
      recebimentos, frequência e pagamentos. Confira a aba Instruções do modelo.</p>
    <div>
      <span><b>1. Baixar e preencher o modelo</b><small>Preencha só as abas que correspondem ao seu lote.</small></span>
      <button className="secondary" disabled={busy}
        onClick={() => void perform(() => downloadLocalFile('/api/history/template'))}>
        <FileSpreadsheet size={17}/> Baixar modelo Excel
      </button>
    </div>
    <div>
      <span><b>2. Selecionar o arquivo preenchido</b><small>{file?.name || 'Planilha .xlsx de até 5 MB.'}</small></span>
      <label className="secondary file-button"><Upload size={17}/> Selecionar planilha
        <input type="file" aria-label="Selecionar planilha de histórico" accept=".xlsx" disabled={busy}
          onChange={event => {
            setFile(event.target.files?.[0] || null);
            setPreview(null);
            setError('');
            setMessage('');
            event.currentTarget.value = '';
          }}/>
      </label>
    </div>
    <div>
      <span><b>3. Validar e conferir</b><small>A validação mostra os registros a incluir antes de salvar.</small></span>
      <button className="secondary" disabled={busy || !file} onClick={() => void validate()}>
        {busy ? 'Aguarde…' : 'Validar planilha'}
      </button>
    </div>
    {preview && <div>
      <span>
        <b>Registros prontos para importar</b>
        {Object.entries(preview.counts).map(([key, count]) =>
          <small key={key}>{labels[key] ?? key} · {count}</small>)}
      </span>
      <button className="primary" disabled={busy} onClick={() => void confirmImport()}>Confirmar importação</button>
    </div>}
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p className="notice compact" role="status">{message}</p>}
    <p className="footnote">Para consultar dados atuais em Excel, use Exportar Excel em Proteção de dados.
      A pasta Planilhas guarda a exportação mais recente.</p>
  </section>;
}
