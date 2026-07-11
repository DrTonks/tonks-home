<script setup lang="ts">
import { ref } from 'vue'

withDefaults(
  defineProps<{
    size?: number
  }>(),
  { size: 100 },
)

const emit = defineEmits<{ click: [] }>()

const gifReady = ref(false)
</script>

<template>
  <div class="relative inline-flex rounded-full">
    <!-- 暗色自发光呼吸层（在 button 外层，不被 overflow-hidden 裁掉辉光）-->
    <div
      class="hidden dark:block absolute -inset-1 rounded-full pointer-events-none animate-avatar-glow"
    />
    <button
      class="relative rounded-full overflow-hidden shadow-2xl ring-4 ring-background/80 dark:ring-[1.5px] dark:ring-primary/80 transition-transform duration-300 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
      :style="{ width: `${size}px`, height: `${size}px` }"
      aria-label="点击展开主页"
      @click="emit('click')"
    >
      <!-- jpg 始终显示（已被 LoadingScreen 缓存，瞬间加载） -->
      <img
        src="/assets/avatar.jpg"
        alt="Tonks"
        class="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        :class="gifReady ? 'opacity-0' : 'opacity-100'"
        style="transition: opacity 0.5s"
        draggable="false"
      />
      <!-- gif 加载后淡入覆盖 -->
      <img
        src="/assets/avatar.gif"
        alt="Tonks"
        class="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        :class="gifReady ? 'opacity-100' : 'opacity-0'"
        style="transition: opacity 0.5s"
        draggable="false"
        @load="gifReady = true"
      />
      <!-- 装饰光环（亮色柔光保持；暗色关闭，改由外层呼吸发光替代）-->
      <div
        class="absolute inset-0 rounded-full pointer-events-none ring-1 ring-primary/30 shadow-[0_0_24px_hsl(var(--primary)/0.3)] dark:ring-0 dark:shadow-none"
      />
    </button>
  </div>
</template>
