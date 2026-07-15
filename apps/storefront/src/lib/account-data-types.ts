// Client-safe account-area types + labels.

export type DeliveredService =
  | { type: 'vpn'; subLink: string; configs: string[]; gb: number; months: number }
  | { type: 'text'; content: string };

export type OrderRow = {
  id: string;
  number: number;
  status: 'pending_payment' | 'paid' | 'fulfilling' | 'delivered' | 'cancelled' | 'refunded';
  total: string;
  createdAt: string;
  items: { productTitle: string; variantTitle: string }[];
  services: DeliveredService[];
  pendingManual: boolean;
};

export type LedgerRow = {
  id: string;
  type: 'credit' | 'debit' | 'adjustment' | 'refund';
  amount: string;
  balanceAfter: string;
  description: string | null;
  reference: string;
  createdAt: string;
};

export type ReferralStats = {
  code: string;
  link: string;
  invitedCount: number;
  qualifiedCount: number;
  earnedTotal: string;
  program: { name?: string } | null;
};

export type SupportMessage = {
  id: string;
  sender: 'user' | 'admin';
  body: string;
  createdAt: string;
};

export type Ticket = {
  id: string;
  number: number;
  status: 'open' | 'answered' | 'closed';
  createdAt: string;
  messages: SupportMessage[];
};

export const ORDER_STATUS_FA: Record<OrderRow['status'], { label: string; tone: string }> = {
  pending_payment: { label: 'در انتظار پرداخت', tone: 'text-amber-300 border-amber-400/30 bg-amber-500/10' },
  paid: { label: 'پرداخت شد', tone: 'text-cyan-300 border-cyan-400/30 bg-cyan-500/10' },
  fulfilling: { label: 'در حال آماده‌سازی', tone: 'text-cyan-300 border-cyan-400/30 bg-cyan-500/10' },
  delivered: { label: 'تحویل شد', tone: 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10' },
  cancelled: { label: 'لغو شد', tone: 'text-slate-300 border-white/15 bg-white/5' },
  refunded: { label: 'بازگشت وجه', tone: 'text-slate-300 border-white/15 bg-white/5' },
};

export const TICKET_STATUS_FA: Record<Ticket['status'], string> = {
  open: 'باز',
  answered: 'پاسخ داده شد',
  closed: 'بسته شد',
};
