import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PersonalizationDto, PlanDto } from './account.dto';
import { AccountService } from './account.service';

@UseGuards(AuthGuard)
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('personalization') personalization(@Req() req: any) { return this.account.personalization(req.user.id); }
  @Patch('personalization') savePersonalization(@Req() req: any, @Body() dto: PersonalizationDto) { return this.account.savePersonalization(req.user.id, dto); }
  @Get('referral') referral(@Req() req: any) { return this.account.referral(req.user.id); }
  @Get('subscription') subscription(@Req() req: any) { return this.account.subscription(req.user.id); }
  @Post('subscription/plan') plan(@Req() req: any, @Body() dto: PlanDto) { return this.account.changePlan(req.user.id, dto.months); }
  @Post('subscription/pause') pause(@Req() req: any) { return this.account.pause(req.user.id); }
  @Post('subscription/resume') resume(@Req() req: any) { return this.account.resume(req.user.id); }
  @Post('subscription/cancel') cancel(@Req() req: any) { return this.account.cancel(req.user.id); }
}
