import { Controller, Get, Param } from '@nestjs/common';
import { ScenariosService } from '../scenarios/scenarios.service';
import { LearningService } from './learning.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('cases')
export class CasesController {
  constructor(
    private readonly scenarios: ScenariosService,
    private readonly learning: LearningService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.scenarios.listForUser(user.sub);
  }

  @Get(':id')
  detail(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.learning.caseDetail(user.sub, id);
  }
}
