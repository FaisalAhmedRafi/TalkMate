import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Subscription } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.module';
import * as bcrypt from 'bcryptjs';
import { NotificationsDto, PasswordDto, PersonalizationDto, PrivacyDto, ProfileDto, SupportDto } from './account.dto';
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

  // ---- Profile ----
  /** Everything the Profile pages show: personal details, notification switches and privacy switches. */
  async profile(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      email: u.email, firstName: u.name ?? '', lastName: u.lastName ?? '', timeZone: u.timeZone, avatar: u.avatar,
      notifications: {
        emailSpecialOffers: u.emailSpecialOffers, emailLearning: u.emailLearning,
        appSpecialOffers: u.appSpecialOffers, appLearning: u.appLearning,
      },
      privacy: { optOutAiTraining: u.optOutAiTraining, optOutProfiling: u.optOutProfiling },
    };
  }

  async saveProfile(userId: string, dto: ProfileDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.firstName === undefined ? undefined : dto.firstName.trim() || null,
        lastName: dto.lastName === undefined ? undefined : dto.lastName.trim() || null,
        timeZone: dto.timeZone,
      },
    });
    return this.profile(userId);
  }

  async saveAvatar(userId: string, image: string | null) {
    await this.prisma.user.update({ where: { id: userId }, data: { avatar: image } });
    return this.profile(userId);
  }

  async changePassword(userId: string, dto: PasswordDto) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
    // 400, not 401: the frontend logs the user out on a 401
    if (!(await bcrypt.compare(dto.currentPassword, u.passwordHash))) throw new BadRequestException('Your current password is incorrect.');
    if (dto.currentPassword === dto.newPassword) throw new BadRequestException('Choose a password that is different from your current one.');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(dto.newPassword, 10) } });
    return { ok: true };
  }

  async saveNotifications(userId: string, dto: NotificationsDto) {
    await this.prisma.user.update({ where: { id: userId }, data: { ...dto } });
    return this.profile(userId);
  }

  async savePrivacy(userId: string, dto: PrivacyDto) {
    await this.prisma.user.update({ where: { id: userId }, data: { ...dto } });
    return this.profile(userId);
  }

  async sendSupport(userId: string, dto: SupportDto) {
    const message = dto.message.trim();
    if (!message) throw new BadRequestException('Please describe your issue or feedback.');
    const { email } = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    await this.prisma.supportMessage.create({ data: { userId, email, type: dto.type, message } });
    return { ok: true };
  }

  /** Permanent. Every table that belongs to the user is removed by the cascade rules in the schema. */
  async deleteAccount(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
    return { ok: true };
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
