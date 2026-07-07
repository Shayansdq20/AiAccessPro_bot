import { apiFetch } from '@/lib/api';
import { apiAction } from '@/lib/actions';
import { getDict } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

interface Category {
  id: string;
  title: string;
  description?: string;
  emoji?: string;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
}

export default async function CategoriesPage() {
  const { t } = await getDict();
  const categories = await apiFetch<Category[]>('/admin/catalog/categories');

  async function create(formData: FormData) {
    'use server';
    await apiAction({
      path: '/admin/catalog/categories',
      body: {
        title: String(formData.get('title') ?? ''),
        emoji: String(formData.get('emoji') ?? '') || undefined,
        description: String(formData.get('description') ?? '') || undefined,
        sortOrder: Number(formData.get('sortOrder') ?? 0),
      },
      revalidate: '/catalog/categories',
    });
  }

  async function update(id: string, formData: FormData) {
    'use server';
    await apiAction({
      path: `/admin/catalog/categories/${id}`,
      method: 'PATCH',
      body: {
        title: String(formData.get('title') ?? ''),
        emoji: String(formData.get('emoji') ?? ''),
        description: String(formData.get('description') ?? ''),
        sortOrder: Number(formData.get('sortOrder') ?? 0),
      },
      revalidate: '/catalog/categories',
    });
  }

  async function remove(id: string) {
    'use server';
    await apiAction({ path: `/admin/catalog/categories/${id}`, method: 'DELETE', revalidate: '/catalog/categories' });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">🗂 {t.categories}</h1>

      <div className="card">
        <h2 className="mb-3 font-semibold">{t.create}</h2>
        <form action={create} className="flex flex-wrap items-end gap-3">
          <div><label className="label">{t.title}</label><input className="input" name="title" required /></div>
          <div className="w-24"><label className="label">{t.emoji}</label><input className="input" name="emoji" placeholder="🛡" /></div>
          <div className="grow"><label className="label">{t.description}</label><input className="input" name="description" /></div>
          <div className="w-24"><label className="label">{t.sortOrder}</label><input className="input" name="sortOrder" type="number" defaultValue={0} /></div>
          <button className="btn" type="submit">{t.create}</button>
        </form>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="table-base">
          <thead><tr><th>{t.title}</th><th>{t.products}</th><th>{t.sortOrder}</th><th></th></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.emoji ? `${c.emoji} ` : ''}{c.title}</td>
                <td>{c._count.products}</td>
                <td>{c.sortOrder}</td>
                <td className="w-40">
                  <details>
                    <summary className="cursor-pointer text-sm text-sky-700">{t.edit} / {t.delete}</summary>
                    <form action={update.bind(null, c.id)} className="mt-2 space-y-2">
                      <input className="input" name="title" defaultValue={c.title} required />
                      <input className="input" name="emoji" defaultValue={c.emoji ?? ''} placeholder={t.emoji} />
                      <input className="input" name="description" defaultValue={c.description ?? ''} placeholder={t.description} />
                      <input className="input" name="sortOrder" type="number" defaultValue={c.sortOrder} />
                      <button className="btn w-full" type="submit">{t.save}</button>
                    </form>
                    <form action={remove.bind(null, c.id)} className="mt-2">
                      <button className="btn btn-danger w-full" type="submit">{t.delete}</button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
            {categories.length === 0 && <tr><td colSpan={4} className="text-slate-400">{t.noData}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
