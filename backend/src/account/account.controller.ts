import { Body, Controller, Delete, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { AvatarDto, ContactDto, NotificationsDto, PasswordDto, PersonalizationDto, PlanDto, PrivacyDto, ProfileDto, SupportDto } from './account.dto';
import { AccountService } from './account.service';

@UseGuards(AuthGuard)
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('personalization') personalization(@Req() req: any) { return this.account.personalization(req.user.id); }
  @Patch('personalization') savePersonalization(@Req() req: any, @Body() dto: PersonalizationDto) { return this.account.savePersonalization(req.user.id, dto); }
  @Get('profile') profile(@Req() req: any) { return this.account.profile(req.user.id); }
  @Patch('profile') saveProfile(@Req() req: any, @Body() dto: ProfileDto) { return this.account.saveProfile(req.user.id, dto); }
  @Patch('contact') saveContact(@Req() req: any, @Body() dto: ContactDto) { return this.account.saveContact(req.user.id, dto); }
  @Patch('avatar') saveAvatar(@Req() req: any, @Body() dto: AvatarDto) { return this.account.saveAvatar(req.user.id, dto.image); }
  @Delete('avatar') removeAvatar(@Req() req: any) { return this.account.saveAvatar(req.user.id, null); }
  // slow down guessing of the current password
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password') password(@Req() req: any, @Body() dto: PasswordDto) { return this.account.changePassword(req.user.id, dto); }
  @Patch('notifications') notifications(@Req() req: any, @Body() dto: NotificationsDto) { return this.account.saveNotifications(req.user.id, dto); }
  @Patch('privacy') privacy(@Req() req: any, @Body() dto: PrivacyDto) { return this.account.savePrivacy(req.user.id, dto); }
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('support') support(@Req() req: any, @Body() dto: SupportDto) { return this.account.sendSupport(req.user.id, dto); }
  @Delete() remove(@Req() req: any) { return this.account.deleteAccount(req.user.id); }
  @Get('referral') referral(@Req() req: any) { return this.account.referral(req.user.id); }
  @Get('subscription') subscription(@Req() req: any) { return this.account.subscription(req.user.id); }
  @Post('subscription/plan') plan(@Req() req: any, @Body() dto: PlanDto) { return this.account.changePlan(req.user.id, dto.months); }
  @Post('subscription/pause') pause(@Req() req: any) { return this.account.pause(req.user.id); }
  @Post('subscription/resume') resume(@Req() req: any) { return this.account.resume(req.user.id); }
  @Post('subscription/cancel') cancel(@Req() req: any) { return this.account.cancel(req.user.id); }
}
