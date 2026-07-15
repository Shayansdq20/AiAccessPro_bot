'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch, apiRequestOtp, apiVerifyOtp, TOKEN_COOKIE } from './api';

export type LoginState = {
  step: 'phone' | 'code';
  phone: string;
  error: string | null;
  info: string | null;
};

/** Single form action driving both OTP steps (phone → code). */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = String(formData.get('intent') ?? '');
  const phone = String(formData.get('phone') ?? '').trim();

  if (intent === 'back') {
    return { step: 'phone', phone, error: null, info: null };
  }

  if (intent === 'request') {
    if (!phone) return { step: 'phone', phone: '', error: 'شماره موبایل را وارد کن', info: null };
    const result = await apiRequestOtp(phone);
    if (!result.ok) return { step: 'phone', phone, error: result.message, info: null };
    return { step: 'code', phone, error: null, info: 'کد تایید برایت ارسال شد' };
  }

  // intent === 'verify'
  const code = String(formData.get('code') ?? '').trim();
  if (!code) return { step: 'code', phone, error: 'کد را وارد کن', info: null };
  const result = await apiVerifyOtp(phone, code);
  if (!result.ok) return { step: 'code', phone, error: result.message, info: null };

  (await cookies()).set(TOKEN_COOKIE, result.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  redirect('/');
}

export async function resendAction(phone: string): Promise<{ message: string }> {
  const result = await apiRequestOtp(phone);
  return { message: result.ok ? 'کد دوباره ارسال شد' : result.message };
}

export async function logoutAction() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // Session may already be gone; clear the cookie regardless.
  }
  (await cookies()).delete(TOKEN_COOKIE);
  redirect('/login');
}
