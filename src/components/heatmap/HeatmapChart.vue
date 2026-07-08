<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { AgentActivity } from '@/api/agent'
import type { ContributionDay } from '@/api/github'

type Mode = 'agent' | 'github'

const props = defineProps<{
  mode: Mode
  agentActivities: AgentActivity[]
  githubDays: ContributionDay[]
}>()

const colorScales: Record<Mode, string[]> = {
  agent: ['#ebedf0', '#C8E2F5', '#7CB9E8', '#4A95CC', '#1F6FA5'],
  github: ['#ebedf0', '#C5E2D5', '#8DC4B0', '#5FA888', '#3D8068'],
}

const option = computed(() => {
  const items =
    props.mode === 'agent'
      ? props.agentActivities.map((a) => ({ date: a.date, value: a.intensity }))
      : props.githubDays.map((d) => ({ date: d.date, value: d.level }))

  if (!items.length) return {}

  const data = items.map((it) => [it.date, it.value])
  const colors = colorScales[props.mode]

  // 日期范围
  const dates = items.map((i) => i.date).sort()
  const range: [string, string] = [dates[0], dates[dates.length - 1]]

  return {
    tooltip: {
      formatter: (p: { value: [string, number] }) => {
        if (!p.value || p.value[1] === 0) return ''
        return `${p.value[0]}<br/>活跃度 <b>${p.value[1]}</b>`
      },
      backgroundColor: 'rgba(26, 37, 48, 0.72)',
      borderWidth: 0,
      padding: [6, 10],
      textStyle: { color: '#fff', fontSize: 11 },
    },
    visualMap: {
      min: 0,
      max: 4,
      show: false,
      inRange: { color: ['#ebedf0', ...colors.slice(1)] },
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
        color: '#4C5863',
        firstDay: 1,
        margin: 4,
        interval: 1,
      },
      monthLabel: {
        show: true,
        fontSize: 9,
        color: '#4C5863',
        margin: 5,
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(255,255,255,0.3)',
          width: 1,
        },
      },
      itemStyle: {
        color: '#ebedf0',
        borderColor: 'rgba(255,255,255,0.4)',
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
