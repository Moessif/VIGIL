<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api';
import { errMsg } from '../api/client';
import type { AiProviderInfo, Role, ScenarioSummary, UserInfo } from '@police/shared';

type Tab = 'providers' | 'users' | 'scenarios' | 'db';

const tab = ref<Tab>('providers');
const loading = ref(false);
const error = ref('');
const notice = ref('');

// 供应商
const providers = ref<AiProviderInfo[]>([]);
// 用户
const users = ref<UserInfo[]>([]);
const roles: Role[] = ['student', 'teacher', 'admin'];
// 情景
const scenarios = ref<ScenarioSummary[]>([]);
const editingScenario = ref(false);
const scenarioForm = ref({ id: '', title: '', fraudType: '', difficulty: 2, estMinutes: 5, description: '', scriptJson: '' });
// 数据库
const dbStats = ref<{ table: string; count: number }[]>([]);

const tabs: { key: Tab; label: string }[] = [
  { key: 'providers', label: 'AI 供应商' },
  { key: 'users', label: '用户管理' },
  { key: 'scenarios', label: '情景管理' },
  { key: 'db', label: '数据库' },
];

const providerTypeLabels: Record<string, string> = {
  main_chat: '主线 AI',
  image: '图片生成',
  tts: '语音消息',
  realtime: '实时语音',
};

async function loadProviders() {
  loading.value = true;
  error.value = '';
  try {
    providers.value = await api.admin.providers();
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    loading.value = false;
  }
}

async function loadUsers() {
  loading.value = true;
  error.value = '';
  try {
    users.value = await api.admin.users();
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    loading.value = false;
  }
}

async function loadScenarios() {
  loading.value = true;
  error.value = '';
  try {
    scenarios.value = (await api.admin.scenarios()) as ScenarioSummary[];
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    loading.value = false;
  }
}

async function loadDbStats() {
  loading.value = true;
  error.value = '';
  try {
    dbStats.value = await api.admin.dbStats();
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    loading.value = false;
  }
}

function switchTab(t: Tab) {
  tab.value = t;
  if (t === 'providers') loadProviders();
  else if (t === 'users') loadUsers();
  else if (t === 'scenarios') loadScenarios();
  else loadDbStats();
}

async function updateProvider(p: AiProviderInfo) {
  error.value = '';
  try {
    await api.admin.updateProvider(p.id, { model: p.model, baseUrl: p.baseUrl });
    notice.value = `已保存供应商 ${p.name}`;
    setTimeout(() => (notice.value = ''), 2000);
  } catch (e) {
    error.value = errMsg(e);
  }
}

async function setCredential(p: AiProviderInfo) {
  const key = window.prompt(`请输入 ${p.name} 的 API Key：`);
  if (!key) return;
  try {
    await api.admin.setCredential(p.id, key);
    notice.value = `已更新 ${p.name} 密钥`;
    loadProviders();
    setTimeout(() => (notice.value = ''), 2000);
  } catch (e) {
    error.value = errMsg(e);
  }
}

async function testConnection(p: AiProviderInfo) {
  notice.value = '正在测试连接…';
  try {
    const r = await api.admin.testConnection(p.type);
    notice.value = r.message;
    setTimeout(() => (notice.value = ''), 3000);
  } catch (e) {
    error.value = errMsg(e);
  }
}

async function resetPassword(u: UserInfo) {
  const pwd = window.prompt(`为 ${u.username} 设置新密码（至少 6 位）：`);
  if (!pwd) return;
  try {
    await api.admin.resetPassword(u.id, pwd);
    notice.value = `已重置 ${u.username} 的密码`;
    setTimeout(() => (notice.value = ''), 2000);
  } catch (e) {
    error.value = errMsg(e);
  }
}

async function setRole(u: UserInfo) {
  try {
    await api.admin.setRole(u.id, u.role);
    notice.value = `已更新 ${u.username} 的权限`;
    loadUsers();
    setTimeout(() => (notice.value = ''), 2000);
  } catch (e) {
    error.value = errMsg(e);
  }
}

async function deleteUser(u: UserInfo) {
  if (!window.confirm(`确认删除用户 ${u.username}？`)) return;
  try {
    await api.admin.deleteUser(u.id);
    loadUsers();
  } catch (e) {
    error.value = errMsg(e);
  }
}

