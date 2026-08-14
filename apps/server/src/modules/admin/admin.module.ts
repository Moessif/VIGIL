import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { UsersModule } from '../users/users.module';
import { ScenariosModule } from '../scenarios/scenarios.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [UsersModule, ScenariosModule, AiModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
