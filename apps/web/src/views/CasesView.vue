<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { errMsg } from '../api/client';
import type { ScenarioSummary } from '@police/shared';

const router = useRouter();
const cases = ref<ScenarioSummary[]>([]);
const loading = ref(true);
const error = ref('');

const statusMap: Record<string, { label: string; cls: string }> = {
  not_started: { label: '未练过', cls: 'bg-slate-100 text-slate-600' },
  failed_retry: { label: '失败重来', cls: 'bg-red-100 text-red-600' },
  review: { label: '复习', cls: 'bg-emerald-100 text-emerald-600' },
  passed: { label: '已通关', cls: 'bg-emerald-100 text-emerald-600' },
};

async function load() {
  loading.value = true;
  error.value = '';
  try {
    cases.value = await api.cases.list();
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="max-w-6xl mx-auto p-6 space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">案例库</h1>
      <p class="text-sm text-slate-500 mt-1">查看所有训练情景、你的历史成绩与解锁结局</p>
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <div v-if="loading" class="py-20 text-center text-slate-400">加载中…</div>

    <div v-else class="grid md:grid-cols-2 gap-4">
      <div
        v-for="c in cases"
        :key="c.id"
        class="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="text-xs text-blue-600 font-medium">{{ c.fraudType }}</div>
            <button
              class="mt-1 text-left font-semibold text-lg text-slate-900 hover:text-blue-600"
              @click="router.push(`/cases/${c.id}`)"
            >
              {{ c.title }}
            </button>
          </div>
          <span
            class="shrink-0 text-xs px-2 py-0.5 rounded-full"
            :class="(statusMap[c.status] || statusMap.not_started).cls"
          >
            {{ (statusMap[c.status] || statusMap.not_started).label }}
          </span>
        </div>

        <div class="mt-3 flex items-center gap-4 text-sm text-slate-500">
          <span class="text-amber-500">{{ '★'.repeat(c.difficulty) }}{{ '☆'.repeat(5 - c.difficulty) }}</span>
          <span>约 {{ c.estMinutes }} 分钟</span>
        </div>

        <div class="mt-3 flex items-center gap-3 text-sm">
          <span v-if="c.bestScore != null" class="text-emerald-600 font-medium">最佳 {{ c.bestScore }} 分</span>
          <span v-else class="text-slate-400">尚未训练</span>
          <span class="text-slate-400">已解锁 {{ c.unlockedEndings.length }} 个结局</span>
        </div>

        <div class="mt-4 flex gap-3">
          <button
            class="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            @click="router.push(`/training/${c.id}`)"
          >
            开始训练
          </button>
          <button
            class="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
            @click="router.push(`/cases/${c.id}`)"
          >
            详情
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
