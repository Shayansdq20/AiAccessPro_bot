import { apiFetch } from '@/lib/api';
import { apiAction } from '@/lib/actions';
import { getDict } from '@/lib/i18n';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Product { id: string; title: string; category: { title: string } }
interface Variant {
  id: string;
  title: string;
  price: string;
  fulfillmentMode: string;
  optionGroup?: string;
  sortOrder: number;
  provisioner?: string | null;
  provisionerConfig?: { inboundId: number; gb: number } | null;
  product: { id: string; title: string; category: { title: string } };
  _count: { orderItems: number };
  inventory: Record<string, number>;
}

interface XuiInbounds {
  configured: boolean;
  error?: string;
  inbounds: { id: number; remark: string; protocol: string; port: number; enable?: boolean }[];
}

const MODES = ['auto_inventory', 'manual_admin', 'hybrid_prefer_inventory'];

export default async function VariantsPage() {
  const { t, lang } = await getDict();
  const [variants, products, xui] = await Promise.all([
    apiFetch<Variant[]>('/admin/catalog/variants'),
    apiFetch<Product[]>('/admin/catalog/products'),
    apiFetch<XuiInbounds>('/admin/xui/inbounds'),
  ]);

  async function create(formData: FormData) {
    'use server';
    const provisioner = String(formData.get('provisioner') ?? '');
    await apiAction({
      path: '/admin/catalog/variants',
      body: {
        productId: String(formData.get('productId') ?? ''),
        title: String(formData.get('title') ?? ''),
        price: String(formData.get('price') ?? '0'),
        fulfillmentMode: String(formData.get('fulfillmentMode') ?? 'hybrid_prefer_inventory'),
        optionGroup: String(formData.get('optionGroup') ?? '') || undefined,
        sortOrder: Number(formData.get('sortOrder') ?? 0),
        provisioner,
        provisionerInboundId: Number(formData.get('provisionerInboundId') || 0) || undefined,
        provisionerGb: Number(formData.get('provisionerGb') || 0) || undefined,
      },
      revalidate: '/catalog/variants',
    });
  }

  async function update(id: string, formData: FormData) {
    'use server';
    const provisioner = String(formData.get('provisioner') ?? '');
    await apiAction({
      path: `/admin/catalog/variants/${id}`,
      method: 'PATCH',
      body: {
        title: String(formData.get('title') ?? ''),
        price: String(formData.get('price') ?? '0'),
        fulfillmentMode: String(formData.get('fulfillmentMode') ?? 'hybrid_prefer_inventory'),
        optionGroup: String(formData.get('optionGroup') ?? ''),
        sortOrder: Number(formData.get('sortOrder') ?? 0),
        provisioner,
        provisionerInboundId: Number(formData.get('provisionerInboundId') || 0) || undefined,
        provisionerGb: Number(formData.get('provisionerGb') || 0) || undefined,
      },
      revalidate: '/catalog/variants',
    });
  }

  async function remove(id: string) {
    'use server';
    await apiAction({ path: `/admin/catalog/variants/${id}`, method: 'DELETE', revalidate: '/catalog/variants' });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">🧾 {t.plans}</h1>

      <div className="card">
        <h2 className="mb-3 font-semibold">{t.create}</h2>
        <form action={create} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">{t.product}</label>
            <select className="input" name="productId" required>
              {products.map((p) => <option key={p.id} value={p.id}>{p.category.title} / {p.title}</option>)}
            </select>
          </div>
          <div className="grow"><label className="label">{t.title}</label><input className="input" name="title" required /></div>
          <div><label className="label">{t.price}</label><input className="input" name="price" required pattern="\d+" dir="ltr" placeholder="150000" /></div>
          <div>
            <label className="label">{t.fulfillment}</label>
            <select className="input" name="fulfillmentMode">{MODES.map((m) => <option key={m}>{m}</option>)}</select>
          </div>
          <div><label className="label">{t.optionGroup}</label><input className="input" name="optionGroup" placeholder="۱ ماه" /></div>
          <div className="w-24"><label className="label">{t.sortOrder}</label><input className="input" name="sortOrder" type="number" defaultValue={0} /></div>
          {xui.configured && (
            <>
              <div>
                <label className="label">{t.xuiProvision}</label>
                <select className="input" name="provisioner" defaultValue="">
                  <option value="">{t.none}</option>
                  <option value="xui">x-ui</option>
                </select>
              </div>
              <div>
                <label className="label">{t.xuiInbound}</label>
                <select className="input" name="provisionerInboundId">
                  {xui.inbounds.map((i) => (
                    <option key={i.id} value={i.id}>#{i.id} {i.remark} ({i.protocol}:{i.port})</option>
                  ))}
                </select>
              </div>
              <div className="w-28">
                <label className="label">{t.xuiGb}</label>
                <input className="input" name="provisionerGb" type="number" min={1} dir="ltr" placeholder="30" />
              </div>
            </>
          )}
          <button className="btn" type="submit">{t.create}</button>
        </form>
        {xui.configured && xui.error && (
          <p className="mt-2 text-sm text-red-600">x-ui: {xui.error}</p>
        )}
        {!xui.configured && (
          <p className="mt-2 text-xs text-slate-400">{t.xuiNotConfigured}</p>
        )}
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>{t.title}</th><th>{t.product}</th><th>{t.price}</th><th>{t.fulfillment}</th>
              <th>{t.optionGroup}</th><th>{t.inventory}</th><th>{t.ordersCount}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.id}>
                <td className="font-medium">{v.title}</td>
                <td>{v.product.category.title} / {v.product.title}</td>
                <td>{money(v.price, lang)}</td>
                <td><span className="badge badge-blue">{v.fulfillmentMode}</span></td>
                <td>{v.optionGroup ?? '—'}</td>
                <td className="text-xs">
                  {v.provisioner === 'xui' && (
                    <span className="badge badge-blue">
                      🛡 x-ui #{v.provisionerConfig?.inboundId} · {v.provisionerConfig?.gb}GB
                    </span>
                  )}{' '}
                  <span className="badge badge-green">{v.inventory.available ?? 0} {t.available}</span>{' '}
                  {v.inventory.delivered ? <span className="badge badge-gray">{v.inventory.delivered} {t.delivered}</span> : null}{' '}
                  {v.inventory.retired ? <span className="badge badge-gray">{v.inventory.retired} {t.retired}</span> : null}
                </td>
                <td>{v._count.orderItems}</td>
                <td className="w-40">
                  <details>
                    <summary className="cursor-pointer text-sm text-sky-700">{t.edit} / {t.delete}</summary>
                    <form action={update.bind(null, v.id)} className="mt-2 space-y-2">
                      <input className="input" name="title" defaultValue={v.title} required />
                      <input className="input" name="price" defaultValue={v.price} pattern="\d+" dir="ltr" />
                      <select className="input" name="fulfillmentMode" defaultValue={v.fulfillmentMode}>
                        {MODES.map((m) => <option key={m}>{m}</option>)}
                      </select>
                      <input className="input" name="optionGroup" defaultValue={v.optionGroup ?? ''} placeholder={t.optionGroup} />
                      <input className="input" name="sortOrder" type="number" defaultValue={v.sortOrder} />
                      {xui.configured && (
                        <>
                          <label className="label">{t.xuiProvision}</label>
                          <select className="input" name="provisioner" defaultValue={v.provisioner ?? ''}>
                            <option value="">{t.none}</option>
                            <option value="xui">x-ui</option>
                          </select>
                          <select className="input" name="provisionerInboundId" defaultValue={v.provisionerConfig?.inboundId ?? ''}>
                            {xui.inbounds.map((i) => (
                              <option key={i.id} value={i.id}>#{i.id} {i.remark} ({i.protocol}:{i.port})</option>
                            ))}
                          </select>
                          <input className="input" name="provisionerGb" type="number" min={1} dir="ltr" defaultValue={v.provisionerConfig?.gb ?? ''} placeholder={t.xuiGb} />
                        </>
                      )}
                      <button className="btn w-full" type="submit">{t.save}</button>
                    </form>
                    <form action={remove.bind(null, v.id)} className="mt-2">
                      <button className="btn btn-danger w-full" type="submit">{t.delete}</button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
            {variants.length === 0 && <tr><td colSpan={8} className="text-slate-400">{t.noData}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
