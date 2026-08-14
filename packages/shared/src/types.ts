// 共享领域类型：前端与后端统一使用

export type Role = 'student' | 'teacher' | 'admin';

export interface UserInfo {
  id: string;
  username: string;
  school: string;
  education: string;
  role: Role;
  createdAt: number;
}

export type AbilityDimension =
  | 'identityCheck'
  | 'fundSafety'
  | 'privacyProtection'
  | 'emergencyResponse';

export interface AbilityScores {
  identityCheck: number; // 身份核验
  fundSafety: number; // 资金安全
  privacyProtection: number; // 隐私保护
  emergencyResponse: number; // 应急处置
}

export const ABILITY_LABELS: Record<AbilityDimension, string> = {
  identityCheck: '身份核验',
  fundSafety: '资金安全',
  privacyProtection: '隐私保护',
  emergencyResponse: '应急处置',
};

export const ABILITY_DIMENSIONS: AbilityDimension[] = [
  'identityCheck',
  'fundSafety',
  'privacyProtection',
  'emergencyResponse',
];

export const DEFAULT_SCORES: AbilityScores = {
  identityCheck: 60,
  fundSafety: 60,
  privacyProtection: 60,
  emergencyResponse: 60,
};

export type ScenarioStatus =
  | 'not_started'
  | 'in_progress'
  | 'failed_retry'
  | 'review'
  | 'passed';

export interface ScenarioSummary {
  id: string;
  title: string;
  fraudType: string;
  difficulty: number; // 1-5
  estMinutes: number;
  description: string;
  status: ScenarioStatus; // 相对当前用户
  bestScore: number | null;
  attempts: number;
  unlockedEndings: string[];
}

export type MessageChannel =
  | 'text'
  | 'image'
  | 'voice'
  | 'voice_call'
  | 'system'
  | 'choice';
export type MessageRole = 'ai' | 'user' | 'system';

export type ChoiceKind = 'normal' | 'transfer' | 'report' | 'block' | 'verify';

export interface ChoiceOption {
  id: string;
  label: string;
  kind: ChoiceKind;
}

export interface TrainingMessage {
  id: string;
  sessionId: string;
  seq: number;
  channel: MessageChannel;
  role: MessageRole;
  speaker?: string; // 角色显示名，如 "妈妈"
  content: string; // 文本内容 或 图片说明
  assetUrl?: string; // 图片/语音 URL 或 data URL
  meta?: Record<string, unknown>;
  options?: ChoiceOption[];
  createdAt: number;
}

export interface TrainingSessionStart {
  sessionId: string;
  scenarioId: string;
  messages: TrainingMessage[];
}

export interface EndingResult {
  ending: string; // victim | defended
  endingTitle: string;
  review: string;
  scores: AbilityScores;
  beforeScores: AbilityScores;
  delta: AbilityScores;
}

export interface RecordItem {
  sessionId: string;
  scenarioId: string;
  scenarioTitle: string;
  fraudType: string;
  ending: string;
  endingTitle: string;
  score: number; // 综合分 0-100
  scores: AbilityScores;
  durationSec: number;
  startedAt: number;
}

export interface TrendPoint {
  endedAt: number;
  score: number;
  ending: string;
  endingTitle: string;
}

export interface AbilityReport {
  totalSessions: number;
  defendedCount: number;
  successRate: number; // 0-100
  tier: string; // 段位 key
  tierName: string; // 段位名称
  avgScores: AbilityScores;
  weeklyScores: AbilityScores;
  trend: TrendPoint[];
}

export interface CaseDetail {
  scenario: ScenarioSummary;
  endings: { key: string; title: string; description: string }[];
  attempts: number;
  bestScore: number | null;
  history: TrendPoint[];
}

export type AiProviderType = 'main_chat' | 'image' | 'tts' | 'realtime';

export interface AiProviderInfo {
  id: string;
  name: string;
  type: AiProviderType;
  baseUrl: string;
  model: string;
  enabled: boolean;
  priority: number;
  keyMask: string;
  connected: boolean;
}

export type ScenarioLifecycleStatus = 'draft' | 'published' | 'offline';

export interface ScenarioAdmin {
  id: string;
  title: string;
  fraudType: string;
  difficulty: number;
  estMinutes: number;
  description: string;
  status: ScenarioLifecycleStatus;
  version: number;
  createdAt: number;
  script: unknown;
}

export interface AuthResponse {
  token: string;
  user: UserInfo;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}
