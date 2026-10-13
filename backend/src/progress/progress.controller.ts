import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PracticeDto, SettingsDto, TimeDto } from './progress.dto';
import { ProgressService } from './progress.service';

@UseGuards(AuthGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get() get(@Req() req: any) { return this.progress.snapshot(req.user.id); }
  @Get('stats') stats(@Req() req: any) { return this.progress.stats(req.user.id); }
  @Post('time') time(@Req() req: any, @Body() dto: TimeDto) { return this.progress.addTime(req.user.id, dto.seconds, dto.day); }
  @Post('practice') practice(@Req() req: any, @Body() dto: PracticeDto) { return this.progress.practice(req.user.id, dto.text); }
  @Patch('settings') settings(@Req() req: any, @Body() dto: SettingsDto) { return this.progress.settings(req.user.id, dto); }
  @Post('premium') premium(@Req() req: any) { return this.progress.unlockPremium(req.user.id); }
  @Post('gift') gift(@Req() req: any) { return this.progress.claimGift(req.user.id); }
}