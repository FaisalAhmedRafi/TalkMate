import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

/** ADMIN_EMAILS is a comma-separated list of account emails that may open /admin. Empty = nobody. */
export function adminEmails(cfg: ConfigService): string[] {
  return (cfg.get<string>('ADMIN_EMAILS') ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}
export const isAdminEmail = (cfg: ConfigService, email?: string | null) => !!email && adminEmails(cfg).includes(email.trim().toLowerCase());

/** Same token check as AuthGuard, plus the account must be listed in ADMIN_EMAILS. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly cfg: ConfigService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Please log in.');
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
    if (!isAdminEmail(this.cfg, payload.email)) throw new ForbiddenException('This account is not an admin.');
    req.user = { id: payload.sub as string, email: payload.email as string };
    return true;
  }
}
