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
import { usePetEnvStore } from '@/stores/petEnv'

export type BubbleMode = 'thinking' | 'status' | 'typing' | 'lyric' | 'notes' | 'emoji'
export type BubbleStatusStage = 'thinking' | 'searching'
export interface SpeechReply {
  text: string
  image?: { src: string; label: string }
  onImageShown?: () => void
}

const THINK_MS = 600 // "..." 思考缓冲
const THINK_MIN_LEN = 4 // 句子 ≥ 此长度才走思考态（短句直接打字，免拖沓）
const TYPE_SPEED = 45 // 每字毫秒
const READ_BASE = 2000 // 打字完后的基础停留（阅读）时间
const READ_PER_CHAR = 250 // 每多一个字符延长的停留时间，让用户多看几眼
const SAY_COOLDOWN = 300 // 气泡收起后的冷却期，避免连续无缝冒泡，让它"喘口气"
const EMOJI_MS = 4000 // 表情包固定展示时长（区别于文字：文字随字数）
const FOLLOW_UP_EMOJI_MS = 3000 // 文字读完后的补充表情

/** 句库条目是否为表情包图片（public/assets/emoji 下的相对路径，或图片扩展名） */
export function isEmoji(s: string): boolean {
  return /^\/(?:assets\/emoji|emojis\/v\d+\/[a-z0-9-]+)\/[a-zA-Z0-9_-]+\.(png|jpe?g|gif|webp|apng)$/i.test(s)
}

export function useSpeechBubble() {
  const visible = ref(false)
  const mode = ref<BubbleMode>('thinking')
  const text = ref('')
  const original = ref('')
  const translation = ref('')
  const revision = ref(0)
  const emojiLabel = ref('表情')
  const emoji = ref('') // 表情包图片路径（emoji 模式）

  let thinkTimer: ReturnType<typeof setTimeout> | null = null
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  let pendingImage: SpeechReply['image']
  let onImageShown: SpeechReply['onImageShown']
  let lastHideAt = 0 // 上次气泡收起的时间戳（用于结束冷却）

  // Clicking/dragging or opening a menu cancels only the queued picture, keeping readable text.
  function cancelPendingReaction() {
    pendingImage = undefined
    onImageShown = undefined
  }

  function clearTimers() {
    cancelPendingReaction()
    if (thinkTimer) {
      clearTimeout(thinkTimer)
      thinkTimer = null
    }
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  /** 说一句日常话：（长句）思考 → 打字机 → 停留 → 淡出；短句跳过思考直接打字。force=true 跳过结束冷却（用于威胁句等重要时刻） */
  function say(sentence: string, force = false, skipThinking = false) {
    return sayReply(isEmoji(sentence)
      ? { text: '', image: { src: sentence, label: '表情' } }
      : { text: sentence }, force, skipThinking)
  }

  function sayReply(reply: SpeechReply, force = false, skipThinking = false): boolean {
    const sentence = reply.text
    const image = reply.image && isEmoji(reply.image.src) ? reply.image : undefined
    if (!sentence && !image) return false
    const petEnv = usePetEnvStore()
    if (petEnv.isQuestionActive && !force) return false
    if (!force && performance.now() - lastHideAt < SAY_COOLDOWN) return false
    clearTimers()
    pendingImage = image
    onImageShown = reply.onImageShown
    revision.value++
    text.value = ''
    emoji.value = ''
    visible.value = true
    const showImage = (duration: number) => {
      const next = pendingImage
      const notifyShown = onImageShown
      cancelPendingReaction()
      if (!next || (sentence && petEnv.isQuestionActive)) { hide(); return }
      text.value = ''
      emoji.value = next.src
      emojiLabel.value = next.label
      mode.value = 'emoji'
      notifyShown?.()
      hideTimer = setTimeout(hide, duration)
    }
    const show = () => {
      if (!sentence) { showImage(EMOJI_MS); return }
      text.value = sentence
      mode.value = 'typing'
      const dwell = sentence.length * TYPE_SPEED + READ_BASE + sentence.length * READ_PER_CHAR
      hideTimer = setTimeout(() => {
        if (pendingImage) showImage(FOLLOW_UP_EMOJI_MS)
        else hide()
      }, dwell)
    }
    if (!skipThinking && (image || sentence.length >= THINK_MIN_LEN)) {
      mode.value = 'thinking'
      thinkTimer = setTimeout(show, THINK_MS)
    } else show()
    return true
  }

  /** 外部异步流程状态：常显，直到 say/hide/其它模式显式替换。 */
  function showStatus(stage: BubbleStatusStage) {
    revision.value++
    emoji.value = ''
    clearTimers()
    mode.value = 'status'
    text.value = stage === 'searching' ? '联网搜索中…' : '思考中…'
    original.value = stage
    visible.value = true
  }

  /** 歌词模式：常显，外部按进度反复调用切行 */
  function showLyric(orig: string, trans = '') {
    revision.value++
    emoji.value = ''
    clearTimers()
    mode.value = 'lyric'
    original.value = orig
    translation.value = trans
    visible.value = true
  }

  /** 无歌词时段：彩色音符 */
  function showNotes() {
    revision.value++
    emoji.value = ''
    clearTimers()
    mode.value = 'notes'
    visible.value = true
  }

  function hide() {
    revision.value++
    emoji.value = ''
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
    emoji,
    emojiLabel,
    revision,
    say,
    sayReply,
    cancelPendingReaction,
    showStatus,
    showLyric,
    showNotes,
    hide,
    isMusicMode,
  }
}

export type SpeechBubbleApi = ReturnType<typeof useSpeechBubble>
