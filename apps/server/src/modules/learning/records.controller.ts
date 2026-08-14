import { Controller, Get } from '@nestjs/common';
import { LearningService } from './learning.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('records')
export class RecordsController {
  constructor(private readonly learning: LearningService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.learning.listRecords(user.sub);
  }
}
