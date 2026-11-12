import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

const DAY = 86_400_000;
const DAYS = 30; // length of the sign-up chart

/**
 * Numbers for the Analytics tab of the Admin panel. "Today" is the admin's own calendar day: the browser sends its UTC
 * offset in minutes (`offset`, e.g. 360 for Dhaka), so a day starts and ends at the admin's midnight, not at UTC midnight.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(offsetRaw?: string) {
    const parsed = Number(offsetRaw);
    const offset = Number.isFinite(parsed) ? Math.max(-840, Math.min(840, Math.round(parsed))) : 0; // minutes ahead of UTC
    const shift = offset * 60_000;
    const now = Date.now();
    const todayStartMs = Math.floor((now + shift) / DAY) * DAY - shift; // the admin's local midnight, as a UTC instant
    const at = (daysAgo: number) => new Date(todayStartMs - daysAgo * DAY);
    const dayKey = (d: Date | number) => new Date(+d + shift).toISOString().slice(0, 10); // local YYYY-MM-DD
    const today = dayKey(now);
    const last7Keys = Array.from({ length: 7 }, (_, i) => dayKey(at(i)));

    const [total, signupsToday, signupsYesterday, signups7, signups30, recentRows, countryGroups, google, verified, noCountry,
      premium, activeSubs, referred, languages, levels, practiceToday, activeTodayRows, active7Rows] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: at(0) } } }),
      this.prisma.user.count({ where: { createdAt: { gte: at(1), lt: at(0) } } }),
      this.prisma.user.count({ where: { createdAt: { gte: at(6) } } }),
      this.prisma.user.count({ where: { createdAt: { gte: at(DAYS - 1) } } }),
      this.prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 12, select: { id: true, name: true, lastName: true, email: true, country: true, createdAt: true, emailVerified: true, googleId: true } }),
      this.prisma.user.groupBy({ by: ['country'], _count: { _all: true } }),
      this.prisma.user.count({ where: { googleId: { not: null } } }),
      this.prisma.user.count({ where: { emailVerified: true } }),
      this.prisma.user.count({ where: { country: null } }),
      this.prisma.progress.count({ where: { premium: true } }),
      this.prisma.subscription.count({ where: { status: 'active' } }),
      this.prisma.user.count({ where: { referredById: { not: null } } }),
      this.prisma.progress.groupBy({ by: ['language'], _count: { _all: true } }),
      this.prisma.progress.groupBy({ by: ['level'], _count: { _all: true } }),
      this.prisma.practiceDay.aggregate({ where: { day: today }, _sum: { seconds: true } }),
      this.prisma.practiceDay.findMany({ where: { day: today }, select: { userId: true } }),
      this.prisma.practiceDay.findMany({ where: { day: { in: last7Keys } }, select: { userId: true }, distinct: ['userId'] }),
    ]);

    // sign-ups of the last 30 days: one row per day, plus the country split of today / 7 days / 30 days
    const recent = await this.prisma.user.findMany({ where: { createdAt: { gte: at(DAYS - 1) } }, select: { createdAt: true, country: true } });
    const perDay = new Map<string, number>();
    const today7 = new Map<string, { today: number; last7: number; last30: number }>();
    for (const u of recent) {
      const k = dayKey(u.createdAt);
      perDay.set(k, (perDay.get(k) ?? 0) + 1);
      const c = u.country ?? '??';
      const e = today7.get(c) ?? { today: 0, last7: 0, last30: 0 };
      e.last30++;
      if (u.createdAt >= at(6)) e.last7++;
      if (u.createdAt >= at(0)) e.today++;
      today7.set(c, e);
    }
    const series = Array.from({ length: DAYS }, (_, i) => {
      const d = at(DAYS - 1 - i);
      const date = dayKey(d);
      return { date, count: perDay.get(date) ?? 0 };
    });

    const countries = countryGroups
      .map((g) => {
        const code = g.country ?? '??';
        return { code, total: g._count._all, ...(today7.get(code) ?? { today: 0, last7: 0, last30: 0 }) };
      })
      .sort((a, b) => b.total - a.total);

    const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
    return {
      generatedAt: new Date().toISOString(),
      today,
      totals: {
        users: total,
        signupsToday, signupsYesterday, signups7, signups30,
        avgPerDay30: Math.round((signups30 / DAYS) * 10) / 10,
        activeToday: new Set(activeTodayRows.map((r) => r.userId)).size,
        active7: active7Rows.length,
        practiceMinutesToday: Math.round((practiceToday._sum.seconds ?? 0) / 60),
        premium, activeSubscriptions: activeSubs, referred,
        verified, verifiedPct: pct(verified), google, googlePct: pct(google), noCountry,
        countriesCount: countries.filter((c) => c.code !== '??').length,
      },
      series,
      countries,
      languages: languages.map((l) => ({ label: l.language, count: l._count._all })).sort((a, b) => b.count - a.count),
      levels: levels.map((l) => ({ label: l.level, count: l._count._all })).sort((a, b) => b.count - a.count),
      recent: recentRows.map((u) => ({
        id: u.id,
        name: [u.name, u.lastName].filter(Boolean).join(' ') || '—',
        email: u.email,
        country: u.country,
        createdAt: u.createdAt.toISOString(),
        method: u.googleId ? 'Google' : 'Email',
        verified: u.emailVerified,
      })),
    };
  }
}
