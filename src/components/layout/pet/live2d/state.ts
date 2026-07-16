/**
 * Live2D 桌宠共享状态 — 独立于旧桌宠的情绪体系（无 threat/rage）。
 */
import { ref, type Ref } from 'vue'

export type Live2DMood = 'idle' | 'happy' | 'angry' | 'cry' | 'sleep' | 'singing'

/** Expression → mood 映射 */
export const EXPRESSION_MAP: Record<Live2DMood, { expr: string; props?: Record<string, number> }> = {
  idle:    { expr: '3clever',   props: { Param4: 1 } },
  happy:   { expr: '3clever',   props: { Param4: 1 } },
  angry:   { expr: '4OAO' },
  cry:     { expr: '5QAQ' },
  sleep:   { expr: '7keyboard', props: { Param4: 1 } },
  singing: { expr: '2mic',      props: { Param: 1 } },
}

export const SLEEP_EXPRESSIONS = ['7keyboard', '9'] as const

export const CRY_AFTER_MS = 2 * 60 * 1000
export const SLEEP_AFTER_MS = 4 * 60 * 1000

export interface Live2DPetState {
  mood: Ref<Live2DMood>
  pos: Ref<{ x: number; y: number }>
  moved: Ref<boolean>
  clickScale: Ref<boolean>
  activeExpression: Ref<string>
  singingChecked: Ref<boolean>
}

export function createLive2DState(): Live2DPetState {
  return {
    mood: ref<Live2DMood>('idle'),
    pos: ref({ x: window.innerWidth - 310, y: 120 }),
    moved: ref(false),
    clickScale: ref(false),
    activeExpression: ref('3clever'),
    singingChecked: ref(false),
  }
}
