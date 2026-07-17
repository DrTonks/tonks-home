<script setup lang="ts">
/**
 * QuestionBubble — 云朵提问气泡。
 * 独立于 SpeechBubble，出现在桌宠头顶/脚下。
 *
 * collapsed：纯云朵轮廓 + 中间 "..." 跳动
 * expanded：  圆角卡片 + 问题 + 输入区 + Check/Close 图标按钮
 *
 * 点击区域覆盖整个 .question-cloud-wrapper，
 * 通过 @pointerdown.stop + @click.stop 防止事件穿透到桌宠。
 */
import { ref, watch, computed, nextTick, type Component } from 'vue'
import {
  Check,
  Close,
  User,
  Present,
  Brush,
  ForkSpoon,
  Sunny,
} from '@element-plus/icons-vue'

const props = withDefaults(
  defineProps<{
    visible?: boolean
    questionText?: string
    inputType?: 'text' | 'choice'
    choices?: string[]
    placeholder?: string
    iconName?: string
    placement?: 'top' | 'bottom'
    verticalOffset?: number
  }>(),
  {
    visible: false,
    questionText: '',
    inputType: 'text',
    choices: () => [],
    placeholder: '',
    iconName: 'User',
    placement: 'top',
    verticalOffset: 90,
  },
)

const emit = defineEmits<{
  submit: [answer: string]
  reject: []
  close: []
}>()

// ===== 状态 =====
const isExpanded = ref(false)
const inputValue = ref('')
const selectedChoice = ref('')
const isClosing = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      isExpanded.value = false
      isClosing.value = false
      inputValue.value = ''
      selectedChoice.value = ''
    }
  },
)

watch(isExpanded, async (v) => {
  if (v && props.inputType === 'text') {
    await nextTick()
    inputRef.value?.focus()
  }
})

// ===== 图标映射 =====
const iconMap: Record<string, Component> = {
  User,
  Present,
  Brush,
  ForkSpoon,
  Sunny,
}
const resolvedIcon = computed(() => iconMap[props.iconName] || User)

// ===== 拖拽 =====
const dragOffset = ref({ x: 0, y: 0 })
let isDragging = false
let dragStart = { x: 0, y: 0 }
let dragBase = { x: 0, y: 0 }

function onDragPointerDown(e: PointerEvent) {
  if (!isExpanded.value) return
  // 只在 expanded 卡片本体上可拖拽（排除内部交互元素：input/button）
  const target = e.target as HTMLElement
  if (target.closest('input, button')) return
  e.stopPropagation()
  isDragging = true
  dragStart = { x: e.clientX, y: e.clientY }
  dragBase = { x: dragOffset.value.x, y: dragOffset.value.y }
  // 捕获指针以便在元素外移动时仍能收到事件
  ;(e.target as HTMLElement)?.setPointerCapture?.(e.pointerId)
}

function onDragPointerMove(e: PointerEvent) {
  if (!isDragging) return
  dragOffset.value = {
    x: dragBase.x + e.clientX - dragStart.x,
    y: dragBase.y + e.clientY - dragStart.y,
  }
}

function onDragPointerUp(_e: PointerEvent) {
  isDragging = false
}

// visible 变化时重置拖拽位置
watch(() => props.visible, (v) => {
  if (v) {
    dragOffset.value = { x: 0, y: 0 }
  }
})

// ===== 操作 =====

function onCloudClick(e: MouseEvent) {
  e.stopPropagation()
  if (isClosing.value || isDragging) return
  if (!isExpanded.value) isExpanded.value = true
}

function stopPointer(e: PointerEvent) {
  e.stopPropagation()
}

function submitAnswer() {
  const answer = props.inputType === 'choice'
    ? (selectedChoice.value || inputValue.value)
    : inputValue.value
  if (!answer.trim()) return

  isClosing.value = true
  emit('submit', answer.trim())
  setTimeout(() => {
    isExpanded.value = false
    isClosing.value = false
    inputValue.value = ''
    selectedChoice.value = ''
  }, 250)
}

function handleReject() {
  isClosing.value = true
  emit('reject')
  setTimeout(() => {
    isExpanded.value = false
    isClosing.value = false
  }, 250)
}

