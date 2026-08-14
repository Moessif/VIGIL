import { Injectable } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import { ScenariosService } from '../scenarios/scenarios.service';
import { ScorerService } from '../training/scorer.service';
import type {
  AbilityReport,
  AbilityScores,
  CaseDetail,
  RecordItem,
  TrendPoint,
} from '@police/shared';
import { DEFAULT_SCORES } from '@police/shared';

@Injectable()
export class LearningService {
  constructor(
    private readonly db: DbService,
    private readonly scenarios: ScenariosService,
    private readonly scorer: ScorerService,
  ) {}

  async caseDetail(userId: string, scenarioId: string): Promise<CaseDetail> {
    const scenario = this.scenarios.getForUser(userId, scenarioId);
    const script = this.scenarios.getScript(scenarioId);
    const endings = Object.entries(script.endings).map(([key, e]) => ({
      key,
      title: e.title,
      description: e.description,
    }));
    return {
      scenario,
      endings,
      attempts: scenario.attempts,
      bestScore: scenario.bestScore,
      history: this.getHistory(userId, scenarioId),
    };
  }

  listRecords(userId: string): RecordItem[] {
    const rows = this.db.all<Record<string, unknown>>(
      `SELECT s.id AS session_id, s.scenario_id, sc.title AS scenario_title, sc.fraud_type,
              s.ending, s.started_at, s.duration_sec,
              a.identity_check, a.fund_safety, a.privacy_protection, a.emergency_response
       FROM training_sessions s
       JOIN scenarios sc ON sc.id = s.scenario_id
       LEFT JOIN ability_scores a ON a.session_id = s.id
       WHERE s.user_id = ? AND s.status = 'ended'
       ORDER BY s.started_at DESC
       LIMIT 200`,
      userId,
    );
    const scenarioIds = rows.map((r) => String(r.scenario_id));
    const titles = this.endingTitles(scenarioIds);
    return rows.map((r) => {
      const scores = scoresFromRow(r);
      const ending = String(r.ending);
      return {
        sessionId: String(r.session_id),
        scenarioId: String(r.scenario_id),
        scenarioTitle: String(r.scenario_title),
        fraudType: String(r.fraud_type ?? ''),
        ending,
        endingTitle: titles[String(r.scenario_id)]?.[ending] ?? ending,
        score: this.scorer.comprehensive(scores),
        scores,
        durationSec: Number(r.duration_sec ?? 0),
        startedAt: Number(r.started_at),
      };
    });
  }

  getReport(userId: string): AbilityReport {
    const rows = this.db.all<Record<string, unknown>>(
      `SELECT s.ending, s.ended_at,
              a.identity_check, a.fund_safety, a.privacy_protection, a.emergency_response
       FROM training_sessions s
       LEFT JOIN ability_scores a ON a.session_id = s.id
       WHERE s.user_id = ? AND s.status = 'ended'
       ORDER BY s.ended_at ASC`,
      userId,
    );
    const totalSessions = rows.length;
    const defendedCount = rows.filter((r) => r.ending === 'defended').length;
    const successRate = totalSessions ? Math.round((defendedCount / totalSessions) * 100) : 0;

    const weekAgo = Date.now() - 7 * 86400 * 1000;
    const weeklyRows = rows.filter((r) => Number(r.ended_at ?? 0) >= weekAgo);
    const avgScores = this.average(rows);
    const weeklyScores = this.average(weeklyRows);

    const titles = this.endingTitles([]);
    const trend: TrendPoint[] = rows.map((r) => {
      const scores = scoresFromRow(r);
      const ending = String(r.ending);
      return {
        endedAt: Number(r.ended_at ?? 0),
        score: this.scorer.comprehensive(scores),
        ending,
        endingTitle: ending,
      };
    });

    const comprehensive = this.scorer.comprehensive(avgScores);
    const tier = this.scorer.tier(comprehensive);

    return {
      totalSessions,
      defendedCount,
      successRate,
      tier: tier.key,
      tierName: tier.name,
      avgScores,
      weeklyScores,
      trend,
    };
  }

  private getHistory(userId: string, scenarioId: string): TrendPoint[] {
    const rows = this.db.all<Record<string, unknown>>(
      `SELECT s.ended_at, s.ending,
              a.identity_check, a.fund_safety, a.privacy_protection, a.emergency_response
       FROM training_sessions s
       LEFT JOIN ability_scores a ON a.session_id = s.id
       WHERE s.user_id = ? AND s.scenario_id = ? AND s.status = 'ended'
       ORDER BY s.ended_at ASC`,
      userId,
      scenarioId,
    );
    const titles = this.endingTitles([scenarioId]);
    return rows.map((r) => {
      const scores = scoresFromRow(r);
      const ending = String(r.ending);
      return {
        endedAt: Number(r.ended_at ?? 0),
        score: this.scorer.comprehensive(scores),
        ending,
        endingTitle: titles[scenarioId]?.[ending] ?? ending,
      };
    });
  }

  private average(rows: Record<string, unknown>[]): AbilityScores {
    const cols = {
      identityCheck: 'identity_check',
      fundSafety: 'fund_safety',
      privacyProtection: 'privacy_protection',
      emergencyResponse: 'emergency_response',
    } as const;
    const out: AbilityScores = { ...DEFAULT_SCORES };
    (Object.keys(cols) as Array<keyof typeof cols>).forEach((d) => {
      const col = cols[d];
      const vals = rows
        .map((r) => r[col])
        .filter((v) => v != null)
        .map((v) => Number(v));
      if (vals.length) out[d] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    });
    return out;
  }

  private endingTitles(scenarioIds: string[]): Record<string, Record<string, string>> {
    const map: Record<string, Record<string, string>> = {};
    for (const sid of new Set(scenarioIds)) {
      try {
        const s = this.scenarios.getScript(sid);
        map[sid] = Object.fromEntries(
          Object.entries(s.endings).map(([k, e]) => [k, e.title]),
        );
      } catch {
        map[sid] = {};
      }
    }
    return map;
  }
}

function scoresFromRow(r: Record<string, unknown>): AbilityScores {
  const v = (x: unknown) => (x == null ? DEFAULT_SCORES.identityCheck : Number(x));
  return {
    identityCheck: v(r.identity_check),
    fundSafety: v(r.fund_safety),
    privacyProtection: v(r.privacy_protection),
    emergencyResponse: v(r.emergency_response),
  };
}
