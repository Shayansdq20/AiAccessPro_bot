import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getDict } from '@/lib/i18n';
import { dateTime, displayName, money } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface PaymentRow {
  id: string;
  number: number;
  status: string;
  amount: string;
  provider: string;
  type: string;
  createdAt: string;
  decidedAt?: string;
  user: { id: string; firstName?: string; lastName?: string; telegramUsername?: string; displayUsername: string };
  receipt?: { id: string } | null;
}

const STATUSES = ['', 'pending', 'approved', 'rejected', 'failed', 'cancelled'];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const { status = '', page = '1' } = await searchParams;
  const { t, lang } = await getDict();
  const data = await apiFetch<{ items: PaymentRow[]; total: number; page: number; pageSize: number }>(
    `/admin/payments?status=${status}&page=${page}`,
  );
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">💳 {t.payments} ({data.total})</h1>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link key={s || 'all'} href={`/payments?status=${s}`} className={`btn btn-secondary ${status === s ? '!bg-slate-900 !text-white' : ''}`}>
            {s || t.all}
          </Link>
        ))}
      </div>
      <div className="card overflow-x-auto !p-0">
        <table className="table-base">
          <thead>
            <tr><th>#</th><th>{t.user}</th><th>{t.amount}</th><th>{t.provider}</th><th>{t.receipt}</th><th>{t.status}</th><th>{t.date}</th></tr>
          </thead>
          <tbody>
            {data.items.map((p) => (
              <tr key={p.id}>
                <td>{p.number}</td>
                <td><Link className="text-sky-700 hover:underline" href={`/users/${p.user.id}`}>{displayName(p.user)}</Link></td>
                <td>{money(p.amount, lang)}</td>
                <td>{p.provider}</td>
                <td>
                  {p.receipt ? (
                    <a className="text-sky-700 hover:underline" href={`/api/receipt/${p.id}`} target="_blank" rel="noreferrer">🖼 {t.receipt}</a>
                  ) : '—'}
                </td>
                <td>
                  <span className={`badge ${p.status === 'approved' ? 'badge-green' : p.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>{p.status}</span>
                </td>
                <td className="text-xs text-slate-500">{dateTime(p.createdAt, lang)}</td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan={7} className="text-slate-400">{t.noData}</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex gap-2">
          {Array.from({ length: pages }, (_, i) => (
            <Link key={i} className={`btn btn-secondary ${data.page === i + 1 ? '!bg-slate-900 !text-white' : ''}`} href={`/payments?status=${status}&page=${i + 1}`}>{i + 1}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
