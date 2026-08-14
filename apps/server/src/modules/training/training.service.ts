import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DbService } from '../../db/db.service';
import { ScenariosService } from '../scenarios/scenarios.service';
import { AiService } from '../ai/ai.service';
import { ScorerService } from './scorer.service';
import type {
  AbilityScores,
  Beat,
  BeatOption,
  ChoiceOption,
  EndingResult,
  ScenarioScript,
  TrainingMessage,
} from '@police/shared';
import {
  ABILITY_DIMENSIONS,
  ABILITY_LABELS,
  DEFAULT_SCORES,
} from '@police/shared';

interface SessionRow {
  id: string;
  user_id: string;
  scenario_id: string;
  status: string;
  state_json: string;
  ending: string | null;
  scores_json: string | null;
  started_at: number;
  ended_at: number | null;
  duration_sec: number;
}

interface SessionState {
  currentBeatId: string | null;
  scores: AbilityScores;
  path: string[];
  choices: string[];
  ended: boolean;
  ending: string | null;
}

interface DecisionTrigger {
  key: string;
  label: string;
  danger: boolean;
}

interface TrainingTurn {
  messages: TrainingMessage[];
  options: ChoiceOption[];
  triggers: DecisionTrigger[];
  scores: AbilityScores;
  ended: boolean;
  ending?: EndingResult;
}

@Injectable()
export class TrainingService {
  constructor(
    private readonly db: DbService,
    private readonly scenarios: ScenariosService,
    private readonly ai: AiService,
    private readonly scorer: ScorerService,
  ) {}

  async start(userId: string, scenarioId: string) {
    const script = this.scenarios.getScript(scenarioId);
    const sessionId = randomUUID();
    const state: SessionState = {
      currentBeatId: null,
      scores: { ...DEFAULT_SCORES },
      path: [],
      choices: [],
      ended: false,
      ending: null,
    };
    const now = Date.now();
    this.db.run(
      'INSERT INTO training_sessions (id, user_id, scenario_id, status, state_json, started_at) VALUES (?,?,?,?,?,?)',
      sessionId, userId, scenarioId, 'active', JSON.stringify(state), now,
    );
    const sessionRow = this.getSession(sessionId, userId);

    const messages: TrainingMessage[] = [];
    const op = script.opening;
    const isSystemOp = op.speaker === 'system';
    messages.push(
      this.pushMessage(sessionId, {
        channel: isSystemOp ? 'system' : op.channel,
        role: 'ai',
        speaker: isSystemOp ? undefined : script.characters[op.speaker]?.name ?? op.speaker,
        content: op.content,
        meta: { opening: true },
      }),
    );

    if (script.beats.length > 0) {
      const first = script.beats[0];
      messages.push(await this.emitBeat(sessionId, script, first));
      state.currentBeatId = first.id;
      state.path.push(first.id);
      this.saveState(sessionId, state);
    }

    const turn = this.buildTurn(state, script, messages);
    return { sessionId, scenarioId, ...turn };
  }

  async reply(userId: string, sessionId: string, dto: { text?: string; optionId?: string }) {
    const sessionRow = this.getSession(sessionId, userId);
    const state = this.loadState(sessionRow);
    if (state.ended) throw new BadRequestException('该训练已结束，请查看复盘');
    const script = this.scenarios.getScript(sessionRow.scenario_id);
    const beat = this.currentBeat(state, script);
    const newMessages: TrainingMessage[] = [];

    if (dto.optionId != null) {
      const idx = Number(dto.optionId);
      const chosen = beat.options?.[idx];
      if (!chosen) throw new BadRequestException('选项无效');
      newMessages.push(this.pushMessage(sessionId, { channel: 'choice', role: 'user', content: chosen.label }));
      if (chosen.score) state.scores = this.scorer.apply(state.scores, chosen.score);
      state.choices.push(chosen.label);
      if (chosen.trigger) {
        return this.handleTrigger(userId, sessionRow, state, script, chosen.trigger, newMessages);
      }
      const nextId = chosen.next ?? beat.next;
      if (!nextId) return this.nudge(sessionRow, state, script, newMessages);
      return this.advance(userId, sessionRow, state, script, nextId, newMessages);
    } else if (dto.text?.trim()) {
      const text = dto.text.trim();
      newMessages.push(this.pushMessage(sessionId, { channel: 'text', role: 'user', content: text }));
      const cls = await this.classify(text, script, beat, state);
      if (cls.trigger) {
        return this.handleTrigger(userId, sessionRow, state, script, cls.trigger, newMessages);
      }
      if (cls.beatId) {
        // 用户主动要求打电话 → 进入语音电话节点
        return this.advance(userId, sessionRow, state, script, cls.beatId, newMessages);
      }
      const chosen = cls.optionIdx != null ? beat.options?.[cls.optionIdx] : undefined;
      if (chosen?.score) state.scores = this.scorer.apply(state.scores, chosen.score);
      if (chosen?.label) state.choices.push(chosen.label);
      const nextId = chosen?.next ?? beat.next;
      if (!nextId) return this.nudge(sessionRow, state, script, newMessages);
      return this.advance(userId, sessionRow, state, script, nextId, newMessages);
    }
    throw new BadRequestException('缺少回复内容');
  }

