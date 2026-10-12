import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Please log in.');
    try {
      const payload = await this.jwt.verifyAsync(token);
      req.user = { id: payload.sub as string, email: payload.email as string };
      return true;
    } catch {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
  }
}
