<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useMusicStore } from '@/stores/music'
import { useAudioAnalyzer } from '@/composables/useAudioAnalyzer'

const emit = defineEmits<{ rage: [] }>()

type Mood = 'idle' | 'happy' | 'angry' | 'threat' | 'cry' | 'sleep'
type Singing = 'singing-1' | 'singing-2' | 'singing-3' | 'singing-4'

const FRAMES: Record<Mood | Singing, string> = {
  idle: '/assets/pet/idle.png',
  happy: '/assets/pet/happy.png',
  angry: '/assets/pet/angry.png',
  threat: '/assets/pet/threat.png',
  cry: '/assets/pet/cry.png',
  sleep: '/assets/pet/blink.png',
  'singing-1': '/assets/pet/singing-1.png',
  'singing-2': '/assets/pet/singing-2.png',
  'singing-3': '/assets/pet/singing-3.png',
  'singing-4': '/assets/pet/singing-4.png',
}

const musicStore = useMusicStore()
const { hasSignal, startSignalCheck, stopSignalCheck } = useAudioAnalyzer()
const BLINK_FRAMES = {
  halfClosed: '/assets/pet/halfClosed.png',
  almostClosed: '/assets/pet/almostClosed.png',
  closed: '/assets/pet/blink.png',
}

const BLINK_SEQ: Array<{ src: string; duration: number }> = [
  { src: BLINK_FRAMES.halfClosed, duration: 80 },
  { src: BLINK_FRAMES.almostClosed, duration: 70 },
  { src: BLINK_FRAMES.closed, duration: 190 },
]

// ===== 桌宠尺寸（图片 2:3 竖长方形） =====
const W = 130
const H = Math.round(W * 1.5) 

// 呼吸/抖动参数（基于宽度比例，以 130px 为基准）
const BASE = 130
function scale(px: number) { return px * W / BASE }

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
const SLEEP_AFTER_MS = 4 * 60 * 1000  // cry 2 分钟后再 2 分钟 → sleep

// 点击升级缓冲：每个阶段的所需点击数为随机区间
function rollThreshold(min: number, max: number) { return Math.floor(min + Math.random() * (max - min + 1)) }

// 暴怒：threat 状态连续点击触发
const RAGE_CLICK_MIN = 4
const RAGE_CLICK_MAX = 10
let rageThreshold = rollThreshold(RAGE_CLICK_MIN, RAGE_CLICK_MAX)
let rageClicks = 0
const rageActive = ref(false)
const rageScale = ref(1)
let rageAnimId: number | null = null

function resetRageThreshold() {
  rageThreshold = rollThreshold(RAGE_CLICK_MIN, RAGE_CLICK_MAX)
  rageClicks = 0
}

const TIER_CONFIG = [
  { mood: 'happy' as Mood,  minClicks: 1, maxClicks: 4 },
  { mood: 'angry' as Mood,  minClicks: 2, maxClicks: 6 },
  { mood: 'threat' as Mood, minClicks: 4, maxClicks: 10 },
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
const pos = ref({ x: window.innerWidth - W - 100, y: 80 })
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
    transform: `scale(${(1 + breath) * rageScale.value}) translateY(${bob + bounce}px) translateX(${shake + sway}px)`,
  }
})

// 眨眼
function scheduleBlink() {
  if (singingState.value) return  // 唱歌时不眨眼
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
  if (singingState.value) return  // 唱歌时不触发动作
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
    stopSleepZs()
    tryResumeSinging()
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
      startSleepZs()
    }
  }, SLEEP_AFTER_MS)
}

// 粒子特效
const particles = ref<Array<{ id: number; originX: number; originY: number; dx: number; dy: number; delay: number }>>([])
let particleId = 0

function spawnParticles(count: number, clickX?: number, clickY?: number) {
  const cx = clickX ?? W / 2
  const cy = clickY ?? H / 2

  const newParticles = Array.from({ length: count }, () => ({
    id: ++particleId,
    originX: cx + (Math.random() - 0.5) * 16,
    originY: cy + (Math.random() - 0.5) * 16,
    dx: (Math.random() - 0.5) * 200,
    dy: (Math.random() - 0.5) * 200 - 50,
    delay: Math.random() * 120,
  }))
  particles.value = [...particles.value, ...newParticles]
  setTimeout(() => {
    particles.value = particles.value.filter((p) => !newParticles.includes(p))
  }, 1000)
}

// 睡眠 Z 字符
interface SleepZ {
  id: number
  x: number
  y: number
  text: string
  delay: number
}
const sleepZs = ref<SleepZ[]>([])
let sleepZId = 0
let sleepZTrainer: ReturnType<typeof setInterval> | null = null

