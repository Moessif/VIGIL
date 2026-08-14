import { Module } from '@nestjs/common';
import { TrainingService } from './training.service';
import { TrainingController } from './training.controller';
import { ScorerService } from './scorer.service';
import { ScenariosModule } from '../scenarios/scenarios.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [ScenariosModule, AiModule],
  controllers: [TrainingController],
  providers: [TrainingService, ScorerService],
  exports: [ScorerService],
})
export class TrainingModule {}
