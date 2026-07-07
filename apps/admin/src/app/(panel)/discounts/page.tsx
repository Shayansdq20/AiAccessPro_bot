import { apiFetch } from '@/lib/api';
import { apiAction } from '@/lib/actions';
import { getDict } from '@/lib/i18n';
import { dateTime, money } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Discount {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: string;
  maxUses?: number | null;
  maxUsesPerUser?: number | null;
  minOrderTotal?: string | null;
  expiresAt?: string | null;
  isActive: boolean;
  _count: { redemptions: number };
}

export default async function DiscountsPage() {
  const { t, lang } = await getDict();
  const discounts = await apiFetch<Discount[]>('/admin/discounts');

  async function create(formData: FormData) {
    'use server';
    const expiresRaw = String(formData.get('expiresAt') ?? '');
    await apiAction({
      path: '/admin/discounts',
      body: {
        code: String(formData.get('code') ?? ''),
        type: String(formData.get('type') ?? 'percent'),
        value: String(formData.get('value') ?? '0'),
        maxUses: formData.get('maxUses') ? Number(formData.get('maxUses')) : null,
        maxUsesPerUser: formData.get('maxUsesPerUser') ? Number(formData.get('maxUsesPerUser')) : null,
        minOrderTotal: String(formData.get('minOrderTotal') ?? '') || null,
        expiresAt: expiresRaw ? new Date(expiresRaw).toISOString() : null,
      },
      revalidate: '/discounts',
    });
  }

  async function toggle(id: string, isActive: boolean) {
    'use server';
    await apiAction({ path: `/admin/discounts/${id}`, method: 'PATCH', body: { isActive: !isActive }, revalidate: '/discounts' });
  }

  async function remove(id: string) {
    'use server';
    await apiAction({ path: `/admin/discounts/${id}`, method: 'DELETE', revalidate: '/discounts' });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">🎁 {t.discounts}</h1>

      <div className="card">
        <h2 className="mb-3 font-semibold">{t.create}</h2>
        <form action={create} className="flex flex-wrap items-end gap-3">
          <div><label className="label">{t.code}</label><input className="input" name="code" required dir="ltr" placeholder="SAVE10" /></div>
          <div>
            <label className="label">{t.type}</label>
            <select className="input" name="type">
              <option value="percent">{t.percent}</option>
              <option value="fixed">{t.fixed}</option>
            </select>
          </div>
          <div><label className="label">{t.value}</label><input className="input" name="value" required pattern="\d+" dir="ltr" placeholder="10" /></div>
          <div className="w-28"><label className="label">{t.maxUses}</label><input className="input" name="maxUses" type="number" min={1} /></div>
          <div className="w-28"><label className="label">{t.maxUsesPerUser}</label><input className="input" name="maxUsesPerUser" type="number" min={1} /></div>
          <div><label className="label">{t.minOrderTotal}</label><input className="input" name="minOrderTotal" pattern="\d*" dir="ltr" /></div>
          <div><label className="label">{t.expiresAt}</label><input className="input" name="expiresAt" type="datetime-local" /></div>
          <button className="btn" type="submit">{t.create}</button>
        </form>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="table-base">
          <thead>
            <tr><th>{t.code}</th><th>{t.type}</th><th>{t.value}</th><th>{t.uses}</th><th>{t.expiresAt}</th><th>{t.status}</th><th></th></tr>
          </thead>
          <tbody>
            {discounts.map((d) => (
              <tr key={d.id}>
                <td className="font-mono font-medium" dir="ltr">{d.code}</td>
                <td>{d.type === 'percent' ? t.percent : t.fixed}</td>
                <td>{d.type === 'percent' ? `${d.value}%` : money(d.value, lang)}</td>
                <td>
                  {d._count.redemptions}
                  {d.maxUses ? ` / ${d.maxUses}` : ''}
                </td>
                <td className="text-xs text-slate-500">{d.expiresAt ? dateTime(d.expiresAt, lang) : '—'}</td>
                <td><span className={`badge ${d.isActive ? 'badge-green' : 'badge-gray'}`}>{d.isActive ? t.active : t.inactive}</span></td>
                <td className="flex gap-2">
                  <form action={toggle.bind(null, d.id, d.isActive)}>
                    <button className="btn btn-secondary" type="submit">{d.isActive ? t.inactive : t.active}</button>
                  </form>
                  <form action={remove.bind(null, d.id)}>
                    <button className="btn btn-danger" type="submit">{t.delete}</button>
                  </form>
                </td>
              </tr>
            ))}
            {discounts.length === 0 && <tr><td colSpan={7} className="text-slate-400">{t.noData}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
