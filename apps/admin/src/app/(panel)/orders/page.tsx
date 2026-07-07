import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getDict } from '@/lib/i18n';
import { dateTime, displayName, money } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface OrderRow {
  id: string;
  number: number;
  status: string;
  total: string;
  discountAmount: string;
  createdAt: string;
  user: { id: string; firstName?: string; lastName?: string; telegramUsername?: string; displayUsername: string };
  items: { productTitle: string; variantTitle: string }[];
  deliveries: { status: string; type: string }[];
}

const STATUSES = ['', 'paid', 'fulfilling', 'delivered', 'cancelled', 'refunded'];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const { status = '', page = '1' } = await searchParams;
  const { t, lang } = await getDict();
  const data = await apiFetch<{ items: OrderRow[]; total: number; page: number; pageSize: number }>(
    `/admin/orders?status=${status}&page=${page}`,
  );
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">🛒 {t.orders} ({data.total})</h1>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link key={s || 'all'} href={`/orders?status=${s}`} className={`btn btn-secondary ${status === s ? '!bg-slate-900 !text-white' : ''}`}>
            {s || t.all}
          </Link>
        ))}
      </div>
      <div className="card overflow-x-auto !p-0">
        <table className="table-base">
          <thead>
            <tr><th>#</th><th>{t.user}</th><th>{t.product}</th><th>{t.total}</th><th>{t.status}</th><th>{t.fulfillment}</th><th>{t.date}</th></tr>
          </thead>
          <tbody>
            {data.items.map((o) => (
              <tr key={o.id}>
                <td>{o.number}</td>
                <td><Link className="text-sky-700 hover:underline" href={`/users/${o.user.id}`}>{displayName(o.user)}</Link></td>
                <td>{o.items[0] ? `${o.items[0].productTitle} — ${o.items[0].variantTitle}` : '—'}</td>
                <td>
                  {money(o.total, lang)}
                  {BigInt(o.discountAmount) > 0n && <span className="ms-1 text-xs text-emerald-600">(-{money(o.discountAmount, lang)})</span>}
                </td>
                <td>
                  <span className={`badge ${o.status === 'delivered' ? 'badge-green' : o.status === 'cancelled' || o.status === 'refunded' ? 'badge-red' : 'badge-yellow'}`}>
                    {o.status}
                  </span>
                </td>
                <td className="text-xs">
                  {o.deliveries.map((d, i) => <span key={i} className={`badge ${d.status === 'sent' ? 'badge-green' : 'badge-yellow'}`}>{d.type}: {d.status}</span>)}
                </td>
                <td className="text-xs text-slate-500">{dateTime(o.createdAt, lang)}</td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan={7} className="text-slate-400">{t.noData}</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex gap-2">
          {Array.from({ length: pages }, (_, i) => (
            <Link key={i} className={`btn btn-secondary ${data.page === i + 1 ? '!bg-slate-900 !text-white' : ''}`} href={`/orders?status=${status}&page=${i + 1}`}>{i + 1}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
