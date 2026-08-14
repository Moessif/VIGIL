<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api';
import { errMsg } from '../api/client';
import { ABILITY_DIMENSIONS, ABILITY_LABELS } from '@police/shared';
import type { AbilityReport } from '@police/shared';
import type { EChartsOption } from 'echarts';
import EChart from '../components/EChart.vue';
import ScorePanel from '../components/ScorePanel.vue';

const report = ref<AbilityReport | null>(null);
const loading = ref(true);
const error = ref('');

const radarOption = computed<EChartsOption>(() => {
  const s = report.value?.avgScores;
  return {
    tooltip: {},
    radar: {
      indicator: ABILITY_DIMENSIONS.map((d) => ({ name: ABILITY_LABELS[d], max: 100 })),
      radius: '65%',
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: ABILITY_DIMENSIONS.map((d) => s?.[d] ?? 60),
            name: '能力画像',
            areaStyle: { color: 'rgba(29,78,216,0.25)' },
            lineStyle: { color: '#1d4ed8' },
            itemStyle: { color: '#1d4ed8' },
          },
        ],
      },
    ],
  };
});

const trendOption = computed<EChartsOption>(() => {
  const t = report.value?.trend ?? [];
  return {
    grid: { left: 40, right: 20, top: 30, bottom: 40 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: t.map((p) => new Date(p.endedAt).toLocaleDateString('zh-CN')) },
    yAxis: { type: 'value', min: 0, max: 100 },
    series: [
      {
        type: 'line',
        data: t.map((p) => ({
          value: p.score,
          itemStyle: { color: p.ending === 'defended' ? '#059669' : '#dc2626' },
        })),
        smooth: true,
        lineStyle: { color: '#1d4ed8' },
        areaStyle: { opacity: 0.12 },
      },
    ],
  };
});

const tierColor = computed(() => {
  const t = report.value?.tier;
  if (t === 'king' || t === 'diamond') return 'from-amber-500 to-yellow-400 text-white';
  if (t === 'platinum' || t === 'gold') return 'from-blue-500 to-indigo-500 text-white';
  return 'from-slate-500 to-slate-600 text-white';
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    report.value = await api.reports.get();
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
      <h1 class="text-2xl font-bold text-slate-900">能力报告</h1>
      <p class="text-sm text-slate-500 mt-1">你的反诈能力画像与成长趋势</p>
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <div v-if="loading" class="py-20 text-center text-slate-400">加载中…</div>

    <template v-else-if="report">
      <!-- 战绩卡片 -->
      <section class="grid sm:grid-cols-4 gap-4">
        <div class="bg-white rounded-2xl p-5 shadow-sm">
          <div class="text-xs text-slate-400">总训练次数</div>
          <div class="mt-1 text-3xl font-bold text-slate-900">{{ report.totalSessions }}</div>
        </div>
        <div class="bg-white rounded-2xl p-5 shadow-sm">
          <div class="text-xs text-slate-400">成功识破</div>
          <div class="mt-1 text-3xl font-bold text-emerald-600">{{ report.defendedCount }}</div>
        </div>
        <div class="bg-white rounded-2xl p-5 shadow-sm">
          <div class="text-xs text-slate-400">识破成功率</div>
          <div class="mt-1 text-3xl font-bold text-blue-600">{{ report.successRate }}%</div>
        </div>
        <div
          class="rounded-2xl p-5 shadow-sm bg-gradient-to-br"
          :class="tierColor"
        >
          <div class="text-xs opacity-80">能力段位</div>
          <div class="mt-1 text-3xl font-bold">{{ report.tierName }}</div>
        </div>
      </section>

      <!-- 雷达 + 本周 -->
      <section class="grid lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-2xl p-6 shadow-sm">
          <h2 class="font-semibold text-slate-900 mb-2">综合能力画像</h2>
          <EChart :option="radarOption" height="300px" />
        </div>
        <div class="bg-white rounded-2xl p-6 shadow-sm">
          <h2 class="font-semibold text-slate-900 mb-4">本周能力</h2>
          <ScorePanel :scores="report.weeklyScores" />
          <div class="mt-4 pt-4 border-t border-slate-100">
            <div class="text-xs text-slate-400 mb-2">历史平均</div>
            <ScorePanel :scores="report.avgScores" />
          </div>
        </div>
      </section>

      <!-- 趋势 -->
      <section class="bg-white rounded-2xl p-6 shadow-sm">
        <h2 class="font-semibold text-slate-900 mb-3">能力趋势</h2>
        <div v-if="report.trend.length">
          <EChart :option="trendOption" height="260px" />
        </div>
        <div v-else class="py-10 text-center text-slate-400">暂无训练数据，完成一次训练后查看趋势</div>
      </section>
    </template>
  </div>
</template>