function spawnSleepZ() {
  const z: SleepZ = {
    id: ++sleepZId,
    x: W * 0.4 + Math.random() * W * 0.5,     // 头部区域偏右
    y: -10 + Math.random() * 30,                // 头顶附近
    text: Math.random() < 0.4 ? 'Z' : 'z',
    delay: Math.random() * 400,
  }
  sleepZs.value = [...sleepZs.value, z]
  setTimeout(() => {
    sleepZs.value = sleepZs.value.filter((s) => s.id !== z.id)
  }, 2800)
}

function startSleepZs() {
  if (sleepZTrainer) return
  spawnSleepZ()
  sleepZTrainer = setInterval(spawnSleepZ, 900)
}

function stopSleepZs() {
  if (sleepZTrainer) {
    clearInterval(sleepZTrainer)
    sleepZTrainer = null
  }
  // 不清空数组 — 已有的 Z 让 CSS 动画自然淡出
}

// ===== 唱歌状态机 =====
const SINGING_TRANSITIONS: Record<Singing, { next: Singing; prob: number }[]> = {
  'singing-1': [{ next: 'singing-2', prob: 0.4 }, { next: 'singing-4', prob: 0.6 }],
  'singing-2': [{ next: 'singing-1', prob: 0.5 }, { next: 'singing-3', prob: 0.5 }],
  'singing-3': [{ next: 'singing-2', prob: 0.4 }, { next: 'singing-4', prob: 0.6 }],
  'singing-4': [{ next: 'singing-3', prob: 0.4 }, { next: 'singing-1', prob: 0.6 }],
}

function pickNextSinging(from: Singing): Singing {
  const r = Math.random()
  let cum = 0
  for (const t of SINGING_TRANSITIONS[from]) {
    cum += t.prob
    if (r < cum) return t.next
  }
  return SINGING_TRANSITIONS[from][0].next
}

const singingState = ref<Singing | null>(null)
let singingTimer: ReturnType<typeof setTimeout> | null = null
let musicStopped = false

function scheduleSingingNext() {
  if (singingTimer) clearTimeout(singingTimer)

  // 音乐停止 + 当前在 singing-1 → 退出
  if (musicStopped && singingState.value === 'singing-1') {
    singingState.value = null
    showFrame.value = FRAMES.idle
    resetIdleTimers()
    scheduleBlink()
    scheduleAction()
    return
  }

  singingTimer = setTimeout(() => {
    if (!singingState.value) return
    const next = pickNextSinging(singingState.value)
    singingState.value = next
    showFrame.value = FRAMES[next]
    spawnSingingNotes(3)
    // 50% 概率触发微动（复用日常 sway/bounce 物理，不换帧）
    if (Math.random() < 0.5) {
      action.value = Math.random() < 0.5 ? 'sway' : 'bounce'
      actionProgress.value = 0
      const dur = 1200
      const tick = () => {
        actionProgress.value += 16 / dur
        if (actionProgress.value < 1) requestAnimationFrame(tick)
        else { action.value = 'idle'; actionProgress.value = 0 }
      }
      requestAnimationFrame(tick)
    }
    scheduleSingingNext()
  }, 700 + Math.random() * 2300)
}

function startSinging() {
  if (mood.value === 'threat') return
  musicStopped = false
  stopSleepZs()
  // 停掉所有可能干扰唱歌帧的定时器
  if (blinkTimer) { clearTimeout(blinkTimer); blinkTimer = null }
  if (actionTimer) { clearTimeout(actionTimer); actionTimer = null }
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
  if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null }
  mood.value = 'idle'
  singingState.value = 'singing-1'
  showFrame.value = FRAMES['singing-1']
  spawnSingingNotes(5)
  // 入场微动
  action.value = 'bounce'
  actionProgress.value = 0
  ;(function tick() {
    actionProgress.value += 16 / 1200
    if (actionProgress.value < 1) requestAnimationFrame(tick)
    else { action.value = 'idle'; actionProgress.value = 0 }
  })()
  scheduleSingingNext()
}

/** threat/sleep/cry 恢复到 idle 时，检测是否有音乐在播放 → 切入唱歌 */
function tryResumeSinging() {
  if (musicStore.isPlaying && !rageActive.value && mood.value !== 'threat') {
    startSinging()
  }
}

function handleMusicStop() {
  musicStopped = true
  if (!singingState.value) return
  if (singingState.value !== 'singing-1') {
    singingState.value = 'singing-1'
    showFrame.value = FRAMES['singing-1']
  }
  scheduleSingingNext()
}

function stopAllSinging() {
  if (singingTimer) { clearTimeout(singingTimer); singingTimer = null }
  singingState.value = null
  singingNotes.value = []
}

// 唱歌音符（类似 Z 但彩色发光）
interface SingingNote {
  id: number
  x: number
  y: number
  symbol: string
  hue: number
  delay: number
}
const singingNotes = ref<SingingNote[]>([])
let singingNoteId = 0

