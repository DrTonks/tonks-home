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

// ===== 桌宠大小参数 =====
const SIZE = 260 

// 呼吸/抖动参数（基于 SIZE 比例，以 130px 为基准）
const BASE = 130
function scale(px: number) { return px * SIZE / BASE }

// 情绪物理（PRTS 数据 × scale）
function phys(breathAmp: number, breathHz: number, bobAmp: number, bobHz: number, shake: number) {
  return {
    breathAmp: scale(breathAmp),
    breathHz,
    bobAmp: bobAmp > 0 ? scale(bobAmp) : 0,
    bobHz,
    shake: shake > 0 ? scale(shake) : 0,
  }
}

const PHYSICS: Record<Mood, ReturnType<typeof phys>> = {
  idle:   phys(0.012, 0.12, 1.5, 0.08, 0),
  happy:  phys(0.016, 0.14, 2.0, 0.10, 0),
  angry:  phys(0.028, 0.65, 0,   0,    1.4),
  threat: phys(0.034, 0.75, 0,   0,    2.4),
  cry:    phys(0.020, 0.18, 0,   0,    0.5),
  sleep:  phys(0.008, 0.06, 0,   0,    0),
}

const CLICK_TIMEOUT_MS = 2500
const CRY_AFTER_MS = 2 * 60 * 1000   // 2 分钟
const SLEEP_AFTER_MS = 15 * 60 * 1000

// 点击升级缓冲：每个阶段的所需点击数为随机区间
function rollThreshold(min: number, max: number) { return Math.floor(min + Math.random() * (max - min + 1)) }

const TIER_CONFIG = [
  { mood: 'happy' as Mood,  minClicks: 1, maxClicks: 4 },
  { mood: 'angry' as Mood,  minClicks: 2, maxClicks: 6 },
  { mood: 'threat' as Mood, minClicks: 2, maxClicks: 5 },
]

let tierThresholds: number[] = []
let clickCount = 0
let clickTimer: ReturnType<typeof setTimeout> | null = null

function resetClickTiers() {
  tierThresholds = TIER_CONFIG.map((t) => rollThreshold(t.minClicks, t.maxClicks))
  clickCount = 0
}

// 状态
const mood = ref<Mood>('idle')
const pos = ref({ x: window.innerWidth - SIZE - 40, y: 60 })
const dragging = ref(false)
const moved = ref(false)
const showFrame = ref(FRAMES.idle)
const action = ref<'idle' | 'sway' | 'bounce'>('idle')
const actionProgress = ref(0)

// 闲置计时
let idleTimer: ReturnType<typeof setTimeout> | null = null
let sleepTimer: ReturnType<typeof setTimeout> | null = null

// 动画
let blinkTimer: ReturnType<typeof setTimeout> | null = null
let actionTimer: ReturnType<typeof setTimeout> | null = null
let rafId: number | null = null
let lastTick = performance.now()
let phase = Math.random() * Math.PI * 2
let shakePhase = Math.random() * Math.PI * 2

// 拖动
let startClientX = 0, startClientY = 0, startPosX = 0, startPosY = 0

const petRef = ref<HTMLElement | null>(null)
const initDrop = ref(true)
const clickScale = ref(false)

function triggerClickEffect() {
  clickScale.value = true
  setTimeout(() => { clickScale.value = false }, 300)
}

