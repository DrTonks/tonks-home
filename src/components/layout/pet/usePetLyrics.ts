/**
 * 桌宠歌词模式：唱歌时按播放进度把 LRC 歌词（或无歌词时段的音符）喂给气泡。
 *  - 唱歌开始/换歌 → 拉取该歌 LRC（无 hasLyrics 即纯音乐）
 *  - 唱歌开场放一小段音符气泡后隐藏；有歌词时段 → showLyric；间奏/尾奏/纯音乐 → 收起气泡（不与桌宠自身音符特效重复）
 *  - 唱歌结束 → 收起气泡
 * 唱歌时日常 say 已被 DesktopPet 的 canDailyTalk/canEmotionTalk（!singingState）挡住，故不冲突。
 */
import { watch, onScopeDispose } from 'vue'
import { useMusicStore } from '@/stores/music'
import { getLyrics, type MusicFile } from '@/api/music'
import { parseLRC, currentLyric, type LyricLine } from '@/lib/lrc'
import type { PetState } from './state'
import type { SpeechBubbleApi } from './useSpeechBubble'

export function usePetLyrics(state: PetState, bubble: SpeechBubbleApi) {
  const store = useMusicStore()
  let lyrics: LyricLine[] = []
  let loadedFor = '' // 已加载歌词的文件名
  let lastKey = '' // 上次显示内容的 key，避免每帧重复调用
  let introTimer: ReturnType<typeof setTimeout> | null = null

  const INTRO_MS = 3000 // 唱歌开场音符气泡的显示时长

  function clearIntro() {
    if (introTimer) {
      clearTimeout(introTimer)
      introTimer = null
    }
  }

  // 唱歌开场：显示一小段音符气泡后自动隐藏（桌宠唱歌本就冒音符，气泡不必长挂、免重复）
  function showIntro() {
    bubble.showNotes()
    lastKey = 'N'
    clearIntro()
    introTimer = setTimeout(() => {
      if (lastKey === 'N') {
        bubble.hide()
        lastKey = ''
      }
      introTimer = null
    }, INTRO_MS)
  }

  function update(t: number) {
    if (!state.singingState.value || state.rageActive.value) return
    const line = lyrics.length ? currentLyric(lyrics, t) : null
    if (line) {
      const key = 'L' + line.time
      if (key !== lastKey) {
        clearIntro()
        bubble.showLyric(line.texts[0] ?? '', line.texts[1] ?? '')
        lastKey = key
      }
    } else if (lastKey && lastKey !== 'N') {
      // 从歌词切入无歌词时段（间奏/尾奏）→ 收起气泡，交给桌宠自身的音符特效
      bubble.hide()
      lastKey = ''
    }
    // 前奏/纯音乐（无 line 且非开场态）：不主动长挂音符，开场音符由 showIntro 处理
  }

  async function load(song: MusicFile | null) {
    lyrics = []
    loadedFor = song?.filename ?? ''
    if (song?.hasLyrics) {
      const text = await getLyrics(song.filename)
      if (loadedFor === song.filename) {
        // 防竞态：加载期间未换歌才应用
        lyrics = parseLRC(text)
        update(store.currentTime)
      }
    }
  }

  // 唱歌开始 / 换歌 → 加载歌词
  watch(
    () => [state.singingState.value, store.currentSong?.filename] as const,
    ([singing, fname]) => {
      if (singing && fname && fname !== loadedFor) load(store.currentSong)
    },
    { immediate: true },
  )

  // 播放进度 → 更新气泡
  watch(() => store.currentTime, update)

  // 唱歌状态变化：仅"开始"(null→singing-*)放开场音符；唱歌中切帧(singing-1↔2↔3↔4)不重触发
  watch(
    () => state.singingState.value,
    (s, prev) => {
      if (s && !prev) {
        showIntro()
        update(store.currentTime)
      } else if (!s && prev) {
        clearIntro()
        bubble.hide()
        lastKey = ''
        lyrics = []
        loadedFor = ''
      }
    },
  )

  // 组件卸载时清开场音符计时器（唱歌中被卸载的兜底）
  onScopeDispose(clearIntro)
}