const NOTE_SYMBOLS = ['♪', '♫', '♩', '♬']

function spawnSingingNotes(count: number) {
  const notes = Array.from({ length: count }, () => ({
    id: ++singingNoteId,
    x: W * 0.2 + Math.random() * W * 0.7,
    y: -10 + Math.random() * 40,
    symbol: NOTE_SYMBOLS[Math.floor(Math.random() * NOTE_SYMBOLS.length)],
    hue: Math.random() * 360,
    delay: Math.random() * 300,
  }))
  singingNotes.value = [...singingNotes.value, ...notes]
  setTimeout(() => {
    singingNotes.value = singingNotes.value.filter((n) => !notes.includes(n))
  }, 2500)
}

// 监听音频信号：有实际声音时才唱歌 / 变化魔法环
watch(() => musicStore.isPlaying, (playing) => {
  if (rageActive.value) return
  if (playing) {
    startSignalCheck()
  } else {
    stopSignalCheck()
    handleMusicStop()
  }
})

// 信号变化 → 唱歌/停止
watch(hasSignal, (active) => {
  if (!musicStore.isPlaying || rageActive.value) return
  if (active) startSinging()
})

function startRage() {
  rageActive.value = true
  stopAllSinging()
  // 清掉所有可能在此期间重置 mood 的定时器
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null }
  if (blinkTimer) { clearTimeout(blinkTimer); blinkTimer = null }
  if (actionTimer) { clearTimeout(actionTimer); actionTimer = null }
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
  if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null }
  rageScale.value = 1
  let start = performance.now()
  const dur = 2500
  function animRage(now: number) {
    const t = Math.min(1, (now - start) / dur)
    // 快速微抖动频率
    shakePhase += 0.6
    // 慢慢变大
    rageScale.value = 1 + t * 0.6
    if (t < 1) {
      rageAnimId = requestAnimationFrame(animRage)
    } else {
      // 保持放大状态，触发 CRT 关机（回弹由外部重置）
      emit('rage')
      rageAnimId = null
    }
  }
  rageAnimId = requestAnimationFrame(animRage)
}

function handleClick(e: MouseEvent) {
  if (moved.value) { moved.value = false; return }
  if (rageActive.value) return

  // 唱歌模式：只出音符，不变情绪
  if (singingState.value) {
    triggerClickEffect()
    spawnSingingNotes(5)
    return
  }

  resetIdleTimers()
  triggerClickEffect()

  // 起床气：sleep → 直接 angry
  if (mood.value === 'sleep') {
    stopSleepZs()
    mood.value = 'angry'
    showFrame.value = FRAMES.angry
    clickCount = 0
    resetRageThreshold()
    if (clickTimer) clearTimeout(clickTimer)
    clickTimer = setTimeout(() => {
      resetClickTiers()
      mood.value = 'idle'
      showFrame.value = FRAMES.idle
      scheduleBlink()
      scheduleAction()
    }, CLICK_TIMEOUT_MS)
    return
  }

  const el = petRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const relX = e.clientX - rect.left
  const relY = e.clientY - rect.top
  spawnParticles(8, relX, relY)

  // 暴怒检测：threat 状态连续点击
  if (mood.value === 'threat') {
    rageClicks++
    if (rageClicks >= rageThreshold) {
      startRage()
      return
    }
    // 超时未点够 → 恢复 idle
    if (clickTimer) clearTimeout(clickTimer)
    clickTimer = setTimeout(() => {
      resetRageThreshold()
      if (mood.value === 'threat') {
        mood.value = 'idle'
        showFrame.value = FRAMES.idle
        scheduleBlink()
        scheduleAction()
        tryResumeSinging()
      }
    }, CLICK_TIMEOUT_MS)
    return
  }

  if (clickTimer) clearTimeout(clickTimer)
  clickCount++

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
    resetRageThreshold()
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
const singingAngry = ref(false) // 唱歌时被拖拽显示生气标记

function onPointerDown(e: PointerEvent) {
  if (mood.value === 'threat' || rageActive.value) return
  if (!singingState.value) resetIdleTimers()
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
    if (singingState.value) {
      // 唱歌模式：不换帧，显示生气标记
      singingAngry.value = true
    } else {
      mood.value = 'angry'; showFrame.value = FRAMES.angry
      if (blinkTimer) clearTimeout(blinkTimer)
    }
    pos.value = {
      x: Math.max(0, Math.min(window.innerWidth - W, startPosX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - H, startPosY + dy)),
    }
  }
}

