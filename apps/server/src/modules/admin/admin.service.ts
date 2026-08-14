import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { DbService } from '../../db/db.service';
import { UsersService } from '../users/users.service';
import { ScenariosService } from '../scenarios/scenarios.service';
import { AiConfigService } from '../ai/ai-config.service';
import { AiService } from '../ai/ai.service';
import type { AiProviderType, Role, ScenarioScript } from '@police/shared';

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DbService,
    private readonly users: UsersService,
    private readonly scenarios: ScenariosService,
    private readonly aiConfig: AiConfigService,
    private readonly ai: AiService,
  ) {}

  // ---------- AI 供应商 ----------
  listProviders() {
    return this.aiConfig.listProviders();
  }

  updateProvider(id: string, dto: Record<string, unknown>) {
    return this.aiConfig.setProvider(id, dto as never);
  }

  setCredential(providerId: string, apiKey: string, operatorId: string) {
    const result = this.aiConfig.setCredential(providerId, apiKey);
    this.audit(operatorId, 'set_credential', providerId);
    return result;
  }

  testConnection(type: AiProviderType) {
    return this.ai.testConnection(type);
  }

  // ---------- 用户 ----------
  listUsers() {
    return this.users.list();
  }

  resetPassword(userId: string, password: string, operatorId: string) {
    if (!password || password.length < 6) throw new BadRequestException('密码至少 6 位');
    this.users.resetPassword(userId, bcrypt.hashSync(password, 10));
    this.audit(operatorId, 'reset_password', userId);
    return { ok: true };
  }

  setRole(userId: string, role: Role, operatorId: string) {
    this.users.setRole(userId, role);
    this.audit(operatorId, 'set_role', userId, { role });
    return { ok: true };
  }

  deleteUser(userId: string, operatorId: string) {
    this.users.remove(userId);
    this.audit(operatorId, 'delete_user', userId);
    return { ok: true };
  }

  // ---------- 情景 ----------
  listScenarios() {
    return this.scenarios.listAll().map((r) => ({
      id: r.id,
      title: r.title,
      fraudType: r.fraud_type,
      difficulty: Number(r.difficulty),
      estMinutes: Number(r.est_minutes),
      description: r.description,
      status: r.status,
      version: Number(r.version),
      createdAt: Number(r.created_at),
      script: safeParse(r.script_json),
    }));
  }

  createScenario(dto: Record<string, unknown>, operatorId: string) {
    const result = this.scenarios.create(dto as never);
    this.audit(operatorId, 'create_scenario', result.id);
    return result;
  }

  updateScenario(id: string, dto: Record<string, unknown>, operatorId: string) {
    const result = this.scenarios.update(id, dto as never);
    this.audit(operatorId, 'update_scenario', id);
    return result;
  }

  deleteScenario(id: string, operatorId: string) {
    this.scenarios.remove(id);
    this.audit(operatorId, 'delete_scenario', id);
    return { ok: true };
  }

  // ---------- 数据库 ----------
  dbStats() {
    const tables = [
      'users',
      'scenarios',
      'training_sessions',
      'training_messages',
      'ability_scores',
      'user_scenario_status',
      'ai_providers',
      'ai_credentials',
      'audit_logs',
    ];
    return tables.map((t) => ({
      table: t,
      count: Number(this.db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM ${t}`)?.c ?? 0),
    }));
  }

  audit(operatorId: string, action: string, target: string, detail?: unknown) {
    this.db.run(
      'INSERT INTO audit_logs (id, operator_id, action, target, detail_json, created_at) VALUES (?,?,?,?,?,?)',
      randomUUID(),
      operatorId,
      action,
      target,
      detail ? JSON.stringify(detail) : null,
      Date.now(),
    );
  }
}

function safeParse(s: string): ScenarioScript | Record<string, never> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