function handleClose() {
  isExpanded.value = false
  isClosing.value = false
  inputValue.value = ''
  selectedChoice.value = ''
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') submitAnswer()
  if (e.key === 'Escape') {
    if (isExpanded.value) {
      // expanded 态 Escape → 等同于拒绝，通知父组件清理状态
      handleReject()
    } else {
      handleClose()
    }
  }
}

function selectChoice(c: string) {
  selectedChoice.value = c
  inputValue.value = c
}
</script>

<template>
  <Transition name="cloud">
    <div
      v-if="visible && !isClosing"
      class="question-cloud-wrapper"
      :class="[`place-${placement}`, { 'no-animate': isDragging }]"
      :style="{
        ...(placement === 'top'
          ? { top: `-${verticalOffset}px` }
          : { bottom: `-${verticalOffset - 10}px` }),
        transform: `translateX(-50%) translate(${dragOffset.x}px, ${dragOffset.y}px)`,
      }"
      role="dialog"
      aria-label="桌宠提问"
      @pointerdown.stop="stopPointer"
      @pointerup.stop="stopPointer"
      @click.stop="onCloudClick"
      @keydown="onKeydown"
    >
      <!-- ===== collapsed：纯云朵 + ... ===== -->
      <div v-if="!isExpanded" class="cloud-collapsed">
        <span class="cloud-icon">
          <component :is="resolvedIcon" />
        </span>
        <span class="cloud-dots" aria-label="点击展开提问">
          <i /><i /><i />
        </span>
      </div>

      <!-- ===== expanded：可拖拽卡片 ===== -->
      <div
        v-else
        class="cloud-expanded"
        :class="{ dragging: isDragging }"
        @pointerdown="onDragPointerDown"
        @pointermove="onDragPointerMove"
        @pointerup="onDragPointerUp"
        @pointercancel="onDragPointerUp"
      >
        <p class="cloud-question-text">{{ questionText }}</p>

        <!-- choice 预设选项 -->
        <div v-if="inputType === 'choice' && choices.length" class="cloud-choices">
          <button
            v-for="c in choices"
            :key="c"
            class="cloud-choice-btn"
            :class="{ selected: selectedChoice === c }"
            @click.stop="selectChoice(c)"
          >
            {{ c }}
          </button>
        </div>

        <!-- 输入行 -->
        <div class="cloud-input-row">
          <input
            ref="inputRef"
            v-model="inputValue"
            class="cloud-input"
            :placeholder="placeholder || '输入...'"
            :maxlength="100"
            @keydown="onKeydown"
            @click.stop
            @pointerdown.stop="stopPointer"
          />
        </div>

        <!-- 操作按钮行 -->
        <div class="cloud-action-row">
          <button
            class="cloud-action-btn submit-btn"
            :class="{ disabled: !inputValue.trim() && !selectedChoice }"
            title="发送"
            @click.stop="submitAnswer"
            @pointerdown.stop="stopPointer"
          >
            <Check />
          </button>
          <button
            class="cloud-action-btn reject-btn"
            title="拒绝（不再提问）"
            @click.stop="handleReject"
            @pointerdown.stop="stopPointer"
          >
            <Close />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ===== 容器 ===== */
.question-cloud-wrapper {
  position: absolute;
  z-index: 62;
  cursor: pointer;
  pointer-events: auto;
  animation: cloud-float 3s ease-in-out infinite;
}

.question-cloud-wrapper.no-animate {
  animation-play-state: paused;
}

.place-top,
.place-bottom {
  left: 50%;
  transform: translateX(-50%);
}

