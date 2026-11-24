import { Eye, EyeOff, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Stat } from '../components/Stat';
import { money } from '../format';

export function receivableAmount(total: number, visible: boolean) {
  const value = money(total);
  return visible ? value : value.replace(/\d/g, 'X');
}

export function ReceivableStat({ label, total, note, visible, onToggle, onActivate }: {
  label: string;
  total: number;
  note: ReactNode;
  visible: boolean;
  onToggle?: () => void;
  onActivate?: () => void;
}) {
  const toggleLabel = visible ? 'Ocultar valores financeiros' : 'Mostrar valores financeiros';
  return <Stat
    label={label}
    value={onToggle ? receivableAmount(total, visible) : 'Restrito'}
    note={note}
    icon={<Wallet />}
    onActivate={onActivate}
    action={onToggle && <button type="button" className="stat-icon stat-visibility" aria-label={toggleLabel} title={toggleLabel} onClick={onToggle}>
      {visible ? <Eye /> : <EyeOff />}
    </button>}
  />;
}
