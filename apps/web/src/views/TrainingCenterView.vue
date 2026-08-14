<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { errMsg } from '../api/client';
import ScorePanel from '../components/ScorePanel.vue';
import type { AbilityReport, ScenarioSummary } from '@police/shared';

const router = useRouter();
const scenarios = ref<ScenarioSummary[]>([]);
const report = ref<AbilityReport | null>(null);
const loading = ref(true);
const error = ref('');

const statusMap: Record<string, { label: string; cls: string }> = {
  not_started: { label: '未练过', cls: 'bg-slate-100 text-slate-600' },
  failed_retry: { label: '失败重来', cls: 'bg-red-100 text-red-600' },
  review: { label: '复习', cls: 'bg-emerald-100 text-emerald-600' },
  passed: { label: '已通关', cls: 'bg-emerald-100 text-emerald-600' },
};

const recommended = computed<ScenarioSummary[]>(() => {
  if (!scenarios.value.length) return [];
  const unplayed = scenarios.value.filter((s) => s.status === 'not_started');
  const failed = scenarios.value.filter((s) => s.status === 'failed_retry');
  return [...failed, ...unplayed].slice(0, 3);
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [s, r] = await Promise.all([api.scenarios.list(), api.reports.get()]);
    scenarios.value = s;
    report.value = r;
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    loading.value = false;
  }
}

function open(id: string) {
  router.push(`/training/${id}`);
}

onMounted(load);
</script>

<template>
  <div class="max-w-6xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">训练中心</h1>
        <p class="text-sm text-slate-500 mt-1">选择情景，进入沉浸式反诈训练</p>
      </div>
      <button
        class="px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
        @click="load"
      >
        刷新
      </button>
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <div v-if="loading" class="py-20 text-center text-slate-400">加载中…</div>

    <template v-else>
      <!-- 本周能力 -->
      <section class="bg-white rounded-2xl p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-slate-900">本周能力</h2>
          <span class="text-xs text-slate-400">四维反诈能力画像</span>
        </div>
        <ScorePanel :scores="report?.weeklyScores ?? { identityCheck: 60, fundSafety: 60, privacyProtection: 60, emergencyResponse: 60 }" />
      </section>

      <!-- 推荐情景 -->
      <section v-if="recommended.length">
        <h2 class="text-lg font-semibold text-slate-900 mb-3">推荐情景</h2>
        <div class="grid md:grid-cols-3 gap-4">
          <button
            v-for="s in recommended"
            :key="s.id"
            class="text-left bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            @click="open(s.id)"
          >
            <div class="text-xs text-blue-200">{{ s.fraudType }}</div>
            <div class="mt-1 font-semibold text-lg leading-snug">{{ s.title }}</div>
            <div class="mt-3 text-xs text-blue-200">
              {{ '★'.repeat(s.difficulty) }}{{ '☆'.repeat(5 - s.difficulty) }} · 约 {{ s.estMinutes }} 分钟
            </div>
          </button>
        </div>
      </section>

      <!-- 情景列表 -->
      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-3">训练情景</h2>
        <div class="grid md:grid-cols-2 gap-4">
          <button
            v-for="s in scenarios"
            :key="s.id"
            class="flex items-center gap-4 bg-white rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
            @click="open(s.id)"
          >
            <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl">
              {{ s.id === 'scn_car_crash' ? '🚗' : s.id === 'scn_refund' ? '🛒' : '💸' }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-slate-900 truncate">{{ s.title }}</span>
                <span
                  class="shrink-0 text-xs px-2 py-0.5 rounded-full"
                  :class="(statusMap[s.status] || statusMap.not_started).cls"
                >
                  {{ (statusMap[s.status] || statusMap.not_started).label }}
                </span>
              </div>
              <div class="mt-1 text-sm text-slate-500 flex items-center gap-3">
                <span>{{ s.fraudType }}</span>
                <span class="text-amber-500">
                  {{ '★'.repeat(s.difficulty) }}{{ '☆'.repeat(5 - s.difficulty) }}
                </span>
                <span>约 {{ s.estMinutes }} 分钟</span>
              </div>
              <div v-if="s.bestScore != null" class="mt-1 text-xs text-emerald-600">
                历史最佳 {{ s.bestScore }} 分
              </div>
            </div>
            <div class="text-slate-300 text-xl">›</div>
          </button>
        </div>
      </section>
    </template>
  </div>
</template>
