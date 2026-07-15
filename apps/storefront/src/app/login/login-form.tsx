'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from '@/lib/actions';

const initial: LoginState = { step: 'phone', phone: '', error: null, info: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="space-y-4">
      {state.step === 'phone' ? (
        <>
          <input type="hidden" name="intent" value="request" />
          <div>
            <label className="label" htmlFor="phone">
              شماره موبایل
            </label>
            <input
              className="input text-center tracking-widest"
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              placeholder="09123456789"
              defaultValue={state.phone}
              autoComplete="tel"
              required
            />
          </div>
          <button className="btn w-full" type="submit" disabled={pending}>
            {pending ? 'در حال ارسال…' : 'دریافت کد تایید'}
          </button>
        </>
      ) : (
        <>
          <input type="hidden" name="phone" value={state.phone} />
          <div>
            <label className="label" htmlFor="code">
              کد تایید ارسال‌شده به {state.phone}
            </label>
            <input
              className="input text-center text-lg tracking-[0.5em]"
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              dir="ltr"
              placeholder="—————"
              autoComplete="one-time-code"
              autoFocus
              required
            />
          </div>
          <button className="btn w-full" type="submit" name="intent" value="verify" disabled={pending}>
            {pending ? 'در حال بررسی…' : 'ورود'}
          </button>
          <button
            className="w-full text-center text-sm text-slate-400 hover:text-white"
            type="submit"
            name="intent"
            value="back"
            formNoValidate
          >
            تغییر شماره موبایل
          </button>
        </>
      )}

      {state.error && <p className="text-center text-sm text-red-400">{state.error}</p>}
      {state.info && !state.error && (
        <p className="text-center text-sm text-emerald-400">{state.info}</p>
      )}
    </form>
  );
}