  /** 实时电话结束后：把通话转写交给主线 AI，决定后续剧情 */
  async realtimeResult(userId: string, sessionId: string, transcript: string) {
    const sessionRow = this.getSession(sessionId, userId);
    const state = this.loadState(sessionRow);
    if (state.ended) throw new BadRequestException('该训练已结束，请查看复盘');
    const script = this.scenarios.getScript(sessionRow.scenario_id);
    const beat = this.currentBeat(state, script);
    const newMessages: TrainingMessage[] = [
      this.pushMessage(sessionId, {
        channel: 'system',
        role: 'system',
        content: `【实时通话结束】\n${(transcript || '').trim() || '（通话无有效内容）'}`,
      }),
    ];

    const decision = await this.decideAfterCall(script, beat, transcript);
    if (decision.trigger) {
      return this.handleTrigger(userId, sessionRow, state, script, decision.trigger, newMessages);
    }
    const nextId = decision.beatId ?? beat.next;
    if (!nextId) return this.nudge(sessionRow, state, script, newMessages);
    return this.advance(userId, sessionRow, state, script, nextId, newMessages);
  }

  /** 实时通话中：快速识别用户一句话的意图（挂断等），使用 DeepSeek v4 Flash */
  async classifyRealtimeIntent(text: string): Promise<{ intent: string }> {
    if (this.ai.mode === 'real') {
      const r = await this.ai.directorChat(
        [
          {
            role: 'system',
            content:
              '判断用户这句话的意图，只输出 JSON：{"intent":"hangup|transfer|report|block|none"}。' +
              '用户想挂断/结束通话/再见/拜拜/先这样/不聊了 → hangup；同意转账/给钱/垫付 → transfer；报警/110 → report；拉黑/举报 → block；其他 → none。',
          },
          { role: 'user', content: text },
        ],
        { temperature: 0, json: true },
      );
      if (r) {
        try {
          const p = JSON.parse(r);
          if (p.intent) return { intent: p.intent };
        } catch {
          /* ignore */
        }
      }
    }
    // mock / 兜底：关键词
    if (/(挂了|挂吧|挂断|再见|拜拜|先这样|不聊了|不说了|结束|就这样|回头再)/.test(text)) {
      return { intent: 'hangup' };
    }
    if (/(转账|转钱|打钱|垫付|支付)/.test(text)) return { intent: 'transfer' };
    if (/(报警|110|警察|报案)/.test(text)) return { intent: 'report' };
    if (/(拉黑|举报|屏蔽)/.test(text)) return { intent: 'block' };
    return { intent: 'none' };
  }

  async action(userId: string, sessionId: string, triggerKey: string) {
    const sessionRow = this.getSession(sessionId, userId);
    const state = this.loadState(sessionRow);
    if (state.ended) throw new BadRequestException('该训练已结束，请查看复盘');
    const script = this.scenarios.getScript(sessionRow.scenario_id);
    const trigger = script.triggers[triggerKey];
    if (!trigger) throw new BadRequestException('无效操作');
    const newMessages: TrainingMessage[] = [
      this.pushMessage(sessionId, {
        channel: 'choice',
        role: 'user',
        content: trigger.label,
        meta: { trigger: triggerKey },
      }),
    ];
    return this.handleTrigger(userId, sessionRow, state, script, triggerKey, newMessages);
  }

