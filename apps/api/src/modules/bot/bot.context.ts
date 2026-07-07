import type { Context, SessionFlavor } from 'grammy';

/** Durable per-user conversation state (persisted in Postgres, restart-safe). */
export interface SessionData {
  pending?:
    | { type: 'custom_amount' }
    | { type: 'receipt'; paymentId: string }
    | { type: 'discount' }
    | { type: 'support' };
  /** Saved discount code applied to the next checkout. */
  discountCodeId?: string;
  lastReceiptAt?: number;
  lastSupportAt?: number;
}

export type BotContext = Context & SessionFlavor<SessionData>;

export function initialSession(): SessionData {
  return {};
}
