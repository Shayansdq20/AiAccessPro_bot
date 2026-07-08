import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getDict } from '@/lib/i18n';
import { logoutAction, switchLangAction } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { t, lang } = await getDict();
  // Redirects to /login when the session is missing or expired.
  const admin = await apiFetch<{ name: string; role: string }>('/admin/auth/me');

  const nav = [
    { href: '/', label: `📊 ${t.dashboard}` },
    { href: '/operations', label: `⚡ ${t.operations}` },
    { href: '/orders', label: `🛒 ${t.orders}` },
    { href: '/payments', label: `💳 ${t.payments}` },
    { href: '/users', label: `👥 ${t.users}` },
    { href: '/catalog/categories', label: `🗂 ${t.categories}` },
    { href: '/catalog/products', label: `📦 ${t.products}` },
    { href: '/catalog/variants', label: `🧾 ${t.plans}` },
    { href: '/catalog/inventory', label: `🔐 ${t.inventory}` },
    { href: '/discounts', label: `🎁 ${t.discounts}` },
    { href: '/support', label: `💬 ${t.support}` },
    { href: '/bot-texts', label: `📝 ${t.botTexts}` },
    { href: '/payment-settings', label: `⚙️ ${t.paymentSettings}` },
    { href: '/audit', label: `🕵️ ${t.audit}` },
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile header with hamburger menu (no JS needed) */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white md:hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between p-4 [&::-webkit-details-marker]:hidden">
            <span className="text-lg font-bold">💎 Premium Hub</span>
            <span className="rounded-lg border border-slate-300 px-3 py-1 text-sm">☰</span>
          </summary>
          <nav className="max-h-[70vh] space-y-0.5 overflow-y-auto border-t border-slate-100 p-3">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                {item.label}
              </Link>
            ))}
            <div className="flex gap-2 pt-2">
              <form action={switchLangAction} className="grow">
                <button className="btn btn-secondary w-full" type="submit">
                  🌐 {lang === 'fa' ? 'English' : 'فارسی'}
                </button>
              </form>
              <form action={logoutAction} className="grow">
                <button className="btn btn-danger w-full" type="submit">
                  {t.logout}
                </button>
              </form>
            </div>
          </nav>
        </details>
      </header>

      <aside className="hidden w-60 shrink-0 flex-col border-e border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-200 p-4">
          <div className="text-lg font-bold">💎 Premium Hub</div>
          <div className="mt-1 text-xs text-slate-500">
            {admin.name} · {admin.role}
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 border-t border-slate-200 p-3">
          <form action={switchLangAction}>
            <button className="btn btn-secondary w-full" type="submit">
              🌐 {lang === 'fa' ? 'English' : 'فارسی'}
            </button>
          </form>
          <form action={logoutAction}>
            <button className="btn btn-danger w-full" type="submit">
              {t.logout}
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
