'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatAmount } from '@premium-hub/shared';
import { quoteAction, checkoutAction } from '@/lib/shop-actions';
import { DISCOUNT_REASON_FA, type ShopProduct, type Quote, type CheckoutResult } from '@/lib/shop-types';

const faDigits = (n: number | string) =>
  String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

/** Same shape as shared durationPrice, computed client-side for list previews. */
function previewPrice(price: string, months: number, extraPercent: number): bigint {
  const base = BigInt(price);
  const extraMonths = BigInt(Math.max(1, months) - 1);
  return base + (base * BigInt(extraPercent) * extraMonths) / 100n;
}

export function BuyPanel({ data }: { data: ShopProduct }) {
  const { product, variants, optionGroups, durationMonths } = data;

  const [months, setMonths] = useState(1);
  const [groupIdx, setGroupIdx] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoting, startQuote] = useTransition();
  const [buying, startBuy] = useTransition();

  const effectiveMonths = product.useDurationTabs ? months : 1;
  const showGroups = !product.useDurationTabs && optionGroups.length > 0;

  const visibleVariants = useMemo(() => {
    if (showGroups) {
      const g = optionGroups[Math.min(groupIdx, optionGroups.length - 1)];
      return variants.filter((v) => (v.optionGroup ?? g) === g);
    }
    return variants;
  }, [variants, optionGroups, groupIdx, showGroups]);

  // Keep a valid variant selected when the visible set changes.
  useEffect(() => {
    if (!visibleVariants.some((v) => v.id === variantId)) {
      setVariantId(visibleVariants[0]?.id ?? null);
    }
  }, [visibleVariants, variantId]);

  // Re-quote whenever variant / duration / applied code changes.
  useEffect(() => {
    if (!variantId) {
      setQuote(null);
      return;
    }
    startQuote(async () => {
      try {
        const q = await quoteAction({
          variantId,
          months: effectiveMonths,
          code: appliedCode || undefined,
        });
        setQuote(q);
      } catch {
        setQuote(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantId, effectiveMonths, appliedCode]);

  const onBuy = () => {
    if (!variantId) return;
    setError(null);
    setResult(null);
    startBuy(async () => {
      try {
        setResult(await checkoutAction({ variantId, months: effectiveMonths, code: appliedCode || undefined }));
      } catch {
        setError('خطا در انجام خرید؛ دوباره تلاش کن.');
      }
    });
  };

  if (result?.ok) return <PurchaseResult result={result} />;

  return (
    <div className="space-y-6">
      {/* مدت زمان (پلن‌های VPN) */}
      {product.useDurationTabs && (
        <div>
          <div className="label">مدت اشتراک</div>
          <div className="flex flex-wrap gap-2">
            {durationMonths.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className={tab(m === months)}
              >
                {faDigits(m)} ماه
              </button>
            ))}
          </div>
        </div>
      )}

      {/* گروه گزینه‌ها */}
      {showGroups && (
        <div>
          <div className="label">نوع سرویس</div>
          <div className="flex flex-wrap gap-2">
            {optionGroups.map((g, idx) => (
              <button key={g} type="button" onClick={() => setGroupIdx(idx)} className={tab(idx === groupIdx)}>
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* پلن‌ها */}
      <div>
        <div className="label">انتخاب پلن</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleVariants.map((v) => {
            const price = formatAmount(previewPrice(v.price, effectiveMonths, product.durationExtraPercent), 'fa');
            const active = v.id === variantId;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariantId(v.id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-right transition-colors ${
                  active
                    ? 'border-violet-400/60 bg-violet-500/10'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                }`}
              >
                <span className="font-semibold text-white">{v.title}</span>
                <span className="text-sm text-slate-300">{price} تومان</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* کد تخفیف */}
      <div>
        <div className="label">کد تخفیف (اختیاری)</div>
        <div className="flex gap-2">
          <input
            className="input"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="مثلاً OFF20"
            dir="ltr"
          />
          <button type="button" className="btn-ghost shrink-0" onClick={() => setAppliedCode(codeInput.trim())}>
            اعمال
          </button>
        </div>
        {quote?.discountStatus === 'rejected' && (
          <p className="mt-2 text-sm text-red-400">
            {DISCOUNT_REASON_FA[quote.discountReason ?? ''] ?? 'کد تخفیف معتبر نیست'}
          </p>
        )}
        {quote?.discountStatus === 'applied' && (
          <p className="mt-2 text-sm text-emerald-400">کد «{quote.discountCodeText}» اعمال شد ✅</p>
        )}
      </div>

      {/* خلاصه قیمت */}
      <div className="card space-y-2">
        {quote ? (
          <>
            <Row label="جمع" value={`${formatAmount(quote.subtotal, 'fa')} تومان`} muted />
            {quote.discountStatus === 'applied' && Number(quote.discountAmount) > 0 && (
              <Row label="تخفیف" value={`− ${formatAmount(quote.discountAmount, 'fa')} تومان`} good />
            )}
            <div className="flex items-center justify-between border-t border-white/10 pt-2">
              <span className="font-bold text-white">مبلغ قابل پرداخت</span>
              <span className="text-xl font-black text-gradient">
                {formatAmount(quote.total, 'fa')} تومان
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">{quoting ? 'در حال محاسبه…' : 'یک پلن انتخاب کن.'}</p>
        )}
      </div>

      {result && !result.ok && <PurchaseError result={result} />}
      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <button className="btn w-full" type="button" onClick={onBuy} disabled={!quote || buying || quoting}>
        {buying ? 'در حال پرداخت…' : 'خرید با کیف پول'}
      </button>
      <p className="text-center text-xs text-slate-500">
        مبلغ از موجودی کیف پول تو کسر می‌شود.
      </p>
    </div>
  );
}

function tab(active: boolean) {
  return `rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
    active ? 'border-violet-400/60 bg-violet-500/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25'
  }`;
}

function Row({ label, value, muted, good }: { label: string; value: string; muted?: boolean; good?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={good ? 'text-emerald-400' : muted ? 'text-slate-300' : 'text-white'}>{value}</span>
    </div>
  );
}

function PurchaseError({ result }: { result: Extract<CheckoutResult, { ok: false }> }) {
  if (result.reason === 'insufficient_balance') {
    return (
      <div className="card border-amber-400/30 bg-amber-500/5">
        <p className="font-bold text-amber-300">موجودی کیف پول کافی نیست</p>
        <p className="mt-1 text-sm text-slate-300">
          مبلغ سفارش {formatAmount(result.total, 'fa')} تومان است و موجودی تو {formatAmount(result.balance, 'fa')} تومان.
          برای ادامه {formatAmount(result.shortfall, 'fa')} تومان کم داری.
        </p>
        <Link href="/wallet" className="btn-ghost mt-3 inline-flex">
          شارژ کیف پول
        </Link>
      </div>
    );
  }
  return (
    <div className="card border-red-400/30 bg-red-500/5">
      <p className="font-bold text-red-300">این پلن موجود نیست</p>
      <p className="mt-1 text-sm text-slate-300">لطفاً پلن دیگری انتخاب کن.</p>
    </div>
  );
}

function PurchaseResult({ result }: { result: Extract<CheckoutResult, { ok: true }> }) {
  const { order, fulfillment } = result;
  return (
    <div className="space-y-5">
      <div className="card border-emerald-400/30 bg-emerald-500/5 text-center">
        <div className="text-3xl">✅</div>
        <h2 className="mt-2 text-xl font-black text-white">خرید موفق بود</h2>
        <p className="mt-1 text-sm text-slate-300">
          سفارش #{faDigits(order.number)} — مبلغ {formatAmount(order.total, 'fa')} تومان
        </p>
      </div>

      {fulfillment.kind === 'delivered' && fulfillment.payload && (
        <CopyBlock title="سرویس تحویل شد" payload={fulfillment.payload} />
      )}
      {fulfillment.kind === 'pending_manual' && (
        <div className="card text-sm text-slate-300">
          سفارش ثبت شد و به‌زودی به‌صورت دستی برایت تحویل داده می‌شود.
        </div>
      )}

      <div className="flex gap-3">
        <Link href="/" className="btn-ghost flex-1 justify-center">حساب کاربری</Link>
        <Link href="/shop" className="btn flex-1 justify-center">خرید دوباره</Link>
      </div>
    </div>
  );
}

function CopyBlock({ title, payload }: { title: string; payload: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold text-white">{title}</span>
        <button
          type="button"
          className="btn-ghost text-xs"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(payload);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard may be blocked; user can select manually */
            }
          }}
        >
          {copied ? 'کپی شد ✅' : 'کپی'}
        </button>
      </div>
      <code
        dir="ltr"
        className="block max-h-48 overflow-auto rounded-lg bg-black/50 px-3 py-2 text-left font-mono text-xs leading-6 text-cyan-300"
        style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}
      >
        {payload}
      </code>
    </div>
  );
}