function onPointerUp() {
  if (!dragging.value) return
  dragging.value = false
  if (moved.value) {
    singingAngry.value = false
    if (!singingState.value) {
      mood.value = 'idle'; showFrame.value = FRAMES.idle
      scheduleBlink(); scheduleAction(); resetIdleTimers()
    }
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
  // 展开时粒子从中心爆发
  setTimeout(() => spawnParticles(10, W / 2, H / 2), 300)
})

onBeforeUnmount(() => {
  if (blinkTimer) clearTimeout(blinkTimer)
  if (clickTimer) clearTimeout(clickTimer)
  if (idleTimer) clearTimeout(idleTimer)
  if (sleepTimer) clearTimeout(sleepTimer)
  if (actionTimer) clearTimeout(actionTimer)
  if (rafId !== null) cancelAnimationFrame(rafId)
  if (rageAnimId !== null) cancelAnimationFrame(rageAnimId)
  stopSleepZs()
  stopAllSinging()
})
</script>

<template>
  <!-- 层1：定位 + 事件（需显式宽高，fixed 元素不以内容撑开） -->
  <div
    class="fixed z-50 select-none cursor-grab active:cursor-grabbing"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px`, width: `${W}px`, height: `${H}px` }"
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
          class="pet-particle absolute w-2.5 h-2.5 rounded-full pointer-events-none z-50"
          :style="{
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            '--delay': `${p.delay}ms`,
            left: `${p.originX}px`,
            top: `${p.originY}px`,
          }"
        />
        <!-- 睡眠 Z 字符 -->
        <span
          v-for="z in sleepZs"
          :key="z.id"
          class="sleep-z absolute pointer-events-none z-50 select-none"
          :style="{
            left: `${z.x}px`,
            top: `${z.y}px`,
            animationDelay: `${z.delay}ms`,
          }"
        >{{ z.text }}</span>
        <!-- 唱歌音符 -->
        <span
          v-for="n in singingNotes"
          :key="n.id"
          class="singing-note absolute pointer-events-none z-50 select-none"
          :style="{
            left: `${n.x}px`,
            top: `${n.y}px`,
            '--hue': `${n.hue}`,
            animationDelay: `${n.delay}ms`,
          }"
        >{{ n.symbol }}</span>
        <img
          :src="showFrame"
          alt="桌宠"
          class="pointer-events-none select-none transition-transform duration-200"
          :class="clickScale ? 'scale-110' : 'scale-100'"
          :style="{ width: `${W}px`, height: `${H}px`, objectFit: 'contain' }"
          draggable="false"
        />
        <!-- 唱歌拖拽生气标记 -->
        <img
          v-if="singingAngry"
          src="/assets/pet/angry-icon.png"
          class="angry-mark absolute pointer-events-none z-50 select-none"
          alt="angry"
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
  box-shadow: 0 0 6px 2px rgba(255,255,255,0.7);
}
@keyframes pet-particle {
  0%   { opacity: 1; transform: scale(1.3); }
  40%  { opacity: 0.8; }
  100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.4); }
}

.sleep-z {
  font-family: 'Geist Sans', sans-serif;
  font-weight: 700;
  font-size: 22px;
  color: rgba(0, 0, 0, 0.65);
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.15);
  animation: sleep-z-float 2.5s ease-out forwards;
  animation-delay: var(--delay, 0ms);
  opacity: 0;
}

@keyframes sleep-z-float {
  0%   { opacity: 0; transform: translateY(0) scale(0.6); }
  15%  { opacity: 0.9; transform: translateY(-5px) scale(1); }
  70%  { opacity: 0.5; transform: translateY(-50px) translateX(8px) scale(1.1); }
  100% { opacity: 0; transform: translateY(-80px) translateX(15px) scale(0.7); }
}

.angry-mark {
  top: -12px;
  right: 2px;
  width: 28px;
  height: 28px;
  object-fit: contain;
  animation: angry-pop 0.3s ease-out;
}

@keyframes angry-pop {
  0%   { transform: scale(0); opacity: 0; }
  60%  { transform: scale(1.4); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.singing-note {
  font-size: 18px;
  color: hsl(var(--hue, 50), 80%, 65%);
  text-shadow: 0 0 10px hsl(var(--hue, 50), 90%, 60%),
               0 0 20px hsl(var(--hue, 50), 80%, 55%);
  animation: note-float 2.5s ease-out forwards;
  animation-delay: var(--delay, 0ms);
  opacity: 0;
}

@keyframes note-float {
  0%   { opacity: 0; transform: translateY(0) scale(0.5) rotate(-10deg); }
  20%  { opacity: 1; transform: translateY(-10px) scale(1.2) rotate(5deg); }
  60%  { opacity: 0.7; transform: translateY(-45px) translateX(10px) scale(1) rotate(15deg); }
  100% { opacity: 0; transform: translateY(-75px) translateX(20px) scale(0.5) rotate(30deg); }
}
</style>
