<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import VChart from 'vue-echarts'
import { initECharts } from '@/plugins/echarts'
import { Card } from '@/components/ui/card'
import { getGitHubStats, type TopLanguage } from '@/api/github'
import { useThemeStore } from '@/stores/theme'

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

const theme = useThemeStore()

// 颜色工具：解析 hex → [r,g,b]；mix 提亮(>0向白)/压暗(<0)；rgba 带透明
function parseHex(hex: string): [number, number, number] {
  let h = (hex || '#888888').replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix([r, g, b]: [number, number, number], ratio: number): string {
  const f = ratio < 0 ? 1 + ratio : 1
  const nr = ratio < 0 ? r * f : r + (255 - r) * ratio
  const ng = ratio < 0 ? g * f : g + (255 - g) * ratio
  const nb = ratio < 0 ? b * f : b + (255 - b) * ratio
  return `rgb(${Math.round(nr)}, ${Math.round(ng)}, ${Math.round(nb)})`
}
function rgba([r, g, b]: [number, number, number], a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// 发光渐变环玫瑰：扇区径向渐变(中心暗→边缘亮) + 深/白描边留缝 + 圆角 + 彩色辉光
const option = computed(() => {
  const dark = theme.isDark
  const data = languages.value.map((l) => {
    const c = parseHex(l.color)
    return {
      name: l.name,
      value: l.stars,
      itemStyle: {
        color: {
          type: 'radial',
          x: 0.5,
          y: 0.5,
          r: 0.85,
          colorStops: [
            { offset: 0, color: mix(c, dark ? -0.32 : 0) },
            { offset: 1, color: mix(c, dark ? 0.22 : 0.16) },
          ],
        },
        borderColor: dark ? 'rgba(8,14,24,0.55)' : '#ffffff',
        borderWidth: 2,
        borderRadius: 6,
        shadowBlur: dark ? 18 : 0,
        shadowColor: dark ? rgba(c, 0.5) : 'transparent',
      },
    }
  })
  return {
    tooltip: {
      formatter: '{b}: {c} stars ({d}%)',
      backgroundColor: dark ? 'rgba(10,16,26,0.9)' : 'rgba(28, 40, 51, 0.7)',
      borderWidth: 0,
      padding: [8, 12],
      textStyle: { color: '#fff', fontSize: 12 },
      confine: true,
    },
    series: [
      {
        type: 'pie',
        roseType: 'area',
        radius: ['30%', '80%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        data,
        emphasis: {
          scale: true,
          scaleSize: 10,
          itemStyle: {
            shadowBlur: dark ? 30 : 16,
            shadowColor: dark ? 'rgba(255,200,120,0.4)' : 'rgba(0,0,0,0.22)',
          },
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
