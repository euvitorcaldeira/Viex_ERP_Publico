import type { ReactNode } from 'react';
import './actionIcon.css';

type ActionIconProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};

export function ActionIcon({ label, icon, onClick, disabled, danger }: ActionIconProps) {
  return (
    <button
      type="button"
      className={danger ? 'action-icon action-icon-danger' : 'action-icon'}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
