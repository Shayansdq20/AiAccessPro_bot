import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_BASE = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
export const TOKEN_COOKIE = 'admin_token';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Server-side fetch to the API with the admin session token. */
export async function apiFetch<T>(path: string, init?: RequestInit & { rawResponse?: boolean }): Promise<T> {
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
  if (init?.rawResponse) return res as unknown as T;
  return (await res.json()) as T;
}

export type LoginResult =
  | { ok: true; token: string; admin: { id: string; email: string; name: string; role: string } }
  | { ok: false; reason: 'invalid' | 'unreachable' };

/** Login is the only unauthenticated API call. Never throws. */
export async function apiLogin(email: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${API_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, reason: 'invalid' };
    const data = (await res.json()) as {
      token: string;
      admin: { id: string; email: string; name: string; role: string };
    };
    return { ok: true, ...data };
  } catch {
    // API container down/unreachable must not crash the login page.
    return { ok: false, reason: 'unreachable' };
  }
}

export function apiBase(): string {
  return API_BASE;
}
