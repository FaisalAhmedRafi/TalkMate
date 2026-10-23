import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PhotoJudgeDto } from './photo.dto';
import { PhotoService } from './photo.service';

@UseGuards(AuthGuard)
@Controller('photo')
export class PhotoController {
  constructor(private readonly photo: PhotoService) {}

  /** The star grid with the learner's progress (Photo Mode home) */
  @Get('units') units(@Req() req: any) { return this.photo.units(req.user.id); }

  /** Judge the learner's description of one photo */
  @Post('judge') judge(@Req() req: any, @Body() dto: PhotoJudgeDto) { return this.photo.judge(req.user.id, dto); }
}
