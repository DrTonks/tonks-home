/**
 * Live2D 情绪映射 composable — 独立于旧桌宠的表情体系。
 *
 * 点击升级（无暴怒）：
 *   idle → happy → angry → cry → 超时回 idle
 *
 * 闲置计时：
 *   2 min → cry
 *   4 min → sleep（9 随机）
 *
 * 环境感知：音乐播放 → singing（2mic）
 */
import { type Ref, onScopeDispose } from 'vue'
import {
  type Live2DMood,
  type Live2DPetState,
  EXPRESSION_MAP,
  SLEEP_EXPRESSIONS,
  CRY_AFTER_MS,
  SLEEP_AFTER_MS,
} from './state'

const CLICK_TIMEOUT_MS = 3500 // 点击升级后自动回 idle 的超时（比旧桌宠略长）

/** 点击升级链（随机阈值，与 DesktopPet 的 TIER_CONFIG 一致） */
const TIER_CONFIG: { mood: Live2DMood; min: number; max: number }[] = [
  { mood: 'happy', min: 1, max: 4 },
  { mood: 'angry', min: 2, max: 6 },
  { mood: 'cry',   min: 4, max: 10 },
]

function rollThreshold(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1))
}

export function useLive2DEmotion(
  state: Live2DPetState,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelRef: Ref<any>,
  isSinging?: Ref<boolean>,
) {
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let sleepTimer: ReturnType<typeof setTimeout> | null = null
  let clickTimer: ReturnType<typeof setTimeout> | null = null
  let clickCount = 0
  let tierThresholds: number[] = []
  /** cry 来源：true=点击升级到 cry，false=闲置计时器触发 cry */
  let cryFromClick = false

  function clearIdleTimers() {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
    if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null }
  }

  function resetIdleTimers() {
    clearIdleTimers()
    if (isSinging?.value) return
    idleTimer = setTimeout(() => {
      if (state.mood.value === 'idle' || state.mood.value === 'happy') { cryFromClick = false; applyMood('cry') }
    }, CRY_AFTER_MS)
    sleepTimer = setTimeout(() => {
      if (state.mood.value === 'cry' || state.mood.value === 'idle') applyMood('sleep')
    }, SLEEP_AFTER_MS)
  }

  function seedClickTiers() {
    tierThresholds = TIER_CONFIG.map((t) => rollThreshold(t.min, t.max))
  }

  function initIdleTimers() {
    clickCount = 0
    seedClickTiers()
    if (!isSinging?.value) resetIdleTimers()
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

  async function applyMood(mood: Live2DMood) {
    const model = modelRef.value
    if (!model) return

    let mapping = EXPRESSION_MAP[mood]
    if (!mapping) mapping = EXPRESSION_MAP.idle

    if (mood === 'sleep') {
      const pick = SLEEP_EXPRESSIONS[Math.floor(Math.random() * SLEEP_EXPRESSIONS.length)]
      mapping = { expr: pick }
    }

    state.mood.value = mood
    state.activeExpression.value = mapping.expr
    // idle → 重置回默认中性脸；其他 mood → 加载对应 exp3
    if (mapping.expr) {
      await model.expression(mapping.expr)
    } else {
      // expressionManager 在 motionManager 下，不是 internalModel 直接属性
      // 去掉当前表情，回到模型默认状态（外设 desk/mic 不受影响）
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (model.internalModel as any)?.motionManager?.expressionManager?.resetExpression?.()
      } catch { /* ignore */ }
    }
    setModelParam(model, 'Param31', 0)
    setModelParam(model, 'Param55', 1)
    setModelParam(model, 'ParamCheek', mood === 'happy' ? 0.9 : 0.5)
  }

  /** 点击处理 — Live2D 专属（无暴怒） */
  function handleClick() {
    if (state.mood.value === 'sleep') {
      applyMood('angry')
      resetIdleTimers()
      if (clickTimer) clearTimeout(clickTimer)
      clickTimer = setTimeout(() => { clickCount = 0; seedClickTiers(); applyMood('idle'); resetIdleTimers() }, CLICK_TIMEOUT_MS)
      return
    }
    if (state.mood.value === 'cry') {
      if (cryFromClick) {
        // 点击升级的 cry：刷新计时器，超时后自动恢复
        resetIdleTimers()
        if (clickTimer) clearTimeout(clickTimer)
        clickTimer = setTimeout(() => {
          clickCount = 0; seedClickTiers(); cryFromClick = false
          applyMood('idle'); resetIdleTimers()
        }, CLICK_TIMEOUT_MS)
      } else {
        // 闲置进入的 cry：点醒回 idle
        applyMood('idle')
        resetIdleTimers()
      }
      return
    }

    resetIdleTimers()
    if (clickTimer) clearTimeout(clickTimer)
    clickCount++

    let matchedMood: Live2DMood = 'idle'
    let cum = 0
    for (let i = 0; i < tierThresholds.length; i++) {
      cum += tierThresholds[i]
      if (clickCount >= cum) matchedMood = TIER_CONFIG[i].mood
      else break
    }
    if (matchedMood !== 'idle') {
      if (matchedMood === 'cry') cryFromClick = true // 标记：cry 由点击触发
      applyMood(matchedMood)
    }

    clickTimer = setTimeout(() => {
      clickCount = 0
      seedClickTiers()
      const m = state.mood.value
      // idle/sleep 不动；闲置进入的 cry 不动；happy/angry/点击升级 cry → 回 idle
      if (m === 'sleep') return
      if (m === 'cry' && !cryFromClick) return
      cryFromClick = false
      applyMood('idle')
      resetIdleTimers()
    }, CLICK_TIMEOUT_MS)
  }

  function checkSingingEnv(isMusicPlaying: boolean) {
    if (isMusicPlaying && !state.singingChecked.value) {
      state.singingChecked.value = true
      applyMood('singing')
    }
  }

  onScopeDispose(() => clearIdleTimers())

  return {
    applyMood,
    handleClick,
    initIdleTimers,
    resetIdleTimers,
    clearIdleTimers,
    checkSingingEnv,
  }
}
