import { Injectable, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DbService } from '../../db/db.service';
import { SEED_SCENARIOS } from './seed.data';
import type { ScenarioScript, ScenarioStatus, ScenarioSummary } from '@police/shared';

export interface ScenarioRow {
  id: string;
  title: string;
  fraud_type: string;
  difficulty: number;
  est_minutes: number;
  description: string;
  script_json: string;
  status: string;
  version: number;
  created_at: number;
}

interface StatusRow {
  attempts: number;
  best_score: number | null;
  best_ending: string | null;
  unlocked_endings: string;
}

@Injectable()
export class ScenariosService implements OnApplicationBootstrap {
  constructor(private readonly db: DbService) {}

  onApplicationBootstrap() {
    this.seed();
  }

  seed() {
    for (const s of SEED_SCENARIOS) {
      const exists = this.db.get('SELECT id FROM scenarios WHERE id = ?', s.id);
      if (!exists) {
        this.db.run(
          `INSERT INTO scenarios
            (id, title, fraud_type, difficulty, est_minutes, description, script_json, status, version, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          s.id,
          s.title,
          s.fraudType,
          s.difficulty,
          s.estMinutes,
          s.description,
          JSON.stringify(s),
          'published',
          1,
          Date.now(),
        );
      } else {
        // 内置剧本内容更新时同步刷新（保留 status，避免覆盖管理员的上/下线状态）
        this.db.run(
          `UPDATE scenarios
             SET title=?, fraud_type=?, difficulty=?, est_minutes=?, description=?, script_json=?
           WHERE id=?`,
          s.title,
          s.fraudType,
          s.difficulty,
          s.estMinutes,
          s.description,
          JSON.stringify(s),
          s.id,
        );
      }
    }
  }

  listAll(): ScenarioRow[] {
    return this.db.all<ScenarioRow>('SELECT * FROM scenarios ORDER BY difficulty ASC, created_at ASC');
  }

  get(id: string): ScenarioRow {
    const r = this.db.get<ScenarioRow>('SELECT * FROM scenarios WHERE id = ?', id);
    if (!r) throw new NotFoundException('情景不存在');
    return r;
  }

  getScript(id: string): ScenarioScript {
    return JSON.parse(this.get(id).script_json) as ScenarioScript;
  }

  listForUser(userId: string): ScenarioSummary[] {
    return this.listAll()
      .filter((r) => r.status === 'published')
      .map((r) => this.toSummary(r, this.getStatus(userId, r.id)));
  }

  getForUser(userId: string, id: string): ScenarioSummary {
    const r = this.get(id);
    return this.toSummary(r, this.getStatus(userId, id));
  }

  create(dto: {
    title: string;
    fraudType: string;
    difficulty: number;
    estMinutes: number;
    description: string;
    script: ScenarioScript;
  }): ScenarioRow {
    const id = dto.script.id || `scn_${randomUUID().slice(0, 8)}`;
    const script: ScenarioScript = { ...dto.script, id };
    this.db.run(
      `INSERT INTO scenarios
        (id, title, fraud_type, difficulty, est_minutes, description, script_json, status, version, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      id,
      dto.title || script.title,
      dto.fraudType || script.fraudType,
      dto.difficulty ?? script.difficulty ?? 2,
      dto.estMinutes ?? script.estMinutes ?? 5,
      dto.description || script.description,
      JSON.stringify(script),
      'draft',
      1,
      Date.now(),
    );
    return this.get(id);
  }

  update(
    id: string,
    dto: {
      title?: string;
      fraudType?: string;
      difficulty?: number;
      estMinutes?: number;
      description?: string;
      script?: ScenarioScript;
      status?: 'draft' | 'published' | 'offline';
    },
  ): ScenarioRow {
    const existing = this.get(id);
    const script = dto.script ? JSON.stringify(dto.script) : existing.script_json;
    this.db.run(
      `UPDATE scenarios SET
        title = ?, fraud_type = ?, difficulty = ?, est_minutes = ?, description = ?,
        script_json = ?, status = ?, version = version + 1
       WHERE id = ?`,
      dto.title ?? existing.title,
      dto.fraudType ?? existing.fraud_type,
      dto.difficulty ?? existing.difficulty,
      dto.estMinutes ?? existing.est_minutes,
      dto.description ?? existing.description,
      script,
      dto.status ?? existing.status,
      id,
    );
    return this.get(id);
  }

  remove(id: string) {
    this.db.run('DELETE FROM scenarios WHERE id = ?', id);
    return { ok: true };
  }

  private getStatus(userId: string, scenarioId: string): StatusRow {
    const st = this.db.get<StatusRow>(
      'SELECT attempts, best_score, best_ending, unlocked_endings FROM user_scenario_status WHERE user_id = ? AND scenario_id = ?',
      userId,
      scenarioId,
    );
    return (
      st ?? {
        attempts: 0,
        best_score: null,
        best_ending: null,
        unlocked_endings: '[]',
      }
    );
  }

  private toSummary(r: ScenarioRow, st: StatusRow): ScenarioSummary {
    let status: ScenarioStatus = 'not_started';
    if (st.attempts > 0) {
      status = st.best_ending === 'defended' ? 'review' : 'failed_retry';
    }
    return {
      id: r.id,
      title: r.title,
      fraudType: r.fraud_type,
      difficulty: Number(r.difficulty),
      estMinutes: Number(r.est_minutes),
      description: r.description,
      status,
      bestScore: st.best_score == null ? null : Number(st.best_score),
      attempts: Number(st.attempts),
      unlockedEndings: safeParseArray(st.unlocked_endings),
    };
  }
}

function safeParseArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
