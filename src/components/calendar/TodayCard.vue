<script setup lang="ts">
import { computed } from 'vue'
import { Card } from '@/components/ui/card'

const now = new Date()

const weekdayCN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const weekdayShort = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const weekday = computed(() => weekdayCN[now.getDay()])
const weekdayEn = computed(() => weekdayShort[now.getDay()])
const monthDay = computed(() => `${now.getMonth() + 1}月${now.getDate()}日`)
</script>

<template>
  <Card class="w-[clamp(140px,10vw,180px)] p-3 flex flex-col justify-center">
    <p class="font-heavy text-[11px] text-brand-mint-deep tracking-[0.2em]">
      {{ weekdayEn }}
    </p>
    <p class="font-kai text-base font-medium text-foreground mt-0.5">{{ weekday }}</p>
    <p class="font-heavy text-lg font-bold text-brand-sky mt-1 tabular-nums">{{ monthDay }}</p>
  </Card>
</template>