/* ===== collapsed：纯云朵轮廓（重叠圆形技法） ===== */
.cloud-collapsed {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  /* 中心圆 */
  width: 44px;
  height: 30px;
  border-radius: 50%;
  background: var(--cloud-fill, #fff);
  /* 用多层 box-shadow 构建云朵轮廓 —— 所有颜色用 --cloud-fill */
  box-shadow:
    /* 左下大凸起 */
    -20px 4px 0 4px var(--cloud-fill),
    /* 右下凸起 */
    17px 4px 0 3px var(--cloud-fill),
    /* 左远凸起 */
    -32px 8px 0 -2px var(--cloud-fill),
    /* 右远凸起 */
    29px 8px 0 -2px var(--cloud-fill),
    /* 顶部中央凸起 */
    0px -10px 0 3px var(--cloud-fill),
    /* 左上凸起 */
    -14px -6px 0 1px var(--cloud-fill),
    /* 右上凸起 */
    12px -6px 0 1px var(--cloud-fill),
    /* 底部阴影 */
    var(--cloud-shadow, 0 4px 16px rgba(0,0,0,0.08)), 0 1px 3px rgba(0,0,0,0.04);
  transition: transform 0.3s ease;
}

.cloud-collapsed:hover {
  transform: scale(1.08);
}

/* collapsed 内部元素 */
.cloud-collapsed .cloud-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: hsl(var(--muted-foreground));
  opacity: 0.45;
  flex-shrink: 0;
}

.cloud-collapsed .cloud-dots {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  flex-shrink: 0;
}

.cloud-collapsed .cloud-dots i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: hsl(var(--muted-foreground));
  opacity: 0.4;
  animation: dot-bounce 1.2s ease-in-out infinite;
}

.cloud-collapsed .cloud-dots i:nth-child(2) { animation-delay: 0.15s; }
.cloud-collapsed .cloud-dots i:nth-child(3) { animation-delay: 0.3s; }

/* ===== expanded：干净圆角卡片（无伪元素） ===== */
.cloud-expanded {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 220px;
  max-width: 260px;
  padding: 16px 20px;
  background: var(--cloud-fill, #fff);
  border-radius: 20px;
  box-shadow: var(--cloud-shadow, 0 4px 20px rgba(0,0,0,0.12)), 0 1px 3px rgba(0,0,0,0.06);
  cursor: grab;
  user-select: none;
  transition:
    width 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-radius 0.35s ease,
    padding 0.3s ease;
}

.cloud-expanded.dragging {
  cursor: grabbing;
  box-shadow: var(--cloud-shadow, 0 8px 32px rgba(0,0,0,0.18)), 0 2px 6px rgba(0,0,0,0.08);
}

.cloud-question-text {
  font-size: 13px;
  line-height: 1.5;
  color: hsl(var(--foreground));
  text-align: center;
  margin: 0;
  word-break: break-word;
}

.cloud-choices {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.cloud-choice-btn {
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-family: inherit;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  border: 1px solid hsl(var(--border));
  cursor: pointer;
  transition: all var(--duration-fast, 150ms) ease;
}

.cloud-choice-btn:hover {
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
}

.cloud-choice-btn.selected {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-color: hsl(var(--primary));
}

.cloud-input-row {
  display: flex;
  gap: 6px;
  width: 100%;
}

.cloud-input {
  flex: 1;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 13px;
  font-family: inherit;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  outline: none;
  transition: border-color var(--duration-fast, 150ms);
}

.cloud-input::placeholder {
  color: hsl(var(--color-ink-3, 207 11% 55%));
}

.cloud-input:focus {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
}

.cloud-action-row {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  width: 100%;
}

.cloud-action-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid hsl(var(--border));
  cursor: pointer;
  font-size: 15px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  transition: all var(--duration-fast, 150ms) ease;
}

.cloud-action-btn:hover {
  background: hsl(var(--muted));
}

.submit-btn {
  color: hsl(var(--primary));
  border-color: hsl(var(--primary) / 0.3);
}

.submit-btn:hover {
  background: hsl(var(--primary) / 0.1);
}

.submit-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.reject-btn {
  color: hsl(var(--muted-foreground));
}

.reject-btn:hover {
  color: hsl(var(--destructive));
  border-color: hsl(var(--destructive) / 0.3);
  background: hsl(var(--destructive) / 0.08);
}

/* ===== 动画 ===== */
@keyframes cloud-float {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50%      { transform: translateX(-50%) translateY(-4px); }
}

@keyframes dot-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30%           { transform: translateY(-3px); opacity: 1; }
}

/* ===== 进出场 ===== */
.cloud-enter-active {
  transition: opacity 0.3s ease-out, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.cloud-leave-active {
  transition: opacity 0.2s ease-in, transform 0.25s ease-in;
}

.cloud-enter-from,
.cloud-leave-to {
  opacity: 0;
  transform: translateX(-50%) scale(0.6);
}
</style>
