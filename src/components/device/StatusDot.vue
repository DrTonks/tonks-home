<script setup lang="ts">
/**
 * 状态点 — 脉冲圆点 + 光晕
 * 默认 2.4s 脉冲，sleeping 态传 pulse=false 静态显示
 */
const props = withDefaults(
  defineProps<{
    color: string
    pulse?: boolean
  }>(),
  {
    pulse: true,
  },
)
</script>

<template>
  <span class="relative inline-flex h-2.5 w-2.5 shrink-0">
    <!-- 外圈光晕（脉冲） -->
    <span
      v-if="pulse"
      class="absolute inset-0 rounded-full animate-pulse-soft"
      :style="{ background: props.color, boxShadow: `0 0 12px ${props.color}` }"
    />
    <!-- 内核 -->
    <span
      class="relative inline-flex h-2.5 w-2.5 rounded-full"
      :style="{
        background: props.color,
        boxShadow: `0 0 8px ${props.color}80`,
      }"
    />
  </span>
</template>
