'use server';

import { apiFetch, ApiError } from './api';

export type ManualStart = { ok: true; paymentId: string; number: number } | { ok: false; message: string };

export async function createManualTopupAction(amount: number): Promise<ManualStart> {
  try {
    const res = await apiFetch<{ paymentId: string; number: number }>('/store/topup/manual', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
    return { ok: true, ...res };
  } catch (err) {
    return { ok: false, message: err instanceof ApiError ? err.message : 'خطا در ایجاد درخواست' };
  }
}

export type ReceiptResult = { ok: true } | { ok: false; message: string };

export async function uploadReceiptAction(
  paymentId: string,
  imageBase64: string,
  mime: string,
): Promise<ReceiptResult> {
  try {
    await apiFetch(`/store/topup/manual/${paymentId}/receipt`, {
      method: 'POST',
      body: JSON.stringify({ imageBase64, mime }),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof ApiError ? err.message : 'خطا در ثبت رسید' };
  }
}

export type GatewayResult = { ok: true; payUrl: string } | { ok: false; message: string };

export async function createGatewayTopupAction(amount: number): Promise<GatewayResult> {
  try {
    const res = await apiFetch<{ ok: boolean; payUrl?: string; error?: string }>('/store/topup/gateway', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
    if (res.ok && res.payUrl) return { ok: true, payUrl: res.payUrl };
    return { ok: false, message: 'درگاه پرداخت آنلاین فعلاً در دسترس نیست' };
  } catch (err) {
    return { ok: false, message: err instanceof ApiError ? err.message : 'خطا در اتصال به درگاه' };
  }
}
