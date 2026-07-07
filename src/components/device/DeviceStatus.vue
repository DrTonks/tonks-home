<script setup lang="ts">
import { computed } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDevicePoll } from '@/composables/useDevicePoll'
import { formatTimestamp, timeAgo, cn } from '@/lib/utils'
import StatusDot from './StatusDot.vue'

const { isRefreshing, refresh, store } = useDevicePoll()

// 状态色映射（粉红琥珀系，避免淡蓝）
const colorMap: Record<string, string> = {
  awake: 'hsl(var(--primary))',          // 在用应用 → 天蓝
  sleeping: 'hsl(var(--color-silver))',     // 似了 → 银灰
  unknown: 'hsl(var(--color-amber))',       // 未登记 → 琥珀金
  error: 'hsl(var(--color-red))',           // 离线 → 红
}

interface DisplayState {
  key: string
  color: string
  appName: string
  desc: string
  pulse: boolean
}

const currentState = computed<DisplayState>(() => {
  // 错误态
  if (store.error) {
    return {
      key: 'error',
      color: colorMap.error,
      appName: '服务器离线',
      desc: '无法连接到后端服务，可能是网络问题或服务器维护中。',
      pulse: true,
    }
  }
  // 未加载
  if (!store.currentStatus) {
    return {
      key: 'unknown',
      color: colorMap.unknown,
      appName: '加载中…',
      desc: '正在获取最新状态。',
      pulse: false,
    }
  }
  const s = store.currentStatus
  // status=99 或 info 没有 desc 字段 → 未登记
  if (
    s.status === 99 ||
    !s.info ||
    typeof s.info === 'object' && !('desc' in s.info)
  ) {
    return {
      key: 'unknown',
      color: colorMap.unknown,
      appName: '未登记应用',
      desc: '当前使用的应用未在状态列表中登记。',
      pulse: true,
    }
  }
  const info = s.info as { id: number; name: string; desc: string; color: string }
  const colorKey = info.color || 'awake'
  return {
    key: colorKey,
    color: colorMap[colorKey] || colorMap.awake,
    appName: info.name,
    desc: info.desc,
    // sleeping 态不脉冲（人睡了灯也别闪）
    pulse: colorKey !== 'sleeping',
  }
})

const timestamp = computed(() => store.currentStatus?.timestamp ?? null)
const relativeTime = computed(() => (timestamp.value ? timeAgo(timestamp.value) : ''))
const absoluteTime = computed(() => (timestamp.value ? formatTimestamp(timestamp.value) : '未知'))
</script>

<template>
  <Card class="w-[clamp(220px,18vw,280px)] p-5 relative group">
    <!-- 标题 + 刷新按钮 -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-kai text-base font-medium tracking-wider text-brand-sky-deep">
        在干什么？
      </h2>
      <Button
        variant="ghost"
        size="icon-sm"
        :disabled="isRefreshing"
        class="opacity-50 group-hover:opacity-100 transition-opacity h-7 w-7"
        aria-label="刷新状态"
        @click="refresh"
      >
        <RefreshCw :class="cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')" />
      </Button>
    </div>

    <!-- 状态点 + 应用名 -->
    <div class="flex items-center gap-2.5 mb-3">
      <StatusDot :color="currentState.color" :pulse="currentState.pulse" />
      <span
        class="font-heavy text-xl font-bold tracking-tight transition-colors duration-normal"
        :style="{ color: currentState.color }"
      >
        {{ currentState.appName }}
      </span>
    </div>

    <!-- 描述 -->
    <p class="text-[13px] leading-relaxed text-muted-foreground line-clamp-2 mb-4 min-h-[2.6em]">
      {{ currentState.desc }}
    </p>

    <!-- 时间 -->
    <div
      class="text-[11px] text-muted-foreground/70 tabular-nums flex items-center gap-1.5"
    >
      <span v-if="relativeTime">{{ relativeTime }} ·</span>
      <span>{{ absoluteTime }}</span>
    </div>
  </Card>
</template>
