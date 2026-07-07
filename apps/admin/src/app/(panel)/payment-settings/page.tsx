import { apiFetch } from '@/lib/api';
import { apiAction } from '@/lib/actions';
import { getDict } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

interface ManualPaymentSettings {
  cardNumber: string;
  cardHolder: string;
  bankName?: string;
  extraNotes?: string;
  presets: { amount: string; label?: string }[];
}

export default async function PaymentSettingsPage() {
  const { t } = await getDict();
  const settings = await apiFetch<ManualPaymentSettings>('/admin/settings/manual-payment');

  async function save(formData: FormData) {
    'use server';
    const presets: { amount: string; label?: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const amount = String(formData.get(`preset_amount_${i}`) ?? '').trim();
      const label = String(formData.get(`preset_label_${i}`) ?? '').trim();
      if (/^\d+$/.test(amount) && amount !== '') presets.push({ amount, label: label || undefined });
    }
    await apiAction({
      path: '/admin/settings/manual-payment',
      method: 'PUT',
      body: {
        cardNumber: String(formData.get('cardNumber') ?? ''),
        cardHolder: String(formData.get('cardHolder') ?? ''),
        bankName: String(formData.get('bankName') ?? ''),
        extraNotes: String(formData.get('extraNotes') ?? ''),
        presets: presets.length > 0 ? presets : [{ amount: '100000' }],
      },
      revalidate: '/payment-settings',
    });
  }

  const presetSlots = Array.from({ length: 6 }, (_, i) => settings.presets[i]);

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">⚙️ {t.paymentSettings}</h1>
      <form action={save} className="space-y-4">
        <div className="card space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">{t.cardNumber}</label>
              <input className="input font-mono" name="cardNumber" defaultValue={settings.cardNumber} required dir="ltr" />
            </div>
            <div>
              <label className="label">{t.cardHolder}</label>
              <input className="input" name="cardHolder" defaultValue={settings.cardHolder} required />
            </div>
            <div>
              <label className="label">{t.bankName}</label>
              <input className="input" name="bankName" defaultValue={settings.bankName ?? ''} />
            </div>
          </div>
          <div>
            <label className="label">{t.extraNotes}</label>
            <textarea className="input min-h-20" name="extraNotes" defaultValue={settings.extraNotes ?? ''} />
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold">{t.presets}</h2>
          {presetSlots.map((preset, i) => (
            <div key={i} className="flex gap-3">
              <div className="grow">
                <label className="label">{t.presetAmount} {i + 1}</label>
                <input className="input" name={`preset_amount_${i}`} defaultValue={preset?.amount ?? ''} pattern="\d*" dir="ltr" />
              </div>
              <div className="grow">
                <label className="label">{t.presetLabel}</label>
                <input className="input" name={`preset_label_${i}`} defaultValue={preset?.label ?? ''} />
              </div>
            </div>
          ))}
        </div>
        <button className="btn" type="submit">💾 {t.save}</button>
      </form>
    </div>
  );
}
