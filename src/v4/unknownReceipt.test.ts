import { expect, it } from 'vitest';
import { installmentReceived, reverseReceipt, type State } from '../v3/domain';
import { balanceMovements } from './balance';

it('quits an undated receipt without inventing a cash month and supports reversal', () => {
  const state = { version:4, invoices:[], records:[], employees:[], employeePayments:[], workshops:[], workshopPayments:[], attendance:[], audit:[], receipts:[{id:'r', invoiceId:'i', installmentId:'p', date:'', dateUnknown:true, amountCents:1060000, reversedAt:null}] } as State;
  expect(installmentReceived(state, 'p')).toBe(1060000);
  expect(balanceMovements(state)).toEqual([]);
  expect(installmentReceived(reverseReceipt(state, 'r'), 'p')).toBe(0);
});
