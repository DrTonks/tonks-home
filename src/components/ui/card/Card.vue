<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()

function onMouseMove(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2  // -1 to 1
  const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2
  ;(e.currentTarget as HTMLElement).style.setProperty('--mx', x.toFixed(3))
  ;(e.currentTarget as HTMLElement).style.setProperty('--my', y.toFixed(3))
}

function onMouseLeave(e: MouseEvent) {
  ;(e.currentTarget as HTMLElement).style.setProperty('--mx', '0')
  ;(e.currentTarget as HTMLElement).style.setProperty('--my', '0')
}
</script>

<template>
  <div
    :class="
      cn(
        'relative rounded-lg border border-white/15 bg-white/20 text-card-foreground shadow-card glass-blur overflow-hidden card-3d duration-normal ease-out-expo',
        props.class,
      )
    "
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
  transform-style: preserve-3d;
  transform: perspective(1000px) rotateY(calc(var(--mx) * 5deg)) rotateX(calc(var(--my) * -5deg));
  transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s ease-out, border-color 0.3s ease-out;
}
.card-3d:hover {
  box-shadow:
    0 1px 3px rgba(26, 37, 48, 0.08),
    0 6px 16px rgba(26, 37, 48, 0.10),
    0 16px 40px rgba(26, 37, 48, 0.12);
  border-color: rgba(255, 255, 255, 0.3);
}
</style>
