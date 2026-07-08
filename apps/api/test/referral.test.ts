import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { WalletService } from '../src/modules/wallet/wallet.service';
import { ReferralService } from '../src/modules/referral/referral.service';
import { NotifierService } from '../src/modules/notifier/notifier.service';
import { SettingsService } from '../src/modules/settings/settings.service';
import { TextsService } from '../src/modules/settings/texts.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { createTestPrisma, createTestUser, truncateAll } from './helpers';

const prisma = createTestPrisma();
const wallet = new WalletService(prisma);
const settings = new SettingsService(prisma);
const texts = new TextsService(settings);
const notifier = new NotifierService();
const audit = new AuditService(prisma);
const referral = new ReferralService(prisma, wallet, notifier, texts, audit);

let tg = 5000n;
async function newUser() {
  tg += 1n;
  return createTestUser(prisma, tg);
}

/** Give a referred user a qualifying paid order of `amount`. */
async function buy(userId: string, amount: bigint) {
  await prisma.order.create({
    data: {
      userId,
      status: 'delivered',
      subtotal: amount,
      total: amount,
      items: { create: { productTitle: 'P', variantTitle: 'V', unitPrice: amount, totalPrice: amount } },
    },
  });
  await referral.onReferredPurchase(userId);
}

beforeEach(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('ReferralService', () => {
  it('generates a stable unique code and a deep link', async () => {
    const user = await createTestUser(prisma, 4001n);
    const code1 = await referral.ensureCode(user);
    const code2 = await referral.ensureCode({ ...user, referralCode: code1 });
    expect(code1).toBe(code2);
    const link = await referral.link({ ...user, referralCode: code1 });
    expect(link).toContain(`ref_${code1}`);
  });

  it('attributes new users to the inviter, not self, and only once', async () => {
    const inviter = await createTestUser(prisma, 4002n);
    const code = await referral.ensureCode(inviter);
    const invited = await newUser();

    await referral.attachReferrer(invited, code);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: invited.id } });
    expect(after.referredById).toBe(inviter.id);

    // self-referral is ignored
    const selfCode = await referral.ensureCode(inviter);
    await referral.attachReferrer({ ...inviter, referralCode: selfCode }, selfCode);
    const inviterAfter = await prisma.user.findUniqueOrThrow({ where: { id: inviter.id } });
    expect(inviterAfter.referredById).toBeNull();
  });

  it('rewards the inviter once 3 referrals each make a purchase (idempotent)', async () => {
    await prisma.referralProgram.create({
      data: { name: '3 friends', requiredReferrals: 3, minReferralSpend: 0n, rewardAmount: 200_000n, repeatable: true },
    });
    const inviter = await createTestUser(prisma, 4100n);
    const code = await referral.ensureCode(inviter);

    // three referred users, purchases one at a time
    const friends = [await newUser(), await newUser(), await newUser()];
    for (const f of friends) await referral.attachReferrer(f, code);

    await buy(friends[0].id, 50_000n);
    await buy(friends[1].id, 50_000n);
    expect(await wallet.balanceOf(inviter.id)).toBe(0n); // only 2 qualified yet

    await buy(friends[2].id, 50_000n); // 3rd qualifies -> reward
    expect(await wallet.balanceOf(inviter.id)).toBe(200_000n);

    // re-evaluating (e.g. another purchase by a friend) must not double-pay
    await buy(friends[0].id, 10_000n);
    expect(await wallet.balanceOf(inviter.id)).toBe(200_000n);
    expect(await prisma.referralReward.count({ where: { userId: inviter.id } })).toBe(1);
  });

  it('respects the minimum spend per referral', async () => {
    await prisma.referralProgram.create({
      data: { name: 'min 200k', requiredReferrals: 2, minReferralSpend: 200_000n, rewardAmount: 100_000n, repeatable: true },
    });
    const inviter = await createTestUser(prisma, 4200n);
    const code = await referral.ensureCode(inviter);
    const a = await newUser();
    const b = await newUser();
    await referral.attachReferrer(a, code);
    await referral.attachReferrer(b, code);

    await buy(a.id, 150_000n); // below min, doesn't qualify
    await buy(b.id, 250_000n); // qualifies
    expect(await wallet.balanceOf(inviter.id)).toBe(0n); // only 1 of 2

    await buy(a.id, 60_000n); // a now at 210k total -> qualifies -> 2/2
    expect(await wallet.balanceOf(inviter.id)).toBe(100_000n);
  });

  it('repeatable=false caps the reward at one batch', async () => {
    await prisma.referralProgram.create({
      data: { name: 'once', requiredReferrals: 2, minReferralSpend: 0n, rewardAmount: 50_000n, repeatable: false },
    });
    const inviter = await createTestUser(prisma, 4300n);
    const code = await referral.ensureCode(inviter);
    const friends = [await newUser(), await newUser(), await newUser(), await newUser()];
    for (const f of friends) await referral.attachReferrer(f, code);
    for (const f of friends) await buy(f.id, 10_000n); // 4 qualified = 2 batches

    // not repeatable -> only the first batch pays
    expect(await wallet.balanceOf(inviter.id)).toBe(50_000n);
  });

  it('reports stats for the invite screen', async () => {
    await prisma.referralProgram.create({
      data: { name: 's', requiredReferrals: 3, minReferralSpend: 0n, rewardAmount: 200_000n, repeatable: true },
    });
    const inviter = await createTestUser(prisma, 4400n);
    const code = await referral.ensureCode(inviter);
    const a = await newUser();
    await referral.attachReferrer(a, code);
    await buy(a.id, 10_000n);

    const stats = await referral.statsFor({ ...inviter, referralCode: code });
    expect(stats.invitedCount).toBe(1);
    expect(stats.qualifiedCount).toBe(1);
    expect(stats.program?.requiredReferrals).toBe(3);
    expect(stats.earnedTotal).toBe(0n);
  });
});
