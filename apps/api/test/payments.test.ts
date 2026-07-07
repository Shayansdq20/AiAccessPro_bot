import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { WalletService } from '../src/modules/wallet/wallet.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { NotifierService } from '../src/modules/notifier/notifier.service';
import { SettingsService } from '../src/modules/settings/settings.service';
import { TextsService } from '../src/modules/settings/texts.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { ZarinpalProvider } from '../src/modules/payments/providers/zarinpal.provider';
import { createTestPrisma, createTestUser, truncateAll } from './helpers';

const prisma = createTestPrisma();
const wallet = new WalletService(prisma);
const settings = new SettingsService(prisma);
const texts = new TextsService(settings);
const notifier = new NotifierService(); // placeholder token: sends fail silently
const audit = new AuditService(prisma);
const payments = new PaymentsService(prisma, wallet, notifier, texts, audit, new ZarinpalProvider());

beforeEach(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('PaymentsService approve/reject (idempotent)', () => {
  it('approves a pending payment exactly once, crediting the wallet once', async () => {
    const user = await createTestUser(prisma);
    const payment = await payments.createManualTopup(user.id, 200_000n);

    const first = await payments.approve(payment.id, { adminId: 'admin1' });
    const second = await payments.approve(payment.id, { adminId: 'admin2' });

    expect(first.status).toBe('approved');
    expect(second.status).toBe('already_decided');
    expect(await wallet.balanceOf(user.id)).toBe(200_000n);
    expect(await prisma.walletLedger.count({ where: { reference: `payment:${payment.id}` } })).toBe(1);
  });

  it('survives concurrent double-approval without double credit', async () => {
    const user = await createTestUser(prisma);
    const payment = await payments.createManualTopup(user.id, 150_000n);

    const results = await Promise.all([
      payments.approve(payment.id, { adminId: 'a1' }),
      payments.approve(payment.id, { adminId: 'a2' }),
      payments.approve(payment.id, { adminId: 'a3' }),
    ]);
    expect(results.filter((r) => r.status === 'approved')).toHaveLength(1);
    expect(await wallet.balanceOf(user.id)).toBe(150_000n);
  });

  it('cannot approve after reject', async () => {
    const user = await createTestUser(prisma);
    const payment = await payments.createManualTopup(user.id, 90_000n);

    const rejected = await payments.reject(payment.id, { adminId: 'admin1' });
    const approveAfter = await payments.approve(payment.id, { adminId: 'admin1' });

    expect(rejected.status).toBe('rejected');
    expect(approveAfter.status).toBe('already_decided');
    expect(approveAfter.payment.status).toBe('rejected');
    expect(await wallet.balanceOf(user.id)).toBe(0n);
  });
});
