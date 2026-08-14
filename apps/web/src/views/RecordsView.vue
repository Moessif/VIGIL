<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { errMsg } from '../api/client';
import type { RecordItem } from '@police/shared';

const router = useRouter();
const records = ref<RecordItem[]>([]);
const loading = ref(true);
const error = ref('');

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    records.value = await api.records.list();
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="max-w-5xl mx-auto p-6 space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">学习记录</h1>
      <p class="text-sm text-slate-500 mt-1">你的训练历史，点击可跳转对应案例详情</p>
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <div v-if="loading" class="py-20 text-center text-slate-400">加载中…</div>

    <div v-else-if="records.length" class="bg-white rounded-2xl shadow-sm divide-y divide-slate-100 overflow-hidden">
      <button
        v-for="r in records"
        :key="r.sessionId"
        class="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
        @click="router.push(`/cases/${r.scenarioId}`)"
      >
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
          :class="r.ending === 'defended' ? 'bg-emerald-50' : 'bg-red-50'"
        >
          {{ r.ending === 'defended' ? '🛡️' : '⚠️' }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-slate-900 truncate">{{ r.scenarioTitle }}</div>
          <div class="text-xs text-slate-400 mt-0.5">
            {{ fmtTime(r.startedAt) }} · 用时 {{ fmtDuration(r.durationSec) }}
          </div>
        </div>
        <div class="hidden sm:block text-sm text-slate-500">{{ r.fraudType }}</div>
        <div
          class="text-sm font-semibold shrink-0"
          :class="r.ending === 'defended' ? 'text-emerald-600' : 'text-red-600'"
        >
          {{ r.endingTitle }}
        </div>
        <div class="w-14 text-right font-bold text-slate-900 shrink-0">{{ r.score }}</div>
      </button>
    </div>

    <div v-else class="py-20 text-center text-slate-400">
      暂无学习记录，去训练中心开启第一次训练吧
    </div>
  </div>
</template>
