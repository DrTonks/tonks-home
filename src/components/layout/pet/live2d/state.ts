/**
 * Live2D 桌宠共享状态 — 独立于旧桌宠的情绪体系（无 threat/rage）。
 */
import { ref, type Ref } from 'vue'

export type Live2DMood = 'idle' | 'happy' | 'angry' | 'cry' | 'sleep' | 'singing'

/** Expression → mood 映射。idle 无表达式（模型默认中性脸），其他 mood 各对应一个 exp3 */
export const EXPRESSION_MAP: Record<Live2DMood, { expr: string | null }> = {
  idle:    { expr: null },   // 默认无表情，resetExpression() 回到中性脸
  happy:   { expr: '3clever' },
  angry:   { expr: '4OAO' },
  cry:     { expr: '5QAQ' },
  sleep:   { expr: '9' },
  singing: { expr: '2mic' },
}

export const SLEEP_EXPRESSIONS = ['9'] as const

/** 睡眠闭眼程度（0=全闭 1=全开）— Emotion 初值与 Interaction 逐帧覆盖共用，两处必须一致 */
export const SLEEP_EYE_OPEN = 0.05

export const CRY_AFTER_MS = 3 * 60 * 1000
export const SLEEP_AFTER_MS = 5 * 60 * 1000

export interface Live2DParticle { id: number; originX: number; originY: number; dx: number; dy: number; delay: number }
export interface Live2DSingingNote { id: number; x: number; y: number; symbol: string; hue: number; delay: number }
export const NOTE_SYMBOLS = ['♪', '♫', '♩', '♬']

export interface Live2DPetState {
  mood: Ref<Live2DMood>
  pos: Ref<{ x: number; y: number }>
  moved: Ref<boolean>
  clickScale: Ref<boolean>
  activeExpression: Ref<string | null>
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
    activeExpression: ref<string | null>(null),
    singingChecked: ref(false),
    particles: ref([]),
    singingNotes: ref([]),
  }
}
