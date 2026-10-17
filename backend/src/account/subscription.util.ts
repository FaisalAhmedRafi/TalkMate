import { PrismaService } from '../prisma/prisma.module';

// Billing is not connected, so plans have no prices. Everything here is demo logic.
export const PLAN_MONTHS = [1, 3, 12, 24];

export const addMonths = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
};

/** End of the period already paid for: step forward from `end` in whole plans until it is in the future. */
export function nextPayment(end: Date, months: number, now = new Date()) {
  let d = end;
  for (let i = 0; d <= now && i < 600; i++) d = addMonths(d, months);
  return d;
}

/** Demo unlock/start. A plan that is already active is left alone. */
export async function startSubscription(prisma: PrismaService, userId: string, months = 1) {
  const now = new Date();
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (sub?.status === 'active') {
    await prisma.progress.update({ where: { userId }, data: { premium: true } });
    return;
  }
  // restarting a cancelled or paused plan keeps the time that is already paid for
  const end = sub && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : addMonths(now, sub?.months ?? months);
  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { userId },
      create: { userId, months, status: 'active', currentPeriodEnd: end },
      update: { status: 'active', currentPeriodEnd: end },
    }),
    prisma.progress.update({ where: { userId }, data: { premium: true } }),
  ]);
  await rewardForReferral(prisma, userId);
}

/** One free month. Without a plan it creates a plan that does not renew. */
async function grantFreeMonth(prisma: PrismaService, userId: string) {
  const now = new Date();
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const end = addMonths(sub && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now, 1);
  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { userId },
      create: { userId, months: 1, status: 'canceled', currentPeriodEnd: end },
      update: { currentPeriodEnd: end },
    }),
    prisma.progress.update({ where: { userId }, data: { premium: true } }),
  ]);
}

/** A referred friend starts their first subscription: both get one free month, paid once. */
export async function rewardForReferral(prisma: PrismaService, friendId: string) {
  const friend = await prisma.user.findUnique({ where: { id: friendId }, select: { referredById: true } });
  if (!friend?.referredById) return;
  // updateMany with the flag in the filter makes the payout happen once, even on double clicks
  const claimed = await prisma.user.updateMany({
    where: { id: friendId, referralRewarded: false },
    data: { referralRewarded: true },
  });
  if (claimed.count === 0) return;
  await grantFreeMonth(prisma, friend.referredById);
  await grantFreeMonth(prisma, friendId);
}

/** Premium switches off once a paused or cancelled plan has run out. Active plans never expire here. */
export async function syncPremium(prisma: PrismaService, userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (sub && sub.status !== 'active' && sub.currentPeriodEnd <= new Date()) {
    await prisma.progress.updateMany({ where: { userId, premium: true }, data: { premium: false } });
  }
}
