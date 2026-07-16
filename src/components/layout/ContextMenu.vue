<script setup lang="ts">
/**
 * 通用右键菜单 — 主题自适应，自动定位在点击位置。
 * - 点击菜单项 / 外部 / Escape → 消失
 * - 3 秒无操作自动消失
 */
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'

export interface ContextMenuItem {
  label: string
  icon?: string
  action: () => void
  disabled?: boolean
}

const props = defineProps<{
  items: ContextMenuItem[]
  x: number
  y: number
  show: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const menuRef = ref<HTMLElement | null>(null)
const adjX = ref(0)
const adjY = ref(0)

let dismissTimer: ReturnType<typeof setTimeout> | null = null

function resetDismissTimer() {
  if (dismissTimer) clearTimeout(dismissTimer)
  dismissTimer = setTimeout(() => emit('close'), 3000)
}

function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

function adjustPosition() {
  if (!menuRef.value) return
  const rect = menuRef.value.getBoundingClientRect()
  adjX.value = Math.min(props.x, window.innerWidth - rect.width - 8)
  adjY.value = Math.min(props.y, window.innerHeight - rect.height - 8)
}

watch(() => props.show, (v) => {
  if (v) {
    resetDismissTimer()
    nextTick(adjustPosition)
    document.addEventListener('click', handleClickOutside, true)
    document.addEventListener('keydown', handleEscape)
  } else {
    if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null }
    document.removeEventListener('click', handleClickOutside, true)
    document.removeEventListener('keydown', handleEscape)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside, true)
  document.removeEventListener('keydown', handleEscape)
  if (dismissTimer) clearTimeout(dismissTimer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="ctx-fade">
      <div
        v-if="show"
        ref="menuRef"
        class="ctx-menu fixed z-[100] min-w-[140px] rounded-lg border border-border bg-popover shadow-xl py-1 select-none"
        :style="{ left: `${adjX}px`, top: `${adjY}px` }"
        @mousemove="resetDismissTimer"
        @contextmenu.prevent
      >
        <button
          v-for="item in items"
          :key="item.label"
          class="ctx-item flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
          :class="item.disabled ? 'text-muted-foreground' : 'text-foreground'"
          :disabled="item.disabled"
          @click="item.disabled ? undefined : item.action(); emit('close')"
        >
          <span v-if="item.icon" class="text-xs leading-none">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ctx-menu {
  transform-origin: top left;
}
.ctx-fade-enter-active {
  transition: opacity 0.12s ease-out, transform 0.12s ease-out;
}
.ctx-fade-leave-active {
  transition: opacity 0.08s ease-in, transform 0.08s ease-in;
}
.ctx-fade-enter-from {
  opacity: 0;
  transform: scale(0.92);
}
.ctx-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
.ctx-item {
  font-family: inherit;
  cursor: pointer;
}
</style>
