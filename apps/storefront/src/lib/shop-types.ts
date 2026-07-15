// Client-safe shop types + constants (no server-only imports).

export type Category = {
  id: string;
  title: string;
  description: string | null;
};

export type ProductLite = {
  id: string;
  title: string;
  description: string | null;
};

export type Variant = {
  id: string;
  title: string;
  price: string;
  optionGroup: string | null;
};

export type ShopProduct = {
  product: {
    id: string;
    title: string;
    description: string | null;
    categoryId: string;
    useDurationTabs: boolean;
    durationExtraPercent: number;
  };
  variants: Variant[];
  optionGroups: string[];
  durationMonths: number[];
};

export type Quote = {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  durationMonths: number;
  subtotal: string;
  discountAmount: string;
  total: string;
  discountStatus: 'none' | 'applied' | 'rejected';
  discountCodeText?: string;
  discountReason?: string;
};

export type Fulfillment =
  | { kind: 'delivered'; payload: string }
  | { kind: 'pending_manual' }
  | { kind: 'out_of_stock' };

export type CheckoutResult =
  | { ok: true; order: { number: number; total: string }; fulfillment: Fulfillment }
  | { ok: false; reason: 'insufficient_balance'; balance: string; total: string; shortfall: string }
  | { ok: false; reason: 'out_of_stock' };

export const DISCOUNT_REASON_FA: Record<string, string> = {
  not_found: 'کد تخفیف پیدا نشد',
  inactive: 'این کد غیرفعال است',
  expired: 'این کد منقضی شده است',
  max_uses: 'ظرفیت استفاده از این کد پر شده است',
  max_uses_per_user: 'قبلاً از این کد استفاده کرده‌ای',
  min_order: 'مبلغ سفارش برای این کد کافی نیست',
};
