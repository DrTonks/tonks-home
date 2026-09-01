<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { GitPullRequest, LoaderCircle, MessageCircle, Plus, X } from 'lucide-vue-next'
import {
  convertCommentTreeToFeedback,
  type FeedbackKind,
  type FeedbackTopic,
} from '@/api/community'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  open: boolean
  rootCommentId: number | null
  topics: FeedbackTopic[]
  adminSecret: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  converted: [topicId: number]
}>()

const mode = ref<'new' | 'existing'>('new')
const title = ref('')
const kind = ref<FeedbackKind>('bug')
const topicId = ref<number | null>(null)
const busy = ref(false)
const error = ref('')

const availableTopics = computed(() =>
  props.topics.filter((topic) => ['open', 'in_progress'].includes(topic.status)),
)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    mode.value = 'new'
    title.value = ''
    kind.value = 'bug'
    topicId.value = availableTopics.value[0]?.id ?? null
    error.value = ''
  },
)

async function submit() {
  if (!props.rootCommentId || busy.value) return
  if (mode.value === 'new' && !title.value.trim()) {
    error.value = '请先给反馈取一个便于追踪的标题'
    return
  }
  if (mode.value === 'existing' && !topicId.value) {
    error.value = '请选择要关联的反馈'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const result = await convertCommentTreeToFeedback(
      props.rootCommentId,
      mode.value === 'existing'
        ? { topicId: topicId.value ?? undefined }
        : { title: title.value, kind: kind.value },
      props.adminSecret,
    )
    emit('converted', result)
    emit('update:open', false)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '转换失败，请稍后重试'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Transition name="feedback-convert">
    <div v-if="open" class="convert-layer" @mousedown.self="emit('update:open', false)">
      <section class="convert-card" role="dialog" aria-modal="true" aria-labelledby="convert-title">
        <header>
          <div>
            <span>COMMENT TREE / FEEDBACK</span>
            <h3 id="convert-title">将整棵评论转为反馈</h3>
          </div>
          <button type="button" aria-label="关闭" @click="emit('update:open', false)">
            <X class="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <p class="convert-note">
          原评论树会从当前房间搬入 Feedback，层级、作者与时间都会保留在反馈卡片中。
        </p>

        <div class="convert-mode-grid">
          <button type="button" :class="mode === 'new' && 'is-active'" @click="mode = 'new'">
            <Plus class="h-4 w-4" aria-hidden="true" />
            <span>
              <strong>新建反馈</strong>
              <small>为这棵评论单独建项</small>
            </span>
          </button>
          <button
            type="button"
            :class="mode === 'existing' && 'is-active'"
            :disabled="!availableTopics.length"
            @click="mode = 'existing'"
          >
            <MessageCircle class="h-4 w-4" aria-hidden="true" />
            <span>
              <strong>关联已有项</strong>
              <small>补充到同一个问题</small>
            </span>
          </button>
        </div>

        <template v-if="mode === 'new'">
          <label>
            反馈标题
            <input v-model="title" maxlength="70" placeholder="概括需要解决的问题" />
          </label>
          <label>
            类型
            <select v-model="kind">
              <option value="bug">问题</option>
              <option value="suggestion">建议</option>
              <option value="content">内容</option>
              <option value="other">其他</option>
            </select>
          </label>
        </template>
        <label v-else>
          关联到
          <select v-model="topicId">
            <option v-for="topic in availableTopics" :key="topic.id" :value="topic.id">
              #{{ topic.id }} · {{ topic.title }}
            </option>
          </select>
        </label>

        <p v-if="error" class="convert-error" role="alert">{{ error }}</p>
        <footer>
          <span>搬入后可在 Feedback 卡片中折叠查看</span>
          <Button :disabled="busy" @click="submit">
            <LoaderCircle v-if="busy" class="mr-1.5 h-4 w-4 animate-spin" />
            <GitPullRequest v-else class="mr-1.5 h-4 w-4" />
            确认转换
          </Button>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.convert-layer {
  position: fixed;
  z-index: 130;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: hsl(220 18% 8%/0.5);
  backdrop-filter: blur(6px);
}
.convert-card {
  width: min(31rem, 100%);
  border: 1px solid hsl(var(--border));
  border-radius: 0.8rem;
  background: hsl(var(--popover));
  padding: 1rem;
  color: hsl(var(--foreground));
  box-shadow: 0 24px 80px hsl(220 25% 5%/0.28);
}
.convert-card header,
.convert-card footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.convert-card header span {
  color: hsl(var(--primary));
  font-family: monospace;
  font-size: 0.52rem;
  letter-spacing: 0.16em;
}
.convert-card h3 {
  margin-top: 0.1rem;
  font-size: 1rem;
  font-weight: 700;
}
.convert-card header button {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.4rem;
}
.convert-card header button:hover {
  background: hsl(var(--muted));
}
.convert-note {
  margin-top: 0.75rem;
  border-left: 2px solid hsl(var(--primary) / 0.45);
  padding-left: 0.65rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.65rem;
  line-height: 1.65;
}
.convert-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.45rem;
  margin-top: 0.85rem;
}
.convert-mode-grid > button {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  padding: 0.65rem;
  text-align: left;
}
.convert-mode-grid > button.is-active {
  border-color: hsl(var(--primary) / 0.55);
  background: hsl(var(--primary) / 0.08);
  color: hsl(var(--primary));
}
.convert-mode-grid > button:disabled {
  opacity: 0.4;
}
.convert-mode-grid span,
.convert-mode-grid strong,
.convert-mode-grid small {
  display: block;
}
.convert-mode-grid strong {
  font-size: 0.7rem;
}
.convert-mode-grid small {
  margin-top: 0.1rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.55rem;
}
.convert-card label {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.75rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.62rem;
}
.convert-card input,
.convert-card select {
  width: 100%;
  border: 1px solid hsl(var(--border));
  border-radius: 0.45rem;
  background: hsl(var(--background));
  padding: 0.58rem 0.65rem;
  color: hsl(var(--foreground));
  font-size: 0.72rem;
  outline: none;
}
.convert-card input:focus,
.convert-card select:focus {
  border-color: hsl(var(--primary) / 0.6);
  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.1);
}
.convert-card footer {
  margin-top: 1rem;
}
.convert-card footer > span {
  color: hsl(var(--muted-foreground));
  font-size: 0.55rem;
}
.convert-error {
  margin-top: 0.75rem;
  color: hsl(var(--destructive));
  font-size: 0.62rem;
}
.feedback-convert-enter-active,
.feedback-convert-leave-active {
  transition: opacity 160ms ease;
}
.feedback-convert-enter-active .convert-card,
.feedback-convert-leave-active .convert-card {
  transition:
    transform 180ms ease,
    opacity 160ms ease;
}
.feedback-convert-enter-from,
.feedback-convert-leave-to {
  opacity: 0;
}
.feedback-convert-enter-from .convert-card,
.feedback-convert-leave-to .convert-card {
  opacity: 0;
  transform: translateY(8px) scale(0.985);
}
@media (max-width: 520px) {
  .convert-mode-grid {
    grid-template-columns: 1fr;
  }
  .convert-card footer > span {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .feedback-convert-enter-active,
  .feedback-convert-leave-active,
  .feedback-convert-enter-active .convert-card,
  .feedback-convert-leave-active .convert-card {
    transition: none;
  }
}
</style>
