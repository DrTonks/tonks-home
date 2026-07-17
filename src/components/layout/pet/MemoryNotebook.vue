<script setup lang="ts">
/**
 * MemoryNotebook — 笔记风格记忆查看/编辑窗口。
 *
 * 视觉：左侧装订线 + 纸张纹理 + 淡横线
 * 交互：查看 / 内联编辑 / 删除
 */
import { ref, watch, nextTick, computed } from 'vue'
import { Edit, Delete, Close } from '@element-plus/icons-vue'
import { usePetMemory } from '@/composables/usePetMemory'
import questionsData from '@/data/pet-questions.json'

interface PetQuestion {
  id: string; key: string | null; personas: { static: string; live2d: string }
  inputType: string; choices: string[] | null; placeholder: string; icon: string
}
const allQuestions = questionsData as PetQuestion[]

const props = withDefaults(
  defineProps<{
    visible?: boolean
  }>(),
  { visible: false },
)

const emit = defineEmits<{ close: [] }>()

const memory = usePetMemory()

// ===== 编辑状态 =====
const editingKey = ref<string | null>(null)
const editValue = ref('')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let editInputEl: any = null

// ===== 已拒绝项的填写状态 =====
const fillQuestionId = ref<string | null>(null)
const fillValue = ref('')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fillInputEl: any = null

// ===== 记忆列表 =====
const entries = computed(() => {
  return Object.entries(memory.memories.value)
    .filter(([, v]) => v?.value)
    .map(([key, entry]) => ({
      key,
      value: entry.value,
      answeredAt: entry.answered_at,
      questionId: entry.question_id,
    }))
})

// ===== 已拒绝列表（含问题文案） =====
const rejectedItems = computed(() => {
  return memory.getRejectedIds()
    .map(id => {
      const q = allQuestions.find(q => q.id === id)
      return {
        id,
        questionText: q?.personas?.static ?? id,
        key: q?.key ?? null,
      }
    })
})

function keyLabel(key: string): string {
  const labels: Record<string, string> = {
    user_name: '称呼',
    birthday: '生日',
    favorite_color: '喜欢的颜色',
    favorite_food: '喜欢的食物',
  }
  return labels[key] || key
}

// ===== 记忆操作 =====

function startEdit(key: string, currentValue: string) {
  editingKey.value = key
  editValue.value = currentValue
  nextTick(() => editInputEl?.focus())
}

function saveEdit(key: string) {
  const entry = memory.memories.value[key]
  if (entry && editValue.value.trim()) {
    memory.setValue(key, editValue.value.trim(), entry.question_id)
  }
  editingKey.value = null
  editValue.value = ''
}

function cancelEdit() {
  editingKey.value = null
  editValue.value = ''
}

function deleteEntry(key: string) {
  memory.removeValue(key)
}

// ===== 已拒绝操作 =====

function startFill(qId: string) {
  fillQuestionId.value = qId
  fillValue.value = ''
  nextTick(() => fillInputEl?.focus())
}

function confirmFill(qId: string) {
  const q = allQuestions.find(q => q.id === qId)
  if (!q?.key || !fillValue.value.trim()) return
  memory.unrejectQuestion(qId)
  memory.setValue(q.key, fillValue.value.trim(), qId)
  fillQuestionId.value = null
  fillValue.value = ''
}

function cancelFill() {
  fillQuestionId.value = null
  fillValue.value = ''
}

// visible 变化时重置
watch(() => props.visible, (v) => {
  if (!v) {
    editingKey.value = null
    fillQuestionId.value = null
  }
})

