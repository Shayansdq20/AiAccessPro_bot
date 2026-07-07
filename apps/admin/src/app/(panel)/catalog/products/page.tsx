import { apiFetch } from '@/lib/api';
import { apiAction } from '@/lib/actions';
import { getDict } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

interface Category { id: string; title: string }
interface Product {
  id: string;
  title: string;
  description?: string;
  kind: string;
  useDurationTabs: boolean;
  sortOrder: number;
  category: { id: string; title: string };
  _count: { variants: number };
}

const KINDS = ['account', 'config', 'license', 'gift_card', 'custom'];

export default async function ProductsPage() {
  const { t } = await getDict();
  const [products, categories] = await Promise.all([
    apiFetch<Product[]>('/admin/catalog/products'),
    apiFetch<Category[]>('/admin/catalog/categories'),
  ]);

  async function create(formData: FormData) {
    'use server';
    await apiAction({
      path: '/admin/catalog/products',
      body: {
        categoryId: String(formData.get('categoryId') ?? ''),
        title: String(formData.get('title') ?? ''),
        description: String(formData.get('description') ?? '') || undefined,
        kind: String(formData.get('kind') ?? 'account'),
        useDurationTabs: formData.get('useDurationTabs') === 'on',
        sortOrder: Number(formData.get('sortOrder') ?? 0),
      },
      revalidate: '/catalog/products',
    });
  }

  async function update(id: string, formData: FormData) {
    'use server';
    await apiAction({
      path: `/admin/catalog/products/${id}`,
      method: 'PATCH',
      body: {
        categoryId: String(formData.get('categoryId') ?? ''),
        title: String(formData.get('title') ?? ''),
        kind: String(formData.get('kind') ?? 'account'),
        useDurationTabs: formData.get('useDurationTabs') === 'on',
        sortOrder: Number(formData.get('sortOrder') ?? 0),
      },
      revalidate: '/catalog/products',
    });
  }

  async function remove(id: string) {
    'use server';
    await apiAction({ path: `/admin/catalog/products/${id}`, method: 'DELETE', revalidate: '/catalog/products' });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">📦 {t.products}</h1>

      <div className="card">
        <h2 className="mb-3 font-semibold">{t.create}</h2>
        <form action={create} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">{t.category}</label>
            <select className="input" name="categoryId" required>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="grow"><label className="label">{t.title}</label><input className="input" name="title" required /></div>
          <div>
            <label className="label">{t.kind}</label>
            <select className="input" name="kind">{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          </div>
          <div className="w-24"><label className="label">{t.sortOrder}</label><input className="input" name="sortOrder" type="number" defaultValue={0} /></div>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="useDurationTabs" /> {t.durationTabs}</label>
          <button className="btn" type="submit">{t.create}</button>
        </form>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="table-base">
          <thead><tr><th>{t.title}</th><th>{t.category}</th><th>{t.kind}</th><th>{t.plans}</th><th>{t.durationTabs}</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.title}</td>
                <td>{p.category.title}</td>
                <td><span className="badge badge-blue">{p.kind}</span></td>
                <td>{p._count.variants}</td>
                <td>{p.useDurationTabs ? '✅' : '—'}</td>
                <td className="w-40">
                  <details>
                    <summary className="cursor-pointer text-sm text-sky-700">{t.edit} / {t.delete}</summary>
                    <form action={update.bind(null, p.id)} className="mt-2 space-y-2">
                      <select className="input" name="categoryId" defaultValue={p.category.id}>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                      <input className="input" name="title" defaultValue={p.title} required />
                      <select className="input" name="kind" defaultValue={p.kind}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
                      <input className="input" name="sortOrder" type="number" defaultValue={p.sortOrder} />
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="useDurationTabs" defaultChecked={p.useDurationTabs} /> {t.durationTabs}
                      </label>
                      <button className="btn w-full" type="submit">{t.save}</button>
                    </form>
                    <form action={remove.bind(null, p.id)} className="mt-2">
                      <button className="btn btn-danger w-full" type="submit">{t.delete}</button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={6} className="text-slate-400">{t.noData}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
