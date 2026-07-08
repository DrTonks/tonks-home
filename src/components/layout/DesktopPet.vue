<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

type Mood = 'idle' | 'happy' | 'angry' | 'threat' | 'cry' | 'sleep'

const FRAMES: Record<Mood, string> = {
  idle: '/assets/pet/idle.png',
  happy: '/assets/pet/happy.png',
  angry: '/assets/pet/angry.png',
  threat: '/assets/pet/threat.png',
  cry: '/assets/pet/cry.png',
  sleep: '/assets/pet/sleep.png',
}
const BLINK_FRAMES = {
  halfClosed: '/assets/pet/halfClosed.png',
  almostClosed: '/assets/pet/almostClosed.png',
  closed: '/assets/pet/blink.png',
}

const BLINK_SEQ: Array<{ src: string; duration: number }> = [
  { src: BLINK_FRAMES.halfClosed, duration: 70 },
  { src: BLINK_FRAMES.almostClosed, duration: 60 },
  { src: BLINK_FRAMES.closed, duration: 110 },
]

// 呼吸 / 抖动参数（来自 PRTS renderer.js MOOD_PARAMS）
const PHYSICS: Record<Mood, { breathAmp: number; breathHz: number; bobAmp: number; bobHz: number; shake: number }> = {
  idle:   { breathAmp: 0.012, breathHz: 0.12, bobAmp: 1.5,  bobHz: 0.08, shake: 0 },
  happy:  { breathAmp: 0.016, breathHz: 0.14, bobAmp: 2.0,  bobHz: 0.10, shake: 0 },
  angry:  { breathAmp: 0.028, breathHz: 0.65, bobAmp: 0,    bobHz: 0,    shake: 1.4 },
  threat: { breathAmp: 0.034, breathHz: 0.75, bobAmp: 0,    bobHz: 0,    shake: 2.4 },
  cry:    { breathAmp: 0.020, breathHz: 0.18, bobAmp: 0,    bobHz: 0,    shake: 0.5 },
  sleep:  { breathAmp: 0.008, breathHz: 0.06, bobAmp: 0,    bobHz: 0,    shake: 0 },
}

const SIZE = 130
const CLICK_TIMEOUT_MS = 2500 // 连续点击窗口
const CRY_AFTER_MS = 10 * 60 * 1000
const SLEEP_AFTER_MS = 15 * 60 * 1000

// 状态
const mood = ref<Mood>('idle')
const pos = ref({ x: window.innerWidth - SIZE - 40, y: 60 })
const dragging = ref(false)
const moved = ref(false)
const showFrame = ref(FRAMES.idle)

// 点击升级
let clickCount = 0
let clickTimer: ReturnType<typeof setTimeout> | null = null
const CLICK_TIER: Mood[] = ['happy', 'angry', 'threat']

// 闲置计时
let idleTimer: ReturnType<typeof setTimeout> | null = null
let sleepTimer: ReturnType<typeof setTimeout> | null = null

// 动画
let blinkTimer: ReturnType<typeof setTimeout> | null = null
let rafId: number | null = null
let lastTick = performance.now()
let phase = Math.random() * Math.PI * 2
let shakePhase = Math.random() * Math.PI * 2

// 拖动
let startClientX = 0, startClientY = 0, startPosX = 0, startPosY = 0

const petRef = ref<HTMLElement | null>(null)

const physStyle = computed(() => {
  const p = PHYSICS[mood.value]
  const breath = Math.sin(phase) * p.breathAmp
  const bob = p.bobAmp > 0 ? Math.sin(phase * (p.bobHz / p.breathHz)) * p.bobAmp : 0
  const shake = p.shake > 0 ? Math.sin(shakePhase * 4) * p.shake : 0
  return {
    transform: `scale(${1 + breath}) translateY(${bob}px) translateX(${shake}px)`,
  }
})

