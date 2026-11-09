import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { Resolver } from 'dns/promises';
import { PrismaService } from '../prisma/prisma.module';
import { ForgotPasswordDto, GoogleDto, LoginDto, RegisterDto, ResendVerificationDto, ResetPasswordDto, VerifyEmailDto } from './auth.dto';
import { MailService } from './mail.service';
import { COUNTRY_MESSAGE, normalizeCountry, normalizePhone, PHONE_MESSAGE } from './phone.rule';

const RESET_MINUTES = 60;
const CODE_MINUTES = 15; // how long an emailed verification code works
const RESEND_SECONDS = 60; // minimum gap between two codes for the same account
const MAX_CODE_TRIES = 5; // wrong guesses allowed per code
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

  // Rejects domains that cannot receive mail at all (example.com publishes a "no mail" record, typos like gmial.con do not exist).
  // A DNS timeout or other lookup failure is not held against the user: the emailed code is the real check.
  private async assertDeliverable(email: string) {
    const domain = email.split('@')[1];
    const dns = new Resolver({ timeout: 3000, tries: 2 });
    let mx: { exchange: string }[] = [];
    try {
      mx = await dns.resolveMx(domain);
    } catch (e: any) {
      if (e?.code !== 'ENOTFOUND' && e?.code !== 'ENODATA') return;
    }
    if (mx.some((r) => r.exchange && r.exchange !== '.')) return;
    if (mx.length === 0) {
      // no MX record at all: mail falls back to the domain's own address record
      try { if ((await dns.resolve4(domain)).length) return; } catch (e: any) { if (e?.code !== 'ENOTFOUND' && e?.code !== 'ENODATA') return; }
    }
    throw new BadRequestException("That email address can't receive mail. Please use a real email.");
  }

  private codeHash(userId: string, code: string) { return sha256(`${userId}:${code}`); }

  // Stores a fresh 6-digit code and emails it. Skips silently while the previous code is under RESEND_SECONDS old.
  private async sendVerification(userId: string, email: string) {
    const prev = await this.prisma.emailVerification.findUnique({ where: { userId } });
    if (prev && Date.now() - prev.sentAt.getTime() < RESEND_SECONDS * 1000) return;
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const data = { codeHash: this.codeHash(userId, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000), attempts: 0, sentAt: new Date() };
    await this.prisma.emailVerification.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    try {
      await this.mail.send(
        email,
        `${code} is your TalkMate verification code`,
        `Your TalkMate verification code is ${code}\n\nIt works for ${CODE_MINUTES} minutes. If you didn't try to sign up, you can ignore this email.`,
        `<p>Your TalkMate verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It works for ${CODE_MINUTES} minutes. If you didn't try to sign up, you can ignore this email.</p>`,
      );
    } catch (e) {
      this.log.error(`Could not send verification email: ${e instanceof Error ? e.message : e}`);
      await this.prisma.emailVerification.deleteMany({ where: { userId } }); // so the cooldown does not block a retry
      throw new ServiceUnavailableException("We couldn't send the verification email. Please check the address and try again.");
    }
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const country = normalizeCountry(dto.country);
    if (!country) throw new BadRequestException(COUNTRY_MESSAGE);
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new BadRequestException(PHONE_MESSAGE);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing?.emailVerified) throw new ConflictException('An account with this email already exists.');
    await this.assertDeliverable(email);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const names = { name: dto.firstName.trim(), lastName: dto.lastName.trim(), country, phone };
    // An earlier sign-up that was never verified (a typo, a fake address) owns nothing, so a new attempt takes it over.
    let user = existing;
    if (user) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { ...names, passwordHash } });
    } else {
      const referrer = await this.referrerId(dto.referralCode);
      user = await this.prisma.user.create({
        data: { email, ...names, passwordHash, progress: { create: {} }, referredBy: referrer ? { connect: { id: referrer } } : undefined },
      });
    }
    await this.sendVerification(user.id, email);
    return { verify: true, email }; // no session yet: the code in the email proves the address is real
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = dto.email.trim().toLowerCase();
    const wrong = new BadRequestException('That code is wrong or has expired. Request a new one.');
    const user = await this.prisma.user.findUnique({ where: { email }, include: { emailVerification: true } });
    const row = user?.emailVerification;
    if (!user || !row || row.expiresAt < new Date()) throw wrong;
    // count the guess first so parallel requests cannot get extra tries
    const tried = await this.prisma.emailVerification.update({ where: { userId: user.id }, data: { attempts: { increment: 1 } } });
    if (tried.attempts > MAX_CODE_TRIES) {
      await this.prisma.emailVerification.deleteMany({ where: { userId: user.id } });
      throw wrong;
    }
    const a = Buffer.from(this.codeHash(user.id, dto.code));
    const b = Buffer.from(row.codeHash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw wrong;
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } }),
      this.prisma.emailVerification.deleteMany({ where: { userId: user.id } }),
    ]);
    return this.session(user.id, user.email, dto.remember);
  }

  // Always answers { ok: true } so it cannot be used to find out which emails have accounts.
  async resendVerification(dto: ResendVerificationDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified && user.passwordHash) {
      try { await this.sendVerification(user.id, user.email); } catch { /* already logged */ }
    }
    return { ok: true };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Same message for unknown email, wrong password and Google-only accounts (no password set).
    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (!user.emailVerified) {
      // only said after the password was right, so it does not reveal which emails have accounts
      try { await this.sendVerification(user.id, user.email); } catch { /* already logged; the screen has a Resend button */ }
      throw new ForbiddenException({ message: 'Please verify your email first. We sent you a code.', code: 'EMAIL_NOT_VERIFIED' });
    }
    return this.session(user.id, user.email, dto.remember);
  }

  // Google Identity Services gives the browser an ID token; we ask Google to validate it, then check it is ours.
  async google(dto: GoogleDto) {
    const g = await this.verifyGoogle(dto.credential);
    const email = String(g.email).trim().toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { googleId: g.sub } });
    if (user && !user.emailVerified) user = await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    if (!user) {
      // same email already registered: link it (safe because Google says the address is verified)
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        // Google proves the address is theirs. If that account was never verified, whoever signed it up may not own the
        // address, so its password is dropped (they can set one through "Forgot your password?").
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId: g.sub, emailVerified: true, ...(byEmail.emailVerified ? {} : { passwordHash: null }) },
        });
      } else {
        const referrer = await this.referrerId(dto.referralCode);
        user = await this.prisma.user.create({
          data: {
            email,
            googleId: g.sub,
            emailVerified: true,
            name: (g.given_name ?? g.name ?? '').toString().trim().slice(0, 60) || null,
            lastName: (g.family_name ?? '').toString().trim().slice(0, 60) || null,
            progress: { create: {} },
            referredBy: referrer ? { connect: { id: referrer } } : undefined,
          },
        });
      }
    }
    // a Google sign-in without a country and phone number (a new Google account, or an older one) must add them before using the app
    const session = await this.session(user.id, user.email, dto.remember);
    return { ...session, needsDetails: !user.country || !user.phone };
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
      // the link was emailed to the address, so using it also proves the address is real
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await bcrypt.hash(dto.password, 10), emailVerified: true } }),
      this.prisma.emailVerification.deleteMany({ where: { userId: row.userId } }),
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
