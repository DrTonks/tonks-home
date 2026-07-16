<script setup lang="ts">
/**
 * 桌宠对话气泡：玻璃拟物 + 指向桌宠的小尾巴，双主题自适应。
 * 四种模式：
 *  - thinking：显示 "..." 思考态（说话前的缓冲）
 *  - typing：打字机逐字打出日常句
 *  - lyric：歌词（原文为主 + 译文小字为次，直接切行不打字）
 *  - notes：彩色跳动音符（前奏/间奏/尾奏/纯音乐等无歌词时段）
 * placement 由父组件按桌宠在视口的位置动态计算，控制气泡朝向与尾巴方向。
 */
import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { NOTE_SYMBOLS } from './state'

type BubbleMode = 'thinking' | 'typing' | 'lyric' | 'notes' | 'emoji'
type Placement = 'left' | 'right'

const props = withDefaults(
  defineProps<{
    visible?: boolean
    mode?: BubbleMode
    text?: string // typing：完整句子（组件内逐字）
    original?: string // lyric：原文（主）
    translation?: string // lyric：译文（次）
    emoji?: string // emoji：表情包图片路径
    placement?: Placement
    verticalOffset?: number // 气泡垂直偏移 (top)
    horizontalOffset?: number // 气泡水平偏移 (right/left 表达式中的 px 值)
    typeSpeed?: number // 每字毫秒
  }>(),
  {
    visible: false,
    mode: 'thinking',
    text: '',
    original: '',
    translation: '',
    emoji: '',
    placement: 'left',
    verticalOffset: 14,
    horizontalOffset: 13,
    typeSpeed: 45,
  },
)

// ===== 打字机 =====
const typed = ref('')
const typingDone = ref(false) // 打字完成后隐藏光标，避免看起来还在打字
let typingTimer: ReturnType<typeof setInterval> | null = null

function stopTyping() {
  if (typingTimer) {
    clearInterval(typingTimer)
    typingTimer = null
  }
}
function startTyping(full: string) {
  stopTyping()
  typed.value = ''
  typingDone.value = false
  let i = 0
  typingTimer = setInterval(() => {
    typed.value = full.slice(0, ++i)
    if (i >= full.length) {
      stopTyping()
      typingDone.value = true
    }
  }, props.typeSpeed)
}

watch(
  () => [props.mode, props.text] as const,
  ([mode, text]) => {
    if (mode === 'typing') startTyping(text)
    else {
      stopTyping()
      typed.value = text
      typingDone.value = true
    }
  },
  { immediate: true },
)

onBeforeUnmount(stopTyping)

const noteSymbols = computed(() => NOTE_SYMBOLS)
</script>

<template>
  <Transition name="bubble">
    <div
      v-if="visible"
      class="pet-bubble"
      :class="[`place-${placement}`, { 'is-emoji': mode === 'emoji' }]"
      :style="placement
        ? { top: `${verticalOffset}px`, [placement === 'left' ? 'right' : 'left']: `calc(100% - ${horizontalOffset}px)` }
        : undefined"
      role="status"
      aria-live="polite"
    >
      <!-- 思考态：三点 -->
      <span v-if="mode === 'thinking'" class="dots" aria-label="正在输入">
        <i /><i /><i />
      </span>

      <!-- 日常句：打字机 -->
      <span v-else-if="mode === 'typing'" class="bubble-text">{{ typed
        }}<i v-if="!typingDone" class="caret" /></span>

      <!-- 歌词：原文主 + 译文次 -->
      <span v-else-if="mode === 'lyric'" class="lyric">
        <span class="lyric-main">{{ original }}</span>
        <span v-if="translation" class="lyric-sub">{{ translation }}</span>
      </span>

      <!-- 表情包：图片，气泡贴合尺寸 -->
      <img
        v-else-if="mode === 'emoji'"
        :src="emoji"
        class="bubble-emoji"
        alt="表情"
        draggable="false"
      />

      <!-- 无歌词时段：彩色跳动音符 -->
      <span v-else class="notes" aria-hidden="true">
        <i
          v-for="(n, idx) in noteSymbols"
          :key="idx"
          class="note"
          :style="{ '--i': idx }"
          >{{ n }}</i
        >
      </span>

      <!-- 尾巴 -->
      <span class="tail" />
    </div>
  </Transition>
