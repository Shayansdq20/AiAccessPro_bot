import { formatAmount } from '@premium-hub/shared';
import { getReferral } from '@/lib/account-data';
import { CopyInline } from '@/components/copyable';

export const dynamic = 'force-dynamic';

const faDigits = (n: number | string) =>
  String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

export default async function ReferralPage() {
  const r = await getReferral();

  const stats = [
    { label: 'دعوت‌شده‌ها', value: faDigits(r.invitedCount) },
    { label: 'خرید موفق', value: faDigits(r.qualifiedCount) },
    { label: 'جایزه‌ی دریافتی', value: `${formatAmount(r.earnedTotal, 'fa')} تومان` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">دعوت دوستان</h1>
        <p className="mt-1 text-sm text-slate-400">
          دوستانت را دعوت کن و برای هر خرید موفق آن‌ها جایزه بگیر.
        </p>
      </div>

      <div className="card space-y-3">
        <div className="text-sm font-semibold text-slate-300">لینک دعوت اختصاصی تو</div>
        <CopyInline value={r.link} mono />
        <p className="text-xs text-slate-500">
          کد دعوت: <span className="font-mono text-slate-300">{r.code}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="text-sm text-slate-400">{s.label}</div>
            <div className="mt-2 text-xl font-black text-white">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card text-sm text-slate-300">
        {r.program
          ? 'برنامه‌ی جایزه فعال است؛ با دعوت دوستان و خرید آن‌ها، اعتبار به کیف پولت اضافه می‌شود.'
          : 'در حال حاضر برنامه‌ی جایزه‌ی فعالی وجود ندارد، اما لینک دعوت تو همیشه فعال است.'}
      </div>
    </div>
  );
}
