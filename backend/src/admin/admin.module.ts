import { Module } from '@nestjs/common';
import { AdminController, ContentController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController, ContentController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
