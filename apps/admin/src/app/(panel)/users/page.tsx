import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getDict } from '@/lib/i18n';
import { displayName, money } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface UserRow {
  id: string;
  telegramId: string;
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
  displayUsername: string;
  status: string;
  language: string;
  wallet?: { balance: string };
  _count: { orders: number; payments: number; tickets: number };
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q = '', page = '1' } = await searchParams;
  const { t, lang } = await getDict();
  const data = await apiFetch<{ items: UserRow[]; total: number; page: number; pageSize: number }>(
    `/admin/users?q=${encodeURIComponent(q)}&page=${page}`,
  );
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.users} ({data.total})</h1>
      <form className="flex max-w-md gap-2">
        <input className="input" name="q" defaultValue={q} placeholder={`${t.search}: ${t.telegramId} / ${t.username} / ${t.name}`} />
        <button className="btn" type="submit">{t.search}</button>
      </form>
      <div className="card overflow-x-auto !p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>{t.user}</th><th>{t.telegramId}</th><th>{t.username}</th><th>{t.balance}</th>
              <th>{t.ordersCount}</th><th>{t.paymentsCount}</th><th>{t.ticketsCount}</th><th>{t.status}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td><Link className="font-medium text-sky-700 hover:underline" href={`/users/${u.id}`}>{displayName(u)}</Link></td>
                <td dir="ltr">{u.telegramId}</td>
                <td dir="ltr">{u.telegramUsername ? `@${u.telegramUsername}` : u.displayUsername}</td>
                <td>{money(u.wallet?.balance ?? '0', lang)}</td>
                <td>{u._count.orders}</td>
                <td>{u._count.payments}</td>
                <td>{u._count.tickets}</td>
                <td><span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}>{u.status}</span></td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan={8} className="text-slate-400">{t.noData}</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex gap-2">
          {Array.from({ length: pages }, (_, i) => (
            <Link key={i} className={`btn btn-secondary ${data.page === i + 1 ? '!bg-slate-900 !text-white' : ''}`} href={`/users?q=${encodeURIComponent(q)}&page=${i + 1}`}>
              {i + 1}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
