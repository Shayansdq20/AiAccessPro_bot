import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getDict } from '@/lib/i18n';
import { dateTime, displayName } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Ticket {
  id: string;
  number: number;
  status: string;
  updatedAt: string;
  user: { id: string; firstName?: string; lastName?: string; telegramUsername?: string; displayUsername: string };
  messages: { body: string; sender: string }[];
  _count: { messages: number };
}

const STATUSES = ['', 'open', 'answered', 'closed'];

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = '' } = await searchParams;
  const { t, lang } = await getDict();
  const tickets = await apiFetch<Ticket[]>(`/admin/support/tickets?status=${status}`);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">💬 {t.support}</h1>
      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <Link key={s || 'all'} href={`/support?status=${s}`} className={`btn btn-secondary ${status === s ? '!bg-slate-900 !text-white' : ''}`}>
            {s || t.all}
          </Link>
        ))}
      </div>
      <div className="card overflow-x-auto !p-0">
        <table className="table-base">
          <thead>
            <tr><th>#</th><th>{t.user}</th><th>{t.lastMessage}</th><th>{t.messages}</th><th>{t.status}</th><th>{t.date}</th></tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-slate-50">
                <td><Link className="font-medium text-sky-700 hover:underline" href={`/support/${ticket.id}`}>#{ticket.number}</Link></td>
                <td>{displayName(ticket.user)}</td>
                <td className="max-w-72 truncate text-slate-600">{ticket.messages[0]?.body ?? '—'}</td>
                <td>{ticket._count.messages}</td>
                <td>
                  <span className={`badge ${ticket.status === 'open' ? 'badge-yellow' : ticket.status === 'answered' ? 'badge-blue' : 'badge-gray'}`}>
                    {ticket.status}
                  </span>
                </td>
                <td className="text-xs text-slate-500">{dateTime(ticket.updatedAt, lang)}</td>
              </tr>
            ))}
            {tickets.length === 0 && <tr><td colSpan={6} className="text-slate-400">{t.noData}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
