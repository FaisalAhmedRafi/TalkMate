import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard, adminEmails, isAdminEmail } from './admin.guard';
import { AdminService } from './admin.service';

@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService, private readonly cfg: ConfigService) {}

  /** Any logged-in user may ask whether they are an admin (the Account menu uses it to show the link). */
  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return { admin: isAdminEmail(this.cfg, req.user.email), configured: adminEmails(this.cfg).length > 0 };
  }

  /** Counts per mode (+ the units to pick from in the forms) */
  @UseGuards(AdminGuard)
  @Get('overview')
  overview() { return this.admin.overview(); }

  /** The compact table of one mode: built-in and custom elements together */
  @UseGuards(AdminGuard)
  @Get('items')
  items(@Query('mode') mode: string) { return this.admin.rows(mode); }

  /** Add one element. Body: { mode, item } */
  @UseGuards(AdminGuard)
  @Post('items')
  create(@Req() req: any, @Body() body: { mode: string; item: unknown }) { return this.admin.create(body?.mode, body?.item, req.user.email); }

  /** Add many elements. Body: { mode, items: [...] } */
  @UseGuards(AdminGuard)
  @Post('import')
  import(@Req() req: any, @Body() body: { mode: string; items: unknown }) { return this.admin.import(body?.mode, body?.items, req.user.email); }

  /** One added element, shaped for the edit form */
  @UseGuards(AdminGuard)
  @Get('items/:mode/:id')
  one(@Param('mode') mode: string, @Param('id') id: string) { return this.admin.get(mode, id); }

  /** Change an element added from the panel (its id stays). Body: { item } */
  @UseGuards(AdminGuard)
  @Patch('items/:mode/:id')
  update(@Param('mode') mode: string, @Param('id') id: string, @Body() body: { item: unknown }) { return this.admin.update(mode, id, body?.item); }

  /** Delete an element added from the panel */
  @UseGuards(AdminGuard)
  @Delete('items/:mode/:id')
  remove(@Param('mode') mode: string, @Param('id') id: string) { return this.admin.remove(mode, id); }
}

/** For every learner (Learn tab): the added Word, Sentence and Dialogue elements that belong to a course. */
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('content')
export class ContentController {
  constructor(private readonly admin: AdminService) {}

  @UseGuards(AuthGuard)
  @Get('course-items')
  courseItems() { return this.admin.courseItems(); }
}
