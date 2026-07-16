/**
 * Live2D 情绪映射 composable — 独立于旧桌宠的表情体系。
 *
 * 点击升级（无暴怒）：
 *   idle → happy → angry → cry → 超时回 idle
 *
 * 闲置计时：
 *   2 min → cry
 *   4 min → sleep（7keyboard 或 9 随机）
 *
 * 环境感知：音乐播放 → singing（2mic）
 */
import { type Ref } from 'vue'
import {
  type Live2DMood,
  type Live2DPetState,
  EXPRESSION_MAP,
  SLEEP_EXPRESSIONS,
  CRY_AFTER_MS,
  SLEEP_AFTER_MS,
} from './state'

const CLICK_TIMEOUT_MS = 2500

/** Live2D 专属点击升级链（3 级，无暴怒） */
const CLICK_TIERS: { mood: Live2DMood; requiredClicks: number }[] = [
  { mood: 'happy', requiredClicks: 1 },
  { mood: 'angry', requiredClicks: 3 },
  { mood: 'cry',   requiredClicks: 7 },
]

export function useLive2DEmotion(
  state: Live2DPetState,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelRef: Ref<any>,
) {
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let sleepTimer: ReturnType<typeof setTimeout> | null = null
  let clickTimer: ReturnType<typeof setTimeout> | null = null
  let clickCount = 0

  function clearIdleTimers() {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
    if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null }
  }

  function resetIdleTimers() {
    clearIdleTimers()
    if (state.mood.value === 'cry' || state.mood.value === 'sleep') {
      applyMood('idle')
    }
    idleTimer = setTimeout(() => {
      if (state.mood.value === 'idle' || state.mood.value === 'happy') applyMood('cry')
    }, CRY_AFTER_MS)
    sleepTimer = setTimeout(() => {
      if (state.mood.value === 'cry' || state.mood.value === 'idle') applyMood('sleep')
    }, SLEEP_AFTER_MS)
  }

  function initIdleTimers() {
    clickCount = 0
    resetIdleTimers()
  }

  function applyMood(mood: Live2DMood) {
    const model = modelRef.value
    if (!model) return

    let mapping = EXPRESSION_MAP[mood]
    if (!mapping) mapping = EXPRESSION_MAP.idle

    if (mood === 'sleep') {
      const pick = SLEEP_EXPRESSIONS[Math.floor(Math.random() * SLEEP_EXPRESSIONS.length)]
      mapping = { expr: pick, props: { Param4: 1 } }
    }

    state.mood.value = mood
    state.activeExpression.value = mapping.expr
    model.expression(mapping.expr)

    const props = mapping.props ?? {}
    setModelProps(model, props)

    setModelParam(model, 'ParamCheek', mood === 'happy' ? 0.9 : 0.5)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setModelProps(model: any, props: Record<string, number>) {
    for (const [id, value] of Object.entries(props)) {
      setModelParam(model, id, value)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setModelParam(model: any, paramId: string, value: number) {
    try {
      const core = model.internalModel?.coreModel as Record<string, unknown> | null
      const fn = core?.setParameterValueById as
        ((id: string, value: number, weight?: number) => void) | undefined
      fn?.call(core, paramId, value, 1)
    } catch { /* ignore */ }
  }

  /** 点击处理 — Live2D 专属（无暴怒） */
  function handleClick() {
    if (state.mood.value === 'sleep') {
      applyMood('angry')
      resetIdleTimers()
      return
    }

    resetIdleTimers()
    if (clickTimer) clearTimeout(clickTimer)
    clickCount++

    // 找到当前达到的最高 tier
    let matchedMood: Live2DMood = 'idle'
    for (const tier of CLICK_TIERS) {
      if (clickCount >= tier.requiredClicks) {
        matchedMood = tier.mood
      }
    }
    if (matchedMood !== 'idle') applyMood(matchedMood)

    clickTimer = setTimeout(() => {
      clickCount = 0
      const m = state.mood.value
      if (m !== 'cry' && m !== 'sleep') {
        applyMood('idle')
        resetIdleTimers()
      }
    }, CLICK_TIMEOUT_MS)
  }

  function checkSingingEnv(isMusicPlaying: boolean) {
    if (isMusicPlaying && !state.singingChecked.value) {
      state.singingChecked.value = true
      applyMood('singing')
    }
  }

  return {
    applyMood,
    handleClick,
    initIdleTimers,
    resetIdleTimers,
    clearIdleTimers,
    checkSingingEnv,
  }
}
