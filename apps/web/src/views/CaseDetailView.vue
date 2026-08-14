<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { errMsg } from '../api/client';
import EChart from '../components/EChart.vue';
import type { CaseDetail } from '@police/shared';
import type { EChartsOption } from 'echarts';

const route = useRoute();
const router = useRouter();
const id = String(route.params.id);

const detail = ref<CaseDetail | null>(null);
const loading = ref(true);
const error = ref('');

const chartOption = computed<EChartsOption>(() => {
  const h = detail.value?.history ?? [];
  return {
    grid: { left: 40, right: 20, top: 30, bottom: 40 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: h.map((p) => new Date(p.endedAt).toLocaleDateString('zh-CN')),
    },
    yAxis: { type: 'value', min: 0, max: 100 },
    series: [
      {
        type: 'line',
        data: h.map((p) => p.score),
        smooth: true,
        areaStyle: { opacity: 0.15 },
        lineStyle: { color: '#1d4ed8' },
        itemStyle: { color: '#1d4ed8' },
        markLine: {
          data: [{ type: 'average', name: '平均' }],
          label: { formatter: '平均 {c}' },
        },
      },
    ],
  };
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    detail.value = await api.cases.detail(id);
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
    <div class="flex items-center gap-3">
      <button
        class="w-9 h-9 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center justify-center"
        @click="router.push('/cases')"
      >
        ‹
      </button>
      <h1 class="text-2xl font-bold text-slate-900">{{ detail?.scenario.title || '案例详情' }}</h1>
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <div v-if="loading" class="py-20 text-center text-slate-400">加载中…</div>

    <template v-else-if="detail">
      <!-- 概览 -->
      <section class="bg-white rounded-2xl p-6 shadow-sm grid sm:grid-cols-4 gap-4">
        <div>
          <div class="text-xs text-slate-400">诈骗类型</div>
          <div class="mt-1 font-semibold text-slate-900">{{ detail.scenario.fraudType }}</div>
        </div>
        <div>
          <div class="text-xs text-slate-400">难度</div>
          <div class="mt-1 font-semibold text-amber-500">
            {{ '★'.repeat(detail.scenario.difficulty) }}{{ '☆'.repeat(5 - detail.scenario.difficulty) }}
          </div>
        </div>
        <div>
          <div class="text-xs text-slate-400">训练次数</div>
          <div class="mt-1 font-semibold text-slate-900">{{ detail.attempts }}</div>
        </div>
        <div>
          <div class="text-xs text-slate-400">历史最佳</div>
          <div class="mt-1 font-semibold text-emerald-600">
            {{ detail.bestScore != null ? detail.bestScore + ' 分' : '—' }}
          </div>
        </div>
      </section>

      <!-- 描述 -->
      <section class="bg-white rounded-2xl p-6 shadow-sm">
        <h2 class="font-semibold text-slate-900 mb-2">情景介绍</h2>
        <p class="text-sm text-slate-600">{{ detail.scenario.description }}</p>
      </section>

      <!-- 结局 -->
      <section class="bg-white rounded-2xl p-6 shadow-sm">
        <h2 class="font-semibold text-slate-900 mb-3">结局（{{ detail.scenario.unlockedEndings.length }}/{{ detail.endings.length }} 已解锁）</h2>
        <div class="grid sm:grid-cols-2 gap-3">
          <div
            v-for="e in detail.endings"
            :key="e.key"
            class="rounded-xl border p-4"
            :class="
              detail.scenario.unlockedEndings.includes(e.key)
                ? 'border-emerald-200 bg-emerald-50/50'
                : 'border-slate-200 opacity-60'
            "
          >
            <div class="flex items-center gap-2">
              <span>{{ detail.scenario.unlockedEndings.includes(e.key) ? '🔓' : '🔒' }}</span>
              <span class="font-semibold" :class="e.key === 'defended' ? 'text-emerald-600' : 'text-red-600'">
                {{ e.title }}
              </span>
            </div>
            <div class="mt-1 text-sm text-slate-500">{{ e.description }}</div>
          </div>
        </div>
      </section>

      <!-- 历史折线 -->
      <section class="bg-white rounded-2xl p-6 shadow-sm">
        <h2 class="font-semibold text-slate-900 mb-3">成绩趋势</h2>
        <div v-if="detail.history.length" class="text-sm text-slate-500 mb-2">
          最近 {{ detail.history.length }} 次训练 · 每次综合分
        </div>
        <div v-if="detail.history.length">
          <EChart :option="chartOption" height="260px" />
        </div>
        <div v-else class="py-10 text-center text-slate-400">暂无训练记录，快去练一练吧</div>
      </section>

      <button
        class="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
        @click="router.push(`/training/${id}`)"
      >
        {{ detail.attempts > 0 ? '再次训练' : '开始训练' }}
      </button>
    </template>
  </div>
</template>
