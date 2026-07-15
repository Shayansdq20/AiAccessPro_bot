'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from './api';

export type MessageState = { ok: boolean; error: string | null };

export async function sendSupportMessageAction(
  _prev: MessageState,
  formData: FormData,
): Promise<MessageState> {
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return { ok: false, error: 'پیام خالی است' };
  try {
    await apiFetch('/store/support/message', {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    revalidatePath('/support');
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'خطا در ارسال پیام' };
  }
}
