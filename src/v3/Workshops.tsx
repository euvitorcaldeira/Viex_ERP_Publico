import { useScreenPreference } from '../components/screenPreferences';
import { SortableTable } from '../components/SortableTable';
import { useState } from 'react';
import { CircleOff, ClipboardList, Pencil, Plus, RotateCcw, Wallet } from 'lucide-react';
import { ActionIcon } from '../components/ActionIcon';
import { Modal } from '../components/Modal';
import { useFormError } from '../components/useFormError';
import { money } from '../format';
import { PaymentHistory } from '../v4/PaymentHistory';
import { History, PaymentDialog, type Commit } from './common';
import { payWorkshop, saveWorkshop, uid, workshopBalance, workshopCharges, type State, type Workshop } from './domain';

type WorkshopsProps = {
  state: State;
  commit: Commit;
  onOpen: (id: string) => void;
  mode?: 'all' | 'registry' | 'operations';
};

export function Workshops({ state, commit, onOpen, mode = 'all' }: WorkshopsProps) {
  const operations = mode === 'operations';
  const registry = mode === 'registry';
  const [editing, setEditing] = useState<Workshop | null>(null);
  const [detailId, setDetailId] = useState('');
  const [payment, setPayment] = useState<{ id: string; charges: string[] } | null>(null);
  const [showInactive, setShowInactive] = useScreenPreference('oficinas:mostrar-inativas:'+mode,false);
  const [error, setError] = useFormError();

  const detail = state.workshops.find(workshop => workshop.id === detailId);
  const charges = detail ? workshopCharges(state, detail.id) : [];

  function edit(workshop?: Workshop) {
    setEditing(workshop ? { ...workshop } : { id: uid(), name: '', contact: '', pix: '', active: true });
    setError('');
  }

  function toggleWorkshop(workshop: Workshop) {
    const action = workshop.active ? 'Desativar' : 'Reativar';
    if (window.confirm(`${action} ${workshop.name}? Os vínculos e pagamentos serão preservados.`)) {
      commit(state => saveWorkshop(state, { ...workshop, active: !workshop.active }), 'Oficina atualizada.');
    }
  }

  function payAll(workshopId: string) {
    const open = workshopCharges(state, workshopId).filter(charge => charge.open > 0);
    setPayment({ id: workshopId, charges: open.map(charge => charge.id) });
  }

  return (
    <>
      <div className="module-actions">
        <label className="check-label">
          <input type="checkbox" checked={showInactive} onChange={event => setShowInactive(event.target.checked)} />
          Mostrar inativas
        </label>
        {!operations && <button className="primary" onClick={() => edit()}><Plus size={16} /> Cadastrar oficina</button>}
      </div>
      <section className="panel">
        <div className="table-wrap">
          <SortableTable>
            <thead><tr><th>Oficina / Contato</th><th>Saldo pendente</th><th>Ações</th></tr></thead>
            <tbody>
              {state.workshops.filter(workshop => showInactive || workshop.active).map(workshop => {
                const balance = workshopBalance(state, workshop.id);
                return (
                  <tr key={workshop.id}>
                    <td>
                      <b>{workshop.name}</b>
                      <small>{workshop.contact || 'Sem contato'} · {workshop.active ? 'Ativa' : 'Inativa'}</small>
                      <small>Pix: {workshop.pix || 'Não informado'}</small>
                    </td>
                    <td>{money(balance)}</td>
                    <td>
                      <div className="row-actions">
                        {!registry && (
                          <>
                            <ActionIcon label="Produções e histórico" icon={<ClipboardList size={16} />} onClick={() => setDetailId(workshop.id)} />
                            <ActionIcon label="Registrar pagamento da oficina" icon={<Wallet size={16} />} disabled={balance <= 0} onClick={() => payAll(workshop.id)} />
                          </>
                        )}
                        {!operations && (
                          <>
                            <ActionIcon label="Editar oficina" icon={<Pencil size={16} />} onClick={() => edit(workshop)} />
                            <ActionIcon
                              label={workshop.active ? 'Desativar oficina' : 'Reativar oficina'}
                              icon={workshop.active ? <CircleOff size={16} /> : <RotateCcw size={16} />}
                              onClick={() => toggleWorkshop(workshop)}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </SortableTable>
        </div>
      </section>
      {detail && (
        <section className="panel module-section">
          <div className="panel-heading">
            <div>
              <h2>{detail.name} · Produções e pagamentos</h2>
              <p>Custos por peça separados dos valores cobrados ao cliente.</p>
            </div>
            <button className="primary" disabled={!charges.some(charge => charge.open > 0)} onClick={() => payAll(detail.id)}>
              <Wallet size={16} /> Pagamento acumulado
            </button>
          </div>
          <div className="table-wrap">
            <SortableTable>
              <thead><tr><th>Romaneio / Modelo</th><th>Quantidade</th><th>Unitário</th><th>Total</th><th>Pago</th><th>Saldo</th><th>Ações</th></tr></thead>
              <tbody>
                {charges.map(charge => (
                  <tr key={charge.id}>
                    <td>
                      <button className="text-link" onClick={() => onOpen(charge.recordId)}>{charge.recordId}</button>
                      <small>{charge.code} · {charge.description}</small>
                    </td>
                    <td>{charge.quantity}</td>
                    <td>{money(charge.unitCents)}</td>
                    <td>{money(charge.amountCents)}</td>
                    <td>{money(charge.paid)}</td>
                    <td>{money(charge.open)}</td>
                    <td>
                      <ActionIcon
                        label="Pagar produção"
                        icon={<Wallet size={16} />}
                        disabled={charge.open <= 0}
                        onClick={() => setPayment({ id: detail.id, charges: [charge.id] })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </SortableTable>
            {!charges.length && <div className="empty">Nenhuma produção terceirizada concluída para esta oficina.</div>}
          </div>
          <h3 className="section-padding">Histórico de pagamentos</h3>
          <PaymentHistory state={state} id={detail.id} type="workshop" commit={commit} />
          <div className="section-padding"><History state={state} id={detail.id} /></div>
        </section>
      )}
      {editing && (
        <Modal
          title={state.workshops.some(workshop => workshop.id === editing.id) ? 'Editar oficina' : 'Cadastrar oficina'}
          subtitle="CADASTRO DE OFICINA EXTERNA"
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="secondary" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="primary" onClick={() => {
                const failure = commit(state => saveWorkshop(state, editing), 'Oficina salva.');
                setError(failure || '');
                if (!failure) setEditing(null);
              }}>Salvar oficina</button>
            </>
          }
        >
          <div className="modal-body">
            <div className="form-grid">
              <label>Nome da oficina<input value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label>
              <label>Contato<input value={editing.contact} onChange={event => setEditing({ ...editing, contact: event.target.value })} /></label>
              <label>Chave Pix<input value={editing.pix} onChange={event => setEditing({ ...editing, pix: event.target.value })} /></label>
            </div>
            {error && <p className="error" role="alert">{error}</p>}
          </div>
        </Modal>
      )}
      {payment && (
        <PaymentDialog
          title={`Pagar ${state.workshops.find(workshop => workshop.id === payment.id)?.name}`}
          balance={workshopCharges(state, payment.id).filter(charge => payment.charges.includes(charge.id)).reduce((sum, charge) => sum + charge.open, 0)}
          onClose={() => setPayment(null)}
          onPay={(date, amount) => commit(state => payWorkshop(state, payment.id, date, amount, payment.charges), 'Pagamento da oficina registrado.')}
        />
      )}
    </>
  );
}
