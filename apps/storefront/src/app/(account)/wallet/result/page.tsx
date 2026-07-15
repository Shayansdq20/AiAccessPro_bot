import Link from 'next/link';
import { formatAmount } from '@premium-hub/shared';

export const dynamic = 'force-dynamic';

export default async function WalletResultPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; amount?: string }>;
}) {
  const { status, amount } = await searchParams;
  const ok = status === 'ok';

  return (
    <div className="mx-auto max-w-md">
      <div className={`card text-center ${ok ? 'border-emerald-400/30 bg-emerald-500/5' : 'border-red-400/30 bg-red-500/5'}`}>
        <div className="text-4xl">{ok ? '✅' : '❌'}</div>
        <h1 className="mt-3 text-xl font-black text-white">
          {ok ? 'پرداخت موفق بود' : 'پرداخت ناموفق'}
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          {ok
            ? `کیف پول تو ${amount ? `به مبلغ ${formatAmount(amount, 'fa')} تومان ` : ''}با موفقیت شارژ شد.`
            : 'اگر مبلغی از حساب تو کسر شده باشد، طی ۷۲ ساعت بازمی‌گردد.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/wallet" className="btn">
            بازگشت به کیف پول
          </Link>
          <Link href="/" className="btn-ghost">
            حساب کاربری
          </Link>
        </div>
      </div>
    </div>
  );
}
