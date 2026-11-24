import type { ReactNode } from 'react';

export function Stat({ label, value, icon, note, action, onActivate }: {
  label: string;
  value: string;
  icon?: ReactNode;
  note: ReactNode;
  action?: ReactNode;
  onActivate?: () => void;
}) {
  return <section className={onActivate ? 'stat stat-clickable' : 'stat'}>
    <div>
      {onActivate ? <button type="button" className="stat-link" onClick={onActivate}>{label}</button> : <span>{label}</span>}
      {action ?? <span className="stat-icon">{icon}</span>}
    </div>
    <strong>{value}</strong>
    <small>{note}</small>
  </section>;
}
