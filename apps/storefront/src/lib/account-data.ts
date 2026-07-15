import { apiFetch } from './api';
import type { OrderRow, LedgerRow, ReferralStats, Ticket } from './account-data-types';

export * from './account-data-types';

export async function getOrders(): Promise<OrderRow[]> {
  return apiFetch<OrderRow[]>('/store/orders');
}

export async function getLedger(): Promise<LedgerRow[]> {
  return apiFetch<LedgerRow[]>('/store/wallet/ledger');
}

export async function getReferral(): Promise<ReferralStats> {
  return apiFetch<ReferralStats>('/store/referral');
}

export async function getTickets(): Promise<Ticket[]> {
  return apiFetch<Ticket[]>('/store/support/tickets');
}
