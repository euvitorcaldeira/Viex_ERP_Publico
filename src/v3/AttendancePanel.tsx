import { useScreenPreference } from '../components/screenPreferences';
import { SortableTable } from '../components/SortableTable';
import { useId, useRef, useState, type MouseEvent } from 'react';
import { Ellipsis } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useFormError } from '../components/useFormError';
import { cents, dateLabel, money, today } from '../format';
import { defaultAttendanceStatus, weekday, weekDates } from '../v4/domain';
import { type Commit } from './common';
import { employeeActiveOn, employeeAttendanceStart, markAttendance, type Attendance, type AttendanceStatus, type Employee, type State } from './domain';
import './attendance.css';

const views = ['Lista diária', 'Calendário semanal', 'Calendário mensal'] as const;
type View = typeof views[number];
type Day = { employee: Employee; date: string };
const editLabels = {
  justification: 'Justificar falta',
  overtime: 'Adicionar hora extra',
  earlyDeparture: 'Adicionar saída antecipada',
  note: 'Editar observação',
} as const;
type EditAction = keyof typeof editLabels;
type DayEdit = Day & { action: EditAction; value: string };
const statusActions: { status: AttendanceStatus; label: string }[] = [
  { status: 'Presente', label: 'Marcar presença' },
  { status: 'Falta', label: 'Marcar falta' },
  { status: 'Não trabalhado', label: 'Marcar não trabalhado' },
];

function attendanceKey(employeeId: string, date: string) {
  return `${employeeId}|${date}`;
}

function attendanceAmount(entry: Attendance | undefined, employee: Employee, status: AttendanceStatus) {
  if (status !== 'Presente') return 0;
  return (entry?.dailyCents ?? employee.dailyCents) + (entry?.overtimeCents ?? 0) - (entry?.earlyDepartureDeductionCents ?? 0);
}

