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
import { watch, onScopeDispose, type Ref } from 'vue'
import { useMusicStore } from '@/stores/music'
import { useAudioAnalyzer } from '@/composables/useAudioAnalyzer'
import { getLyrics, type MusicFile } from '@/api/music'
import { parseLRC, currentLyric, type LyricLine } from '@/lib/lrc'
import type { SpeechBubbleApi } from '../useSpeechBubble'

const SINGING_MOUTH_MIN = 0.1
const SINGING_MOUTH_MAX = 1.5
const HEAD_SWAY_SPEED = 0.002
const MOUTH_CYCLE_SPEED = 0.12 // 张嘴周期（弧度/帧，≈5frame 一个完整开合）

export function useLive2DSinging(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelRef: Ref<any>,
  bubble: SpeechBubbleApi,
  singingChecked: Ref<boolean>,
  onSingingExit: () => void,
) {
  const store = useMusicStore()
  const { hasSignal, startSignalCheck, stopSignalCheck } = useAudioAnalyzer()

  let mouthOpen = 0
  let eyeOpen = 1
  let eyeOpenTarget = 1
  let eyeSwitchTimer: ReturnType<typeof setInterval> | null = null
  let headPhase = 0
  let mouthPhase = 0
  let ticking = false
  let hasLyric = false  // 当前是否有歌词

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

    // 张嘴：有歌词时正弦波一张一合，无歌词时平滑闭嘴
    if (hasLyric) {
      mouthPhase += MOUTH_CYCLE_SPEED
      const cycle = (Math.sin(mouthPhase) + 1) / 2
      const target = SINGING_MOUTH_MIN + cycle * (SINGING_MOUTH_MAX - SINGING_MOUTH_MIN)
      mouthOpen += (target - mouthOpen) * 0.3
    } else {
      mouthOpen += (0 - mouthOpen) * 0.08
    }
    setParam(model, 'ParamMouthOpenY', Math.max(0, mouthOpen))

    eyeOpen += (eyeOpenTarget - eyeOpen) * 0.05
    setParam(model, 'ParamEyeLOpen', eyeOpen)
    setParam(model, 'ParamEyeROpen', eyeOpen)

    headPhase += HEAD_SWAY_SPEED
    setParam(model, 'ParamAngleX', Math.sin(headPhase) * 8)
    setParam(model, 'ParamAngleY', Math.cos(headPhase * 1.3) * 4)

    requestAnimationFrame(singingTick)
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

  // ===== 唱歌启停 =====
  async function startSinging() {
    const model = modelRef.value
    if (!model) return
    setParam(model, 'Param', 1)
    singingChecked.value = true
    ticking = true
    startEyeSwitch()
    singingTick()
    showIntro()
    if (store.currentSong) loadLRC(store.currentSong)
  }

  function stopSinging() {
    ticking = false
    if (eyeSwitchTimer) { clearInterval(eyeSwitchTimer); eyeSwitchTimer = null }
    const model = modelRef.value
    if (model) {
      setParam(model, 'Param', 0)
      setParam(model, 'ParamMouthOpenY', 0)
      setParam(model, 'ParamEyeLOpen', 1)
      setParam(model, 'ParamEyeROpen', 1)
    }
    clearIntro()
    bubble.hide()
    lastKey = ''
    lyrics = []
    loadedFor = ''
    stopSignalCheck()
    onSingingExit()
  }

  watch(() => store.isPlaying, (playing) => {
    if (playing) startSignalCheck()
    else { stopSignalCheck(); stopSinging() }
  }, { immediate: true })

  watch(hasSignal, (active) => {
    if (store.isPlaying && active) startSinging()
  })

  onScopeDispose(clearIntro)
  return { startSinging, stopSinging, tryResumeSinging: startSinging }
}
