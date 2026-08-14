import { Injectable } from '@nestjs/common';
import {
  ABILITY_DIMENSIONS,
  AbilityDimension,
  AbilityScores,
} from '@police/shared';

@Injectable()
export class ScorerService {
  clamp(n: number): number {
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  apply(scores: AbilityScores, deltas: Partial<Record<AbilityDimension, number>>): AbilityScores {
    const out: AbilityScores = { ...scores };
    for (const d of ABILITY_DIMENSIONS) {
      const delta = deltas[d];
      if (delta != null) out[d] = this.clamp(out[d] + delta);
    }
    return out;
  }

  comprehensive(scores: AbilityScores): number {
    const sum = ABILITY_DIMENSIONS.reduce((acc, d) => acc + (scores[d] ?? 0), 0);
    return Math.round(sum / ABILITY_DIMENSIONS.length);
  }

  tier(score: number): { key: string; name: string } {
    if (score >= 90) return { key: 'king', name: '王者' };
    if (score >= 80) return { key: 'diamond', name: '钻石' };
    if (score >= 70) return { key: 'platinum', name: '铂金' };
    if (score >= 60) return { key: 'gold', name: '黄金' };
    if (score >= 50) return { key: 'silver', name: '白银' };
    return { key: 'bronze', name: '青铜' };
  }
}
