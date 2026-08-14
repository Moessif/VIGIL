import { Controller, Get } from '@nestjs/common';
import { LearningService } from './learning.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly learning: LearningService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.learning.getReport(user.sub);
  }
}
