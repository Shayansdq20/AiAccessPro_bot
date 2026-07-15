import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_BASE = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
export const TOKEN_COOKIE = 'customer_token';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Server-side fetch to the API with the customer session token. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) redirect('/login');

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, body || res.statusText);
  }
  return (await res.json()) as T;
}

export type OtpRequestResult =
  | { ok: true; expiresInSeconds: number }
  | { ok: false; message: string };

/** Step 1 — send an OTP. Never throws (login pages must not crash). */
export async function apiRequestOtp(phone: string): Promise<OtpRequestResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/request-otp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone }),
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as {
      expiresInSeconds?: number;
      message?: string;
    };
    if (!res.ok) return { ok: false, message: data.message || 'ارسال کد ناموفق بود' };
    return { ok: true, expiresInSeconds: data.expiresInSeconds ?? 120 };
  } catch {
    return { ok: false, message: 'سرور در دسترس نیست' };
  }
}

export type Customer = {
  id: string;
  displayUsername: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  language: 'fa' | 'en';
  status: 'active' | 'blocked';
  referralCode: string | null;
};

export type OtpVerifyResult =
  | { ok: true; token: string; customer: Customer }
  | { ok: false; message: string };

/** Step 2 — verify the code and receive a session token. Never throws. */
export async function apiVerifyOtp(phone: string, code: string): Promise<OtpVerifyResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, code }),
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      customer?: Customer;
      message?: string;
    };
    if (!res.ok || !data.token || !data.customer) {
      return { ok: false, message: data.message || 'کد نامعتبر است' };
    }
    return { ok: true, token: data.token, customer: data.customer };
  } catch {
    return { ok: false, message: 'سرور در دسترس نیست' };
  }
}

export type Account = {
  customer: Customer;
  wallet: { balance: string };
  ordersCount: number;
};

export async function getAccount(): Promise<Account> {
  return apiFetch<Account>('/store/account');
}
