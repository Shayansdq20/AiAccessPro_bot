import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { WalletService, InsufficientBalanceError } from '../src/modules/wallet/wallet.service';
import { createTestPrisma, createTestUser, truncateAll } from './helpers';

const prisma = createTestPrisma();
const wallet = new WalletService(prisma);

beforeEach(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('WalletService (ledger-first, idempotent)', () => {
  it('credits once for a repeated reference', async () => {
    const user = await createTestUser(prisma);
    const first = await wallet.credit({ userId: user.id, amount: 50_000n, reference: 'payment:p1' });
    const second = await wallet.credit({ userId: user.id, amount: 50_000n, reference: 'payment:p1' });

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(await wallet.balanceOf(user.id)).toBe(50_000n);
    expect(await prisma.walletLedger.count()).toBe(1);
  });

  it('is idempotent under concurrent duplicate credits', async () => {
    const user = await createTestUser(prisma);
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        wallet.credit({ userId: user.id, amount: 10_000n, reference: 'payment:race' }),
      ),
    );
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    expect(await wallet.balanceOf(user.id)).toBe(10_000n);
  });

  it('sums concurrent distinct credits correctly', async () => {
    const user = await createTestUser(prisma);
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        wallet.credit({ userId: user.id, amount: 1_000n, reference: `payment:c${i}` }),
      ),
    );
    expect(await wallet.balanceOf(user.id)).toBe(10_000n);
    const ledger = await wallet.ledgerOf(user.id, 50);
    expect(ledger).toHaveLength(10);
    // balanceAfter entries must be strictly increasing when sorted by value.
    const balances = ledger.map((l) => l.balanceAfter).sort((a, b) => (a < b ? -1 : 1));
    expect(balances[9]).toBe(10_000n);
  });

  it('rejects debits beyond the balance and rolls back', async () => {
    const user = await createTestUser(prisma);
    await wallet.credit({ userId: user.id, amount: 30_000n, reference: 'payment:x' });
    await expect(
      wallet.debit({ userId: user.id, amount: 40_000n, reference: 'order:o1' }),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
    expect(await wallet.balanceOf(user.id)).toBe(30_000n);
    expect(await prisma.walletLedger.count()).toBe(1);
  });

  it('never lets concurrent debits overdraw', async () => {
    const user = await createTestUser(prisma);
    await wallet.credit({ userId: user.id, amount: 100_000n, reference: 'payment:full' });
    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        wallet.debit({ userId: user.id, amount: 30_000n, reference: `order:d${i}` }),
      ),
    );
    const succeeded = attempts.filter((a) => a.status === 'fulfilled').length;
    expect(succeeded).toBe(3); // 3 * 30k = 90k <= 100k, 4th would overdraw
    expect(await wallet.balanceOf(user.id)).toBe(10_000n);
  });

  it('adjusts with signed amounts through the ledger', async () => {
    const user = await createTestUser(prisma);
    await wallet.adjust({ userId: user.id, signedAmount: 25_000n, reference: 'adjust:a1', actorAdminId: 'admin1' });
    await wallet.adjust({ userId: user.id, signedAmount: -5_000n, reference: 'adjust:a2', actorAdminId: 'admin1' });
    expect(await wallet.balanceOf(user.id)).toBe(20_000n);
    const ledger = await wallet.ledgerOf(user.id);
    expect(ledger.every((l) => l.type === 'adjustment')).toBe(true);
    expect(ledger.every((l) => l.actorAdminId === 'admin1')).toBe(true);
  });
});
