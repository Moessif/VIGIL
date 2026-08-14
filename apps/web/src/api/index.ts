import { http } from './client';
import type {
  AbilityReport,
  AbilityScores,
  AiProviderInfo,
  AiProviderType,
  AuthResponse,
  CaseDetail,
  ChoiceOption,
  Contact,
  EndingResult,
  RecordItem,
  Role,
  ScenarioSummary,
  TrainingMessage,
  UserInfo,
} from '@police/shared';

export interface TrainingTurn {
  messages: TrainingMessage[];
  options: ChoiceOption[];
  triggers: { key: string; label: string; danger: boolean }[];
  scores: AbilityScores;
  ended: boolean;
  ending?: EndingResult;
}

export interface TrainingStart extends TrainingTurn {
  sessionId: string;
  scenarioId: string;
  contacts: Contact[];
}

const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const api = {
  auth: {
    register: (body: { username: string; password: string; school?: string; education?: string }) =>
      d<AuthResponse>(http.post('/auth/register', body)),
    login: (body: { username: string; password: string }) =>
      d<AuthResponse>(http.post('/auth/login', body)),
    me: () => d<UserInfo>(http.get('/auth/me')),
  },
  scenarios: {
    list: () => d<ScenarioSummary[]>(http.get('/scenarios')),
    get: (id: string) => d<ScenarioSummary>(http.get(`/scenarios/${id}`)),
  },
  training: {
    start: (scenarioId: string) => d<TrainingStart>(http.post('/training/start', { scenarioId })),
    reply: (id: string, body: { text?: string; optionId?: string }) =>
      d<TrainingTurn>(http.post(`/training/${id}/reply`, body)),
    action: (id: string, trigger: string) =>
      d<TrainingTurn>(http.post(`/training/${id}/action`, { trigger })),
    realtimeResult: (id: string, transcript: string) =>
      d<TrainingTurn>(http.post(`/training/${id}/realtime-result`, { transcript })),
    realtimeIntent: (text: string) =>
      d<{ intent: string }>(http.post('/training/realtime-intent', { text })),
    get: (id: string) =>
      d<
        TrainingTurn & {
          sessionId: string;
          scenarioId: string;
          messages: TrainingMessage[];
        }
      >(http.get(`/training/${id}`)),
  },
  cases: {
    list: () => d<ScenarioSummary[]>(http.get('/cases')),
    detail: (id: string) => d<CaseDetail>(http.get(`/cases/${id}`)),
  },
  reports: {
    get: () => d<AbilityReport>(http.get('/reports')),
  },
  records: {
    list: () => d<RecordItem[]>(http.get('/records')),
  },
  admin: {
    providers: () => d<AiProviderInfo[]>(http.get('/admin/providers')),
    updateProvider: (id: string, body: Record<string, unknown>) =>
      d<AiProviderInfo>(http.patch(`/admin/providers/${id}`, body)),
    setCredential: (id: string, apiKey: string) =>
      d<{ ok: boolean; keyMask: string }>(http.post(`/admin/providers/${id}/credential`, { apiKey })),
    testConnection: (type: AiProviderType) =>
      d<{ ok: boolean; message: string }>(http.post('/admin/providers/test', { type })),
    users: () => d<UserInfo[]>(http.get('/admin/users')),
    resetPassword: (id: string, password: string) =>
      d<{ ok: boolean }>(http.post(`/admin/users/${id}/reset-password`, { password })),
    setRole: (id: string, role: Role) =>
      d<{ ok: boolean }>(http.patch(`/admin/users/${id}/role`, { role })),
    deleteUser: (id: string) => d<{ ok: boolean }>(http.delete(`/admin/users/${id}`)),
    scenarios: () => d<ScenarioSummary[]>(http.get('/admin/scenarios')),
    createScenario: (body: Record<string, unknown>) =>
      d<unknown>(http.post('/admin/scenarios', body)),
    updateScenario: (id: string, body: Record<string, unknown>) =>
      d<unknown>(http.patch(`/admin/scenarios/${id}`, body)),
    deleteScenario: (id: string) => d<{ ok: boolean }>(http.delete(`/admin/scenarios/${id}`)),
    dbStats: () => d<{ table: string; count: number }[]>(http.get('/admin/db-stats')),
  },
};
