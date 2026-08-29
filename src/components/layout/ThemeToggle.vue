<script setup lang="ts">
import { Contrast, Moon, Sun } from 'lucide-vue-next'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
const props = withDefaults(defineProps<{ fadeCarouselArt?: boolean }>(), {
  fadeCarouselArt: false,
})

function onToggle(e: MouseEvent) {
  theme.cycle(e.clientX, e.clientY, props.fadeCarouselArt)
}

const modeLabels = { light: '亮色', dark: '暗色', system: '跟随系统' } as const
const nextModeLabels = { light: '暗色', dark: '跟随系统', system: '亮色' } as const
</script>

<template>
  <button
    class="theme-toggle fixed top-5 right-5 z-40 h-9 w-9 rounded-full flex items-center justify-center bg-popover dark:bg-card backdrop-blur-sm shadow-md hover:shadow-lg border border-border hover:border-primary/50 transition-all"
    :aria-label="`快速切换主题，当前：${modeLabels[theme.mode]}；下一项：${nextModeLabels[theme.mode]}`"
    title="点击依次切换亮色、暗色和跟随系统"
    @click="onToggle"
  >
    <Transition name="theme-icon" mode="out-in">
      <Contrast v-if="theme.mode === 'system'" key="system" class="h-4 w-4 text-primary" />
      <Moon v-else-if="theme.mode === 'dark'" key="moon" class="h-4 w-4 text-primary" />
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
  transition:
    opacity 0.25s var(--ease-spring),
    transform 0.25s var(--ease-spring);
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
