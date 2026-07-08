/**
 * Dev/demo seed: creates a demo catalog (categories, products, plans,
 * inventory) so the bot can be driven end-to-end immediately.
 * Idempotent — safe to run more than once.
 *
 * The initial admin user and default settings are NOT seeded here; the API
 * creates them on boot from ADMIN_INITIAL_EMAIL / ADMIN_INITIAL_PASSWORD.
 */
import { PrismaClient } from '@prisma/client';
import { encryptPayload } from './crypto';

const prisma = new PrismaClient();

async function main() {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY is required to seed inventory');

  // Default referral program (idempotent): invite 3 buyers -> 200,000 Toman.
  if ((await prisma.referralProgram.count()) === 0) {
    await prisma.referralProgram.create({
      data: {
        name: 'دعوت ۳ دوست',
        requiredReferrals: 3,
        minReferralSpend: 0n,
        rewardAmount: 200000n,
        repeatable: true,
      },
    });
    console.log('Default referral program seeded.');
  }

  const existing = await prisma.productCategory.count();
  if (existing > 0) {
    console.log('Catalog already seeded, skipping.');
    return;
  }

  const music = await prisma.productCategory.create({
    data: { title: 'اکانت پرمیوم', emoji: '⭐', sortOrder: 1 },
  });
  const vpnCat = await prisma.productCategory.create({
    data: { title: 'VPN', emoji: '🛡', sortOrder: 2 },
  });

  const spotify = await prisma.product.create({
    data: {
      categoryId: music.id,
      title: 'Spotify Premium',
      kind: 'account',
      sortOrder: 1,
    },
  });
  const chatgpt = await prisma.product.create({
    data: {
      categoryId: music.id,
      title: 'ChatGPT Plus',
      kind: 'account',
      sortOrder: 2,
    },
  });
  const vpnParis = await prisma.product.create({
    data: {
      categoryId: vpnCat.id,
      title: 'VPN پاریس',
      kind: 'config',
      useDurationTabs: true,
      sortOrder: 1,
    },
  });

  const spotify1m = await prisma.productVariant.create({
    data: {
      productId: spotify.id,
      title: 'اسپاتیفای ۱ ماهه',
      price: 150000n,
      fulfillmentMode: 'auto_inventory',
      optionGroup: '۱ ماه',
      sortOrder: 1,
    },
  });
  await prisma.productVariant.create({
    data: {
      productId: spotify.id,
      title: 'اسپاتیفای ۳ ماهه',
      price: 400000n,
      fulfillmentMode: 'auto_inventory',
      optionGroup: '۳ ماه',
      sortOrder: 2,
    },
  });
  await prisma.productVariant.create({
    data: {
      productId: chatgpt.id,
      title: 'ChatGPT Plus یک ماهه (روی ایمیل شما)',
      price: 900000n,
      fulfillmentMode: 'manual_admin',
      sortOrder: 1,
    },
  });
  await prisma.productVariant.create({
    data: {
      productId: vpnParis.id,
      title: 'VPN پاریس 30GB',
      price: 120000n,
      fulfillmentMode: 'hybrid_prefer_inventory',
      sortOrder: 1,
    },
  });

  await prisma.inventoryItem.createMany({
    data: [
      {
        variantId: spotify1m.id,
        label: 'Spotify demo #1',
        payloadEnc: encryptPayload(
          'Email: demo1@example.com\nPassword: demo-pass-1\nRenews: monthly',
          encryptionKey,
        ),
      },
      {
        variantId: spotify1m.id,
        label: 'Spotify demo #2',
        payloadEnc: encryptPayload(
          'Email: demo2@example.com\nPassword: demo-pass-2\nRenews: monthly',
          encryptionKey,
        ),
      },
    ],
  });

  console.log('Demo catalog seeded.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
