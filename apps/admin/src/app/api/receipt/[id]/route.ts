import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { apiBase, TOKEN_COOKIE } from '@/lib/api';

/** Proxies the Telegram receipt photo from the API with the admin session. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  const upstream = await fetch(`${apiBase()}/admin/payments/${id}/receipt.jpg`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!upstream.ok) return new NextResponse('Not found', { status: upstream.status });
  const buffer = await upstream.arrayBuffer();
  return new NextResponse(buffer, {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=3600' },
  });
}
