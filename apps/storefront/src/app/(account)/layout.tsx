import Link from 'next/link';
import { logoutAction } from '@/lib/actions';

const nav = [
  { href: '/', label: 'داشبورد' },
  { href: '/shop', label: 'فروشگاه' },
  { href: '/wallet', label: 'کیف پول' },
  { href: '/orders', label: 'سفارش‌ها' },
  { href: '/referral', label: 'دعوت دوستان' },
  { href: '/support', label: 'پشتیبانی' },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-lg font-black text-white">
              P
            </span>
            <span className="font-extrabold text-white">پریمیوم هاب</span>
          </Link>
          <form action={logoutAction}>
            <button className="btn-ghost text-sm" type="submit">
              خروج
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3 pb-2 text-sm">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-8">{children}</main>
    </div>
  );
}
