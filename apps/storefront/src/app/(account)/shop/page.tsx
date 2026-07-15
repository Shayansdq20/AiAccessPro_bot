import Link from 'next/link';
import { getCategories, getCategoryProducts } from '@/lib/shop';

export const dynamic = 'force-dynamic';

export default async function ShopPage() {
  const categories = await getCategories();
  const withProducts = await Promise.all(
    categories.map(async (c) => ({ category: c, products: await getCategoryProducts(c.id) })),
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-black text-white">فروشگاه</h1>
        <p className="mt-1 text-sm text-slate-400">سرویس دلخواهت را انتخاب کن.</p>
      </div>

      {withProducts.length === 0 && (
        <div className="card text-center text-slate-400">فعلاً سرویسی برای فروش موجود نیست.</div>
      )}

      {withProducts.map(({ category, products }) => (
        <section key={category.id} className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white">{category.title}</h2>
            {category.description && (
              <p className="mt-1 text-sm text-slate-400">{category.description}</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/shop/${p.id}`}
                className="card group transition-colors hover:border-white/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-white">{p.title}</h3>
                  <span className="text-cyan-400 transition-transform group-hover:-translate-x-1">
                    ←
                  </span>
                </div>
                {p.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-400">{p.description}</p>
                )}
                <span className="mt-4 inline-block text-sm font-semibold text-gradient">
                  مشاهده و خرید
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
