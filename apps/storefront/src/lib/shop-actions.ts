'use server';

import { apiFetch } from './api';
import type { Quote, CheckoutResult } from './shop-types';

/** Live price quote for a selected variant/duration/code. Runs server-side (authed). */
export async function quoteAction(input: {
  variantId: string;
  months: number;
  code?: string;
}): Promise<Quote> {
  return apiFetch<Quote>('/store/quote', {
    method: 'POST',
    body: JSON.stringify({
      variantId: input.variantId,
      months: input.months,
      code: input.code || undefined,
    }),
  });
}

/** Wallet purchase. Fulfillment runs server-side; the config comes back in the result. */
export async function checkoutAction(input: {
  variantId: string;
  months: number;
  code?: string;
}): Promise<CheckoutResult> {
  return apiFetch<CheckoutResult>('/store/checkout', {
    method: 'POST',
    body: JSON.stringify({
      variantId: input.variantId,
      months: input.months,
      code: input.code || undefined,
    }),
  });
}
