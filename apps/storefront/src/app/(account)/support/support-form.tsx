'use client';

import { useActionState, useEffect, useRef } from 'react';
import { sendSupportMessageAction, type MessageState } from '@/lib/account-actions';

const initial: MessageState = { ok: false, error: null };

export function SupportForm() {
  const [state, action, pending] = useActionState(sendSupportMessageAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card space-y-3">
      <label className="label" htmlFor="body">
        پیام جدید به پشتیبانی
      </label>
      <textarea
        id="body"
        name="body"
        rows={3}
        required
        maxLength={2000}
        placeholder="سوال یا مشکلت را بنویس…"
        className="input resize-y"
      />
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-400">پیام ارسال شد ✅</p>}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? 'در حال ارسال…' : 'ارسال پیام'}
      </button>
    </form>
  );
}
