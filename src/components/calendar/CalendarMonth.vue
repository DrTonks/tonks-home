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
const viewMonth = ref(today.getMonth())

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d
    .getDate()
    .toString()
    .padStart(2, '0')}`
}

const todayStr = computed(() => formatDateISO(today))
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
  <Card class="w-[clamp(240px,18vw,300px)] p-4">
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

    <CalendarGrid
      :year="viewYear"
      :month="viewMonth"
      :events="monthEvents"
      :holidays="monthHolidays"
      :today-str="todayStr"
      @select-date="openDayDialog"
    />

    <CalendarDayDialog
      v-model:open="showDayDialog"
      :date="selectedDate"
      :events="selectedDateEvents"
      :holidays="[]"
      @changed="loadMonth"
    />
  </Card>
</template>
