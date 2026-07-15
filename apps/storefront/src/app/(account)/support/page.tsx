import { getTickets, TICKET_STATUS_FA } from '@/lib/account-data';
import { SupportForm } from './support-form';

export const dynamic = 'force-dynamic';

const faDigits = (n: number | string) =>
  String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

export default async function SupportPage() {
  const tickets = await getTickets();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">پشتیبانی</h1>
        <p className="mt-1 text-sm text-slate-400">هر سوال یا مشکلی داری برایمان بنویس.</p>
      </div>

      <SupportForm />

      {tickets.length === 0 ? (
        <div className="card text-center text-slate-400">هنوز گفتگویی با پشتیبانی نداشته‌ای.</div>
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => (
            <div key={t.id} className="card space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-bold text-white">تیکت #{faDigits(t.number)}</span>
                <span className="text-xs text-slate-400">{TICKET_STATUS_FA[t.status]}</span>
              </div>
              <div className="space-y-2">
                {t.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender === 'user' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                        m.sender === 'user'
                          ? 'rounded-tr-sm bg-white/5 text-slate-200'
                          : 'rounded-tl-sm bg-gradient-to-br from-violet-500/25 to-cyan-400/20 text-white'
                      }`}
                    >
                      <div className="mb-0.5 text-[10px] text-slate-400">
                        {m.sender === 'user' ? 'تو' : 'پشتیبانی'}
                      </div>
                      {m.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
