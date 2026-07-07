<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { TopLanguage } from '@/api/github'

const props = defineProps<{
  languages: TopLanguage[]
  totalContributions: number
}>()

const option = computed(() => {
  const data = props.languages.map((l) => ({
    name: l.name,
    value: l.stars,
    itemStyle: { color: l.color },
  }))
  return {
    tooltip: {
      formatter: '{b}: {c} stars ({d}%)',
      backgroundColor: 'rgba(28, 40, 51, 0.92)',
      borderWidth: 0,
      padding: [6, 10],
      textStyle: { color: '#fff', fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '88%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        data,
        emphasis: {
          scale: true,
          scaleSize: 6,
          label: {
            show: true,
            fontSize: 10,
            fontWeight: 'bold',
            color: 'hsl(var(--foreground))',
          },
        },
        animationType: 'scale',
        animationEasing: 'elasticOut',
        animationDelay: () => 80 + Math.random() * 80,
      },
    ],
  }
})
</script>

<template>
  <div class="flex items-center gap-3">
    <!-- 饼图 -->
    <div class="relative w-[72px] h-[72px] shrink-0">
      <VChart :option="option" autoresize style="height: 72px; width: 72px" />
      <div
        class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
      >
        <p class="text-xs font-bold text-foreground tabular-nums leading-none">
          {{ languages.length }}
        </p>
        <p class="text-[9px] text-muted-foreground mt-0.5">语言</p>
      </div>
    </div>

    <!-- 语言列表 -->
    <div class="flex-1 min-w-0 space-y-0.5">
      <div
        v-for="lang in languages.slice(0, 4)"
        :key="lang.name"
        class="flex items-center gap-1.5 text-[10px]"
      >
        <span
          class="w-1.5 h-1.5 rounded-full shrink-0"
          :style="{ background: lang.color }"
        />
        <span class="flex-1 truncate text-foreground">{{ lang.name }}</span>
      </div>
      <div
        v-if="!languages.length"
        class="text-[10px] text-muted-foreground/70 italic"
      >
        暂无数据
      </div>
    </div>

    <!-- 总贡献 -->
    <div class="text-right shrink-0 border-l border-border/40 pl-3">
      <p class="text-base font-bold text-foreground tabular-nums leading-none">
        {{ totalContributions.toLocaleString() }}
      </p>
      <p class="text-[9px] text-muted-foreground mt-1">总贡献</p>
    </div>
  </div>
</template>
