import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import type { AiProviderType, Role } from '@police/shared';

@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // AI 供应商
  @Get('providers')
  providers() {
    return this.admin.listProviders();
  }

  @Patch('providers/:id')
  updateProvider(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.admin.updateProvider(id, dto);
  }

  @Post('providers/:id/credential')
  setCredential(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('apiKey') apiKey: string,
  ) {
    return this.admin.setCredential(id, apiKey, user.sub);
  }

  @Post('providers/test')
  testConnection(@Body('type') type: AiProviderType) {
    return this.admin.testConnection(type);
  }

  // 用户
  @Get('users')
  users() {
    return this.admin.listUsers();
  }

  @Post('users/:id/reset-password')
  resetPassword(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('password') password: string,
  ) {
    return this.admin.resetPassword(id, password, user.sub);
  }

  @Patch('users/:id/role')
  setRole(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('role') role: Role,
  ) {
    return this.admin.setRole(id, role, user.sub);
  }

  @Delete('users/:id')
  deleteUser(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.admin.deleteUser(id, user.sub);
  }

  // 情景
  @Get('scenarios')
  scenarios() {
    return this.admin.listScenarios();
  }

  @Post('scenarios')
  createScenario(@CurrentUser() user: JwtPayload, @Body() dto: Record<string, unknown>) {
    return this.admin.createScenario(dto, user.sub);
  }

  @Patch('scenarios/:id')
  updateScenario(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.admin.updateScenario(id, dto, user.sub);
  }

  @Delete('scenarios/:id')
  deleteScenario(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.admin.deleteScenario(id, user.sub);
  }

  // 数据库
  @Get('db-stats')
  dbStats() {
    return this.admin.dbStats();
  }
}