function onKeydown(e: KeyboardEvent, key?: string) {
  if (e.key === 'Enter' && key) saveEdit(key)
  if (e.key === 'Escape') {
    if (editingKey.value) cancelEdit()
    else if (fillQuestionId.value) cancelFill()
    else emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="notebook">
      <div v-if="visible" class="notebook-overlay" @click.self="emit('close')">
        <div class="notebook-card" tabindex="-1" @keydown="onKeydown">
          <!-- ===== 左侧装订线 ===== -->
          <div class="binding-strip">
            <span
              v-for="i in 6"
              :key="i"
              class="binding-hole"
            />
            <span class="binding-thread" />
          </div>

          <!-- ===== 主体内容区 ===== -->
          <div class="notebook-body">
            <!-- 标题栏 -->
            <div class="notebook-header">
              <h3 class="notebook-title">📓 记忆笔记</h3>
              <button class="notebook-close-btn" title="关闭" @click="emit('close')">
                <Close />
              </button>
            </div>

            <!-- 记忆列表 -->
            <div class="notebook-pages">
              <!-- 空状态 -->
              <p v-if="!entries.length && !rejectedItems.length" class="notebook-empty">
                还没有任何记忆。我们的闲聊内容也许会出现在这里。
              </p>

              <!-- ===== 已拒绝分区 ===== -->
              <template v-if="rejectedItems.length">
                <div class="notebook-section-label">还不知道的事情qwq</div>
                <div
                  v-for="item in rejectedItems"
                  :key="item.id"
                  class="memory-row rejected-row"
                >
                  <span class="memory-label rejected-label">{{ item.questionText }}</span>

                  <!-- 填写态 -->
                  <template v-if="fillQuestionId === item.id">
                    <input
                      :ref="(el) => { fillInputEl = el as HTMLInputElement | null }"
                      v-model="fillValue"
                      class="memory-edit-input"
                      placeholder="输入答案..."
                      @keydown.enter="confirmFill(item.id)"
                      @keydown.escape="cancelFill"
                    />
                    <span class="memory-actions">
                      <button class="memory-action-btn save-hint" @click.stop="confirmFill(item.id)">✓</button>
                      <button class="memory-action-btn delete-btn" @click.stop="cancelFill">✕</button>
                    </span>
                  </template>

                  <!-- 查看态 -->
                  <template v-else>
                    <span class="memory-value muted-value">—</span>
                    <span class="memory-actions" style="opacity:1">
                      <button class="memory-action-btn fill-btn" title="填写" @click.stop="startFill(item.id)">
                        <Edit />
                      </button>
                    </span>
                  </template>
                </div>
              </template>

              <!-- 记忆条目 -->
              <div
                v-for="entry in entries"
                :key="entry.key"
                class="memory-row"
                :class="{ editing: editingKey === entry.key }"
              >
                <span class="memory-label">{{ keyLabel(entry.key) }}</span>

                <!-- 查看态 -->
                <template v-if="editingKey !== entry.key">
                  <span class="memory-value">{{ entry.value }}</span>
                  <span class="memory-actions">
                    <button
                      class="memory-action-btn edit-btn"
                      title="编辑"
                      @click.stop="startEdit(entry.key, entry.value)"
                    >
                      <Edit />
                    </button>
                    <button
                      class="memory-action-btn delete-btn"
                      title="删除"
                      @click.stop="deleteEntry(entry.key)"
                    >
                      <Delete />
                    </button>
                  </span>
                </template>

                <!-- 编辑态 -->
                <template v-else>
                  <input
                    :ref="(el) => { editInputEl = el as HTMLInputElement | null }"
                    v-model="editValue"
                    class="memory-edit-input"
                    @keydown="onKeydown($event, entry.key)"
                    @blur="saveEdit(entry.key)"
                  />
                  <span class="memory-actions">
                    <button class="memory-action-btn save-hint" @click.stop="saveEdit(entry.key)">✓</button>
                  </span>
                </template>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ===== 遮罩 ===== */
.notebook-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* ===== 卡片主体 ===== */
.notebook-card {
  display: flex;
  max-width: 420px;
  width: 90vw;
  max-height: 80vh;
  border-radius: 6px 14px 14px 6px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.18),
    0 2px 8px rgba(0, 0, 0, 0.10);
  overflow: hidden;
}

/* ===== 左侧装订线 ===== */
.binding-strip {
  position: relative;
  width: 26px;
  flex-shrink: 0;
  background: linear-gradient(
    to right,
    hsl(32 20% 72%),
    hsl(34 22% 80%) 40%,
    hsl(32 20% 76%)
  );
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding-top: 20px;
}

/* 装订孔 */
.binding-hole {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: hsl(30 15% 58%);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

/* 装订线（竖线穿过所有孔） */
.binding-thread {
  position: absolute;
  left: 50%;
  top: 28px;
  bottom: 28px;
  width: 1px;
  background: repeating-linear-gradient(
    to bottom,
    hsl(30 15% 52%) 0px,
    hsl(30 15% 52%) 8px,
    transparent 8px,
    transparent 20px
  );
  transform: translateX(-50%);
}

/* ===== 主体内容区（纸张） ===== */
.notebook-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* 纸张质感：奶油色底 + 淡横线 */
  background-color: #faf6f0;
  background-image:
    repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 27px,
      hsl(35 20% 86%) 27px,
      hsl(35 20% 86%) 28px
    );
}

