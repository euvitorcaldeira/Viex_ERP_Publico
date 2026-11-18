import { audit, type State } from '../v3/domain';

export type MovementKind = 'receipts' | 'employeePayments' | 'workshopPayments';

export function archiveMovement(state: State, kind: MovementKind, movementId: string): State {
  const rows = state[kind];
  const movement = rows.find(row => row.id === movementId);
  if (!movement) throw new Error('A movimentação já foi removida ou não existe.');

  const entityId = 'invoiceId' in movement
    ? movement.invoiceId
    : 'employeeId' in movement ? movement.employeeId : movement.workshopId;
  return audit(
    { ...state, [kind]: rows.filter(row => row.id !== movementId) },
    entityId,
    'Movimentação excluída do histórico',
    movement,
    { collection: kind, removed: true },
  );
}
