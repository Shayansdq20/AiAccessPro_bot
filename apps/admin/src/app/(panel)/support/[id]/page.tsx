import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { apiAction } from '@/lib/actions';
import { getDict } from '@/lib/i18n';
import { dateTime, displayName } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface TicketDetail {
  id: string;
  number: number;
  status: string;
  user: { id: string; telegramId: string; firstName?: string; lastName?: string; telegramUsername?: string; displayUsername: string };
  messages: { id: string; sender: 'user' | 'admin'; body: string; createdAt: string }[];
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, lang } = await getDict();
  const ticket = await apiFetch<TicketDetail>(`/admin/support/tickets/${id}`);

  async function reply(formData: FormData) {
    'use server';
    await apiAction({
      path: `/admin/support/tickets/${id}/reply`,
      body: { message: String(formData.get('message') ?? '') },
      revalidate: `/support/${id}`,
    });
  }

  async function close() {
    'use server';
    await apiAction({ path: `/admin/support/tickets/${id}/close`, revalidate: `/support/${id}` });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">💬 {t.ticket} #{ticket.number}</h1>
        {ticket.status !== 'closed' && (
          <form action={close}>
            <button className="btn btn-secondary" type="submit">{t.close}</button>
          </form>
        )}
      </div>
      <div className="card text-sm">
        <Link className="text-sky-700 hover:underline" href={`/users/${ticket.user.id}`}>{displayName(ticket.user)}</Link>
        <span className="text-slate-500"> · </span>
        <span dir="ltr" className="text-slate-500">{ticket.user.telegramId}</span>
        <span className="text-slate-500"> · </span>
        <span className={`badge ${ticket.status === 'open' ? 'badge-yellow' : ticket.status === 'answered' ? 'badge-blue' : 'badge-gray'}`}>{ticket.status}</span>
      </div>

      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div key={m.id} className={`card !p-3 ${m.sender === 'admin' ? 'ms-12 bg-sky-50' : 'me-12'}`}>
            <div className="whitespace-pre-wrap text-sm">{m.body}</div>
            <div className="mt-1 text-xs text-slate-400">
              {m.sender === 'admin' ? `🛠 ${t.admin}` : `👤 ${t.user}`} · {dateTime(m.createdAt, lang)}
            </div>
          </div>
        ))}
      </div>

      {ticket.status !== 'closed' && (
        <form action={reply} className="card space-y-2">
          <textarea className="input min-h-24" name="message" required placeholder={`${t.reply}...`} />
          <button className="btn" type="submit">📤 {t.reply}</button>
        </form>
      )}
    </div>
  );
}
