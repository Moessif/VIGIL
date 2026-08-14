import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { TrainingService } from './training.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

class StartDto {
  @IsString()
  scenarioId!: string;
}

class ReplyDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  optionId?: string;
}

class ActionDto {
  @IsString()
  trigger!: string;
}

class RealtimeResultDto {
  @IsString()
  transcript!: string;
}

class RealtimeIntentDto {
  @IsString()
  text!: string;
}

@Controller('training')
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  @Post('start')
  start(@CurrentUser() user: JwtPayload, @Body() dto: StartDto) {
    return this.training.start(user.sub, dto.scenarioId);
  }

  @Post(':id/reply')
  reply(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ReplyDto) {
    return this.training.reply(user.sub, id, dto);
  }

  @Post(':id/action')
  action(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ActionDto) {
    return this.training.action(user.sub, id, dto.trigger);
  }

  @Post(':id/realtime-result')
  realtimeResult(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: RealtimeResultDto) {
    return this.training.realtimeResult(user.sub, id, dto.transcript);
  }

  @Post('realtime-intent')
  realtimeIntent(@Body() dto: RealtimeIntentDto) {
    return this.training.classifyRealtimeIntent(dto.text);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.training.getSessionView(user.sub, id);
  }
}
