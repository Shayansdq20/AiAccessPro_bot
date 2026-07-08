import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { apiAction } from '@/lib/actions';
import { getDict } from '@/lib/i18n';
import { displayName, money } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Program {
  id: string;
  name: string;
  requiredReferrals: number;
  minReferralSpend: string;
  rewardAmount: string;
  repeatable: boolean;
  isActive: boolean;
  _count: { rewards: number };
}

interface LeaderRow {
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
    telegramUsername?: string;
    displayUsername: string;
    telegramId: string;
  } | null;
  invited: number;
  earned: string;
}

export default async function ReferralPage() {
  const { t, lang } = await getDict();
  const [programs, leaderboard] = await Promise.all([
    apiFetch<Program[]>('/admin/referral/programs'),
    apiFetch<LeaderRow[]>('/admin/referral/leaderboard'),
  ]);

  async function create(formData: FormData) {
    'use server';
    await apiAction({
      path: '/admin/referral/programs',
      body: {
        name: String(formData.get('name') ?? ''),
        requiredReferrals: Number(formData.get('requiredReferrals') ?? 3),
        minReferralSpend: String(formData.get('minReferralSpend') || '0'),
        rewardAmount: String(formData.get('rewardAmount') ?? '0'),
        repeatable: formData.get('repeatable') === 'on',
      },
      revalidate: '/referral',
    });
  }

  async function toggle(id: string, isActive: boolean) {
    'use server';
    await apiAction({ path: `/admin/referral/programs/${id}`, method: 'PATCH', body: { isActive: !isActive }, revalidate: '/referral' });
  }

  async function remove(id: string) {
    'use server';
    await apiAction({ path: `/admin/referral/programs/${id}`, method: 'DELETE', revalidate: '/referral' });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">👥 {t.referral}</h1>

      <div className="card">
        <h2 className="mb-3 font-semibold">{t.create}</h2>
        <form action={create} className="flex flex-wrap items-end gap-3">
          <div className="grow">
            <label className="label">{t.name}</label>
            <input className="input" name="name" required placeholder={t.referralNamePlaceholder} />
          </div>
          <div className="w-32">
            <label className="label">{t.referralRequired}</label>
            <input className="input" name="requiredReferrals" type="number" min={1} defaultValue={3} dir="ltr" />
          </div>
          <div>
            <label className="label">{t.referralMinSpend}</label>
            <input className="input" name="minReferralSpend" pattern="\d*" dir="ltr" placeholder="0" />
          </div>
          <div>
            <label className="label">{t.referralReward}</label>
            <input className="input" name="rewardAmount" required pattern="\d+" dir="ltr" placeholder="200000" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="repeatable" defaultChecked /> {t.referralRepeatable}
          </label>
          <button className="btn" type="submit">{t.create}</button>
        </form>
        <p className="mt-2 text-xs text-slate-400">{t.referralHint}</p>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>{t.name}</th><th>{t.referralRequired}</th><th>{t.referralMinSpend}</th>
              <th>{t.referralReward}</th><th>{t.referralRepeatable}</th><th>{t.referralPaid}</th><th>{t.status}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {programs.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td>{p.requiredReferrals}</td>
                <td>{BigInt(p.minReferralSpend) > 0n ? money(p.minReferralSpend, lang) : t.referralAnyPurchase}</td>
                <td>{money(p.rewardAmount, lang)}</td>
                <td>{p.repeatable ? '🔁' : '1×'}</td>
                <td>{p._count.rewards}</td>
                <td><span className={`badge ${p.isActive ? 'badge-green' : 'badge-gray'}`}>{p.isActive ? t.active : t.inactive}</span></td>
                <td className="flex gap-2">
                  <form action={toggle.bind(null, p.id, p.isActive)}>
                    <button className="btn btn-secondary" type="submit">{p.isActive ? t.inactive : t.active}</button>
                  </form>
                  <form action={remove.bind(null, p.id)}>
                    <button className="btn btn-danger" type="submit">{t.delete}</button>
                  </form>
                </td>
              </tr>
            ))}
            {programs.length === 0 && <tr><td colSpan={8} className="text-slate-400">{t.noData}</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">🏆 {t.referralLeaderboard}</h2>
        <table className="table-base">
          <thead><tr><th>{t.user}</th><th>{t.referralInvited}</th><th>{t.referralEarned}</th></tr></thead>
          <tbody>
            {leaderboard.map((row, i) => (
              <tr key={i}>
                <td>
                  {row.user ? (
                    <Link className="text-sky-700 hover:underline" href={`/users/${row.user.id}`}>{displayName(row.user)}</Link>
                  ) : '—'}
                </td>
                <td>{row.invited}</td>
                <td>{money(row.earned, lang)}</td>
              </tr>
            ))}
            {leaderboard.length === 0 && <tr><td colSpan={3} className="text-slate-400">{t.noData}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
