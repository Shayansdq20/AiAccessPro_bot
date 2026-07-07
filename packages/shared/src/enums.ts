// String enums mirroring the Prisma schema so the admin panel and bot can
// reference them without depending on the generated Prisma client.

export const LANGUAGES = ['fa', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'fa';

export const USER_STATUSES = ['active', 'blocked'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const LEDGER_TYPES = ['credit', 'debit', 'adjustment', 'refund'] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

export const FULFILLMENT_MODES = [
  'auto_inventory',
  'manual_admin',
  'hybrid_prefer_inventory',
] as const;
export type FulfillmentMode = (typeof FULFILLMENT_MODES)[number];

export const PRODUCT_KINDS = ['account', 'config', 'license', 'gift_card', 'custom'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const INVENTORY_STATUSES = ['available', 'reserved', 'delivered', 'retired'] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'fulfilling',
  'delivered',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_TYPES = ['manual', 'gateway'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_STATUSES = ['pending', 'approved', 'rejected', 'failed', 'cancelled'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DISCOUNT_TYPES = ['percent', 'fixed'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DELIVERY_TYPES = ['auto_inventory', 'manual'] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

export const DELIVERY_STATUSES = ['pending', 'sent'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const TICKET_STATUSES = ['open', 'answered', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const ADMIN_ROLES = ['owner', 'support', 'operator', 'catalog_manager'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const SENDER_TYPES = ['user', 'admin'] as const;
export type SenderType = (typeof SENDER_TYPES)[number];