</template>

<style scoped>
.pet-bubble {
  position: absolute;
  z-index: 60;
  max-width: 220px;
  min-width: 44px;
  width: max-content;
  padding: 8px 12px;
  border-radius: 14px;
  /* 玻璃：用较实的 popover token（亮 85% / 暗 94%），保证半透背景上文字可读 */
  background: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
  border: 1px solid hsl(var(--border));
  box-shadow: var(--shadow-pop, 0 8px 24px rgba(0, 0, 0, 0.18));
  backdrop-filter: blur(10px) saturate(150%);
  -webkit-backdrop-filter: blur(10px) saturate(150%);
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
  pointer-events: none;
  transform-origin: var(--bubble-origin, bottom center);
}

/* ===== 表情包：气泡贴合图片，去掉文字的内边距 ===== */
.pet-bubble.is-emoji {
  padding: 4px;
  min-width: 0;
  max-width: none;
  top: -16px; /* 表情包更高，补偿图片高度 */
}
.bubble-emoji {
  display: block;
  max-width: 100px;
  max-height: 100px;
  width: auto;
  height: auto;
  border-radius: 8px;
  object-fit: contain;
}

/* ===== 相对桌宠的方位（桌宠在 petRef 容器内，宽 W=130）=====
   气泡水平出现在桌宠一侧、对齐头部高度；尾巴在朝桌宠那侧、垂直居中，尖角指向桌宠。 */
.place-left {
  right: calc(100% - 13px);
  top: 14px;
  --bubble-origin: right center;
}
.place-right {
  left: calc(100% - 13px);
  top: 14px;
  --bubble-origin: left center;
}

/* ===== 尾巴（旋转方块，尖角指向桌宠）===== */
.tail {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  background: hsl(var(--popover));
}
.place-left .tail {
  right: -5px;
  transform: translateY(-50%) rotate(45deg);
  border-top: 1px solid hsl(var(--border));
  border-right: 1px solid hsl(var(--border));
}
.place-right .tail {
  left: -5px;
  transform: translateY(-50%) rotate(45deg);
  border-bottom: 1px solid hsl(var(--border));
  border-left: 1px solid hsl(var(--border));
}

/* ===== 日常句文字 ===== */
.bubble-text {
  white-space: pre-wrap;
  word-break: break-word;
}
.caret {
  display: inline-block;
  width: 1px;
  height: 1em;
  margin-left: 1px;
  background: currentColor;
  vertical-align: text-bottom;
  animation: caret-blink 0.8s step-end infinite;
}
@keyframes caret-blink {
  50% {
    opacity: 0;
  }
}

/* ===== 歌词 ===== */
.lyric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.lyric-main {
  font-size: 15px;
  font-weight: 600;
}
.lyric-sub {
  font-size: 12.5px;
  opacity: 0.72;
}

/* ===== 思考三点 ===== */
.dots {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 2px 2px;
}
.dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.5;
  animation: dot-bounce 1.2s ease-in-out infinite;
}
.dots i:nth-child(2) {
  animation-delay: 0.15s;
}
.dots i:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes dot-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

/* ===== 音符态（前奏/间奏/纯音乐）===== */
.notes {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  font-size: 15px;
}
.note {
  color: hsl(calc(var(--i) * 60 + 200) 80% 60%);
  animation: note-bob 1.4s ease-in-out infinite, note-hue 4s linear infinite;
  animation-delay: calc(var(--i) * 0.18s);
}
@keyframes note-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}
@keyframes note-hue {
  to {
    filter: hue-rotate(360deg);
  }
}

/* ===== 进出场 ===== */
.bubble-enter-active {
  transition: opacity 0.25s ease-out, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.bubble-leave-active {
  transition: opacity 0.2s ease-in, transform 0.2s ease-in;
}
.bubble-enter-from,
.bubble-leave-to {
  opacity: 0;
  transform: scale(0.7);
}

@media (prefers-reduced-motion: reduce) {
  .dots i,
  .note,
  .caret {
    animation: none;
  }
  .bubble-enter-active,
  .bubble-leave-active {
    transition: opacity 0.2s;
  }
}
</style>
