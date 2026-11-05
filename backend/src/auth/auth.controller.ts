import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ForgotPasswordDto, GoogleDto, LoginDto, RegisterDto, ResetPasswordDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } }) // slow down password guessing
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register') register(@Body() dto: RegisterDto) { return this.auth.register(dto); }
  @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto); }
  @Post('google') google(@Body() dto: GoogleDto) { return this.auth.google(dto); }
  @Throttle({ default: { limit: 3, ttl: 60_000 } }) // each call can send an email
  @Post('forgot-password') forgot(@Body() dto: ForgotPasswordDto) { return this.auth.forgotPassword(dto); }
  @Post('reset-password') reset(@Body() dto: ResetPasswordDto) { return this.auth.resetPassword(dto); }
}
