import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Subscription } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.module';
import { PersonalizationDto } from './account.dto';
import { QUESTIONS } from './account.options';
import { nextPayment, syncPremium } from './subscription.util';

type SubStatus = 'none' | 'active' | 'paused' | 'canceled';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no look-alike characters
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');

/** What the Subscriptions page shows. A paused or cancelled plan that has run out counts as none. */
function view(sub: Subscription | null, premium: boolean) {
  const now = new Date();
  if (!sub || (sub.status !== 'active' && sub.currentPeriodEnd <= now)) {
    return { status: 'none' as SubStatus, months: null, nextPayment: null, accessUntil: null, premium };
  }
  const active = sub.status === 'active';
  return {
    status: sub.status as SubStatus,
    months: sub.months,
    nextPayment: active ? nextPayment(sub.currentPeriodEnd, sub.months, now).toISOString() : null,
    accessUntil: active ? null : sub.currentPeriodEnd.toISOString(),
    premium,
  };
}

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Personalization ----
  async personalization(userId: string) {
    const row = await this.prisma.personalization.findUnique({ where: { userId } });
    return {
      values: {
        reason: row?.reason ?? null, frequency: row?.frequency ?? null, goal: row?.goal ?? null,
        style: row?.style ?? null, ageRange: row?.ageRange ?? null,
      },
      questions: QUESTIONS,
    };
  }

  async savePersonalization(userId: string, dto: PersonalizationDto) {
    await this.prisma.personalization.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
    return this.personalization(userId);
  }

  // ---- Refer a friend ----
  async referral(userId: string) {
    let code = (await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } })).referralCode;
    for (let i = 0; !code && i < 5; i++) {
      const candidate = makeCode();
      try {
        await this.prisma.user.update({ where: { id: userId }, data: { referralCode: candidate } });
        code = candidate;
      } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e; // P2002 = code already taken, try another
      }
    }
    if (!code) throw new ServiceUnavailableException("Couldn't create your invite code. Try again.");
    const [invited, rewarded] = await Promise.all([
      this.prisma.user.count({ where: { referredById: userId } }),
      this.prisma.user.count({ where: { referredById: userId, referralRewarded: true } }),
    ]);
    return { code, invited, rewarded };
  }

  // ---- Subscriptions ----
  async subscription(userId: string) {
    await syncPremium(this.prisma, userId);
    return this.current(userId);
  }

  private async current(userId: string) {
    const [sub, p] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { userId } }),
      this.prisma.progress.findUnique({ where: { userId }, select: { premium: true } }),
    ]);
    return view(sub, p?.premium ?? false);
  }

  private async find(userId: string, allowed: string[], message: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    const ranOut = !!sub && sub.status !== 'active' && sub.currentPeriodEnd <= new Date();
    if (!sub || ranOut || !allowed.includes(sub.status)) throw new BadRequestException(message);
    return sub;
  }

  async changePlan(userId: string, months: number) {
    await this.find(userId, ['active', 'paused'], 'There is no subscription to change.');
    await this.prisma.subscription.update({ where: { userId }, data: { months } });
    return this.current(userId);
  }

  async pause(userId: string) {
    const sub = await this.find(userId, ['active'], 'Only an active subscription can be paused.');
    // keep access until the end of the period that is already paid for
    await this.prisma.subscription.update({
      where: { userId },
      data: { status: 'paused', currentPeriodEnd: nextPayment(sub.currentPeriodEnd, sub.months) },
    });
    return this.current(userId);
  }

  async resume(userId: string) {
    await this.find(userId, ['paused'], 'Only a paused subscription can be resumed.');
    await this.prisma.subscription.update({ where: { userId }, data: { status: 'active' } });
    return this.current(userId);
  }

  async cancel(userId: string) {
    const sub = await this.find(userId, ['active', 'paused'], 'There is no subscription to cancel.');
    const end = sub.status === 'active' ? nextPayment(sub.currentPeriodEnd, sub.months) : sub.currentPeriodEnd;
    await this.prisma.subscription.update({ where: { userId }, data: { status: 'canceled', currentPeriodEnd: end } });
    return this.current(userId);
  }
}
