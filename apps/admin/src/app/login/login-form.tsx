'use client';

import { useActionState } from 'react';
import { loginAction } from '@/lib/actions';

export function LoginForm({
  labels,
}: {
  labels: { email: string; password: string; login: string; failed: string; unreachable: string };
}) {
  const [state, action, pending] = useActionState(loginAction, { error: null });
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">{labels.email}</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="username" />
      </div>
      <div>
        <label className="label" htmlFor="password">{labels.password}</label>
        <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {state.error && (
        <p className="text-sm text-red-600">
          {state.error === 'unreachable' ? labels.unreachable : labels.failed}
        </p>
      )}
      <button className="btn w-full" type="submit" disabled={pending}>
        {labels.login}
      </button>
    </form>
  );
}
