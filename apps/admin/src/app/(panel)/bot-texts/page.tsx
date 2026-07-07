import { apiFetch } from '@/lib/api';
import { apiAction } from '@/lib/actions';
import { getDict } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

interface BotMessagesResponse {
  keys: string[];
  defaults: { fa: Record<string, string>; en: Record<string, string> };
  overrides: { fa?: Record<string, string>; en?: Record<string, string> };
}

export default async function BotTextsPage() {
  const { t } = await getDict();
  const data = await apiFetch<BotMessagesResponse>('/admin/settings/bot-messages');

  const groups = new Map<string, string[]>();
  for (const key of data.keys) {
    const prefix = key.split('.')[0];
    groups.set(prefix, [...(groups.get(prefix) ?? []), key]);
  }

  async function save(formData: FormData) {
    'use server';
    const fa: Record<string, string> = {};
    const en: Record<string, string> = {};
    for (const [name, value] of formData.entries()) {
      if (typeof value !== 'string') continue;
      if (name.startsWith('fa:')) fa[name.slice(3)] = value;
      if (name.startsWith('en:')) en[name.slice(3)] = value;
    }
    await apiAction({ path: '/admin/settings/bot-messages', method: 'PUT', body: { fa, en }, revalidate: '/bot-texts' });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">📝 {t.botTexts}</h1>
      <p className="text-sm text-slate-500">{t.botTextsHint}</p>

      <form action={save} className="space-y-4">
        <div className="sticky top-2 z-10">
          <button className="btn shadow-lg" type="submit">💾 {t.save}</button>
        </div>
        {[...groups.entries()].map(([group, keys]) => (
          <details key={group} className="card" open={group === 'menu'}>
            <summary className="cursor-pointer font-semibold">{group} ({keys.length})</summary>
            <div className="mt-4 space-y-4">
              {keys.map((key) => (
                <div key={key} className="grid gap-2 border-b border-slate-100 pb-3 lg:grid-cols-2">
                  <div>
                    <label className="label" dir="ltr">{key} — فارسی</label>
                    <textarea
                      className="input min-h-16"
                      name={`fa:${key}`}
                      defaultValue={data.overrides.fa?.[key] ?? ''}
                      placeholder={data.defaults.fa[key]}
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="label" dir="ltr">{key} — English</label>
                    <textarea
                      className="input min-h-16"
                      name={`en:${key}`}
                      defaultValue={data.overrides.en?.[key] ?? ''}
                      placeholder={data.defaults.en[key]}
                      dir="ltr"
                    />
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
        <button className="btn" type="submit">💾 {t.save}</button>
      </form>
    </div>
  );
}
