<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { initECharts } from '@/plugins/echarts'
import { useThemeStore } from '@/stores/theme'
import type { AgentActivity } from '@/api/agent'
import type { ContributionDay } from '@/api/github'

initECharts()

type Mode = 'agent' | 'github'

const props = defineProps<{
  mode: Mode
  agentActivities: AgentActivity[]
  githubDays: ContributionDay[]
}>()

const theme = useThemeStore()

const LIGHT_SCALES: Record<Mode, string[]> = {
  agent: ['#ebedf0', '#C8E2F5', '#7CB9E8', '#4A95CC', '#1F6FA5'],
  github: ['#ebedf0', '#C5E2D5', '#8DC4B0', '#5FA888', '#3D8068'],
}
const DARK_SCALES: Record<Mode, string[]> = {
  agent: ['#1b2230', '#0e3a5c', '#1a5c8c', '#2f86c2', '#5aa8dd'],
  github: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
}

const option = computed(() => {
  const items =
    props.mode === 'agent'
      ? props.agentActivities.map((a) => ({ date: a.date, value: a.intensity }))
      : props.githubDays.map((d) => ({ date: d.date, value: d.level }))

  if (!items.length) return {}

  const dark = theme.isDark
  const data = items.map((it) => [it.date, it.value])
  const colors = (dark ? DARK_SCALES : LIGHT_SCALES)[props.mode]
  const emptyCell = dark ? '#3a4656' : '#ebedf0'
  const labelColor = dark ? '#9aa7b5' : '#4C5863'
  const gridColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.3)'
  const cellBorder = dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)'
  const tooltipBg = dark ? 'rgba(10,16,26,0.92)' : 'rgba(26, 37, 48, 0.72)'

  // 日期范围
  const dates = items.map((i) => i.date).sort()
  const range: [string, string] = [dates[0], dates[dates.length - 1]]

  return {
    tooltip: {
      formatter: (p: { value: [string, number] }) => {
        if (!p.value || p.value[1] === 0) return ''
        return `${p.value[0]}<br/>活跃度 <b>${p.value[1]}</b>`
      },
      backgroundColor: tooltipBg,
      borderWidth: 0,
      padding: [6, 10],
      textStyle: { color: '#fff', fontSize: 11 },
    },
    visualMap: {
      min: 0,
      max: 4,
      show: false,
      inRange: { color: [emptyCell, ...colors.slice(1)] },
    },
    calendar: {
      top: 22,
      left: 28,
      right: 5,
      bottom: 12,
      cellSize: ['auto', 11],
      range,
      dayLabel: {
        show: true,
        fontSize: 9,
        color: labelColor,
        firstDay: 1,
        margin: 4,
        interval: 1,
      },
      monthLabel: {
        show: true,
        fontSize: 9,
        color: labelColor,
        margin: 5,
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: gridColor,
          width: 1,
        },
      },
      itemStyle: {
        color: emptyCell,
        borderColor: cellBorder,
        borderWidth: 1,
        borderRadius: 3,
      },
      yearLabel: { show: false },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data,
        emphasis: {
          itemStyle: {
            borderColor: 'hsl(var(--foreground))',
            borderWidth: 1.5,
            shadowBlur: 8,
            shadowColor: 'rgba(0,0,0,0.3)',
          },
        },
      },
    ],
  }
})
</script>

<template>
  <div class="chart-reveal" style="width: 100%; height: 180px">
    <VChart :option="option" :loading="false" style="width: 100%; height: 100%" />
  </div>
</template>

<style scoped>
.chart-reveal {
  animation: reveal 1.2s cubic-bezier(0.4, 0, 0.2, 1) both;
}
@keyframes reveal {
  from {
    clip-path: inset(0 100% 0 0);
    opacity: 0.6;
  }
  to {
    clip-path: inset(0 0 0 0);
    opacity: 1;
  }
}
</style>
