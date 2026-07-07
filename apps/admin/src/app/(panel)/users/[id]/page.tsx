import { apiFetch } from '@/lib/api';
import { apiAction } from '@/lib/actions';
import { getDict } from '@/lib/i18n';
import { dateTime, displayName, money } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface UserDetail {
  id: string;
  telegramId: string;
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
  displayUsername: string;
  language: string;
  status: string;
  createdAt: string;
  wallet?: {
    balance: string;
    ledger: { id: string; type: string; amount: string; balanceAfter: string; reference: string; description?: string; createdAt: string }[];
  };
  orders: { id: string; number: number; status: string; total: string; createdAt: string; items: { productTitle: string; variantTitle: string }[] }[];
  payments: { id: string; number: number; status: string; amount: string; provider: string; createdAt: string }[];
  tickets: { id: string; number: number; status: string; createdAt: string; _count: { messages: number } }[];
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, lang } = await getDict();
  const user = await apiFetch<UserDetail>(`/admin/users/${id}`);

  async function adjust(formData: FormData) {
    'use server';
    await apiAction({
      path: `/admin/users/${id}/wallet-adjust`,
      body: {
        signedAmount: String(formData.get('signedAmount') ?? '0'),
        reason: String(formData.get('reason') ?? ''),
      },
      revalidate: `/users/${id}`,
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">👤 {displayName(user)}</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold">{t.details}</h2>
          <div><span className="text-slate-500">{t.telegramId}: </span><span dir="ltr">{user.telegramId}</span></div>
          <div><span className="text-slate-500">{t.username}: </span><span dir="ltr">{user.telegramUsername ? `@${user.telegramUsername}` : '—'}</span></div>
          <div><span className="text-slate-500">Store: </span><span dir="ltr">{user.displayUsername}</span></div>
          <div><span className="text-slate-500">{t.language}: </span>{user.language}</div>
          <div><span className="text-slate-500">{t.status}: </span><span className={`badge ${user.status === 'active' ? 'badge-green' : 'badge-red'}`}>{user.status}</span></div>
          <div><span className="text-slate-500">{t.createdAt}: </span>{dateTime(user.createdAt, lang)}</div>
          <div className="pt-2 text-lg"><span className="text-slate-500">{t.balance}: </span><b>{money(user.wallet?.balance ?? '0', lang)}</b></div>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-3 font-semibold">{t.adjustWallet}</h2>
          <form action={adjust} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">{t.signedAmount}</label>
              <input className="input" name="signedAmount" required pattern="-?\d+" placeholder="50000 / -50000" dir="ltr" />
            </div>
            <div className="grow">
              <label className="label">{t.reason}</label>
              <input className="input" name="reason" required minLength={2} />
            </div>
            <button className="btn" type="submit">{t.save}</button>
          </form>
          <h2 className="mt-6 mb-3 font-semibold">{t.walletLedger}</h2>
          <div className="max-h-72 overflow-y-auto">
            <table className="table-base">
              <thead><tr><th>{t.type}</th><th>{t.amount}</th><th>{t.balance}</th><th>{t.reason}</th><th>{t.date}</th></tr></thead>
              <tbody>
                {user.wallet?.ledger.map((l) => (
                  <tr key={l.id}>
                    <td><span className="badge badge-gray">{l.type}</span></td>
                    <td className={BigInt(l.amount) < 0n ? 'text-red-600' : 'text-emerald-600'}>{money(l.amount, lang)}</td>
                    <td>{money(l.balanceAfter, lang)}</td>
                    <td className="max-w-52 truncate text-xs text-slate-500" title={l.reference}>{l.description ?? l.reference}</td>
                    <td className="text-xs text-slate-500">{dateTime(l.createdAt, lang)}</td>
                  </tr>
                ))}
                {(user.wallet?.ledger.length ?? 0) === 0 && <tr><td colSpan={5} className="text-slate-400">{t.noData}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">{t.orders}</h2>
          <table className="table-base">
            <thead><tr><th>#</th><th>{t.product}</th><th>{t.total}</th><th>{t.status}</th><th>{t.date}</th></tr></thead>
            <tbody>
              {user.orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.number}</td>
                  <td>{o.items[0] ? `${o.items[0].productTitle} — ${o.items[0].variantTitle}` : '—'}</td>
                  <td>{money(o.total, lang)}</td>
                  <td><span className="badge badge-gray">{o.status}</span></td>
                  <td className="text-xs text-slate-500">{dateTime(o.createdAt, lang)}</td>
                </tr>
              ))}
              {user.orders.length === 0 && <tr><td colSpan={5} className="text-slate-400">{t.noData}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">{t.payments}</h2>
          <table className="table-base">
            <thead><tr><th>#</th><th>{t.amount}</th><th>{t.provider}</th><th>{t.status}</th><th>{t.date}</th></tr></thead>
            <tbody>
              {user.payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.number}</td>
                  <td>{money(p.amount, lang)}</td>
                  <td>{p.provider}</td>
                  <td><span className={`badge ${p.status === 'approved' ? 'badge-green' : p.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>{p.status}</span></td>
                  <td className="text-xs text-slate-500">{dateTime(p.createdAt, lang)}</td>
                </tr>
              ))}
              {user.payments.length === 0 && <tr><td colSpan={5} className="text-slate-400">{t.noData}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
