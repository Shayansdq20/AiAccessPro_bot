import Link from 'next/link';
import { formatAmount } from '@pro-ai-access/shared';
import { getAccount } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const account = await getAccount();
  const { customer, wallet, ordersCount } = account;
  const name = customer.firstName?.trim() || customer.phone || customer.displayUsername;

  const tiles = [
    { title: 'خرید سرویس', desc: 'انتخاب پلن VPN و سرویس‌ها', href: '/shop' },
    { title: 'شارژ کیف پول', desc: 'افزایش موجودی حساب', href: '/wallet' },
    { title: 'سفارش‌های من', desc: 'کانفیگ‌ها و تاریخچه', href: '/orders' },
    { title: 'دعوت دوستان', desc: 'کد دعوت و جایزه‌ها', href: '/referral' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white">سلام، {name} 👋</h1>
        <p className="mt-1 text-sm text-slate-400">به حساب کاربری Pro Ai Access خوش آمدی.</p>
      </div>

      {/* آمار حساب */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-sm text-slate-400">موجودی کیف پول</div>
          <div className="mt-2 text-2xl font-black text-white">
            {formatAmount(wallet.balance, 'fa')}
            <span className="mr-1 text-sm font-normal text-slate-400">تومان</span>
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-400">سفارش‌ها</div>
          <div className="mt-2 text-2xl font-black text-white">{ordersCount}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-400">کد دعوت تو</div>
          <div className="mt-2 font-mono text-xl font-black text-gradient" dir="ltr">
            {customer.referralCode ?? '—'}
          </div>
        </div>
      </div>

      {/* دسترسی سریع */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-white">دسترسی سریع</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {tiles.map((tile) => (
            <Link
              key={tile.title}
              href={tile.href}
              className="card flex items-center justify-between transition-colors hover:border-white/20"
            >
              <div>
                <div className="font-bold text-white">{tile.title}</div>
                <div className="mt-1 text-sm text-slate-400">{tile.desc}</div>
              </div>
              <span className="text-cyan-400">←</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="text-base font-bold text-white">مشخصات حساب</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-400">شماره موبایل</dt>
            <dd className="font-mono text-white" dir="ltr">{customer.phone ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">نام کاربری</dt>
            <dd className="text-white">{customer.displayUsername}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
