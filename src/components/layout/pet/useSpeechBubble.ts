/**
 * 桌宠对话气泡状态机。
 * 内容源无关：日常句、歌词都通过它驱动同一个 SpeechBubble。
 *  - say(text)：日常句 —— 先 "..." 思考态缓冲，再打字机逐字，停留后淡出
 *  - showLyric(original, translation)：歌词模式（常显，随行切换）
 *  - showNotes()：无歌词时段的彩色音符态
 *  - hide()：淡出
 * 生命周期用计时器串联；任何新调用都会清掉上一次的计时器（打断/覆盖）。
 */
import { ref } from 'vue'

export type BubbleMode = 'thinking' | 'typing' | 'lyric' | 'notes'

const THINK_MS = 600 // "..." 思考缓冲
const THINK_MIN_LEN = 4 // 句子 ≥ 此长度才走思考态（短句直接打字，免拖沓）
const TYPE_SPEED = 45 // 每字毫秒
const READ_BASE = 2000 // 打字完后的基础停留（阅读）时间
const READ_PER_CHAR = 250 // 每多一个字符延长的停留时间，让用户多看几眼
const SAY_COOLDOWN = 300 // 气泡收起后的冷却期，避免连续无缝冒泡，让它"喘口气"

export function useSpeechBubble() {
  const visible = ref(false)
  const mode = ref<BubbleMode>('thinking')
  const text = ref('')
  const original = ref('')
  const translation = ref('')

  let thinkTimer: ReturnType<typeof setTimeout> | null = null
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  let lastHideAt = 0 // 上次气泡收起的时间戳（用于结束冷却）

  function clearTimers() {
    if (thinkTimer) {
      clearTimeout(thinkTimer)
      thinkTimer = null
    }
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  /** 说一句日常话：（长句）思考 → 打字机 → 停留 → 淡出；短句跳过思考直接打字 */
  function say(sentence: string) {
    if (!sentence) return
    // 结束冷却：气泡刚收起不久则跳过本次，避免高频点击时无缝连续冒泡
    if (performance.now() - lastHideAt < SAY_COOLDOWN) return
    clearTimers()
    text.value = ''
    visible.value = true
    const showText = () => {
      mode.value = 'typing'
      text.value = sentence
      // 停留 = 基础 2000ms + 每字延长；字越多看得越久
      const dwell = sentence.length * TYPE_SPEED + READ_BASE + sentence.length * READ_PER_CHAR
      hideTimer = setTimeout(hide, dwell)
    }
    if (sentence.length >= THINK_MIN_LEN) {
      mode.value = 'thinking'
      thinkTimer = setTimeout(showText, THINK_MS)
    } else {
      showText()
    }
  }

  /** 歌词模式：常显，外部按进度反复调用切行 */
  function showLyric(orig: string, trans = '') {
    clearTimers()
    mode.value = 'lyric'
    original.value = orig
    translation.value = trans
    visible.value = true
  }

  /** 无歌词时段：彩色音符 */
  function showNotes() {
    clearTimers()
    mode.value = 'notes'
    visible.value = true
  }

  function hide() {
    clearTimers()
    visible.value = false
    lastHideAt = performance.now()
  }

  /** 是否正处于歌词/音符（音乐）模式 —— 供接入层判断优先级 */
  function isMusicMode() {
    return visible.value && (mode.value === 'lyric' || mode.value === 'notes')
  }

  return {
    visible,
    mode,
    text,
    original,
    translation,
    say,
    showLyric,
    showNotes,
    hide,
    isMusicMode,
    TYPE_SPEED,
  }
}

export type SpeechBubbleApi = ReturnType<typeof useSpeechBubble>