export function AttendancePanel({ state, commit, active }: { state: State; commit: Commit; active: boolean }) {
  const [date, setDate] = useState(today);
  const [view, setView] = useScreenPreference<View>('frequencia:modo','Lista diária');
  const [selectedDay, setSelectedDay] = useState<Day | null>(null);
  const [editing, setEditing] = useState<DayEdit | null>(null);
  const [error, setError] = useFormError();
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  if (!active) return null;

  const currentDate = today();
  const entries = new Map(state.attendance.map(entry => [attendanceKey(entry.employeeId, entry.date), entry]));
  const daily = view === 'Lista diária';
  const weekly = view === 'Calendário semanal';
  const dateValue = new Date(`${date}T12:00:00`);
  const monthLength = new Date(dateValue.getFullYear(), dateValue.getMonth() + 1, 0).getDate();
  const days = weekly ? weekDates(date) : Array.from({ length: monthLength }, (_, index) =>
    `${date.slice(0, 7)}-${String(index + 1).padStart(2, '0')}`,
  );
  const lookup = (day: Day) => entries.get(attendanceKey(day.employee.id, day.date));
  const selectedEntry = selectedDay ? lookup(selectedDay) : undefined;
  const selectedStatus = selectedDay ? selectedEntry?.status ?? (!employeeActiveOn(state, selectedDay.employee, selectedDay.date) ? null : defaultAttendanceStatus(selectedDay.date)) : null;
  const canAdjust = selectedStatus === 'Presente';

  function closeMenu(restoreFocus = false) {
    if (menu.current?.matches(':popover-open')) menu.current.hidePopover();
    if (restoreFocus) trigger.current?.focus();
  }

  function positionMenu(event: MouseEvent<HTMLButtonElement>, day: Day) {
    if (!menu.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    trigger.current = event.currentTarget;
    setSelectedDay(day);
    const placeAbove = window.innerHeight - rect.bottom < 275 && rect.top > window.innerHeight - rect.bottom;
    const maxRight = Math.max(8, window.innerWidth - 228);
    const right = Math.min(maxRight, Math.max(8, window.innerWidth - rect.right));
    const availableHeight = placeAbove ? rect.top : window.innerHeight - rect.bottom;
    menu.current.style.setProperty('--attendance-right', `${right}px`);
    menu.current.style.setProperty('--attendance-height', `${availableHeight - 12}px`);
    menu.current.style.setProperty('--attendance-edge', `${placeAbove ? rect.top - 4 : rect.bottom + 4}px`);
    menu.current.dataset.above = String(placeAbove);
  }

  function actionButton(day: Day) {
    const disabled = day.date > currentDate || day.date < employeeAttendanceStart(state, day.employee) || (!employeeActiveOn(state, day.employee, day.date) && !lookup(day));
    const label = `Ações de frequência de ${day.employee.name}, ${dateLabel(day.date)}`;
    return <button type="button" className="icon-btn attendance-action-button" title={label}
      aria-label={label} disabled={disabled} popoverTarget={menuId}
      onClick={event => positionMenu(event, day)}><Ellipsis size={18} aria-hidden="true" /></button>;
  }

  function setStatus(status: AttendanceStatus) {
    if (!selectedDay) return;
    closeMenu(true);
    commit(state => markAttendance(state, selectedDay.employee.id, selectedDay.date, status), 'Frequência salva.');
  }

  function openEdit(action: EditAction) {
    if (!selectedDay) return;
    closeMenu(true);
    setError('');
    const currentAmount = action === 'overtime' ? selectedEntry?.overtimeCents : selectedEntry?.earlyDepartureDeductionCents;
    const value = action === 'justification' || action === 'note'
      ? selectedEntry?.note ?? ''
      : currentAmount ? (currentAmount / 100).toFixed(2).replace('.', ',') : '';
    setEditing({ ...selectedDay, action, value });
  }

  function saveEdit() {
    if (!editing) return;
    const { employee, date, action, value } = editing;
    const note = value.trim();
    if (action === 'justification' && !note) {
      setError('Informe o motivo da falta.');
      return;
    }
    const existing = lookup(editing);
    const status = action === 'justification' ? 'Falta' : existing?.status ?? defaultAttendanceStatus(date);
    const amount = cents(value || '0');
    const result = commit(state => markAttendance(
      state, employee.id, date, status,
      action === 'overtime' ? amount : undefined,
      action === 'earlyDeparture' ? amount : undefined,
      action === 'justification' || action === 'note' ? note : undefined,
    ), 'Frequência atualizada.', { inlineError: true });
    setError(result ?? '');
    if (!result) setEditing(null);
  }

  function fillDefaults() {
    const availableDates = (daily ? [date] : days).filter(day => day <= currentDate);
    commit(state => {
      const recorded = new Set(state.attendance.map(entry => attendanceKey(entry.employeeId, entry.date)));
      let next = state;
      for (const employee of state.employees.filter(person => person.active)) {
        for (const day of availableDates.filter(value => employeeActiveOn(state, employee, value))) {
          if (!recorded.has(attendanceKey(employee.id, day))) {
            next = markAttendance(next, employee.id, day, defaultAttendanceStatus(day));
          }
        }
      }
      return next;
    }, 'Padrões preenchidos nos dias sem registro.');
  }

  return <section className="panel attendance-panel">
    <div className="toolbar">
      <label>Data de referência<input aria-label="Data da frequência" type="date" value={date} max={currentDate}
        onChange={event => { closeMenu(); if (event.target.value) setDate(event.target.value); }} /></label>
      <div className="tabs">{views.map(option => <button type="button" key={option} className={view === option ? 'selected' : ''}
        onClick={() => { closeMenu(); setView(option); }}>{option}</button>)}</div>
      {(daily || weekly) && <button type="button" className="secondary" onClick={fillDefaults}>
        {daily ? 'Preencher padrão deste dia' : 'Preencher semana padrão'}</button>}
    </div>
    <div className="table-wrap" onScroll={() => closeMenu()}>
      {daily ? <SortableTable>
        <thead><tr><th>Funcionário</th><th>{weekday(date)} · {dateLabel(date)}</th><th>Valor calculado</th><th>Ações</th></tr></thead>
        <tbody>{state.employees.filter(employee => employee.active || lookup({ employee, date })).map(employee => {
          const day = { employee, date };
          const entry = lookup(day);
          const status = entry?.status ?? (!employeeActiveOn(state, employee, date) ? null : defaultAttendanceStatus(date));
          return <tr key={employee.id}>
            <td><span className="employee-name"><b>{employee.name}</b>{!employee.active && <span className="employee-pause-tag">Em pausa</span>}</span></td>
            <td>{status || (date >= employeeAttendanceStart(state, employee) ? 'Em pausa' : 'Não iniciado')}{!entry && status && <small>Presença automática</small>}{entry?.note && <small>{entry.note}</small>}</td>
            <td>{money(attendanceAmount(entry, employee, status || 'Não trabalhado'))}
              {!!entry?.overtimeCents && <small>Hora extra +{money(entry.overtimeCents)}</small>}
              {!!entry?.earlyDepartureDeductionCents && <small>Saída antecipada −{money(entry.earlyDepartureDeductionCents)}</small>}
            </td>
            <td>{actionButton(day)}</td>
          </tr>;
        })}</tbody>
      </SortableTable> : <SortableTable className="attendance-calendar">
        <thead><tr><th>Funcionário</th>{days.map(day => <th key={day}>
          <span className="week-label">{weekday(day)}</span>{dateLabel(day).slice(0, 5)}</th>)}</tr></thead>
        <tbody>{state.employees.map(employee => <tr key={employee.id}>
          <td><span className="employee-name"><b>{employee.name}</b>{!employee.active && <span className="employee-pause-tag">Em pausa</span>}</span></td>
          {days.map(date => {
            const day = { employee, date };
            const entry = lookup(day);
            const status = entry?.status ?? (!employeeActiveOn(state, employee, date) ? null : defaultAttendanceStatus(date));
            const compactStatus = status === 'Não trabalhado' ? 'Não trab.' : status || (date >= employeeAttendanceStart(state, employee) ? 'Em pausa' : 'Não iniciou');
            return <td key={date}><div className="attendance-calendar-cell">
              <span className={entry ? '' : 'attendance-suggested'} title={entry?.note ? `${status}: ${entry.note}` : status || (date >= employeeAttendanceStart(state, employee) ? 'Em pausa' : 'Não iniciado')}>
                {compactStatus}</span>{actionButton(day)}
            </div></td>;
          })}
        </tr>)}</tbody>
      </SortableTable>}
    </div>
    <p className="table-footer">Use o menu de três pontos para registrar a frequência e seus ajustes. O preenchimento padrão respeita os dias já registrados.</p>
    <div ref={menu} id={menuId} popover="auto" className="attendance-action-menu" role="group" aria-label="Ações de frequência">
      {statusActions.map(({ status, label }) => <button type="button" key={status} onClick={() => setStatus(status)}>{label}</button>)}
      <button type="button" onClick={() => openEdit('justification')}>{editLabels.justification}</button>
      <button type="button" disabled={!canAdjust} title={canAdjust ? undefined : 'Marque presença para lançar hora extra'}
        onClick={() => openEdit('overtime')}>{editLabels.overtime}</button>
      <button type="button" disabled={!canAdjust} title={canAdjust ? undefined : 'Marque presença para lançar uma saída antecipada'}
        onClick={() => openEdit('earlyDeparture')}>{editLabels.earlyDeparture}</button>
      <button type="button" onClick={() => openEdit('note')}>{editLabels.note}</button>
    </div>
    {editing && <Modal title={editLabels[editing.action]} subtitle={`${editing.employee.name} · ${dateLabel(editing.date)}`}
      onClose={() => setEditing(null)} footer={<>
        <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button>
        <button type="button" className="primary" onClick={saveEdit}>Salvar dia</button>
      </>}>
      <div className="modal-body">
        {editing.action === 'justification' || editing.action === 'note' ? <label>
          {editing.action === 'justification' ? 'Motivo da falta' : 'Observação'}
          <textarea placeholder="Ex.: apresentou atestado" value={editing.value}
            onChange={event => setEditing({ ...editing, value: event.target.value })} />
        </label> : <label>
          {editing.action === 'overtime' ? 'Valor do acréscimo (R$)' : 'Valor do desconto (R$)'}
          <input inputMode="decimal" placeholder="0,00" value={editing.value}
            onChange={event => setEditing({ ...editing, value: event.target.value })} />
        </label>}
        {editing.action === 'justification' && <p className="footnote">A justificativa fica no histórico. O dia continua registrado como falta, sem diária.</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </Modal>}
  </section>;
}
