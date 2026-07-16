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

const CLICK_TIMEOUT_MS = 2500

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

  function clearIdleTimers() {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
    if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null }
  }

  function resetIdleTimers() {
    clearIdleTimers()
    // 唱歌期间不启动闲置计时器（保持默认/微笑状态）
    if (isSinging?.value) return
    idleTimer = setTimeout(() => {
      if (state.mood.value === 'idle' || state.mood.value === 'happy') applyMood('cry')
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
    // expression() 是 async，await 后才覆盖 leaf，否则 exp3.json 会重置
    await model.expression(mapping.expr)
    setModelParam(model, 'Param31', 0)
    setModelParam(model, 'Param55', 1)
    setModelParam(model, 'ParamCheek', mood === 'happy' ? 0.9 : 0.5)
  }

  /** 点击处理 — Live2D 专属（无暴怒） */
  function handleClick() {
    if (state.mood.value === 'sleep') {
      applyMood('angry')
      resetIdleTimers()
      return
    }

    // cry 时点击 → 恢复 idle（无论是点击升级还是挂机进入的 cry 都可被点醒）
    if (state.mood.value === 'cry') {
      applyMood('idle')
      resetIdleTimers()
      return
    }

    resetIdleTimers()
    if (clickTimer) clearTimeout(clickTimer)
    clickCount++

    // 累计随机阈值匹配当前 tier（与 DesktopPet 相同算法）
    let matchedMood: Live2DMood = 'idle'
    let cum = 0
    for (let i = 0; i < tierThresholds.length; i++) {
      cum += tierThresholds[i]
      if (clickCount >= cum) matchedMood = TIER_CONFIG[i].mood
      else break
    }
    if (matchedMood !== 'idle') applyMood(matchedMood)

    clickTimer = setTimeout(() => {
      clickCount = 0
      seedClickTiers()
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
