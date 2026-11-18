import { Trash2 } from 'lucide-react';
import { ActionIcon } from '../components/ActionIcon';
import { useCapabilities } from '../security/context';
import type { Commit } from '../v3/common';
import { archiveMovement, type MovementKind } from './movementHistory';

type ArchiveMovementButtonProps = {
  commit: Commit;
  kind: MovementKind;
  movementId: string;
  reversed?: boolean;
};

export function ArchiveMovementButton({ commit, kind, movementId, reversed }: ArchiveMovementButtonProps) {
  const { actor, canViewFinance } = useCapabilities();
  if (!canViewFinance || actor.source !== 'authenticated') return null;

  const label = kind === 'receipts' ? 'Excluir recebimento do histórico' : 'Excluir pagamento do histórico';
  function archive() {
    const effect = reversed
      ? 'O saldo não será alterado.'
      : 'O valor será retirado dos lançamentos e o saldo será recalculado.';
    if (window.confirm(`${label}? ${effect} A movimentação original ficará registrada na auditoria.`)) {
      commit(state => archiveMovement(state, kind, movementId), 'Movimentação excluída do histórico.');
    }
  }

  return <ActionIcon label={label} icon={<Trash2 size={16} />} onClick={archive} danger />;
}
