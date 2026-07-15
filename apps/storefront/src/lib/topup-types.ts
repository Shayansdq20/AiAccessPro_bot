// Client-safe wallet/top-up types + labels.

export type Preset = { amount: string | number; label?: string };

export type TopupOptions = {
  presets: Preset[];
  card: { number: string; holder: string; bank: string; notes: string };
  gatewayEnabled: boolean;
  minAmount: string;
};

export type PaymentRow = {
  id: string;
  number: number;
  amount: string;
  status: 'pending' | 'approved' | 'rejected' | 'failed' | 'cancelled';
  type: 'manual' | 'gateway';
  provider: string;
  createdAt: string;
};

export const PAYMENT_STATUS_FA: Record<PaymentRow['status'], { label: string; tone: string }> = {
  pending: { label: 'در انتظار تایید', tone: 'text-amber-300 border-amber-400/30 bg-amber-500/10' },
  approved: { label: 'تایید شد', tone: 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10' },
  rejected: { label: 'رد شد', tone: 'text-red-300 border-red-400/30 bg-red-500/10' },
  failed: { label: 'ناموفق', tone: 'text-red-300 border-red-400/30 bg-red-500/10' },
  cancelled: { label: 'لغو شد', tone: 'text-slate-300 border-white/15 bg-white/5' },
};
