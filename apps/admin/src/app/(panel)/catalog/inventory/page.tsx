import { apiFetch } from '@/lib/api';
import { apiAction } from '@/lib/actions';
import { getDict } from '@/lib/i18n';
import { dateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Variant { id: string; title: string; product: { title: string; category: { title: string } } }
interface Item {
  id: string;
  label: string;
  status: string;
  reservedOrderId?: string;
  deliveredAt?: string;
  createdAt: string;
  variant: { id: string; title: string; product: { id: string; title: string; category: { id: string; title: string } } };
}

export default async function InventoryPage() {
  const { t, lang } = await getDict();
  const [items, variants] = await Promise.all([
    apiFetch<Item[]>('/admin/inventory'),
    apiFetch<Variant[]>('/admin/catalog/variants'),
  ]);

  async function create(formData: FormData) {
    'use server';
    await apiAction({
      path: '/admin/inventory',
      body: {
        variantId: String(formData.get('variantId') ?? ''),
        label: String(formData.get('label') ?? ''),
        payload: String(formData.get('payload') ?? ''),
      },
      revalidate: '/catalog/inventory',
    });
  }

  async function remove(id: string) {
    'use server';
    await apiAction({ path: `/admin/inventory/${id}`, method: 'DELETE', revalidate: '/catalog/inventory' });
  }

  const badge = (status: string) =>
    status === 'available' ? 'badge-green' : status === 'delivered' ? 'badge-blue' : status === 'reserved' ? 'badge-yellow' : 'badge-gray';

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">🔐 {t.inventory}</h1>

      <div className="card">
        <h2 className="mb-3 font-semibold">{t.create}</h2>
        <form action={create} className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">{t.plan}</label>
              <select className="input" name="variantId" required>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.product.category.title} / {v.product.title} / {v.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grow"><label className="label">{t.label}</label><input className="input" name="label" required placeholder="Spotify #12" /></div>
          </div>
          <div>
            <label className="label">{t.payload}</label>
            <textarea className="input min-h-24 font-mono" name="payload" required placeholder={'Email: ...\nPassword: ...'} dir="ltr" />
          </div>
          <button className="btn" type="submit">{t.create}</button>
        </form>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="table-base">
          <thead>
            <tr><th>{t.label}</th><th>{t.category}</th><th>{t.product}</th><th>{t.plan}</th><th>{t.status}</th><th>{t.createdAt}</th><th>{t.delivered}</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td className="font-medium">{i.label}</td>
                <td>{i.variant.product.category.title}</td>
                <td>{i.variant.product.title}</td>
                <td>{i.variant.title}</td>
                <td><span className={`badge ${badge(i.status)}`}>{i.status}</span></td>
                <td className="text-xs text-slate-500">{dateTime(i.createdAt, lang)}</td>
                <td className="text-xs text-slate-500">{i.deliveredAt ? dateTime(i.deliveredAt, lang) : '—'}</td>
                <td>
                  {i.status !== 'retired' && (
                    <form action={remove.bind(null, i.id)}>
                      <button className="btn btn-danger" type="submit">
                        {i.status === 'available' ? t.delete : t.retired}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="text-slate-400">{t.noData}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
