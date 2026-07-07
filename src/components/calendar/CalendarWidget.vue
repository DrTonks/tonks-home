<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useCalendarStore } from '@/stores/calendar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import CalendarGrid from './CalendarGrid.vue'
import CalendarDayDialog from './CalendarDayDialog.vue'

const store = useCalendarStore()

const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth()) // 0-11

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d
    .getDate()
    .toString()
    .padStart(2, '0')}`
}

const todayStr = computed(() => formatDateISO(today))
const todayWeekday = computed(
  () =>
    ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][today.getDay()],
)

const monthLabel = computed(() => `${viewYear.value}年${viewMonth.value + 1}月`)

const monthEvents = computed(() => {
  const ym = `${viewYear.value}-${(viewMonth.value + 1).toString().padStart(2, '0')}`
  return store.events.filter((e) => e.date.startsWith(ym))
})

const monthHolidays = computed(() => {
  const ym = `${viewYear.value}-${(viewMonth.value + 1).toString().padStart(2, '0')}`
  return [
    ...store.publicHolidays.filter((h) => h.date.startsWith(ym)),
    ...store.customHolidays.filter((h) => h.date.startsWith(ym)),
  ]
})

// 下个节日（从今天开始）
const nextHoliday = computed(() => {
  const all = [...store.publicHolidays, ...store.customHolidays]
    .filter((h) => h.date >= todayStr.value)
    .sort((a, b) => a.date.localeCompare(b.date))
  return all[0] || null
})

const daysToNextHoliday = computed(() => {
  if (!nextHoliday.value) return null
  const diff = Math.ceil(
    (new Date(nextHoliday.value.date).getTime() - today.getTime()) / 86400000,
  )
  return diff
})

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
}
function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
}

// 选中的日期（弹 Dialog）
const selectedDate = ref<string | null>(null)
const showDayDialog = ref(false)

function openDayDialog(dateStr: string) {
  selectedDate.value = dateStr
  showDayDialog.value = true
}

const selectedDateEvents = computed(() =>
  selectedDate.value ? store.events.filter((e) => e.date === selectedDate.value) : [],
)

async function loadMonth() {
  const ym = `${viewYear.value}-${(viewMonth.value + 1).toString().padStart(2, '0')}`
  await Promise.all([
    store.fetchEvents({ date: ym }),
    store.fetchHolidays(viewYear.value),
  ])
}

watch([viewYear, viewMonth], loadMonth)

onMounted(() => {
  loadMonth()
})
</script>

<template>
  <Card class="w-[clamp(280px,22vw,360px)] p-4">
    <!-- 今日卡 -->
    <div
      class="flex items-stretch gap-2 mb-4 rounded-md bg-muted/30 p-3 border border-border/40"
    >
      <div class="flex-1">
        <p class="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">
          {{ todayWeekday }}
        </p>
        <p class="text-base font-semibold text-foreground mt-0.5 tabular-nums">
          {{ today.getMonth() + 1 }}月{{ today.getDate() }}日
        </p>
      </div>
      <div
        v-if="nextHoliday"
        class="flex-1 text-right border-l border-border/40 pl-2 flex flex-col justify-center"
      >
        <p class="text-[10px] text-muted-foreground uppercase tracking-[0.15em] truncate">
          {{ nextHoliday.name }}
        </p>
        <p class="text-xs font-medium text-secondary-foreground mt-0.5 tabular-nums">
          {{
            daysToNextHoliday === 0
              ? '就在今天'
              : daysToNextHoliday === 1
                ? '明天'
                : `${daysToNextHoliday} 天后`
          }}
        </p>
      </div>
    </div>

    <!-- 月份导航 -->
    <div class="flex items-center justify-between mb-2">
      <p class="text-xs font-medium text-foreground tabular-nums">{{ monthLabel }}</p>
      <div class="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          class="h-7 w-7"
          aria-label="上一月"
          @click="prevMonth"
        >
          <ChevronLeft class="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          class="h-7 w-7"
          aria-label="下一月"
          @click="nextMonth"
        >
          <ChevronRight class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>

    <!-- 月视图 -->
    <CalendarGrid
      :year="viewYear"
      :month="viewMonth"
      :events="monthEvents"
      :holidays="monthHolidays"
      :today-str="todayStr"
      @select-date="openDayDialog"
    />

    <!-- 日期 Dialog -->
    <CalendarDayDialog
      v-model:open="showDayDialog"
      :date="selectedDate"
      :events="selectedDateEvents"
      @changed="loadMonth"
    />
  </Card>
</template>
