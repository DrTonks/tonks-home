<script setup lang="ts">
/**
 * DevQuestionPanel — 管理员调试提问面板（可拖拽浮窗）。
 *
 * 列出所有问题，点击立即触发云朵提问。
 * "触发记忆句"按钮随机调用句库 memory 行。
 * 仅管理员可见。
 */
import { ref } from 'vue'
import { Close, Promotion } from '@element-plus/icons-vue'
import { usePetMemory } from '@/composables/usePetMemory'
import questionsData from '@/data/pet-questions.json'

interface PetQuestion {
  id: string; key: string | null
  personas: { static: string; live2d: string }
  inputType: string; choices: string[] | null
  placeholder: string; icon: string
}
const allQuestions = questionsData as PetQuestion[]

withDefaults(
  defineProps<{
    visible?: boolean
    persona?: 'static' | 'live2d'
    hasMemories?: boolean
    questionIsActive?: boolean
  }>(),
  { visible: false, persona: 'static', hasMemories: false, questionIsActive: false },
)

const emit = defineEmits<{
  'trigger-question': [questionId: string]
  'trigger-memory': []
  close: []
}>()

const memory = usePetMemory()

// ===== 拖拽 =====
const panelPos = ref({ x: 0, y: 0 })
let isDragging = false
let dragStart = { x: 0, y: 0 }
let dragBase = { x: 0, y: 0 }

function onHeaderPointerDown(e: PointerEvent) {
  isDragging = true
  dragStart = { x: e.clientX, y: e.clientY }
  dragBase = { x: panelPos.value.x, y: panelPos.value.y }
  ;(e.target as HTMLElement)?.setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  e.stopPropagation()
  if (!isDragging) return
  panelPos.value = {
    x: dragBase.x + e.clientX - dragStart.x,
    y: dragBase.y + e.clientY - dragStart.y,
  }
}

function onPointerUp(e: PointerEvent) {
  e.stopPropagation()
  isDragging = false
}

function getQuestionStatus(q: PetQuestion): 'answered' | 'rejected' | 'available' {
  if (q.key && memory.hasMemory(q.key)) return 'answered'
  if (memory.isRejected(q.id)) return 'rejected'
  return 'available'
}

function statusLabel(s: string): string {
  return { answered: '已答', rejected: '已拒', available: '未问' }[s] || s
}
</script>

<template>
  <div
    v-if="visible"
    class="dev-panel"
    :style="{ transform: `translate(${panelPos.x}px, ${panelPos.y}px)` }"
    @pointerdown.stop
    @pointermove.stop="onPointerMove"
    @pointerup.stop="onPointerUp"
    @pointercancel.stop="onPointerUp"
  >
    <!-- 标题栏（拖拽手柄） -->
    <div
      class="dev-header"
      @pointerdown.stop="onHeaderPointerDown"
    >
      <span class="dev-title">🛠 调试提问</span>
      <button class="dev-close" title="关闭" @click="emit('close')">
        <Close />
      </button>
    </div>

    <!-- 问题列表 -->
    <div class="dev-body">
      <button
        v-for="q in allQuestions"
        :key="q.id"
        class="dev-q-btn"
        :class="getQuestionStatus(q)"
        :disabled="questionIsActive || getQuestionStatus(q) === 'answered'"
        @click="emit('trigger-question', q.id)"
      >
        <span class="dev-q-persona">{{ q.personas[persona] }}</span>
        <span class="dev-q-badge">{{ statusLabel(getQuestionStatus(q)) }}</span>
      </button>

      <div class="dev-divider" />

      <button
        class="dev-mem-btn"
        :class="{ disabled: !hasMemories }"
        :disabled="!hasMemories"
        title="随机触发一句记忆句"
        @click="emit('trigger-memory')"
      >
        <Promotion /> 触发记忆句
      </button>
    </div>
  </div>
</template>

<style scoped>
.dev-panel {
  position: fixed;
  top: 120px;
  right: 20px;
  z-index: 210;
  width: 260px;
  max-height: 70vh;
  background: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
  box-shadow:
    0 8px 32px rgba(0,0,0,0.18),
    0 2px 8px rgba(0,0,0,0.08);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
}

.dev-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: grab;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.3);
}

.dev-header:active { cursor: grabbing; }

.dev-title {
  font-size: 13px;
  font-weight: 650;
}

.dev-close {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%;
  background: transparent; color: hsl(var(--muted-foreground));
  cursor: pointer; font-size: 14px;
}
.dev-close:hover { background: hsl(var(--muted)); }

.dev-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dev-q-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background));
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  text-align: left;
  color: hsl(var(--foreground));
  transition: all 120ms;
}
.dev-q-btn:hover:not(:disabled) {
  border-color: hsl(var(--primary) / 0.4);
  background: hsl(var(--primary) / 0.06);
}
.dev-q-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.dev-q-btn.answered { border-left: 3px solid hsl(var(--primary)); }
.dev-q-btn.rejected { border-left: 3px solid hsl(var(--muted-foreground) / 0.5); opacity: 0.65; }
.dev-q-btn.available { border-left: 3px solid transparent; }

.dev-q-persona { flex: 1; }
.dev-q-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  flex-shrink: 0;
}

.dev-divider {
  height: 1px;
  background: hsl(var(--border));
  margin: 4px 0;
}

.dev-mem-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  border: 1px dashed hsl(var(--primary) / 0.4);
  border-radius: 8px;
  background: hsl(var(--primary) / 0.06);
  color: hsl(var(--primary));
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all 120ms;
}
.dev-mem-btn:hover:not(.disabled) {
  background: hsl(var(--primary) / 0.12);
}
.dev-mem-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