const DEFAULT_SCRIPT = JSON.stringify(
  {
    id: 'scn_new',
    title: '新情景',
    fraudType: '未知诈骗',
    difficulty: 2,
    estMinutes: 5,
    description: '情景描述',
    characters: { scammer: { name: '骗子', persona: '', voice: 'male_young' } },
    opening: { speaker: 'scammer', channel: 'text', content: '开场白' },
    beats: [
      {
        id: 'b1',
        speaker: 'scammer',
        channel: 'text',
        content: '话术…',
        options: [{ label: '识破并报警', trigger: 'report' }, { label: '上当', trigger: 'transfer' }],
      },
    ],
    endings: {
      victim: { title: '被骗', description: '' },
      defended: { title: '成功识破', description: '' },
    },
    triggers: {
      transfer: { label: '转账', ending: 'victim', dimension: 'fundSafety', delta: -60 },
      report: { label: '报警', ending: 'defended', dimension: 'emergencyResponse', delta: 40 },
      block: { label: '拉黑', ending: 'defended', dimension: 'emergencyResponse', delta: 30 },
    },
  },
  null,
  2,
);

function startCreate() {
  editingScenario.value = true;
  scenarioForm.value = {
    id: '',
    title: '',
    fraudType: '',
    difficulty: 2,
    estMinutes: 5,
    description: '',
    scriptJson: DEFAULT_SCRIPT,
  };
}

function startEdit(s: ScenarioSummary) {
  editingScenario.value = true;
  // 通过重新拉取脚本（简化：用列表数据 + 空脚本提示）
  scenarioForm.value = {
    id: s.id,
    title: s.title,
    fraudType: s.fraudType,
    difficulty: s.difficulty,
    estMinutes: s.estMinutes,
    description: s.description,
    scriptJson: '',
  };
}

async function saveScenario() {
  error.value = '';
  try {
    const base = {
      title: scenarioForm.value.title,
      fraudType: scenarioForm.value.fraudType,
      difficulty: Number(scenarioForm.value.difficulty),
      estMinutes: Number(scenarioForm.value.estMinutes),
      description: scenarioForm.value.description,
    };
    if (scenarioForm.value.id) {
      const body: Record<string, unknown> = { ...base };
      if (scenarioForm.value.scriptJson.trim()) {
        body.script = JSON.parse(scenarioForm.value.scriptJson);
      }
      await api.admin.updateScenario(scenarioForm.value.id, body);
    } else {
      const script = JSON.parse(scenarioForm.value.scriptJson || DEFAULT_SCRIPT);
      await api.admin.createScenario({ ...base, script });
    }
    editingScenario.value = false;
    loadScenarios();
    notice.value = '情景已保存';
    setTimeout(() => (notice.value = ''), 2000);
  } catch (e) {
    error.value = errMsg(e);
  }
}

async function deleteScenario(s: ScenarioSummary) {
  if (!window.confirm(`确认删除情景「${s.title}」？`)) return;
  try {
    await api.admin.deleteScenario(s.id);
    loadScenarios();
  } catch (e) {
    error.value = errMsg(e);
  }
}

async function toggleScenario(s: ScenarioSummary, status: 'published' | 'offline') {
  try {
    await api.admin.updateScenario(s.id, { status });
    loadScenarios();
  } catch (e) {
    error.value = errMsg(e);
  }
}

onMounted(() => loadProviders());
</script>

