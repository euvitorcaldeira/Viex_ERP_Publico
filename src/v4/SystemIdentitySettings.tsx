import { useState } from 'react';
import { useFormError } from '../components/useFormError';
import { type Commit } from '../v3/common';
import { type State } from '../v3/domain';
import { internalWorkshopName, invoiceSummaryPaymentText, saveInternalWorkshopName, saveInvoiceSummaryPaymentText, saveSystemDisplayName, systemDisplayName } from './domain';

export function SystemIdentitySettings({ state, commit }: { state: State; commit: Commit }) {
  const savedSystemName = systemDisplayName(state);
  const savedWorkshopName = internalWorkshopName(state);
  const savedPaymentText = invoiceSummaryPaymentText(state);
  const [systemName, setSystemName] = useState(savedSystemName);
  const [workshopName, setWorkshopName] = useState(savedWorkshopName);
  const [paymentText, setPaymentText] = useState(savedPaymentText);
  const [systemError, setSystemError] = useFormError();
  const [workshopError, setWorkshopError] = useFormError();
  const [paymentError, setPaymentError] = useFormError();

  function saveSystemName() {
    const error = commit(current => saveSystemDisplayName(current, systemName), 'Nome do sistema atualizado.', { inlineError: true });
    setSystemError(error || '');
    if (!error) setSystemName(systemName.trim());
  }

  function saveWorkshopName() {
    const error = commit(current => saveInternalWorkshopName(current, workshopName), 'Nome da oficina interna atualizado.', { inlineError: true });
    setWorkshopError(error || '');
    if (!error) setWorkshopName(workshopName.trim());
  }

  function savePaymentText() {
    const error = commit(current => saveInvoiceSummaryPaymentText(current, paymentText), 'Complemento do resumo da NF atualizado.', { inlineError: true });
    setPaymentError(error || '');
    if (!error) setPaymentText(paymentText.trim());
  }

  return <section className="panel settings system-identity-settings">
    <h2>Identidade do sistema</h2>
    <p>Identifique a empresa no VIEX ERP e padronize o nome da produção interna.</p>
    <div className="identity-setting-row">
      <div><b>Nome de exibição</b><small>Nome da empresa usado no título, na área de trabalho e no rodapé.</small></div>
      <div className="identity-setting-control">
        <label>Nome do sistema<input aria-label="Nome do sistema" maxLength={48} value={systemName} onChange={event => { setSystemName(event.target.value); setSystemError(''); }} /></label>
        <button className="primary" disabled={!systemName.trim() || systemName.trim() === savedSystemName} onClick={saveSystemName}>Salvar nome</button>
      </div>
      {systemError && <p className="error" role="alert">{systemError}</p>}
    </div>
    <div className="identity-setting-row">
      <div><b>Nome da produção interna</b><small>Usado para identificar a oficina interna nos romaneios.</small></div>
      <div className="identity-setting-control">
        <label>Nome da oficina interna<input aria-label="Nome da oficina interna" maxLength={48} value={workshopName} onChange={event => { setWorkshopName(event.target.value); setWorkshopError(''); }} /></label>
        <button className="primary" disabled={!workshopName.trim() || workshopName.trim() === savedWorkshopName} onClick={saveWorkshopName}>Salvar nome</button>
      </div>
      {workshopError && <p className="error" role="alert">{workshopError}</p>}
    </div>
    <div className="identity-setting-row">
      <div><b>Complemento do resumo da NF</b><small>Acrescentado ao final do texto para emissão, por exemplo: PIX 42655411862. Deixe vazio para não incluir dados de pagamento.</small></div>
      <div className="identity-setting-control">
        <label>Texto de pagamento<input aria-label="Complemento do resumo da NF" maxLength={120} placeholder="PIX 42655411862" value={paymentText} onChange={event => { setPaymentText(event.target.value); setPaymentError(''); }} /></label>
        <button className="primary" disabled={paymentText.trim() === savedPaymentText} onClick={savePaymentText}>Salvar complemento</button>
      </div>
      {paymentError && <p className="error" role="alert">{paymentError}</p>}
    </div>
  </section>;
}
