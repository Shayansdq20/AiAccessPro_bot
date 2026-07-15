import { formatAmount } from '@premium-hub/shared';
import { getAccount } from '@/lib/api';
import { getTopupOptions, getPayments, PAYMENT_STATUS_FA } from '@/lib/topup';
import { getLedger } from '@/lib/account-data';
import { TopupPanel } from './topup-panel';

export const dynamic = 'force-dynamic';

const faDigits = (n: number | string) =>
  String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

export default async function WalletPage() {
  const [account, options, payments, ledger] = await Promise.all([
    getAccount(),
    getTopupOptions(),
    getPayments(),
    getLedger(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white">کیف پول</h1>
        <p className="mt-1 text-sm text-slate-400">موجودی‌ات را شارژ کن تا سریع خرید کنی.</p>
      </div>

      <div className="card">
        <div className="text-sm text-slate-400">موجودی فعلی</div>
        <div className="mt-1 text-3xl font-black text-gradient">
          {formatAmount(account.wallet.balance, 'fa')}
          <span className="mr-2 text-sm font-normal text-slate-400">تومان</span>
        </div>
      </div>

      <TopupPanel options={options} />

      <div>
        <h2 className="mb-3 text-lg font-bold text-white">تراکنش‌های اخیر</h2>
        {payments.length === 0 ? (
          <div className="card text-sm text-slate-400">هنوز تراکنشی نداری.</div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => {
              const s = PAYMENT_STATUS_FA[p.status];
              return (
                <div key={p.id} className="card flex items-center justify-between py-4">
                  <div>
                    <div className="font-semibold text-white">
                      شارژ کیف پول — {formatAmount(p.amount, 'fa')} تومان
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      #{faDigits(p.number)} · {p.type === 'gateway' ? 'درگاه آنلاین' : 'کارت به کارت'}
                    </div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs ${s.tone}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold text-white">گردش حساب</h2>
        {ledger.length === 0 ? (
          <div className="card text-sm text-slate-400">هنوز گردشی در کیف پول نداری.</div>
        ) : (
          <div className="card divide-y divide-white/5">
            {ledger.map((e) => {
              const positive = !e.amount.startsWith('-');
              return (
                <div key={e.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-slate-200">{e.description ?? '—'}</div>
                    <div className="text-xs text-slate-500">
                      موجودی: {formatAmount(e.balanceAfter, 'fa')} تومان
                    </div>
                  </div>
                  <div className={`shrink-0 font-bold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {positive ? '+' : '−'}
                    {formatAmount(e.amount.replace('-', ''), 'fa')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
