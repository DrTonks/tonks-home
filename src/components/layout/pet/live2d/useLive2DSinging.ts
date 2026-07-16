/**
 * Live2D 桌宠唱歌状态机 — 独立体系。
 *
 * 唱歌模式：
 *  - 自动显示 2mic 道具
 *  - ParamMouthOpenY 随节拍振荡（张嘴跟唱）
 *  - 闭眼/睁眼随机切换（沉浸感）
 *  - 音符粒子 + LRC 歌词气泡
 *  - 头部摇晃
 */
import { ref, watch, onScopeDispose, type Ref } from 'vue'
import { useMusicStore } from '@/stores/music'
import { useAudioAnalyzer } from '@/composables/useAudioAnalyzer'
import { getLyrics, type MusicFile } from '@/api/music'
import { parseLRC, currentLyric, type LyricLine } from '@/lib/lrc'
import type { SpeechBubbleApi } from '../useSpeechBubble'

const SINGING_MOUTH_MIN = 0.05
const SINGING_MOUTH_MAX = 1.6
const HEAD_SWAY_SPEED = 0.002

export function useLive2DSinging(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelRef: Ref<any>,
  bubble: SpeechBubbleApi,
  singingChecked: Ref<boolean>,
  onSingingEnter: () => void,
  onSingingExit: () => void,
  onSpawnNotes?: (count: number) => void,
) {
  const store = useMusicStore()
  const { hasSignal, startSignalCheck, stopSignalCheck } = useAudioAnalyzer()
  const isSinging = ref(false)

  let mouthOpen = 0
  let eyeOpen = 1
  let eyeOpenTarget = 1
  let eyeSwitchTimer: ReturnType<typeof setInterval> | null = null
  let headPhase = 0
  let mouthLerp = 0.08    // 逼近目标值 lerp 系数（随机变化）
  let mouthTarget = 0     // 当前张嘴目标
  let mouthHoldTimer = 0  // 张嘴后保持的剩余时间
  let ticking = false
  let hasLyric = false
  let singingRafId: number | null = null
  let noteSpawnTimer: ReturnType<typeof setTimeout> | null = null

  // LRC 歌词
  let lyrics: LyricLine[] = []
  let loadedFor = ''
  let lastKey = ''
  let introTimer: ReturnType<typeof setTimeout> | null = null
  const INTRO_MS = 3000

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setParam(model: any, id: string, v: number) {
    try {
      const core = model.internalModel?.coreModel as Record<string, unknown> | null
      const fn = core?.setParameterValueById as
        ((id: string, value: number, weight?: number) => void) | undefined
      fn?.call(core, id, v, 1)
    } catch { /* ignore */ }
  }

  function singingTick() {
    const model = modelRef.value
    if (!model || !ticking) return

    // 张嘴：模拟真实唱歌的吐字随机性
    if (hasLyric) {
      mouthHoldTimer -= 0.016
      if (mouthHoldTimer <= 0) {
        // 随机决定下一个动作：张嘴 / 闭嘴 / 微张
        const r = Math.random()
        if (r < 0.55) {
          // 张大口（重音/长音）：0.2~0.8s
          mouthTarget = 0.5 + Math.random() * 0.5
          mouthLerp = 0.15 + Math.random() * 0.2
          mouthHoldTimer = 0.2 + Math.random() * 0.6
        } else if (r < 0.85) {
          // 小幅张开（轻音/短音）：0.1~0.4s
          mouthTarget = 0.15 + Math.random() * 0.35
          mouthLerp = 0.2 + Math.random() * 0.25
          mouthHoldTimer = 0.1 + Math.random() * 0.3
        } else {
          // 短暂闭嘴（换气/停顿）：0.05~0.25s
          mouthTarget = 0
          mouthLerp = 0.1 + Math.random() * 0.15
          mouthHoldTimer = 0.05 + Math.random() * 0.2
        }
        mouthTarget = Math.max(SINGING_MOUTH_MIN, Math.min(SINGING_MOUTH_MAX, mouthTarget * (SINGING_MOUTH_MAX - SINGING_MOUTH_MIN) + SINGING_MOUTH_MIN))
      }
    } else {
      mouthTarget = 0
      mouthLerp = 0.06
      mouthHoldTimer = 0
    }
    mouthOpen += (mouthTarget - mouthOpen) * mouthLerp
    setParam(model, 'ParamMouthOpenY', Math.max(0, mouthOpen))

    eyeOpen += (eyeOpenTarget - eyeOpen) * 0.05
    setParam(model, 'ParamEyeLOpen', eyeOpen)
    setParam(model, 'ParamEyeROpen', eyeOpen)

    headPhase += HEAD_SWAY_SPEED
    setParam(model, 'ParamAngleX', Math.sin(headPhase) * 8)
    setParam(model, 'ParamAngleY', Math.cos(headPhase * 1.3) * 4)

    singingRafId = requestAnimationFrame(singingTick)
  }

  function startEyeSwitch() {
    eyeSwitchTimer = setInterval(() => {
      eyeOpenTarget = Math.random() < 0.35 ? 0.05 : 0.9 + Math.random() * 0.1
    }, 1200 + Math.random() * 2500)
  }

  // ===== LRC =====
  function clearIntro() {
    if (introTimer) { clearTimeout(introTimer); introTimer = null }
  }

  function showIntro() {
    bubble.showNotes()
    lastKey = 'N'
    clearIntro()
    introTimer = setTimeout(() => {
      if (lastKey === 'N') { bubble.hide(); lastKey = '' }
      introTimer = null
    }, INTRO_MS)
  }

  function updateLRC(t: number) {
    if (!ticking) return
    const line = lyrics.length ? currentLyric(lyrics, t) : null
    if (line) {
      const key = 'L' + line.time
      if (key !== lastKey) {
        clearIntro()
        bubble.showLyric(line.texts[0] ?? '', line.texts[1] ?? '')
        lastKey = key
      }
      hasLyric = true
    } else if (lastKey && lastKey !== 'N') {
      bubble.hide()
      lastKey = ''
      hasLyric = false // 间奏 → 闭嘴
    } else {
      hasLyric = false
    }
  }

  async function loadLRC(song: MusicFile | null) {
    lyrics = []
    loadedFor = song?.filename ?? ''
    if (song?.hasLyrics) {
      const text = await getLyrics(song.filename)
      if (loadedFor === song.filename) {
        lyrics = parseLRC(text)
        updateLRC(store.currentTime)
      }
    }
  }

  watch(
    () => [store.currentSong?.filename] as const,
    ([fname]) => {
      if (ticking && fname && fname !== loadedFor) loadLRC(store.currentSong)
    },
  )
  watch(() => store.currentTime, updateLRC)

  // 唱歌前保存用户麦克风偏好，结束后恢复
  let savedMicState = 0

  // ===== 唱歌启停 =====
  async function startSinging() {
    // 重入防护：已在唱歌状态则忽略
    if (ticking) return

    const model = modelRef.value
    if (!model) return

    // 保存当前麦克风状态（用户可能已通过右键菜单开启）
    savedMicState = 0
    try {
      const core = model.internalModel?.coreModel as Record<string, unknown> | null
      savedMicState = (core?.getParameterValueById as ((id: string) => number) | undefined)?.call(core, 'Param') ?? 0
    } catch { /* ignore */ }

    setParam(model, 'Param', 1)
    singingChecked.value = true
    // 7b 修复：唱歌前清空闲置计时器，防止 cry/sleep 在唱歌期间误触发
    onSingingEnter()
    ticking = true
    isSinging.value = true
    startEyeSwitch()
    singingTick()
    showIntro()
    // 自动冒音符：setTimeout 链式，每次间隔独立随机 0.7~2.7s
    function scheduleNote() {
      if (!ticking) return
      noteSpawnTimer = setTimeout(() => {
        if (ticking) { onSpawnNotes?.(3); scheduleNote() }
      }, 700 + Math.random() * 2000)
    }
    scheduleNote()
    if (store.currentSong) loadLRC(store.currentSong)
  }

  function stopSinging() {
    ticking = false
    if (singingRafId !== null) { cancelAnimationFrame(singingRafId); singingRafId = null }
    if (eyeSwitchTimer) { clearInterval(eyeSwitchTimer); eyeSwitchTimer = null }
    if (noteSpawnTimer) { clearTimeout(noteSpawnTimer); noteSpawnTimer = null }
    const model = modelRef.value
    if (model) {
      // 恢复用户的麦克风偏好，而非强制关闭
      setParam(model, 'Param', savedMicState)
      setParam(model, 'ParamMouthOpenY', 0)
      setParam(model, 'ParamEyeLOpen', 1)
      setParam(model, 'ParamEyeROpen', 1)
    }
    clearIntro()
    bubble.hide()
    lastKey = ''
    lyrics = []
    loadedFor = ''
    isSinging.value = false
    stopSignalCheck()
    onSingingExit()
  }

  watch(() => store.isPlaying, (playing) => {
    if (playing) startSignalCheck()
    else { stopSignalCheck(); if (ticking) stopSinging() } // immediate 触发时不调 stopSinging（emotion 可能未初始化）
  }, { immediate: true })

  watch(hasSignal, (active) => {
    // C3：模型未加载完时忽略信号，checkSingingEnv 在 onMounted 中兜底
    if (store.isPlaying && active && modelRef.value) startSinging()
  })

  onScopeDispose(() => {
    clearIntro()
    if (singingRafId !== null) { cancelAnimationFrame(singingRafId); singingRafId = null }
    if (eyeSwitchTimer) { clearInterval(eyeSwitchTimer); eyeSwitchTimer = null }
    if (noteSpawnTimer) { clearTimeout(noteSpawnTimer); noteSpawnTimer = null }
    stopSignalCheck()
  })
  return { startSinging, stopSinging, isSinging, tryResumeSinging: startSinging }
}
