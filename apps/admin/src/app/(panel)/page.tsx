import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getDict } from '@/lib/i18n';
import { dateTime, displayName, money } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Dashboard {
  counts: {
    users: number;
    orders: number;
    delivered: number;
    pendingPayments: number;
    pendingDeliveries: number;
    openTickets: number;
  };
  revenue: string;
  recentOrders: {
    id: string;
    number: number;
    status: string;
    total: string;
    createdAt: string;
    user: { id: string; firstName?: string; lastName?: string; telegramUsername?: string; displayUsername: string };
    items: { productTitle: string; variantTitle: string }[];
  }[];
  recentPayments: {
    id: string;
    number: number;
    status: string;
    amount: string;
    provider: string;
    createdAt: string;
    user: { id: string; firstName?: string; lastName?: string; telegramUsername?: string; displayUsername: string };
  }[];
}

export default async function DashboardPage() {
  const { t, lang } = await getDict();
  const data = await apiFetch<Dashboard>('/admin/dashboard');

  const stats = [
    { label: t.totalUsers, value: data.counts.users, href: '/users' },
    { label: t.totalOrders, value: data.counts.orders, href: '/orders' },
    { label: t.deliveredServices, value: data.counts.delivered, href: '/orders?status=delivered' },
    { label: t.pendingPayments, value: data.counts.pendingPayments, href: '/operations', hot: data.counts.pendingPayments > 0 },
    { label: t.pendingDeliveries, value: data.counts.pendingDeliveries, href: '/operations', hot: data.counts.pendingDeliveries > 0 },
    { label: t.openTickets, value: data.counts.openTickets, href: '/support', hot: data.counts.openTickets > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.dashboard}</h1>
        <div className="card !p-3 text-sm">
          <span className="text-slate-500">{t.revenue}: </span>
          <b>{money(data.revenue, lang)}</b>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`card transition hover:shadow-md ${s.hot ? 'border-amber-300 bg-amber-50' : ''}`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="mt-1 text-xs text-slate-500">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">{t.recentOrders}</h2>
          <table className="table-base">
            <thead>
              <tr><th>#</th><th>{t.user}</th><th>{t.product}</th><th>{t.total}</th><th>{t.status}</th></tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o) => (
                <tr key={o.id}>
                  <td>{o.number}</td>
                  <td><Link className="text-sky-700 hover:underline" href={`/users/${o.user.id}`}>{displayName(o.user)}</Link></td>
                  <td>{o.items[0]?.productTitle ?? '—'}</td>
                  <td>{money(o.total, lang)}</td>
                  <td><span className="badge badge-gray">{o.status}</span></td>
                </tr>
              ))}
              {data.recentOrders.length === 0 && <tr><td colSpan={5} className="text-slate-400">{t.noData}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">{t.recentPayments}</h2>
          <table className="table-base">
            <thead>
              <tr><th>#</th><th>{t.user}</th><th>{t.amount}</th><th>{t.status}</th><th>{t.date}</th></tr>
            </thead>
            <tbody>
              {data.recentPayments.map((p) => (
                <tr key={p.id}>
                  <td>{p.number}</td>
                  <td><Link className="text-sky-700 hover:underline" href={`/users/${p.user.id}`}>{displayName(p.user)}</Link></td>
                  <td>{money(p.amount, lang)}</td>
                  <td>
                    <span className={`badge ${p.status === 'approved' ? 'badge-green' : p.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="text-xs text-slate-500">{dateTime(p.createdAt, lang)}</td>
                </tr>
              ))}
              {data.recentPayments.length === 0 && <tr><td colSpan={5} className="text-slate-400">{t.noData}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
