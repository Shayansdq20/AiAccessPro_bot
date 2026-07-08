import { getDict } from '@/lib/i18n';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const { t } = await getDict();
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-sm">
        <h1 className="mb-1 text-center text-xl font-bold">💎 {t.appName}</h1>
        <p className="mb-6 text-center text-sm text-slate-500">{t.login}</p>
        <LoginForm
          labels={{
            email: t.email,
            password: t.password,
            login: t.login,
            failed: t.loginFailed,
            unreachable: t.apiUnreachable,
          }}
        />
      </div>
    </main>
  );
}