/* ===== 标题栏 ===== */
.notebook-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px dashed hsl(35 15% 78%);
}

.notebook-title {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
  color: hsl(30 20% 22%);
  letter-spacing: 0.02em;
}

.notebook-close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: hsl(30 10% 45%);
  cursor: pointer;
  font-size: 16px;
  transition: all 150ms;
}

.notebook-close-btn:hover {
  background: hsl(30 15% 85%);
  color: hsl(30 20% 25%);
}

/* ===== 记忆列表区 ===== */
.notebook-pages {
  flex: 1;
  overflow-y: auto;
  padding: 8px 20px;
}

.notebook-empty {
  text-align: center;
  color: hsl(30 10% 50%);
  font-size: 13px;
  line-height: 1.7;
  padding: 32px 8px;
  margin: 0;
}

/* ===== 单条记忆 ===== */
.memory-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 4px;
  border-bottom: 1px dotted hsl(35 15% 82%);
  min-height: 44px;
  transition: background 150ms;
}

.memory-row:hover {
  background: hsl(35 25% 92% / 0.5);
}

.memory-row.editing {
  background: hsl(48 40% 92% / 0.6);
}

.memory-label {
  font-size: 12px;
  font-weight: 600;
  color: hsl(30 15% 45%);
  min-width: 64px;
  flex-shrink: 0;
  text-transform: capitalize;
}

.memory-value {
  flex: 1;
  font-size: 14px;
  color: hsl(30 20% 18%);
  word-break: break-word;
}

.memory-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 150ms;
}

.memory-row:hover .memory-actions,
.memory-row.editing .memory-actions {
  opacity: 1;
}

.memory-action-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  transition: all 120ms;
}

.edit-btn {
  color: hsl(30 15% 50%);
}

.edit-btn:hover {
  background: hsl(210 40% 88%);
  color: hsl(210 60% 45%);
}

.delete-btn {
  color: hsl(30 15% 50%);
}

.delete-btn:hover {
  background: hsl(0 40% 90%);
  color: hsl(0 55% 50%);
}

.save-hint {
  color: hsl(140 40% 40%);
}

.save-hint:hover {
  background: hsl(140 40% 88%);
}

.memory-edit-input {
  flex: 1;
  border: 1px solid hsl(35 15% 74%);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 14px;
  font-family: inherit;
  background: hsl(35 30% 96%);
  color: hsl(30 20% 18%);
  outline: none;
  min-width: 0;
}

.memory-edit-input:focus {
  border-color: hsl(35 30% 60%);
  box-shadow: 0 0 0 2px hsl(35 30% 75% / 0.3);
}

