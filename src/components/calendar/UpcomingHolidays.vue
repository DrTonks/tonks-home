<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Calendar } from 'lucide-vue-next'
import { useCalendarStore } from '@/stores/calendar'
import { Card } from '@/components/ui/card'

const store = useCalendarStore()

const today = new Date()
const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1)
  .toString()
  .padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`

onMounted(async () => {
  await store.fetchHolidays(today.getFullYear())
})

const upcoming = computed(() => {
  const all = [...store.publicHolidays, ...store.customHolidays]
    .filter((h) => h.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
  return all.map((h) => {
    const diff = Math.ceil(
      (new Date(h.date).getTime() - today.getTime()) / 86400000,
    )
    return {
      name: h.name,
      date: h.date,
      diff: diff === 0 ? '今天' : diff === 1 ? '明天' : `${diff} 天后`,
      diffLabel: diff === 0 ? '今天' : diff === 1 ? '明天' : `${diff}天后`,
    }
  })
})
</script>

<template>
  <Card class="w-[clamp(180px,14vw,220px)] p-3">
    <p class="font-heavy text-[11px] text-brand-amber-deep tracking-[0.2em] mb-2 flex items-center gap-1">
      <Calendar class="h-3 w-3" />
      近期节日
    </p>
    <div class="space-y-1.5">
      <div
        v-for="h in upcoming"
        :key="h.date"
        class="flex items-center justify-between gap-2"
      >
        <span class="font-serif text-xs font-medium text-foreground truncate">{{ h.name }}</span>
        <span class="font-heavy text-[10px] text-brand-mint tabular-nums shrink-0">{{ h.diffLabel }}</span>
      </div>
      <div v-if="!upcoming.length" class="text-[11px] text-muted-foreground italic">
        暂无近期节日
      </div>
    </div>
  </Card>
</template>
