<script setup lang="ts">
/**
 * 主题自适应加载条 — 呼吸式不定进度条。
 * - 暗色主题：深底 + 主色渐变 + 荧光
 * - 亮色主题：浅底 + 主色渐变 + 阴影
 * - 加载文字 + 周围漂浮粒子
 */
defineProps<{ visible: boolean }>()
</script>

<template>
  <Transition name="load-fade">
    <div
      v-if="visible"
      class="loading-wrapper flex flex-col items-center gap-3"
    >
      <!-- 加载条 -->
      <div class="loading-bar-track">
        <div class="loading-bar-fill" />
      </div>
      <!-- 文字 -->
      <span class="loading-text text-xs text-muted-foreground">
        正在召唤桌宠...
      </span>
    </div>
  </Transition>
</template>

<style scoped>
.loading-wrapper {
  width: 160px;
}

.loading-bar-track {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  overflow: hidden;
  background: hsl(var(--muted));
}

.loading-bar-fill {
  width: 40%;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, hsl(var(--primary)), hsl(var(--chart-1)), hsl(var(--primary)));
  background-size: 200% 100%;
  animation: loading-shimmer 1.6s ease-in-out infinite;
  box-shadow: 0 0 8px hsl(var(--primary) / 0.5);
}

/* 暗色主题下加强荧光 */
:root.dark .loading-bar-fill,
.dark .loading-bar-fill {
  box-shadow: 0 0 14px hsl(var(--primary) / 0.7), 0 0 28px hsl(var(--chart-1) / 0.3);
}

.loading-text {
  letter-spacing: 0.05em;
  animation: loading-pulse 2s ease-in-out infinite;
}

@keyframes loading-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes loading-pulse {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}

.load-fade-enter-active { transition: opacity 0.25s ease-out, transform 0.25s ease-out; }
.load-fade-leave-active { transition: opacity 0.15s ease-in, transform 0.15s ease-in; }
.load-fade-enter-from { opacity: 0; transform: translateY(8px) scale(0.95); }
.load-fade-leave-to   { opacity: 0; transform: translateY(4px) scale(0.98); }
</style>