const physStyle = computed(() => {
  const p = PHYSICS[mood.value]
  const breath = Math.sin(phase) * p.breathAmp
  const bob = p.bobAmp > 0 ? Math.sin(phase * (p.bobHz / Math.max(0.01, p.breathHz))) * p.bobAmp : 0
  const shake = p.shake > 0 ? Math.sin(shakePhase * 4) * p.shake : 0
  // sway / bounce
  const ap = actionProgress.value
  const wave = Math.sin(Math.max(0, ap) * Math.PI * 2)
  const sway = action.value === 'sway' ? wave * scale(5) : 0
  const bounce = action.value === 'bounce' ? -Math.abs(wave) * scale(8) : 0
  return {
    transform: `scale(${1 + breath}) translateY(${bob + bounce}px) translateX(${shake + sway}px)`,
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

// 动作状态机（sway/bounce）
function scheduleAction() {
  if (actionTimer) clearTimeout(actionTimer)
  actionTimer = setTimeout(() => {
    if (dragging.value || mood.value === 'sleep' || mood.value === 'cry') { scheduleAction(); return }
    action.value = Math.random() < 0.55 ? 'sway' : 'bounce'
    actionProgress.value = 0
    if (mood.value === 'idle') {
      showFrame.value = Math.random() < 0.45 ? FRAMES.happy : FRAMES.idle
    }
    const dur = 1400
    const step = () => {
      actionProgress.value += 16 / dur
      if (actionProgress.value < 1) requestAnimationFrame(step)
      else {
        action.value = 'idle'
        if (mood.value === 'idle') showFrame.value = FRAMES.idle
        scheduleAction()
      }
    }
    requestAnimationFrame(step)
  }, 4500 + Math.random() * 6500)
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
    scheduleAction()
  }
  idleTimer = setTimeout(() => {
    if (mood.value === 'idle') {
      mood.value = 'cry'
      showFrame.value = FRAMES.cry
      if (blinkTimer) clearTimeout(blinkTimer)
      if (actionTimer) clearTimeout(actionTimer)
    }
  }, CRY_AFTER_MS)
  sleepTimer = setTimeout(() => {
    if (mood.value === 'cry' || mood.value === 'idle') {
      mood.value = 'sleep'
      showFrame.value = FRAMES.sleep
      if (blinkTimer) clearTimeout(blinkTimer)
      if (actionTimer) clearTimeout(actionTimer)
    }
  }, SLEEP_AFTER_MS)
}

// 粒子特效
const particles = ref<Array<{ id: number; x: number; y: number; delay: number }>>([])
let particleId = 0

function spawnParticles(count: number) {
  const newParticles = Array.from({ length: count }, () => ({
    id: ++particleId,
    x: (Math.random() - 0.5) * 120,
    y: (Math.random() - 0.5) * 120 - 30,
    delay: Math.random() * 200,
  }))
  particles.value = [...particles.value, ...newParticles]
  setTimeout(() => {
    particles.value = particles.value.filter((p) => !newParticles.includes(p))
  }, 1000)
}

// 点击升级（带缓冲）
function handleClick() {
  if (moved.value) { moved.value = false; return }
  resetIdleTimers()
  triggerClickEffect()
  spawnParticles(8)

  if (clickTimer) clearTimeout(clickTimer)
  clickCount++

  // 找当前达到的 tier
  let currentTier = -1
  let cum = 0
  for (let i = 0; i < tierThresholds.length; i++) {
    cum += tierThresholds[i]
    if (clickCount >= cum) currentTier = i
    else break
  }

  if (currentTier >= 0) {
    mood.value = TIER_CONFIG[currentTier].mood
    showFrame.value = FRAMES[mood.value]
    if (blinkTimer) clearTimeout(blinkTimer)
    if (actionTimer) clearTimeout(actionTimer)
  }

  clickTimer = setTimeout(() => {
    resetClickTiers()
    if (mood.value !== 'cry' && mood.value !== 'sleep') {
      mood.value = 'idle'
      showFrame.value = FRAMES.idle
      scheduleBlink()
      scheduleAction()
    }
  }, CLICK_TIMEOUT_MS)
}

// 拖动
function onPointerDown(e: PointerEvent) {
  resetIdleTimers()
  dragging.value = true; moved.value = false
  startClientX = e.clientX; startClientY = e.clientY
  startPosX = pos.value.x; startPosY = pos.value.y
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const dx = e.clientX - startClientX, dy = e.clientY - startClientY
  if (Math.hypot(dx, dy) > 4) moved.value = true
  if (moved.value) {
    mood.value = 'angry'; showFrame.value = FRAMES.angry
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
    mood.value = 'idle'; showFrame.value = FRAMES.idle
    scheduleBlink(); scheduleAction(); resetIdleTimers()
    moved.value = false
  }
}

onMounted(() => {
  resetClickTiers()
  scheduleBlink()
  scheduleAction()
  resetIdleTimers()
  lastTick = performance.now()
  rafId = requestAnimationFrame(tick)
  // 展开时模拟粒子爆发
  setTimeout(() => spawnParticles(10), 300)
})

onBeforeUnmount(() => {
  if (blinkTimer) clearTimeout(blinkTimer)
  if (clickTimer) clearTimeout(clickTimer)
  if (idleTimer) clearTimeout(idleTimer)
  if (sleepTimer) clearTimeout(sleepTimer)
  if (actionTimer) clearTimeout(actionTimer)
  if (rafId !== null) cancelAnimationFrame(rafId)
})
</script>

<template>
  <!-- 层1：定位 + 事件 -->
  <div
    class="fixed z-50 select-none cursor-grab active:cursor-grabbing"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click="handleClick"
    @dragstart.prevent
  >
    <!-- 层2：从天而降动画（纯 CSS，JS 不碰 transform） -->
    <div :class="initDrop ? 'drop-enter' : ''" class="drop-layer">
      <!-- 层3：rAF 物理 transform + 粒子 + 图像 -->
      <div ref="petRef" class="relative !overflow-visible">
        <span
          v-for="p in particles"
          :key="p.id"
          class="pet-particle absolute w-4 h-4 rounded-full pointer-events-none z-50"
          :style="{
            '--px': `${p.x}px`,
            '--py': `${p.y}px`,
            '--delay': `${p.delay}ms`,
            left: '50%',
            top: '50%',
          }"
        />
        <img
          :src="showFrame"
          alt="桌宠"
          class="pointer-events-none select-none transition-transform duration-200"
          :class="clickScale ? 'scale-110' : 'scale-100'"
          :style="{ width: `${SIZE}px`, height: `${SIZE}px`, objectFit: 'contain' }"
          draggable="false"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pet-particle {
  animation: pet-particle 0.8s ease-out forwards;
  animation-delay: var(--delay);
  background: #fff !important;
  box-shadow: 0 0 10px 3px rgba(255,255,255,0.8);
}
@keyframes pet-particle {
  from { opacity: 1; transform: translate(0, 0) scale(1.2); }
  to   { opacity: 0; transform: translate(var(--px), var(--py)) scale(0); }
}
</style>
