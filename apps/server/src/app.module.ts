import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DbModule } from './db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ScenariosModule } from './modules/scenarios/scenarios.module';
import { AiModule } from './modules/ai/ai.module';
import { TrainingModule } from './modules/training/training.module';
import { LearningModule } from './modules/learning/learning.module';
import { AdminModule } from './modules/admin/admin.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    DbModule,
    UsersModule,
    AuthModule,
    ScenariosModule,
    AiModule,
    TrainingModule,
    LearningModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
