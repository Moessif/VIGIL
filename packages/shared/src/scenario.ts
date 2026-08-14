// 剧本 DSL 规范 —— 情景的"骨架/护栏"，主线 AI 在其约束内做动态编排

import type { AbilityDimension, MessageChannel } from './types';

export interface CharacterDef {
  name: string;
  persona: string;
  voice: string; // 语音角色 key
}

export interface BeatOption {
  label: string;
  next?: string; // 指向的 beat id
  trigger?: string; // 触发关键决策（transfer/report/block/verify）
  score?: Partial<Record<AbilityDimension, number>>;
  note?: string;
}

export interface VoiceParams {
  tone?: string; // 语气
  pauseMs?: number; // 停顿
  breath?: string; // 喘气
}

export interface Beat {
  id: string;
  speaker: string; // 角色 key
  channel: MessageChannel;
  content: string; // 台词 或 图片 prompt
  imagePrompt?: string;
  voiceParams?: VoiceParams;
  options?: BeatOption[];
  next?: string; // 默认下一 beat（自由输入或无选项时）
  allowFreeText?: boolean;
}

export interface EndingDef {
  title: string;
  description: string;
}

/** 通讯录联系人：通话中可在右侧面板选择拨打 */
export interface Contact {
  key: string;
  name: string; // 显示名，如 "市人民医院"
  description?: string; // 备注，如 "急诊科"
  persona: string; // 接听后该角色的设定（含重要事实）
  voice?: string; // 语义音色 key
  opening: string; // 接听后的开场白
  voiceParams?: VoiceParams;
}

export interface TriggerDef {
  label: string;
  ending?: string; // victim | defended
  dimension?: AbilityDimension;
  delta?: number;
}

export interface ScenarioScript {
  id: string;
  title: string;
  fraudType: string;
  difficulty: number;
  estMinutes: number;
  description: string;
  characters: Record<string, CharacterDef>;
  opening: { speaker: string; channel: MessageChannel; content: string };
  beats: Beat[];
  endings: Record<string, EndingDef>;
  triggers: Record<string, TriggerDef>;
  /** 可选：通话界面右侧的通讯录，用户可点选拨打 */
  contacts?: Contact[];
}
