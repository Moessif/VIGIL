<script setup lang="ts">
import { ABILITY_DIMENSIONS, ABILITY_LABELS } from '@police/shared';
import type { AbilityScores } from '@police/shared';

defineProps<{ scores: AbilityScores }>();

function color(v: number): string {
  if (v >= 80) return 'bg-emerald-500';
  if (v >= 60) return 'bg-blue-500';
  if (v >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}
</script>

<template>
  <div class="space-y-3">
    <div v-for="d in ABILITY_DIMENSIONS" :key="d" class="flex items-center gap-3">
      <span class="w-20 shrink-0 text-sm text-slate-600">{{ ABILITY_LABELS[d] }}</span>
      <div class="flex-1 h-2.5 rounded-full bg-slate-200 overflow-hidden">
        <div
          :class="color(scores[d])"
          class="h-full rounded-full transition-all duration-500"
          :style="{ width: scores[d] + '%' }"
        />
      </div>
      <span class="w-10 text-right text-sm font-semibold text-slate-700">{{ scores[d] }}</span>
    </div>
  </div>
</template>
