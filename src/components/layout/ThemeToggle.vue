<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()

function onToggle(e: MouseEvent) {
  theme.toggle(e.clientX, e.clientY)
}
</script>

<template>
  <button
    class="theme-toggle fixed top-5 right-5 z-40 h-9 w-9 rounded-full flex items-center justify-center bg-popover dark:bg-card backdrop-blur-sm shadow-md hover:shadow-lg border border-border hover:border-primary/50 transition-all"
    :aria-label="theme.isDark ? '切换到亮色主题' : '切换到暗色主题'"
    @click="onToggle"
  >
    <Transition name="theme-icon" mode="out-in">
      <Moon v-if="theme.isDark" key="moon" class="h-4 w-4 text-primary" />
      <Sun v-else key="sun" class="h-4 w-4 text-brand-amber" />
    </Transition>
  </button>
</template>

<style scoped>
.theme-toggle:hover {
  transform: scale(1.08);
}
.theme-toggle:active {
  transform: scale(0.94);
}
.theme-icon-enter-active,
.theme-icon-leave-active {
  transition: opacity 0.25s var(--ease-spring), transform 0.25s var(--ease-spring);
}
.theme-icon-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.4);
}
.theme-icon-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.4);
}
</style>
