import { Module } from '@nestjs/common';
import { LearningService } from './learning.service';
import { CasesController } from './cases.controller';
import { ReportsController } from './reports.controller';
import { RecordsController } from './records.controller';
import { ScenariosModule } from '../scenarios/scenarios.module';
import { TrainingModule } from '../training/training.module';

@Module({
  imports: [ScenariosModule, TrainingModule],
  controllers: [CasesController, ReportsController, RecordsController],
  providers: [LearningService],
})
export class LearningModule {}
