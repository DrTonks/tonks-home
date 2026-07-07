<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'

/**
 * 区域容器 — 负责：
 * 1. 绝对定位（通过 props锚定到四角/中下）
 * 2. 区域级 3D 视差（hover 时整体 perspective + rotateX/Y ±3°）
 * 3. 内部 flex/grid 布局（通过 props 配置）
 *
 * 不负责磨砂玻璃质感 — 内部子组件自带 glass-card
 */

const props = withDefaults(
  defineProps<{
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
    direction?: 'row' | 'column'
    gap?: string
    align?: 'start' | 'center' | 'end' | 'stretch'
  }>(),
  {
    direction: 'row',
    gap: '12px',
    align: 'stretch',
  },
)

const innerRef = ref<HTMLElement | null>(null)
let rafId: number | null = null
let targetX = 0
let targetY = 0
let currentX = 0
let currentY = 0
let isHovering = false

const positionClass = {
  'top-left': 'top-6 left-6',
  'top-right': 'top-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-6 right-6',
}

function onMouseMove(e: MouseEvent) {
  if (!innerRef.value) return
  const rect = innerRef.value.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  // 归一化到 [-1, 1]
  targetX = (e.clientX - cx) / (rect.width / 2)
  targetY = (e.clientY - cy) / (rect.height / 2)
  // 限制范围
  targetX = Math.max(-1, Math.min(1, targetX))
  targetY = Math.max(-1, Math.min(1, targetY))
}

function onMouseEnter() {
  isHovering = true
  if (rafId === null) tick()
}

function onMouseLeave() {
  isHovering = false
  targetX = 0
  targetY = 0
}

function tick() {
  currentX += (targetX - currentX) * 0.12
  currentY += (targetY - currentY) * 0.12

  if (innerRef.value) {
    const rotY = currentX * 3 // ±3°
    const rotX = -currentY * 3
    innerRef.value.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`
  }

  // 鼠标离开且已回弹到位 → 停止 rAF
  if (!isHovering && Math.abs(currentX) < 0.01 && Math.abs(currentY) < 0.01) {
    if (innerRef.value) {
      innerRef.value.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)'
    }
    rafId = null
    return
  }

  rafId = requestAnimationFrame(tick)
}

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
})
</script>

<template>
  <div
    class="absolute z-10"
    :class="positionClass[props.position]"
    style="transform-style: preserve-3d"
    @mouseenter="onMouseEnter"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div
      ref="innerRef"
      class="flex"
      :style="{
        flexDirection: props.direction,
        gap: props.gap,
        alignItems: props.align,
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        transition: 'transform 0.2s ease-out',
      }"
    >
      <slot />
    </div>
  </div>
</template>
