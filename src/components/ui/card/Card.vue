<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()

// 缓存 rect，避免每次 mousemove 触发 layout（getBoundingClientRect 会强制回流）
let cache: { left: number; top: number; w: number; h: number } | null = null

function onMouseEnter(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  cache = { left: r.left, top: r.top, w: r.width, h: r.height }
}

function onMouseMove(e: MouseEvent) {
  if (!cache) return
  const x = ((e.clientX - cache.left) / cache.w - 0.5) * 2
  const y = ((e.clientY - cache.top) / cache.h - 0.5) * 2
  ;(e.currentTarget as HTMLElement).style.setProperty('--mx', x.toFixed(3))
  ;(e.currentTarget as HTMLElement).style.setProperty('--my', y.toFixed(3))
}

function onMouseLeave(e: MouseEvent) {
  cache = null
  ;(e.currentTarget as HTMLElement).style.setProperty('--mx', '0')
  ;(e.currentTarget as HTMLElement).style.setProperty('--my', '0')
}
</script>

<template>
  <div
    :class="
      cn(
        'relative rounded-lg bg-white/20 text-card-foreground shadow-card glass-blur glass-edge glass-noise overflow-hidden card-3d duration-normal ease-out-expo',
        props.class,
      )
    "
    @mouseenter="onMouseEnter"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div
      class="absolute inset-0 pointer-events-none rounded-lg"
      style="background: linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 40%, transparent 65%, rgba(255,255,255,0.06) 100%);"
    />
    <div class="relative z-[1]">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.card-3d {
  --mx: 0;
  --my: 0;
  transform: perspective(1000px) rotateY(calc(var(--mx) * 5deg)) rotateX(calc(var(--my) * -5deg));
  transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s ease-out;
}
.card-3d:hover {
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.28),
    0 1px 3px rgba(26, 37, 48, 0.08),
    0 6px 16px rgba(26, 37, 48, 0.10),
    0 16px 40px rgba(26, 37, 48, 0.12);
}
</style>
