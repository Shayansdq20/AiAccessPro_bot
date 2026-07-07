'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiFetch, apiLogin, TOKEN_COOKIE } from './api';
import { LANG_COOKIE } from './i18n';

export async function loginAction(_prev: { error: boolean }, formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const result = await apiLogin(email, password);
  if (!result) return { error: true };
  (await cookies()).set(TOKEN_COOKIE, result.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  redirect('/');
}

export async function logoutAction() {
  try {
    await apiFetch('/admin/auth/logout', { method: 'POST' });
  } catch {
    // Session may already be gone; clear the cookie regardless.
  }
  (await cookies()).delete(TOKEN_COOKIE);
  redirect('/login');
}

export async function switchLangAction() {
  const store = await cookies();
  const current = store.get(LANG_COOKIE)?.value === 'en' ? 'en' : 'fa';
  store.set(LANG_COOKIE, current === 'fa' ? 'en' : 'fa', {
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
  revalidatePath('/', 'layout');
}

/** Generic mutation helper used by simple forms across the panel. */
export async function apiAction(params: {
  path: string;
  method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  revalidate: string;
}) {
  await apiFetch(params.path, {
    method: params.method ?? 'POST',
    body: params.body === undefined ? undefined : JSON.stringify(params.body),
  });
  revalidatePath(params.revalidate);
}
