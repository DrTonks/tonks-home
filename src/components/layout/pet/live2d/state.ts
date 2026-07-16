/**
 * Live2D 桌宠共享状态 — 独立于旧桌宠的情绪体系（无 threat/rage）。
 */
import { ref, type Ref } from 'vue'

export type Live2DMood = 'idle' | 'happy' | 'angry' | 'cry' | 'sleep' | 'singing'

/** Expression → mood 映射（道具由用户右键控制，不在此映射中自动设置） */
export const EXPRESSION_MAP: Record<Live2DMood, { expr: string }> = {
  idle:    { expr: '3clever' },
  happy:   { expr: '3clever' },
  angry:   { expr: '4OAO' },
  cry:     { expr: '5QAQ' },
  sleep:   { expr: '9' },
  singing: { expr: '2mic' },
}

export const SLEEP_EXPRESSIONS = ['9'] as const

export const CRY_AFTER_MS = 2 * 60 * 1000
export const SLEEP_AFTER_MS = 4 * 60 * 1000

export interface Live2DParticle { id: number; originX: number; originY: number; dx: number; dy: number; delay: number }
export interface Live2DSingingNote { id: number; x: number; y: number; symbol: string; hue: number; delay: number }
export const NOTE_SYMBOLS = ['♪', '♫', '♩', '♬']

export interface Live2DPetState {
  mood: Ref<Live2DMood>
  pos: Ref<{ x: number; y: number }>
  moved: Ref<boolean>
  clickScale: Ref<boolean>
  activeExpression: Ref<string>
  singingChecked: Ref<boolean>
  particles: Ref<Live2DParticle[]>
  singingNotes: Ref<Live2DSingingNote[]>
}

export function createLive2DState(): Live2DPetState {
  return {
    mood: ref<Live2DMood>('idle'),
    pos: ref({ x: window.innerWidth - 310, y: 150 }),
    moved: ref(false),
    clickScale: ref(false),
    activeExpression: ref('3clever'),
    singingChecked: ref(false),
    particles: ref([]),
    singingNotes: ref([]),
  }
}
