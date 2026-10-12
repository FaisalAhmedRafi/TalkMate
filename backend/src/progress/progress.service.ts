import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { SettingsDto } from './progress.dto';

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  private ensure(userId: string) {
    return this.prisma.progress.upsert({ where: { userId }, create: { userId }, update: {} });
  }

  /** What the frontend shows. A streak that lapsed over a day ago reads as 0 without writing. */
  async snapshot(userId: string) {
    const today = ymd(new Date());
    const [p, user, entries] = await Promise.all([
      this.ensure(userId),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } }),
      this.prisma.practiceEntry.findMany({
        where: { userId, day: today }, orderBy: { createdAt: 'desc' }, take: 30,
      }),
    ]);
    const lapsed = p.lastDay ? daysBetween(p.lastDay, today) > 1 : false;
    return {
      email: user.email,
      xp: p.xp, streak: lapsed ? 0 : p.streak, longest: p.longest, messages: p.messages,
      premium: p.premium, giftClaimed: p.giftClaimed, language: p.language, level: p.level,
      today: entries.reverse().map((e) => e.text),
    };
  }

  async practice(userId: string, text: string) {
    const today = ymd(new Date());
    const p = await this.ensure(userId);
    const gap = p.lastDay ? daysBetween(p.lastDay, today) : null;
    const streak = gap === 0 ? p.streak : gap === 1 ? p.streak + 1 : 1;
    await this.prisma.$transaction([
      this.prisma.progress.update({
        where: { userId },
        data: {
          xp: { increment: 10 }, messages: { increment: 1 },
          streak, longest: Math.max(p.longest, streak), lastDay: today,
        },
      }),
      this.prisma.practiceEntry.create({ data: { userId, day: today, text: text.slice(0, 1000) } }),
    ]);
    return this.snapshot(userId);
  }

  async settings(userId: string, dto: SettingsDto) {
    await this.ensure(userId);
    await this.prisma.progress.update({ where: { userId }, data: { language: dto.language, level: dto.level } });
    return this.snapshot(userId);
  }

  /** Demo unlock until real billing exists. */
  async unlockPremium(userId: string) {
    await this.ensure(userId);
    await this.prisma.progress.update({ where: { userId }, data: { premium: true } });
    return this.snapshot(userId);
  }

  async claimGift(userId: string) {
    const p = await this.ensure(userId);
    if (!p.giftClaimed) {
      await this.prisma.progress.update({ where: { userId }, data: { giftClaimed: true, xp: { increment: 20 } } });
    }
    return this.snapshot(userId);
  }
}
