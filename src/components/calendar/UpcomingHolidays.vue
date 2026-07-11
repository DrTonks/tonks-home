<script setup lang="ts">
import { ref, computed } from 'vue'
import { Calendar } from 'lucide-vue-next'
import { Card } from '@/components/ui/card'
import { getCalendarEvents, getHolidays, type CalendarEvent, type Holiday } from '@/api/calendar'

// 独立数据源，不依赖共享 store（避免被月视图切换覆盖）
const events = ref<CalendarEvent[]>([])
const holidays = ref<Holiday[]>([])

const today = new Date()
const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`

// 组件挂载时独立拉取
getCalendarEvents().then((r) => { if (r.success) events.value = r.events })
getHolidays(today.getFullYear()).then((r) => { if (r.success) holidays.value = r.publicHolidays })

interface Upcoming {
  name: string
  date: string
  color: string
  diffLabel: string
}

const upcoming = computed<Upcoming[]>(() => {
  const all: Upcoming[] = []
  for (const h of holidays.value) {
    if (h.date >= todayStr) {
      all.push({ name: h.name, date: h.date, color: 'hsl(var(--color-amber))', diffLabel: '' })
    }
  }
  for (const e of events.value) {
    if (e.date >= todayStr) {
      const c = e.type === 'work' ? 'hsl(var(--color-event-work))' : 'hsl(var(--color-mint))'
      all.push({ name: e.name, date: e.date, color: c, diffLabel: '' })
    }
  }
  return all
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
    .map((item) => {
      const diff = Math.ceil((new Date(item.date).getTime() - today.getTime()) / 86400000)
      return { ...item, diffLabel: diff === 0 ? '今天' : diff === 1 ? '明天' : `${diff}天后` }
    })
})
</script>

<template>
  <Card class="w-[clamp(180px,14vw,220px)] p-3">
    <p class="font-heavy text-[11px] text-brand-amber-deep tracking-[0.2em] mb-2 flex items-center gap-1">
      <Calendar class="h-3 w-3" />
      近期事项
    </p>
    <div class="space-y-1.5">
      <div v-for="h in upcoming" :key="h.date + h.name" class="flex items-center justify-between gap-2">
        <span class="flex items-center gap-1.5 text-xs text-foreground truncate">
          <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ background: h.color }" />
          {{ h.name }}
        </span>
        <span class="font-heavy text-[10px] text-brand-mint text-nowrap tabular-nums shrink-0">{{ h.diffLabel }}</span>
      </div>
      <div v-if="!upcoming.length" class="text-[11px] text-muted-foreground italic">
        暂无近期事项
      </div>
    </div>
  </Card>
</template>
