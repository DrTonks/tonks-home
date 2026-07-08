<script setup lang="ts">
import { Music as MusicIcon } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    size?: number
    spinning?: boolean
  }>(),
  {
    size: 80,
    spinning: false,
  },
)
</script>

<template>
  <div
    class="relative shrink-0"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <!-- 黑胶主体：始终挂载动画，用 play-state 控制暂停/播放，保留角度 -->
    <div
      class="absolute inset-0 rounded-full bg-gradient-to-br from-[#1a1a1a] via-[#2a2a2a] to-[#0a0a0a] shadow-[0_4px_16px_rgba(0,0,0,0.3)] animate-[spin_8s_linear_infinite] motion-reduce:animate-none"
      :style="{ animationPlayState: spinning ? 'running' : 'paused' }"
    >
      <!-- 黑胶纹路（同心圆） -->
      <div class="absolute inset-1 rounded-full border border-white/[0.04]" />
      <div class="absolute inset-[10%] rounded-full border border-white/[0.04]" />
      <div class="absolute inset-[15%] rounded-full border border-white/[0.04]" />
      <div class="absolute inset-[20%] rounded-full border border-white/[0.04]" />

      <!-- 反光高光 -->
      <div
        class="absolute inset-0 rounded-full opacity-30 pointer-events-none"
        style="background: linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 35%, transparent 65%, rgba(255,255,255,0.1) 100%);"
      />

      <!-- 中心标签（天空蓝） -->
      <div
        class="absolute rounded-full bg-primary flex items-center justify-center shadow-inner"
        style="inset: 30%;"
      >
        <MusicIcon
          class="text-primary-foreground"
          :style="{ width: `${size * 0.18}px`, height: `${size * 0.18}px` }"
        />
      </div>

      <!-- 中心孔 -->
      <div
        class="absolute rounded-full bg-background"
        style="inset: 47%;"
      />
    </div>
  </div>
</template>
