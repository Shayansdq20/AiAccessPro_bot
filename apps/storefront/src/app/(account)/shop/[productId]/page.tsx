import Link from 'next/link';
import { getProduct } from '@/lib/shop';
import { BuyPanel } from './buy-panel';

export const dynamic = 'force-dynamic';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const data = await getProduct(productId);

  return (
    <div className="space-y-6">
      <Link href="/shop" className="text-sm text-slate-400 hover:text-white">
        ← بازگشت به فروشگاه
      </Link>

      <div>
        <h1 className="text-2xl font-black text-white">{data.product.title}</h1>
        {data.product.description && (
          <p className="mt-2 leading-7 text-slate-400">{data.product.description}</p>
        )}
      </div>

      <BuyPanel data={data} />
    </div>
  );
}
