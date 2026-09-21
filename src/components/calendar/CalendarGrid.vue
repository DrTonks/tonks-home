<script setup lang="ts">
import { computed, ref } from 'vue'
import { cn } from '@/lib/utils'
import type { CalendarEvent, Holiday } from '@/api/calendar'
import { holidayRanges, getDayOfHoliday as dayInRange } from '@/lib/holidays'

const props = defineProps<{
  year: number
  month: number
  events: CalendarEvent[]
  holidays: Holiday[]
  workdays?: Holiday[]
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
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6
  const totalDays = lastDay.getDate()
  const arr: DayCell[] = []
  for (let i = 0; i < startOffset; i++) arr.push({ day: null, date: null })
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${props.year}-${(props.month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`
    arr.push({ day: d, date: dateStr })
  }
  while (arr.length < 42) arr.push({ day: null, date: null })
  return arr
})

const ranges = computed(() => holidayRanges(props.holidays))
const workdayMap = computed(() => new Map((props.workdays || []).map(d => [d.date, d])))
function getWorkday(date: string | null) { return date ? workdayMap.value.get(date) : undefined }
function getHolidayInfo(date: string | null) {
  if (!date) return null
  const range = ranges.value.find(r => date >= r.start && date <= r.end)
  return range ? {name:range.name, isFirst:date === range.start, isLast:date === range.end, isMiddle:date !== range.start && date !== range.end} : null
}

function isToday(date: string | null): boolean {
  return date === props.todayStr
}

function getEvents(date: string | null): CalendarEvent[] {
  if (!date) return []
  return props.events.filter((e) => e.date === date)
}

function eventDotColor(type: string): string {
  if (type === 'work') return 'hsl(var(--color-event-work))'
  if (type === 'personal') return 'hsl(var(--color-mint))'
  if (type === 'holiday') return 'hsl(var(--color-amber))'
  return 'hsl(var(--muted-foreground))'
}

// 浮窗
const hoverCell = ref<{ x: number; y: number; date: string; labels: string[] } | null>(null)
let hideTimer: ReturnType<typeof setTimeout> | null = null

function onCellEnter(e: MouseEvent, date: string | null) {
  if (!date) return
  const hi = getHolidayInfo(date)
  const evs = getEvents(date)
  const labels: string[] = []
  const workday = getWorkday(date)
  if (workday) labels.push(`${workday.name}调休上班`)
  if (hi) labels.push(hi.name + (hi.isFirst && hi.isLast ? '' : ` (第${getDayOfHoliday(date)}天)`))
  evs.forEach((e) => labels.push(e.name))
  if (!labels.length) return
  if (hideTimer) clearTimeout(hideTimer)
  const rect = (e.target as HTMLElement).getBoundingClientRect()
  hoverCell.value = { x: rect.left + rect.width / 2, y: rect.top - 6, date, labels }
}

function onCellLeave() {
  hideTimer = setTimeout(() => { hoverCell.value = null }, 150)
}

function getDayOfHoliday(date: string): number {
  const range = ranges.value.find(r => date >= r.start && date <= r.end)
  return range ? dayInRange(date, range) : 1
}
</script>

<template>
  <div class="relative">
    <!-- 浮窗 -->
    <Teleport to="body">
      <div
        v-if="hoverCell"
        class="fixed z-[100] pointer-events-none -translate-x-1/2 -translate-y-full"
        :style="{ left: `${hoverCell.x}px`, top: `${hoverCell.y}px` }"
      >
        <div class="bg-[#1A2530] dark:bg-[#26384a] text-white text-[11px] px-2 py-1.5 rounded-md shadow-lg whitespace-nowrap border border-white/10 dark:border-white/20 leading-relaxed">
          <div v-for="(l, i) in hoverCell.labels" :key="i">{{ l }}</div>
        </div>
      </div>
    </Teleport>

    <!-- 周头 -->
    <div class="grid grid-cols-7 mb-1.5">
      <div v-for="w in weekdays" :key="w" class="text-[11px] text-foreground/80 text-center py-1 font-semibold">
        {{ w }}
      </div>
    </div>
    <!-- 格子 -->
    <div class="grid grid-cols-7 gap-1">
      <button
        v-for="(cell, idx) in days"
        :key="idx"
        :disabled="!cell.date"
        :aria-label="cell.date ? `${cell.date}${getWorkday(cell.date) ? ' ' + getWorkday(cell.date)!.name + '调休上班' : getHolidayInfo(cell.date) ? ' ' + getHolidayInfo(cell.date)!.name + '休息' : ''}` : undefined"
        class="aspect-square relative flex items-center justify-center text-xs transition-all duration-fast rounded-md hover:bg-primary/15 disabled:pointer-events-none font-medium group"
        :class="
          cn(
            cell.date && 'cursor-pointer',
            isToday(cell.date) &&
              'bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow-md ring-2 ring-primary/30',
            !isToday(cell.date) && getHolidayInfo(cell.date) &&
              (() => {
                const hi = getHolidayInfo(cell.date)!
                if (hi.isFirst && hi.isLast) return 'border-2 border-secondary/50 bg-secondary/15 dark:bg-secondary/30 font-semibold'
                if (hi.isMiddle) return 'rounded-none bg-secondary/15 dark:bg-secondary/30 text-secondary-foreground font-semibold border-y-2 border-secondary/40 dark:border-secondary/70'
                if (hi.isFirst) return 'rounded-r-none bg-secondary/15 dark:bg-secondary/30 text-secondary-foreground font-semibold border-2 border-secondary/40 dark:border-secondary/70 border-r-0'
                if (hi.isLast) return 'rounded-l-none bg-secondary/15 dark:bg-secondary/30 text-secondary-foreground font-semibold border-2 border-secondary/40 dark:border-secondary/70 border-l-0'
                return 'border-2 border-secondary text-secondary-foreground bg-secondary/15 dark:bg-secondary/30 font-semibold'
              })(),
            !isToday(cell.date) && !getHolidayInfo(cell.date) && cell.date &&
              'text-foreground hover:bg-primary/15 hover:text-primary',
          )
        "
        @click="cell.date && emit('select-date', cell.date)"
        @mouseenter="(e) => onCellEnter(e, cell.date)"
        @mouseleave="onCellLeave"
      >
        <span v-if="cell.day">{{ cell.day }}</span>
        <span v-if="getWorkday(cell.date) || getHolidayInfo(cell.date)" class="absolute right-0.5 top-0 text-[8px] leading-tight" :class="getWorkday(cell.date) ? 'text-brand-sky' : 'text-brand-amber-deep'">{{ getWorkday(cell.date) ? '班' : '休' }}</span>
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
