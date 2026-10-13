import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { SettingsDto } from './progress.dto';

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const STUDY_SECONDS = 180; // a day counts as a completed session after 3 minutes
const XP_PER_LEVEL = 50;

const ACHIEVEMENTS = [
  { id: 'first_step', name: 'First step', description: 'Send your first practice message', test: (s: Facts) => s.messages >= 1 },
  { id: 'warm_up', name: 'Warm-up', description: 'Practise 3 minutes in one day', test: (s: Facts) => s.studiedDays >= 1 },
  { id: 'on_a_roll', name: 'On a roll', description: 'Reach a 3-day streak', test: (s: Facts) => s.longest >= 3 },
  { id: 'week', name: 'Week warrior', description: 'Reach a 7-day streak', test: (s: Facts) => s.longest >= 7 },
  { id: 'chatterbox', name: 'Chatterbox', description: 'Send 50 practice messages', test: (s: Facts) => s.messages >= 50 },
  { id: 'hour', name: 'Hour of power', description: 'Practise for 60 minutes in total', test: (s: Facts) => s.totalSeconds >= 3600 },
  { id: 'level5', name: 'Level 5', description: 'Reach level 5', test: (s: Facts) => s.level >= 5 },
];
type Facts = { messages: number; longest: number; totalSeconds: number; studiedDays: number; level: number };
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
    await this.ensure(userId);
    await this.prisma.$transaction([
      this.prisma.progress.update({
        where: { userId },
        data: { xp: { increment: 10 }, messages: { increment: 1 } },
      }),
      this.prisma.practiceEntry.create({ data: { userId, day: ymd(new Date()), text: text.slice(0, 1000) } }),
    ]);
    return this.snapshot(userId);
  }

  /** Practice time reported by the browser. Streak goes up when a day first reaches 3 minutes. */
  async addTime(userId: string, seconds: number, day: string) {
    const gapToUtc = (Date.parse(ymd(new Date())) - Date.parse(day)) / 86_400_000;
    if (!Number.isFinite(gapToUtc) || Math.abs(gapToUtc) > 1) throw new BadRequestException('Invalid day');

    const p = await this.ensure(userId);
    const row = await this.prisma.practiceDay.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, seconds },
      update: { seconds: { increment: seconds } },
    });
    if (row.seconds >= STUDY_SECONDS && row.seconds - seconds < STUDY_SECONDS) {
      const gap = p.lastDay ? daysBetween(p.lastDay, day) : null;
      if (gap === null || gap > 0) {
        const streak = gap === 1 ? p.streak + 1 : 1;
        await this.prisma.progress.update({
          where: { userId },
          data: { streak, longest: Math.max(p.longest, streak), lastDay: day },
        });
      }
    }
    return this.snapshot(userId);
  }

  async stats(userId: string) {
    const p = await this.ensure(userId);
    const [rows, agg, studiedDays, activeDays] = await Promise.all([
      this.prisma.practiceDay.findMany({ where: { userId }, orderBy: { day: 'desc' }, take: 400 }),
      this.prisma.practiceDay.aggregate({ where: { userId }, _sum: { seconds: true } }),
      this.prisma.practiceDay.count({ where: { userId, seconds: { gte: STUDY_SECONDS } } }),
      this.prisma.practiceDay.count({ where: { userId, seconds: { gt: 0 } } }),
    ]);
    const totalSeconds = agg._sum.seconds ?? 0;
    const facts: Facts = {
      messages: p.messages, longest: p.longest, totalSeconds, studiedDays,
      level: Math.floor(p.xp / XP_PER_LEVEL) + 1,
    };
    return {
      totalSeconds, studiedDays, activeDays,
      days: rows.reverse().map((r) => ({ day: r.day, seconds: r.seconds })),
      achievements: ACHIEVEMENTS.map((a) => ({
        id: a.id, name: a.name, description: a.description, unlocked: a.test(facts),
      })),
    };
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