/* ===== 已拒绝分区 ===== */
.notebook-section-label {
  font-size: 11px;
  font-weight: 650;
  color: hsl(30 10% 55%);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 4px 4px;
  margin-top: 4px;
  border-top: 1px dashed hsl(35 10% 78%);
}

.rejected-row {
  opacity: 0.7;
}

.rejected-label {
  color: hsl(30 10% 55%);
  font-style: italic;
}

.muted-value {
  color: hsl(30 10% 60%);
  font-style: italic;
}

.fill-btn {
  color: hsl(30 15% 50%);
}

.fill-btn:hover {
  background: hsl(140 35% 86%);
  color: hsl(140 45% 38%);
}

/* ===== 进出场动画 ===== */
.notebook-enter-active {
  transition: opacity 0.25s ease-out;
}

.notebook-enter-active .notebook-card {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease-out;
}

.notebook-leave-active {
  transition: opacity 0.18s ease-in;
}

.notebook-leave-active .notebook-card {
  transition: transform 0.2s ease-in, opacity 0.18s ease-in;
}

.notebook-enter-from,
.notebook-leave-to {
  opacity: 0;
}

.notebook-enter-from .notebook-card {
  transform: scale(0.85) translateY(16px);
  opacity: 0;
}

.notebook-leave-to .notebook-card {
  transform: scale(0.9) translateY(8px);
  opacity: 0;
}

/* ===== 暗色主题 ===== */
:global(html.dark) .notebook-overlay {
  background: rgba(0, 0, 0, 0.55);
}

:global(html.dark) .binding-strip {
  background: linear-gradient(
    to right,
    hsl(30 10% 28%),
    hsl(30 12% 34%) 40%,
    hsl(30 10% 30%)
  );
}

:global(html.dark) .binding-hole {
  background: hsl(30 8% 22%);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
}

:global(html.dark) .binding-thread {
  background: repeating-linear-gradient(
    to bottom,
    hsl(30 10% 38%) 0px,
    hsl(30 10% 38%) 8px,
    transparent 8px,
    transparent 20px
  );
}

:global(html.dark) .notebook-body {
  background-color: hsl(30 10% 14%);
  background-image:
    repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 27px,
      hsl(30 8% 20%) 27px,
      hsl(30 8% 20%) 28px
    );
}

:global(html.dark) .notebook-header {
  border-bottom-color: hsl(30 8% 24%);
}

:global(html.dark) .notebook-title {
  color: hsl(35 20% 78%);
}

:global(html.dark) .notebook-close-btn {
  color: hsl(30 10% 55%);
}

:global(html.dark) .notebook-close-btn:hover {
  background: hsl(30 8% 28%);
  color: hsl(35 20% 80%);
}

:global(html.dark) .notebook-empty {
  color: hsl(30 8% 48%);
}

:global(html.dark) .memory-row {
  border-bottom-color: hsl(30 8% 22%);
}

:global(html.dark) .memory-row:hover {
  background: hsl(30 8% 20% / 0.4);
}

:global(html.dark) .memory-row.editing {
  background: hsl(45 15% 16% / 0.6);
}

:global(html.dark) .memory-label {
  color: hsl(35 15% 55%);
}

:global(html.dark) .memory-value {
  color: hsl(35 20% 82%);
}

:global(html.dark) .memory-edit-input {
  background: hsl(30 8% 16%);
  border-color: hsl(30 8% 28%);
  color: hsl(35 20% 82%);
}

:global(html.dark) .notebook-section-label {
  color: hsl(30 8% 48%);
  border-top-color: hsl(30 8% 24%);
}

:global(html.dark) .rejected-label {
  color: hsl(30 8% 48%);
}

:global(html.dark) .muted-value {
  color: hsl(30 8% 44%);
}

:global(html.dark) .fill-btn {
  color: hsl(30 8% 48%);
}

:global(html.dark) .fill-btn:hover {
  background: hsl(140 20% 20%);
  color: hsl(140 40% 55%);
}

</style>
