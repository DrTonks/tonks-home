<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import type { CalendarEvent, Holiday } from '@/api/calendar'

const props = defineProps<{
  year: number
  month: number // 0-11
  events: CalendarEvent[]
  holidays: Holiday[]
  todayStr: string
}>()

const emit = defineEmits<{ 'select-date': [date: string] }>()

const weekdays = ['一', '二', '三', '四', '五', '六', '日']

interface DayCell {
  day: number | null
  date: string | null
}

const days = computed<DayCell[]>(() => {
  const firstDay = new Date(props.year, props.month, 1)
  const lastDay = new Date(props.year, props.month + 1, 0)
  // 周一为首：getDay()=0(周日)→6, 1(周一)→0, 2(周二)→1...
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6
  const totalDays = lastDay.getDate()

  const arr: DayCell[] = []
  for (let i = 0; i < startOffset; i++) arr.push({ day: null, date: null })
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${props.year}-${(props.month + 1).toString().padStart(2, '0')}-${d
      .toString()
      .padStart(2, '0')}`
    arr.push({ day: d, date: dateStr })
  }
  while (arr.length < 42) arr.push({ day: null, date: null })
  return arr
})

function isHoliday(date: string | null): boolean {
  if (!date) return false
  return props.holidays.some((h) => h.date === date)
}

function isToday(date: string | null): boolean {
  return date === props.todayStr
}

function getEvents(date: string | null): CalendarEvent[] {
  if (!date) return []
  return props.events.filter((e) => e.date === date)
}

function eventDotColor(type: string): string {
  if (type === 'work') return 'hsl(var(--color-sky))'           // 深天蓝
  if (type === 'personal') return 'hsl(var(--color-mint))'     // 鼠尾草绿
  if (type === 'holiday') return 'hsl(var(--color-amber))'      // 琥珀金
  return 'hsl(var(--muted-foreground))'
}
</script>

<template>
  <div>
    <!-- 周头（加深：foreground/80） -->
    <div class="grid grid-cols-7 mb-1.5">
      <div
        v-for="w in weekdays"
        :key="w"
        class="text-[11px] text-foreground/80 text-center py-1 font-semibold"
      >
        {{ w }}
      </div>
    </div>
    <!-- 格子 -->
    <div class="grid grid-cols-7 gap-1">
      <button
        v-for="(cell, idx) in days"
        :key="idx"
        :disabled="!cell.date"
        class="aspect-square relative flex items-center justify-center text-xs transition-all duration-fast rounded-md hover:bg-primary/15 disabled:pointer-events-none font-medium"
        :class="
          cn(
            cell.date && 'cursor-pointer',
            isToday(cell.date) &&
              'bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow-md ring-2 ring-primary/30',
            !isToday(cell.date) &&
              isHoliday(cell.date) &&
              'border-2 border-secondary text-secondary-foreground bg-secondary/10 font-semibold',
            !isToday(cell.date) &&
              !isHoliday(cell.date) &&
              cell.date &&
              'text-foreground hover:bg-primary/15 hover:text-primary',
          )
        "
        @click="cell.date && emit('select-date', cell.date)"
      >
        <span v-if="cell.day">{{ cell.day }}</span>
        <!-- 事件点（加大） -->
        <span
          v-if="cell.date && getEvents(cell.date).length > 0"
          class="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5"
        >
          <span
            v-for="(e, i) in getEvents(cell.date).slice(0, 3)"
            :key="i"
            class="w-1.5 h-1.5 rounded-full ring-1 ring-background/50"
            :style="{ background: isToday(cell.date) ? 'hsl(var(--primary-foreground))' : eventDotColor(e.type) }"
          />
        </span>
      </button>
    </div>
  </div>
</template>
