import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="glow left-1/2 top-[-6rem] h-96 w-96 -translate-x-1/2 bg-violet-600/40" />
      <div className="glow bottom-[-6rem] right-[-4rem] h-80 w-80 bg-cyan-500/25" />

      <div className="card w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-2xl font-black text-white">
            P
          </div>
          <h1 className="text-xl font-black text-white">ورود به پریمیوم هاب</h1>
          <p className="mt-1 text-sm text-slate-400">
            با شماره موبایل وارد شو؛ کد تایید برایت پیامک می‌شود.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