<template>
  <div class="max-w-6xl mx-auto p-6 space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">管理后台</h1>
      <p class="text-sm text-slate-500 mt-1">统一管理 AI 供应商、用户、训练情景与数据库</p>
    </div>

    <div class="flex gap-2 border-b border-slate-200">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
        :class="tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'"
        @click="switchTab(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <p v-if="notice" class="text-sm text-blue-600">{{ notice }}</p>
    <div v-if="loading" class="py-16 text-center text-slate-400">加载中…</div>

    <!-- AI 供应商 -->
    <template v-else-if="tab === 'providers'">
      <div class="grid gap-4">
        <div v-for="p in providers" :key="p.id" class="bg-white rounded-2xl p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-semibold text-slate-900">{{ p.name }}</div>
              <div class="text-xs text-slate-400 mt-0.5">
                {{ providerTypeLabels[p.type] }} · 密钥：{{ p.keyMask || '未配置' }}
                <span :class="p.connected ? 'text-emerald-600' : 'text-slate-400'">
                  {{ p.connected ? '● 已配置' : '● 未配置' }}
                </span>
              </div>
            </div>
            <div class="flex gap-2">
              <button class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50" @click="setCredential(p)">
                设置密钥
              </button>
              <button class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50" @click="testConnection(p)">
                测试连接
              </button>
            </div>
          </div>
          <div class="mt-3 grid sm:grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-slate-500">模型</label>
              <input v-model="p.model" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            </div>
            <div>
              <label class="text-xs text-slate-500">Base URL</label>
              <input v-model="p.baseUrl" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            </div>
          </div>
          <div class="mt-3 text-right">
            <button class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700" @click="updateProvider(p)">
              保存
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- 用户 -->
    <template v-else-if="tab === 'users'">
      <div class="bg-white rounded-2xl shadow-sm divide-y divide-slate-100 overflow-hidden">
        <div v-for="u in users" :key="u.id" class="flex items-center gap-4 px-5 py-3">
          <div class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-semibold text-slate-600">
            {{ u.username.slice(0, 1).toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-slate-900">{{ u.username }}</div>
            <div class="text-xs text-slate-400">{{ u.school || '未填写学校' }} · {{ u.education }}</div>
          </div>
          <select
            :value="u.role"
            class="px-2 py-1.5 rounded-lg border border-slate-200 text-sm bg-white"
            @change="u.role = ($event.target as HTMLSelectElement).value as Role; setRole(u)"
          >
            <option v-for="r in roles" :key="r" :value="r">{{ r === 'admin' ? '管理员' : r === 'teacher' ? '教师' : '学员' }}</option>
          </select>
          <button class="text-sm text-blue-600 hover:underline" @click="resetPassword(u)">重置密码</button>
          <button class="text-sm text-red-500 hover:underline" @click="deleteUser(u)">删除</button>
        </div>
      </div>
    </template>

    <!-- 情景 -->
    <template v-else-if="tab === 'scenarios'">
      <div class="flex justify-end">
        <button class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700" @click="startCreate">
          + 新建情景
        </button>
      </div>
      <div class="bg-white rounded-2xl shadow-sm divide-y divide-slate-100 overflow-hidden">
        <div v-for="s in scenarios" :key="s.id" class="flex items-center gap-4 px-5 py-3">
          <div class="flex-1 min-w-0">
            <div class="font-medium text-slate-900">{{ s.title }}</div>
            <div class="text-xs text-slate-400">
              {{ s.fraudType }} · 难度 {{ s.difficulty }} ·
              <span :class="s.status === 'published' ? 'text-emerald-600' : 'text-slate-400'">{{ s.status }}</span>
            </div>
          </div>
          <button v-if="s.status === 'published'" class="text-sm text-slate-500 hover:underline" @click="toggleScenario(s, 'offline')">下线</button>
          <button v-else class="text-sm text-emerald-600 hover:underline" @click="toggleScenario(s, 'published')">发布</button>
          <button class="text-sm text-blue-600 hover:underline" @click="startEdit(s)">编辑</button>
          <button class="text-sm text-red-500 hover:underline" @click="deleteScenario(s)">删除</button>
        </div>
      </div>
    </template>

    <!-- 数据库 -->
    <template v-else-if="tab === 'db'">
      <div class="bg-white rounded-2xl shadow-sm divide-y divide-slate-100 overflow-hidden">
        <div v-for="t in dbStats" :key="t.table" class="flex items-center justify-between px-5 py-3">
          <span class="font-mono text-sm text-slate-700">{{ t.table }}</span>
          <span class="font-semibold text-slate-900">{{ t.count }}</span>
        </div>
      </div>
    </template>

    <!-- 情景编辑弹窗 -->
    <div v-if="editingScenario" class="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-6">
      <div class="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-bold text-slate-900">{{ scenarioForm.id ? '编辑情景' : '新建情景' }}</h2>
        <div class="mt-4 grid sm:grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-slate-500">标题</label>
            <input v-model="scenarioForm.title" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
          <div>
            <label class="text-xs text-slate-500">诈骗类型</label>
            <input v-model="scenarioForm.fraudType" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
          <div>
            <label class="text-xs text-slate-500">难度 (1-5)</label>
            <input v-model.number="scenarioForm.difficulty" type="number" min="1" max="5" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
          <div>
            <label class="text-xs text-slate-500">预计时长（分钟）</label>
            <input v-model.number="scenarioForm.estMinutes" type="number" min="1" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
        </div>
        <div class="mt-3">
          <label class="text-xs text-slate-500">描述</label>
          <input v-model="scenarioForm.description" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
        </div>
        <div class="mt-3">
          <label class="text-xs text-slate-500">剧本 JSON（新建时必填，编辑留空则保持不变）</label>
          <textarea
            v-model="scenarioForm.scriptJson"
            rows="10"
            class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
          />
        </div>
        <div class="mt-4 flex gap-3">
          <button class="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700" @click="saveScenario">
            保存
          </button>
          <button class="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" @click="editingScenario = false">
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
