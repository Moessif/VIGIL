<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

const props = defineProps<{ option: EChartsOption; height?: string }>();

const el = ref<HTMLDivElement>();
let chart: echarts.ECharts | null = null;

function resize() {
  chart?.resize();
}

onMounted(() => {
  if (!el.value) return;
  chart = echarts.init(el.value);
  chart.setOption(props.option);
  window.addEventListener('resize', resize);
});

watch(
  () => props.option,
  (o) => chart?.setOption(o, true),
  { deep: true },
);

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
  chart?.dispose();
});
</script>

<template>
  <div ref="el" :style="{ height: height || '300px', width: '100%' }" />
</template>
