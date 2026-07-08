<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

// 表情帧（命名对应 PRTS）
const FRAMES = {
  idle: '/assets/pet/idle.png',
  halfClosed: '/assets/pet/halfClosed.png',
  almostClosed: '/assets/pet/almostClosed.png',
  closed: '/assets/pet/blink.png',
  happy: '/assets/pet/happy.png',
  angry: '/assets/pet/angry.png',
  sleep: '/assets/pet/sleep.png',
} as const

const BLINK_SEQ: Array<{ frame: keyof typeof FRAMES; duration: number }> = [
  { frame: 'halfClosed', duration: 70 },
  { frame: 'almostClosed', duration: 60 },
  { frame: 'closed', duration: 110 },
  { frame: 'idle', duration: 0 },
]

const SIZE = 130

// 状态
const expression = ref<keyof typeof FRAMES>('idle')
const pos = ref({ x: window.innerWidth - SIZE - 40, y: 60 })
const dragging = ref(false)
const moved = ref(false)
const action = ref<'idle' | 'sway' | 'bounce'>('idle')
const actionProgress = ref(0)

// 定时器
let blinkTimer: ReturnType<typeof setTimeout> | null = null
let actionTimer: ReturnType<typeof setTimeout> | null = null
let bobPhase = Math.random() * Math.PI * 2
let rafId: number | null = null
let lastTick = performance.now()

// 拖动状态
let startClientX = 0
let startClientY = 0
let startPosX = 0
let startPosY = 0

// ---- 眨眼 ----
function scheduleBlink() {
  if (blinkTimer) clearTimeout(blinkTimer)
  blinkTimer = setTimeout(() => {
    if (dragging.value) { scheduleBlink(); return }
    let idx = 0
    function step() {
      if (idx >= BLINK_SEQ.length) { scheduleBlink(); return }
      const { frame, duration } = BLINK_SEQ[idx++]
      expression.value = frame
      if (idx < BLINK_SEQ.length) setTimeout(step, duration)
      else setTimeout(() => { expression.value = 'idle'; scheduleBlink() }, 3500 + Math.random() * 5000)
    }
    step()
  }, 3500 + Math.random() * 5000)
}

// ---- 动作（sway / bounce） ----
function scheduleAction() {
  if (actionTimer) clearTimeout(actionTimer)
  actionTimer = setTimeout(() => {
    if (dragging.value) { scheduleAction(); return }
    action.value = Math.random() < 0.55 ? 'sway' : 'bounce'
    expression.value = Math.random() < 0.45 ? 'happy' : 'idle'
    actionProgress.value = 0
    // 动作持续 ~1.4s
    const dur = 1400
    const step = () => {
      actionProgress.value += 16 / dur
      if (actionProgress.value < 1) requestAnimationFrame(step)
      else {
        action.value = 'idle'
        expression.value = 'idle'
        scheduleAction()
      }
    }
    requestAnimationFrame(step)
  }, 4500 + Math.random() * 6500)
}

// ---- 帧更新 loop ----
function tick(now: number) {
  const dt = (now - lastTick) / 1000
  lastTick = now
  bobPhase += dt * 0.1 * Math.PI * 2

  // sway / bounce 偏移
  const ap = actionProgress.value
  const wave = Math.sin(Math.max(0, ap) * Math.PI * 2)
  const sway = action.value === 'sway' ? wave * 5 : 0
  const bounce = action.value === 'bounce' ? -Math.abs(wave) * 8 : 0

  if (petRef.value) {
    petRef.value.style.setProperty('--sway', `${sway}px`)
    petRef.value.style.setProperty('--bounce', `${bounce}px`)
  }
  rafId = requestAnimationFrame(tick)
}

// ---- 拖动 ----
const petRef = ref<HTMLElement | null>(null)

function onPointerDown(e: PointerEvent) {
  dragging.value = true
  moved.value = false
  startClientX = e.clientX
  startClientY = e.clientY
  startPosX = pos.value.x
  startPosY = pos.value.y
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* */ }
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const dx = e.clientX - startClientX
  const dy = e.clientY - startClientY
  if (Math.hypot(dx, dy) > 4) moved.value = true
  if (moved.value) {
    expression.value = 'angry'
    pos.value = {
      x: Math.max(0, Math.min(window.innerWidth - SIZE, startPosX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - SIZE, startPosY + dy)),
    }
  }
}

function onPointerUp() {
  if (!dragging.value) return
  dragging.value = false
  if (moved.value) {
    action.value = 'idle'
    expression.value = 'idle'
    // 放下后冷却 2.5s 不触发新动作
    if (actionTimer) clearTimeout(actionTimer)
    actionTimer = setTimeout(scheduleAction, 2500)
    moved.value = false
  }
}

function onClick() {
  if (moved.value) { moved.value = false; return }
  // 点击抚摸 → 笑 2 秒
  expression.value = 'happy'
  if (blinkTimer) clearTimeout(blinkTimer)
  setTimeout(() => {
    expression.value = 'idle'
    scheduleBlink()
  }, 2000)
}

onMounted(() => {
  scheduleBlink()
  scheduleAction()
  lastTick = performance.now()
  rafId = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  if (blinkTimer) clearTimeout(blinkTimer)
  if (actionTimer) clearTimeout(actionTimer)
  if (rafId !== null) cancelAnimationFrame(rafId)
})
</script>

<template>
  <div
    ref="petRef"
    class="fixed z-50 select-none cursor-grab active:cursor-grabbing"
    :style="{
      left: `${pos.x}px`,
      top: `${pos.y}px`,
      transform: `translateX(var(--sway, 0px)) translateY(var(--bounce, 0px))`,
    }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click="onClick"
    @dragstart.prevent
  >
    <img
      :src="FRAMES[expression]"
      alt="桌宠"
      class="pointer-events-none select-none"
      :style="{ width: `${SIZE}px`, height: `${SIZE}px`, objectFit: 'contain' }"
      draggable="false"
    />
  </div>
</template>