// 眨眼
function scheduleBlink() {
  if (blinkTimer) clearTimeout(blinkTimer)
  blinkTimer = setTimeout(() => {
    if (dragging.value || mood.value === 'sleep') { scheduleBlink(); return }
    let idx = 0
    function step() {
      if (idx >= BLINK_SEQ.length) {
        showFrame.value = FRAMES[mood.value]
        scheduleBlink()
        return
      }
      showFrame.value = BLINK_SEQ[idx++].src
      setTimeout(step, BLINK_SEQ[idx - 1]?.duration || 80)
    }
    step()
  }, 3500 + Math.random() * 5000)
}

// 帧循环
function tick(now: number) {
  const dt = Math.min(0.1, (now - lastTick) / 1000)
  lastTick = now
  const p = PHYSICS[mood.value]
  phase += dt * p.breathHz * Math.PI * 2
  shakePhase += dt * 4 * Math.PI * 2
  if (petRef.value) {
    petRef.value.style.transform = physStyle.value.transform
  }
  rafId = requestAnimationFrame(tick)
}

// 闲置计时
function resetIdleTimers() {
  if (idleTimer) clearTimeout(idleTimer)
  if (sleepTimer) clearTimeout(sleepTimer)
  if (mood.value === 'cry' || mood.value === 'sleep') {
    mood.value = 'idle'
    showFrame.value = FRAMES.idle
    scheduleBlink()
  }
  idleTimer = setTimeout(() => {
    if (mood.value === 'idle') {
      mood.value = 'cry'
      showFrame.value = FRAMES.cry
      if (blinkTimer) clearTimeout(blinkTimer)
    }
  }, CRY_AFTER_MS)
  sleepTimer = setTimeout(() => {
    if (mood.value === 'cry' || mood.value === 'idle') {
      mood.value = 'sleep'
      showFrame.value = FRAMES.sleep
      if (blinkTimer) clearTimeout(blinkTimer)
    }
  }, SLEEP_AFTER_MS)
}

// 点击升级
function handleClick() {
  if (moved.value) { moved.value = false; return }
  resetIdleTimers()

  if (clickTimer) clearTimeout(clickTimer)
  clickCount++
  const tier = Math.min(clickCount - 1, CLICK_TIER.length - 1)
  mood.value = CLICK_TIER[tier]
  showFrame.value = FRAMES[mood.value]
  if (blinkTimer) clearTimeout(blinkTimer)

  clickTimer = setTimeout(() => {
    clickCount = 0
    if (mood.value !== 'cry' && mood.value !== 'sleep') {
      mood.value = 'idle'
      showFrame.value = FRAMES.idle
      scheduleBlink()
    }
  }, CLICK_TIMEOUT_MS)
}

// 拖动
function onPointerDown(e: PointerEvent) {
  resetIdleTimers()
  dragging.value = true
  moved.value = false
  startClientX = e.clientX; startClientY = e.clientY
  startPosX = pos.value.x; startPosY = pos.value.y
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const dx = e.clientX - startClientX, dy = e.clientY - startClientY
  if (Math.hypot(dx, dy) > 4) moved.value = true
  if (moved.value) {
    mood.value = 'angry'
    showFrame.value = FRAMES.angry
    if (blinkTimer) clearTimeout(blinkTimer)
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
    mood.value = 'idle'
    showFrame.value = FRAMES.idle
    scheduleBlink()
    resetIdleTimers()
    moved.value = false
  }
}

onMounted(() => {
  scheduleBlink()
  resetIdleTimers()
  lastTick = performance.now()
  rafId = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  if (blinkTimer) clearTimeout(blinkTimer)
  if (clickTimer) clearTimeout(clickTimer)
  if (idleTimer) clearTimeout(idleTimer)
  if (sleepTimer) clearTimeout(sleepTimer)
  if (rafId !== null) cancelAnimationFrame(rafId)
})
</script>

<template>
  <div
    ref="petRef"
    class="fixed z-50 select-none cursor-grab active:cursor-grabbing"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click="handleClick"
    @dragstart.prevent
  >
    <img
      :src="showFrame"
      alt="桌宠"
      class="pointer-events-none select-none"
      :style="{ width: `${SIZE}px`, height: `${SIZE}px`, objectFit: 'contain' }"
      draggable="false"
    />
  </div>
</template>
