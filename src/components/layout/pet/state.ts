/**
 * 桌宠共享状态 — 所有 composable 共用
 */
import { ref, type Ref } from 'vue'

export type Mood = 'idle' | 'happy' | 'angry' | 'threat' | 'cry' | 'sleep'
export type Singing = 'singing-1' | 'singing-2' | 'singing-3' | 'singing-4'

export const W = 130
export const H = Math.round(W * 1.5)
export const BASE = 130
export function scale(px: number) { return px * W / BASE }

export function phys(breathAmp: number, breathHz: number, bobAmp: number, bobHz: number, shake: number) {
  return { breathAmp: scale(breathAmp), breathHz, bobAmp: bobAmp > 0 ? scale(bobAmp) : 0, bobHz, shake: shake > 0 ? scale(shake) : 0 }
}

export const PHYSICS: Record<Mood, ReturnType<typeof phys>> = {
  idle:   phys(0.012, 0.12, 1.5, 0.08, 0),
  happy:  phys(0.016, 0.14, 2.0, 0.10, 0),
  angry:  phys(0.028, 0.65, 0,   0,    1.4),
  threat: phys(0.034, 0.75, 0,   0,    2.4),
  cry:    phys(0.020, 0.18, 0,   0,    0.5),
  sleep:  phys(0.008, 0.06, 0,   0,    0),
}

export const FRAMES: Record<Mood | Singing, string> = {
  idle: '/assets/pet/idle.png', happy: '/assets/pet/happy.png', angry: '/assets/pet/angry.png',
  threat: '/assets/pet/threat.png', cry: '/assets/pet/cry.png', sleep: '/assets/pet/blink.png',
  'singing-1': '/assets/pet/singing-1.png', 'singing-2': '/assets/pet/singing-2.png',
  'singing-3': '/assets/pet/singing-3.png', 'singing-4': '/assets/pet/singing-4.png',
}

export const BLINK_FRAMES = { halfClosed: '/assets/pet/halfClosed.png', almostClosed: '/assets/pet/almostClosed.png', closed: '/assets/pet/blink.png' }
export const BLINK_SEQ = [
  { src: BLINK_FRAMES.halfClosed, duration: 80 },
  { src: BLINK_FRAMES.almostClosed, duration: 70 },
  { src: BLINK_FRAMES.closed, duration: 190 },
]

export const CLICK_TIMEOUT_MS = 2500
export const CRY_AFTER_MS = 2 * 60 * 1000
export const SLEEP_AFTER_MS = 4 * 60 * 1000
export const RAGE_CLICK_MIN = 4
export const RAGE_CLICK_MAX = 10
export const NOTE_SYMBOLS = ['♪', '♫', '♩', '♬']

export function rollThreshold(min: number, max: number) { return Math.floor(min + Math.random() * (max - min + 1)) }

export const TIER_CONFIG = [
  { mood: 'happy' as Mood,  minClicks: 1, maxClicks: 4 },
  { mood: 'angry' as Mood,  minClicks: 2, maxClicks: 6 },
  { mood: 'threat' as Mood, minClicks: 4, maxClicks: 10 },
]

export interface Particle { id: number; originX: number; originY: number; dx: number; dy: number; delay: number }
export interface SleepZ { id: number; x: number; y: number; text: string; delay: number }
export interface SingingNote { id: number; x: number; y: number; symbol: string; hue: number; delay: number }

export function createPetState() {
  // 响应式
  const mood: Ref<Mood> = ref('idle')
  const showFrame = ref(FRAMES.idle)
  const pos = ref({ x: window.innerWidth - W - 100, y: 80 })
  const dragging = ref(false)
  const moved = ref(false)
  const clickScale = ref(false)
  const action = ref<'idle' | 'sway' | 'bounce'>('idle')
  const actionProgress = ref(0)
  const singingAngry = ref(false)
  const rageActive = ref(false)
  const rageScale = ref(1)
  const singingState: Ref<Singing | null> = ref(null)
  const particles = ref<Particle[]>([])
  const sleepZs = ref<SleepZ[]>([])
  const singingNotes = ref<SingingNote[]>([])

  // 非响应式（计时器句柄、计数器、一次性值）
  const t = {
    blinkTimer: null as ReturnType<typeof setTimeout> | null,
    actionTimer: null as ReturnType<typeof setTimeout> | null,
    idleTimer: null as ReturnType<typeof setTimeout> | null,
    sleepTimer: null as ReturnType<typeof setTimeout> | null,
    clickTimer: null as ReturnType<typeof setTimeout> | null,
    singingTimer: null as ReturnType<typeof setTimeout> | null,
    sleepZTrainer: null as ReturnType<typeof setInterval> | null,
    rafId: null as number | null,
    rageAnimId: null as number | null,
  }

  const c = {
    lastTick: performance.now(),
    phase: Math.random() * Math.PI * 2,
    shakePhase: Math.random() * Math.PI * 2,
    particleId: 0, sleepZId: 0, singingNoteId: 0,
    tierThresholds: [] as number[], clickCount: 0,
    rageThreshold: rollThreshold(RAGE_CLICK_MIN, RAGE_CLICK_MAX), rageClicks: 0,
    musicStopped: false,
    startClientX: 0, startClientY: 0, startPosX: 0, startPosY: 0,
  }

  return { mood, showFrame, pos, dragging, moved, clickScale, action, actionProgress, singingAngry, rageActive, rageScale, singingState, particles, sleepZs, singingNotes, t, c }
}

export type PetState = ReturnType<typeof createPetState>
