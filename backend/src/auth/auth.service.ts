import { BadRequestException, ConflictException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.module';
import { ForgotPasswordDto, GoogleDto, LoginDto, RegisterDto, ResetPasswordDto } from './auth.dto';
import { MailService } from './mail.service';

const RESET_MINUTES = 60;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  private readonly log = new Logger('Auth');
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  // an unknown invite code is ignored, so a typo never blocks sign-up
  private async referrerId(code?: string) {
    if (!code) return null;
    const r = await this.prisma.user.findUnique({ where: { referralCode: code.toUpperCase() }, select: { id: true } });
    return r?.id ?? null;
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('An account with this email already exists.');
    }
    const referrer = await this.referrerId(dto.referralCode);
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name?.trim() || null,
        passwordHash: await bcrypt.hash(dto.password, 10),
        progress: { create: {} },
        referredBy: referrer ? { connect: { id: referrer } } : undefined,
      },
    });
    return this.session(user.id, user.email, dto.remember);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Same message for unknown email, wrong password and Google-only accounts (no password set).
    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return this.session(user.id, user.email, dto.remember);
  }

  // Google Identity Services gives the browser an ID token; we ask Google to validate it, then check it is ours.
  async google(dto: GoogleDto) {
    const g = await this.verifyGoogle(dto.credential);
    const email = String(g.email).trim().toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { googleId: g.sub } });
    if (!user) {
      // same email already registered: link it (safe because Google says the address is verified)
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await this.prisma.user.update({ where: { id: byEmail.id }, data: { googleId: g.sub } });
      } else {
        const referrer = await this.referrerId(dto.referralCode);
        user = await this.prisma.user.create({
          data: {
            email,
            googleId: g.sub,
            name: (g.given_name ?? g.name ?? '').toString().trim().slice(0, 60) || null,
            lastName: (g.family_name ?? '').toString().trim().slice(0, 60) || null,
            progress: { create: {} },
            referredBy: referrer ? { connect: { id: referrer } } : undefined,
          },
        });
      }
    }
    return this.session(user.id, user.email, dto.remember);
  }

  private async verifyGoogle(credential: string) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) throw new ServiceUnavailableException('GOOGLE_CLIENT_ID is not set on the server');
    let res: Response;
    try {
      res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(8000) });
    } catch {
      throw new ServiceUnavailableException("Couldn't reach Google. Please try again.");
    }
    const g: any = res.ok ? await res.json().catch(() => null) : null;
    const issuerOk = g && ['accounts.google.com', 'https://accounts.google.com'].includes(g.iss);
    const verified = g && (g.email_verified === true || g.email_verified === 'true');
    // tokeninfo already rejects expired or badly signed tokens; aud must be OUR client id
    if (!g || g.aud !== clientId || !issuerOk || !verified || !g.email || !g.sub) {
      throw new UnauthorizedException('Google sign-in failed. Please try again.');
    }
    return g as { sub: string; email: string; name?: string; given_name?: string; family_name?: string };
  }

  // Always answers { ok: true } so the form cannot be used to find out which emails have accounts.
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const token = randomBytes(32).toString('hex');
      await this.prisma.$transaction([
        this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }), // only the newest link works
        this.prisma.passwordResetToken.create({
          data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) },
        }),
      ]);
      const base = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');
      const link = `${base}/reset-password?token=${token}`;
      try {
        await this.mail.send(
          email,
          'Reset your TalkMate password',
          `Use this link to choose a new password (valid for ${RESET_MINUTES} minutes):\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
          `<p>Use this link to choose a new TalkMate password (valid for ${RESET_MINUTES} minutes):</p><p><a href="${link}">Reset my password</a></p><p>If you didn't ask for this, you can ignore this email.</p>`,
        );
      } catch (e) {
        this.log.error(`Could not send reset email: ${e instanceof Error ? e.message : e}`); // still answer ok (no enumeration)
      }
    }
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(dto.token) } });
    if (!row || row.expiresAt < new Date()) throw new BadRequestException('This reset link is invalid or has expired. Please request a new one.');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await bcrypt.hash(dto.password, 10) } }),
      this.prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } }), // single use
    ]);
    return { ok: true };
  }

  // "Remember this device" = a 30-day token; otherwise 1 day (the frontend also keeps it only for the browser session)
  private async session(id: string, email: string, remember?: boolean) {
    const token = await this.jwt.signAsync({ sub: id, email }, { expiresIn: remember ? '30d' : '1d' });
    return { token, user: { id, email } };
  }
}
