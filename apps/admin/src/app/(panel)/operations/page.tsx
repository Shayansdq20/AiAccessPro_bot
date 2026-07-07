import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { apiAction } from '@/lib/actions';
import { getDict } from '@/lib/i18n';
import { dateTime, displayName, money } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface PendingPayment {
  id: string;
  number: number;
  amount: string;
  createdAt: string;
  user: { id: string; telegramId: string; firstName?: string; lastName?: string; telegramUsername?: string; displayUsername: string };
  receipt?: { id: string } | null;
}

interface PendingDelivery {
  id: string;
  createdAt: string;
  order: {
    id: string;
    number: number;
    total: string;
    user: { id: string; telegramId: string; firstName?: string; telegramUsername?: string; displayUsername: string; lastName?: string };
    items: { productTitle: string; variantTitle: string; optionsJson?: { durationMonths?: number } }[];
  };
}

export default async function OperationsPage() {
  const { t, lang } = await getDict();
  const [payments, deliveries] = await Promise.all([
    apiFetch<PendingPayment[]>('/admin/payments/pending'),
    apiFetch<PendingDelivery[]>('/admin/deliveries?status=pending'),
  ]);

  async function decide(id: string, decision: 'approve' | 'reject') {
    'use server';
    await apiAction({ path: `/admin/payments/${id}/${decision}`, revalidate: '/operations' });
  }

  async function sendDelivery(id: string, formData: FormData) {
    'use server';
    await apiAction({
      path: `/admin/deliveries/${id}/send`,
      body: { message: String(formData.get('message') ?? '') },
      revalidate: '/operations',
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">⚡ {t.operations}</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">💳 {t.pendingPayments} ({payments.length})</h2>
        {payments.length === 0 && <div className="card text-slate-400">{t.noData}</div>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {payments.map((p) => (
            <div key={p.id} className="card space-y-3">
              {/* The receipt image must be visible before approving. */}
              {p.receipt ? (
                <a href={`/api/receipt/${p.id}`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/receipt/${p.id}`} alt={t.receipt} className="max-h-64 w-full rounded-lg border border-slate-200 object-contain" />
                </a>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-400">{t.noReceipt}</div>
              )}
              <div className="text-sm">
                <div><b>#{p.number}</b> · {money(p.amount, lang)}</div>
                <div>
                  <Link className="text-sky-700 hover:underline" href={`/users/${p.user.id}`}>{displayName(p.user)}</Link>
                  <span className="text-slate-500"> · </span>
                  <span dir="ltr" className="text-slate-500">{p.user.telegramId}</span>
                </div>
                <div className="text-xs text-slate-400">{dateTime(p.createdAt, lang)}</div>
              </div>
              <div className="flex gap-2">
                <form action={decide.bind(null, p.id, 'approve')} className="grow">
                  <button className="btn btn-success w-full" type="submit" disabled={!p.receipt}>✅ {t.approve}</button>
                </form>
                <form action={decide.bind(null, p.id, 'reject')} className="grow">
                  <button className="btn btn-danger w-full" type="submit">❌ {t.reject}</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">📦 {t.pendingDeliveries} ({deliveries.length})</h2>
        {deliveries.length === 0 && <div className="card text-slate-400">{t.noData}</div>}
        <div className="grid gap-4 md:grid-cols-2">
          {deliveries.map((d) => {
            const item = d.order.items[0];
            return (
              <div key={d.id} className="card space-y-3">
                <div className="text-sm">
                  <div><b>#{d.order.number}</b> · {item ? `${item.productTitle} — ${item.variantTitle}` : '—'}
                    {item?.optionsJson?.durationMonths && item.optionsJson.durationMonths > 1 ? ` · ${item.optionsJson.durationMonths}m` : ''}
                  </div>
                  <div>
                    <Link className="text-sky-700 hover:underline" href={`/users/${d.order.user.id}`}>{displayName(d.order.user)}</Link>
                    <span className="text-slate-500"> · </span>
                    <span dir="ltr" className="text-slate-500">{d.order.user.telegramId}</span>
                  </div>
                  <div className="text-xs text-slate-400">{money(d.order.total, lang)} · {dateTime(d.createdAt, lang)}</div>
                </div>
                <form action={sendDelivery.bind(null, d.id)} className="space-y-2">
                  <textarea className="input min-h-24 font-mono" name="message" required placeholder={t.deliveryMessage} dir="ltr" />
                  <button className="btn w-full" type="submit">📬 {t.sendDelivery}</button>
                </form>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
