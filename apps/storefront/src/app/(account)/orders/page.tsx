import { formatAmount } from '@pro-ai-access/shared';
import { getOrders, ORDER_STATUS_FA } from '@/lib/account-data';
import { CopyInline, CopyBox } from '@/components/copyable';

export const dynamic = 'force-dynamic';

const faDigits = (n: number | string) =>
  String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">سفارش‌های من</h1>
        <p className="mt-1 text-sm text-slate-400">کانفیگ‌ها و تاریخچه‌ی خریدهایت.</p>
      </div>

      {orders.length === 0 ? (
        <div className="card text-center text-slate-400">هنوز سفارشی ثبت نکرده‌ای.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const s = ORDER_STATUS_FA[o.status];
            return (
              <div key={o.id} className="card space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-white">
                      {o.items.map((i) => `${i.productTitle} — ${i.variantTitle}`).join('، ')}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      سفارش #{faDigits(o.number)} · {formatAmount(o.total, 'fa')} تومان
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-xs ${s.tone}`}>{s.label}</span>
                </div>

                {o.services.map((svc, idx) =>
                  svc.type === 'vpn' ? (
                    <div key={idx} className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="text-xs text-slate-400">
                        سرویس VPN · {faDigits(svc.gb)}GB · {faDigits(svc.months)} ماه
                      </div>
                      {svc.subLink && (
                        <div>
                          <div className="mb-1 text-xs font-semibold text-slate-300">لینک اشتراک (Subscription)</div>
                          <CopyInline value={svc.subLink} mono />
                        </div>
                      )}
                      {svc.configs.map((cfg, i) => (
                        <CopyBox key={i} title={`کانفیگ ${faDigits(i + 1)}`} payload={cfg} />
                      ))}
                    </div>
                  ) : (
                    <CopyBox key={idx} title="سرویس تحویل‌شده" payload={svc.content} />
                  ),
                )}

                {o.pendingManual && (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-300">
                    در حال آماده‌سازی؛ سرویس به‌زودی به‌صورت دستی تحویل داده می‌شود.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