  async getSessionView(userId: string, sessionId: string) {
    const sessionRow = this.getSession(sessionId, userId);
    const state = this.loadState(sessionRow);
    const script = this.scenarios.getScript(sessionRow.scenario_id);
    const messages = this.db
      .all<Record<string, unknown>>(
        'SELECT * FROM training_messages WHERE session_id = ? ORDER BY seq ASC',
        sessionId,
      )
      .map((r) => this.rowToMessage(r));
    const beat = this.currentBeatOrNull(state, script);
    return {
      sessionId,
      scenarioId: sessionRow.scenario_id,
      ended: state.ended,
      ending: state.ending,
      messages,
      options: beat ? this.buildOptions(beat) : [],
      triggers: this.buildTriggers(script),
      scores: state.scores,
    };
  }

  // ---------- 内部流程 ----------

  private async handleTrigger(
    userId: string,
    sessionRow: SessionRow,
    state: SessionState,
    script: ScenarioScript,
    triggerKey: string,
    newMessages: TrainingMessage[],
  ): Promise<TrainingTurn> {
    const trigger = script.triggers[triggerKey];
    state.choices.push(trigger.label);
    if (trigger.dimension && trigger.delta != null) {
      state.scores = this.scorer.apply(state.scores, { [trigger.dimension]: trigger.delta });
    }
    if (trigger.ending) {
      return this.finalize(userId, sessionRow, state, script, trigger.ending, newMessages);
    }
    newMessages.push(
      this.pushMessage(sessionRow.id, {
        channel: 'system',
        role: 'system',
        content: `已记录动作：${trigger.label}`,
      }),
    );
    this.saveState(sessionRow.id, state);
    return this.buildTurn(state, script, newMessages);
  }

  private async advance(
    userId: string,
    sessionRow: SessionRow,
    state: SessionState,
    script: ScenarioScript,
    nextId: string,
    newMessages: TrainingMessage[],
  ): Promise<TrainingTurn> {
    const nextBeat = script.beats.find((b) => b.id === nextId);
    if (!nextBeat) throw new BadRequestException(`剧本节点缺失: ${nextId}`);
    newMessages.push(await this.emitBeat(sessionRow.id, script, nextBeat));
    state.currentBeatId = nextBeat.id;
    state.path.push(nextBeat.id);
    this.saveState(sessionRow.id, state);
    return this.buildTurn(state, script, newMessages);
  }

  private nudge(
    sessionRow: SessionRow,
    state: SessionState,
    script: ScenarioScript,
    newMessages: TrainingMessage[],
  ): TrainingTurn {
    newMessages.push(
      this.pushMessage(sessionRow.id, {
        channel: 'system',
        role: 'system',
        content: '请选择上方操作继续。',
      }),
    );
    this.saveState(sessionRow.id, state);
    return this.buildTurn(state, script, newMessages);
  }

