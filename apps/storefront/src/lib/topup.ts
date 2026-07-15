import { apiFetch } from './api';
import type { TopupOptions, PaymentRow } from './topup-types';

export * from './topup-types';

export async function getTopupOptions(): Promise<TopupOptions> {
  return apiFetch<TopupOptions>('/store/topup/options');
}

export async function getPayments(): Promise<PaymentRow[]> {
  return apiFetch<PaymentRow[]>('/store/payments');
}
