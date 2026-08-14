import { Controller, Get, Param } from '@nestjs/common';
import { ScenariosService } from './scenarios.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('scenarios')
export class ScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.scenarios.listForUser(user.sub);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.scenarios.getForUser(user.sub, id);
  }
}