  private async finalize(
    userId: string,
    sessionRow: SessionRow,
    state: SessionState,
    script: ScenarioScript,
    endingKey: string,
    newMessages: TrainingMessage[],
  ): Promise<TrainingTurn> {
    const endingDef = script.endings[endingKey] ?? { title: '结束', description: '' };
    state.ended = true;
    state.ending = endingKey;
    const review = await this.buildReview(script, endingKey, state);
    newMessages.push(
      this.pushMessage(sessionRow.id, {
        channel: 'system',
        role: 'system',
        content: `【训练结束】${endingDef.title}\n\n${review}`,
      }),
    );

    const now = Date.now();
    this.db.run(
      `UPDATE training_sessions SET status=?, state_json=?, ending=?, scores_json=?, ended_at=?, duration_sec=?
       WHERE id=?`,
      'ended',
      JSON.stringify(state),
      endingKey,
      JSON.stringify(state.scores),
      now,
      Math.round((now - Number(sessionRow.started_at)) / 1000),
      sessionRow.id,
    );
    this.db.run(
      `INSERT INTO ability_scores
        (id, session_id, user_id, identity_check, fund_safety, privacy_protection, emergency_response, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      randomUUID(),
      sessionRow.id,
      userId,
      state.scores.identityCheck,
      state.scores.fundSafety,
      state.scores.privacyProtection,
      state.scores.emergencyResponse,
      now,
    );
    this.upsertStatus(userId, sessionRow.scenario_id, endingKey, state.scores, now);
    this.db.run(
      'INSERT INTO training_events (id, session_id, type, payload_json, created_at) VALUES (?,?,?,?,?)',
      randomUUID(), sessionRow.id, 'ending', JSON.stringify({ ending: endingKey }), now,
    );

    const delta: AbilityScores = {
      identityCheck: state.scores.identityCheck - DEFAULT_SCORES.identityCheck,
      fundSafety: state.scores.fundSafety - DEFAULT_SCORES.fundSafety,
      privacyProtection: state.scores.privacyProtection - DEFAULT_SCORES.privacyProtection,
      emergencyResponse: state.scores.emergencyResponse - DEFAULT_SCORES.emergencyResponse,
    };
    const ending: EndingResult = {
      ending: endingKey,
      endingTitle: endingDef.title,
      review,
      scores: state.scores,
      beforeScores: { ...DEFAULT_SCORES },
      delta,
    };
    return {
      messages: newMessages,
      options: [],
      triggers: [],
      scores: state.scores,
      ended: true,
      ending,
    };
  }

  private upsertStatus(
    userId: string,
    scenarioId: string,
    endingKey: string,
    scores: AbilityScores,
    now: number,
  ) {
    const existing = this.db.get<{ attempts: number; best_score: number | null; best_ending: string | null; unlocked_endings: string }>(
      'SELECT * FROM user_scenario_status WHERE user_id=? AND scenario_id=?',
      userId, scenarioId,
    );
    const comprehensive = this.scorer.comprehensive(scores);
    const unlocked = existing ? safeParseArray(existing.unlocked_endings) : [];
    if (!unlocked.includes(endingKey)) unlocked.push(endingKey);
    if (existing) {
      const bestScore = Math.max(Number(existing.best_score ?? 0), comprehensive);
      const bestEnding =
        existing.best_ending === 'defended' || endingKey === 'defended' ? 'defended' : existing.best_ending;
      this.db.run(
        `UPDATE user_scenario_status SET attempts=?, best_score=?, best_ending=?, unlocked_endings=?, last_played_at=?
         WHERE user_id=? AND scenario_id=?`,
        Number(existing.attempts) + 1, bestScore, bestEnding, JSON.stringify(unlocked), now, userId, scenarioId,
      );
    } else {
      this.db.run(
        `INSERT INTO user_scenario_status (user_id, scenario_id, attempts, best_score, best_ending, unlocked_endings, last_played_at)
         VALUES (?,?,?,?,?,?,?)`,
        userId, scenarioId, 1, comprehensive, endingKey, JSON.stringify(unlocked), now,
      );
    }
  }

  private async buildReview(script: ScenarioScript, endingKey: string, state: SessionState): Promise<string> {
    if (this.ai.mode === 'real') {
      const aiReview = await this.ai.chat(
        [
          {
            role: 'system',
            content:
              '你是反诈训练复盘教练，请用简洁中文输出一段 120 字以内的复盘点评，指出关键风险点或亮点，不要输出无关内容。',
          },
          {
            role: 'user',
            content: `情景：${script.title}；结局：${script.endings[endingKey]?.title ?? endingKey}；用户关键选择：${state.choices.join(' → ') || '无'}`,
          },
        ],
        { temperature: 0.6 },
      );
      if (aiReview) return aiReview;
    }
    const def = script.endings[endingKey];
    const abilityChange = ABILITY_DIMENSIONS.map(
      (d) => `${ABILITY_LABELS[d]} ${DEFAULT_SCORES[d]} → ${state.scores[d]}`,
    ).join('；');
    return [
      def?.description ?? '',
      `关键选择：${state.choices.length ? state.choices.join(' → ') : '未做关键选择'}`,
      `能力变化：${abilityChange}`,
    ].join('\n');
  }

  /** 主线 AI / 关键词决定：实时电话结束后的剧情走向 */
  private async decideAfterCall(
    script: ScenarioScript,
    beat: Beat,
    transcript: string,
  ): Promise<{ trigger?: string; beatId?: string }> {
    const t = transcript || '';
    if (this.ai.mode === 'real') {
      const aiResult = await this.ai.directorChat(
        [
          {
            role: 'system',
            content:
              '你是反诈情景训练的主线导演。根据用户在实时电话中的表现决定下一步剧情。' +
              `可用触发器：${JSON.stringify(Object.keys(script.triggers))}；可用节点：${JSON.stringify(script.beats.map((b) => b.id))}。` +
              '只输出 JSON：{"trigger":"<触发器名或空字符串>","beatId":"<节点id或空字符串>","summary":"一句话点评"}。' +
              '判定规则：用户报警/拉黑 → report 或 block；用户同意转账/泄露信息 → transfer 或 disclose；用户坚持核实身份 → 进入揭示真相的节点；拿不准就给最合理的节点。',
          },
          {
            role: 'user',
            content: `情景：${script.title}（${script.fraudType}）。当前节点可选项：${JSON.stringify(
              (beat.options ?? []).map((o) => ({ label: o.label, next: o.next, trigger: o.trigger })),
            )}。实时通话记录：${t}`,
          },
        ],
        { temperature: 0, json: true },
      );
      if (aiResult) {
        try {
          const p = JSON.parse(aiResult);
          if (p.trigger && script.triggers[p.trigger]) return { trigger: p.trigger };
          if (p.beatId && script.beats.some((b) => b.id === p.beatId)) return { beatId: p.beatId };
        } catch {
          /* ignore */
        }
      }
    }
    // mock / 兜底：关键词
    if (/(报警|110|警察|报案)/.test(t)) return { trigger: 'report' };
    if (/(拉黑|举报|屏蔽)/.test(t)) return { trigger: 'block' };
    if (/(转账|转钱|汇款|打钱|垫付|支付|卡号|验证码|屏幕共享)/.test(t)) {
      const victim = ['transfer', 'disclose'].find((k) => script.triggers[k]);
      if (victim) return { trigger: victim };
    }
    // 核实 / 默认：走当前节点的"安全"走向（第一个带 next 的选项）
    const safe = (beat.options ?? []).find((o) => o.next);
    if (safe?.next) return { beatId: safe.next };
    return { beatId: beat.next };
  }

  /** 自由文本 → 触发词 / 安全选项 / 语音电话节点（mock 规则 + real AI） */
  private async classify(
    text: string,
    script: ScenarioScript,
    beat: Beat,
    state: SessionState,
  ): Promise<{ trigger?: string; optionIdx?: number; beatId?: string }> {
    // 用户主动要求打电话/回拨 → 路由到尚未经历过的 voice_call 节点
    if (/(打电话|回拨|打给他|给他打|来电|视频通话|语音通话|打个电话|电话核实)/.test(text)) {
      const callBeat = script.beats.find((b) => b.channel === 'voice_call' && !state.path.includes(b.id));
      if (callBeat) return { beatId: callBeat.id };
    }
    const rules: Array<[string, RegExp]> = [
      ['transfer', /(转账|转钱|汇款|打钱|垫付|支付|转过去)/],
      ['disclose', /(卡号|银行卡|验证码|屏幕共享|身份证|密码)/],
      ['report', /(报警|110|警察|报案)/],
      ['block', /(拉黑|举报|屏蔽|挂断|拒绝)/],
    ];
    for (const [key, re] of rules) {
      if (script.triggers[key] && re.test(text)) return { trigger: key };
    }
    if (/(核实|验证|确认|视频|打给|电话|医院|工号|订单|官方|App|app|客服)/.test(text)) {
      const idx = (beat.options ?? []).findIndex((o) => /(核实|验证|官方|医院|订单|电话)/.test(o.label));
      if (idx >= 0) return { optionIdx: idx };
    }
    if (this.ai.mode === 'real') {
      const aiResult = await this.ai.directorChat(
        [
          {
            role: 'system',
            content:
              '你是反诈剧情引擎，把用户回复分类为 JSON：{"trigger":"transfer|disclose|report|block|none","option":"核实|其他|none"}。只输出 JSON。',
          },
          { role: 'user', content: text },
        ],
        { temperature: 0, json: true },
      );
      if (aiResult) {
        try {
          const parsed = JSON.parse(aiResult);
          if (parsed.trigger && script.triggers[parsed.trigger]) return { trigger: parsed.trigger };
          if (parsed.option && parsed.option !== 'none') {
            const idx = (beat.options ?? []).findIndex((o) => o.label.includes(parsed.option));
            if (idx >= 0) return { optionIdx: idx };
          }
        } catch {
          /* ignore */
        }
      }
    }
    return {};
  }

  private async emitBeat(sessionId: string, script: ScenarioScript, beat: Beat): Promise<TrainingMessage> {
    const isSystem = beat.speaker === 'system';
    const speaker = isSystem ? undefined : script.characters[beat.speaker]?.name ?? beat.speaker;
    const channel = isSystem ? 'system' : beat.channel;
    let assetUrl: string | undefined;
    if (beat.channel === 'image') {
      const img = await this.ai.generateImage(beat.imagePrompt || beat.content);
      assetUrl = img.dataUrl || img.url;
    } else if (beat.channel === 'voice') {
      // 普通语音消息：生成 TTS；voice_call（虚拟电话）由实时语音网关负责发声，不重复生成
      const voice = script.characters[beat.speaker]?.voice;
      const tts = await this.ai.synthesize(beat.content, voice);
      assetUrl = tts.dataUrl || tts.url;
    }
    return this.pushMessage(sessionId, {
      channel,
      role: 'ai',
      speaker,
      content: beat.content,
      assetUrl,
      meta: {
        beatId: beat.id,
        voiceParams: beat.voiceParams,
        persona: script.characters[beat.speaker]?.persona,
        voice: script.characters[beat.speaker]?.voice,
      },
    });
  }

  private buildOptions(beat: Beat): ChoiceOption[] {
    return (beat.options ?? []).map((o: BeatOption, i: number) => ({
      id: String(i),
      label: o.label,
      kind: (o.trigger as ChoiceOption['kind']) ?? 'normal',
    }));
  }

  private buildTriggers(script: ScenarioScript): DecisionTrigger[] {
    return Object.entries(script.triggers).map(([key, t]) => ({
      key,
      label: t.label,
      danger: t.ending === 'victim',
    }));
  }

  private buildTurn(state: SessionState, script: ScenarioScript, messages: TrainingMessage[]): TrainingTurn {
    const beat = this.currentBeatOrNull(state, script);
    return {
      messages,
      options: beat ? this.buildOptions(beat) : [],
      triggers: this.buildTriggers(script),
      scores: state.scores,
      ended: state.ended,
    };
  }

  private currentBeat(state: SessionState, script: ScenarioScript): Beat {
    const beat = this.currentBeatOrNull(state, script);
    if (!beat) throw new BadRequestException('当前状态异常，请重新开始');
    return beat;
  }

  private currentBeatOrNull(state: SessionState, script: ScenarioScript): Beat | undefined {
    if (!state.currentBeatId) return undefined;
    return script.beats.find((b) => b.id === state.currentBeatId);
  }

  private pushMessage(
    sessionId: string,
    p: {
      channel: TrainingMessage['channel'];
      role: TrainingMessage['role'];
      speaker?: string;
      content: string;
      assetUrl?: string;
      meta?: Record<string, unknown>;
    },
  ): TrainingMessage {
    const seq =
      (this.db.get<{ c: number }>(
        'SELECT COUNT(*) AS c FROM training_messages WHERE session_id = ?',
        sessionId,
      )?.c ?? 0) + 1;
    const id = randomUUID();
    const createdAt = Date.now();
    this.db.run(
      `INSERT INTO training_messages (id, session_id, seq, channel, role, speaker, content, asset_url, meta_json, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      id, sessionId, seq, p.channel, p.role, p.speaker ?? null, p.content, p.assetUrl ?? null,
      p.meta ? JSON.stringify(p.meta) : null, createdAt,
    );
    return {
      id, sessionId, seq, channel: p.channel, role: p.role, speaker: p.speaker,
      content: p.content, assetUrl: p.assetUrl, meta: p.meta, createdAt,
    };
  }

  private rowToMessage(r: Record<string, unknown>): TrainingMessage {
    return {
      id: String(r.id),
      sessionId: String(r.session_id),
      seq: Number(r.seq),
      channel: r.channel as TrainingMessage['channel'],
      role: r.role as TrainingMessage['role'],
      speaker: r.speaker ? String(r.speaker) : undefined,
      content: String(r.content ?? ''),
      assetUrl: r.asset_url ? String(r.asset_url) : undefined,
      meta: r.meta_json ? safeParseObject(String(r.meta_json)) : undefined,
      createdAt: Number(r.created_at),
    };
  }

  private getSession(id: string, userId: string): SessionRow {
    const r = this.db.get<SessionRow>(
      'SELECT * FROM training_sessions WHERE id = ? AND user_id = ?',
      id, userId,
    );
    if (!r) throw new NotFoundException('训练会话不存在');
    return r;
  }

  private loadState(sessionRow: SessionRow): SessionState {
    const raw = sessionRow.state_json ? safeParseObject(sessionRow.state_json) : {};
    return {
      currentBeatId: (raw.currentBeatId as string) ?? null,
      scores: (raw.scores as AbilityScores) ?? { ...DEFAULT_SCORES },
      path: Array.isArray(raw.path) ? (raw.path as string[]) : [],
      choices: Array.isArray(raw.choices) ? (raw.choices as string[]) : [],
      ended: !!raw.ended,
      ending: (raw.ending as string) ?? null,
    };
  }

  private saveState(sessionId: string, state: SessionState) {
    this.db.run('UPDATE training_sessions SET state_json = ? WHERE id = ?', JSON.stringify(state), sessionId);
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

function safeParseObject(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
