<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import VChart from 'vue-echarts'
import { initECharts } from '@/plugins/echarts'
import { Card } from '@/components/ui/card'
import { getGitHubStats, type TopLanguage } from '@/api/github'

initECharts()

const languages = ref<TopLanguage[]>([])
const loading = ref(true)
const available = ref(true)

onMounted(async () => {
  try {
    const res = await getGitHubStats()
    if (res.success && !res.error) {
      languages.value = res.topLanguages
    } else {
      available.value = false
    }
  } catch {
    available.value = false
  }
  loading.value = false
})

// 环形饼图（去掉中心文字，纯图表）
const option = computed(() => {
  const data = languages.value.map((l) => ({
    name: l.name,
    value: l.stars,
    itemStyle: { color: l.color },
  }))
  return {
    tooltip: {
      formatter: '{b}: {c} stars ({d}%)',
      backgroundColor: 'rgba(28, 40, 51, 0.7)',
      borderWidth: 0,
      padding: [8, 12],
      textStyle: { color: '#fff', fontSize: 12 },
      // confine: true 让 tooltip 自动调整位置，避免超出图表容器被截断
      confine: true,
    },
    series: [
      {
        type: 'pie',
        roseType: 'area',
        radius: ['20%', '80%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        data,
        emphasis: {
          scale: true,
          scaleSize: 12,
          label: { show: false },
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
  <Card class="w-[clamp(200px,16vw,260px)] p-4">
    <h2 class="font-kai text-base font-medium tracking-wider text-brand-sky-deep mb-2">
      最近在鼓捣什么
    </h2>

    <div v-if="loading" class="relative flex items-center justify-center h-[160px]">
      <div class="w-20 h-20 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin" />
      <span class="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground/70 tracking-wide whitespace-nowrap">拉取 GitHub 数据中</span>
    </div>

    <template v-else-if="available">
      <div class="relative w-full h-[160px]">
        <VChart :option="option" autoresize style="height: 160px; width: 100%" />
      </div>

      <!-- 语言列表（仅名称，无 stars 数字） -->
      <div class="flex flex-wrap gap-1.5 mt-3 justify-center">
        <span
          v-for="lang in languages.slice(0, 6)"
          :key="lang.name"
          class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-foreground"
        >
          <span
            class="w-1.5 h-1.5 rounded-full"
            :style="{ background: lang.color }"
          />
          {{ lang.name }}
        </span>
      </div>
    </template>

    <div v-else class="flex items-center justify-center h-[160px] text-[11px] text-muted-foreground">
      GitHub 未配置
    </div>
  </Card>
</template>
