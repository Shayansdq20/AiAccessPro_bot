'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatAmount } from '@pro-ai-access/shared';
import {
  createManualTopupAction,
  createGatewayTopupAction,
  uploadReceiptAction,
} from '@/lib/topup-actions';
import type { TopupOptions } from '@/lib/topup-types';

const faDigits = (n: number | string) =>
  String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

export function TopupPanel({ options }: { options: TopupOptions }) {
  const router = useRouter();
  const minAmount = Number(options.minAmount);

  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [step, setStep] = useState<'select' | 'card' | 'submitted'>('select');
  const [payment, setPayment] = useState<{ paymentId: string; number: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const amountValid = amount != null && amount >= minAmount;

  const pickCustom = (v: string) => {
    setCustom(v);
    const n = Number(v.replace(/\D/g, ''));
    setAmount(n > 0 ? n : null);
  };

  const startCard = () => {
    if (!amountValid) return;
    setError(null);
    start(async () => {
      const r = await createManualTopupAction(amount!);
      if (!r.ok) return setError(r.message);
      setPayment({ paymentId: r.paymentId, number: r.number });
      setStep('card');
    });
  };

  const startGateway = () => {
    if (!amountValid) return;
    setError(null);
    start(async () => {
      const r = await createGatewayTopupAction(amount!);
      if (!r.ok) return setError(r.message);
      window.location.href = r.payUrl;
    });
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !payment) return;
    if (file.size > 5 * 1024 * 1024) return setError('حجم تصویر زیاد است (حداکثر ۵ مگابایت)');
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(',')[1] ?? '';
      const mime = file.type || 'image/jpeg';
      setError(null);
      start(async () => {
        const r = await uploadReceiptAction(payment.paymentId, base64, mime);
        if (!r.ok) return setError(r.message);
        setStep('submitted');
        router.refresh();
      });
    };
    reader.readAsDataURL(file);
  };

  if (step === 'submitted') {
    return (
      <div className="card border-emerald-400/30 bg-emerald-500/5 text-center">
        <div className="text-3xl">🧾</div>
        <h3 className="mt-2 text-lg font-black text-white">رسید ثبت شد</h3>
        <p className="mt-1 text-sm text-slate-300">
          پس از تایید توسط پشتیبانی، مبلغ به کیف پولت اضافه می‌شود.
        </p>
        <button
          type="button"
          className="btn-ghost mt-4"
          onClick={() => {
            setStep('select');
            setAmount(null);
            setCustom('');
            setPayment(null);
          }}
        >
          شارژ دوباره
        </button>
      </div>
    );
  }

  if (step === 'card') {
    return (
      <div className="card space-y-4">
        <h3 className="font-bold text-white">پرداخت کارت به کارت</h3>
        <p className="text-sm text-slate-300">
          مبلغ <b className="text-white">{formatAmount(amount!, 'fa')} تومان</b> را به کارت زیر واریز کن،
          سپس تصویر رسید را بارگذاری کن.
        </p>

        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <CopyRow label="شماره کارت" value={options.card.number} mono />
          {options.card.holder && <InfoRow label="به نام" value={options.card.holder} />}
          {options.card.bank && <InfoRow label="بانک" value={options.card.bank} />}
          {options.card.notes && <p className="pt-1 text-xs text-slate-400">{options.card.notes}</p>}
        </div>

        <div>
          <div className="label">تصویر رسید</div>
          <input
            type="file"
            accept="image/*"
            onChange={onFile}
            disabled={busy}
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/20 file:px-4 file:py-2 file:text-sm file:font-bold file:text-violet-200 hover:file:bg-violet-500/30"
          />
          {busy && <p className="mt-2 text-sm text-slate-400">در حال ارسال…</p>}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button type="button" className="text-sm text-slate-400 hover:text-white" onClick={() => setStep('select')}>
          ← بازگشت
        </button>
      </div>
    );
  }

  // step === 'select'
  return (
    <div className="card space-y-5">
      <div>
        <div className="label">مبلغ شارژ</div>
        <div className="flex flex-wrap gap-2">
          {options.presets.map((p) => {
            const val = Number(p.amount);
            const active = amount === val && !custom;
            return (
              <button
                key={String(p.amount)}
                type="button"
                onClick={() => {
                  setAmount(val);
                  setCustom('');
                }}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-violet-400/60 bg-violet-500/15 text-white'
                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25'
                }`}
              >
                {p.label?.trim() || `${formatAmount(String(p.amount), 'fa')} تومان`}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="label">یا مبلغ دلخواه (تومان)</div>
        <input
          className="input text-center tracking-widest"
          value={custom}
          onChange={(e) => pickCustom(e.target.value)}
          inputMode="numeric"
          dir="ltr"
          placeholder="۱۰۰٬۰۰۰"
        />
        <p className="mt-1 text-xs text-slate-500">
          حداقل مبلغ: {formatAmount(options.minAmount, 'fa')} تومان
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn" onClick={startCard} disabled={!amountValid || busy}>
          کارت به کارت
        </button>
        {options.gatewayEnabled ? (
          <button type="button" className="btn-ghost justify-center" onClick={startGateway} disabled={!amountValid || busy}>
            پرداخت آنلاین (زرین‌پال)
          </button>
        ) : (
          <button type="button" className="btn-ghost justify-center" disabled>
            پرداخت آنلاین (به‌زودی)
          </button>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <button
        type="button"
        className={`flex items-center gap-2 text-white ${mono ? 'font-mono' : ''}`}
        dir="ltr"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value.replace(/\s/g, ''));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard may be blocked */
          }
        }}
      >
        <span>{value}</span>
        <span className="text-xs text-cyan-400">{copied ? '✅' : 'کپی'}</span>
      </button>
    </div>
  );
}
