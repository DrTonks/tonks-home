<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDot,
  FileText,
  GitMerge,
  Link2,
  LoaderCircle,
  MessageCircle,
  Pencil,
  RotateCcw,
  Send,
  ShieldCheck,
  Smile,
  SquarePlus,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-vue-next'
import {
  addFeedbackRoomMessage,
  addFeedbackMessage,
  createFeedbackTopic,
  deleteFeedbackTopic,
  getFeedbackAvatarUrl,
  getFeedbackRoomAvatarUrl,
  mergeFeedbackTopics,
  updateFeedbackTopic,
  type FeedbackKind,
  type FeedbackRoomMessage,
  type FeedbackStatus,
  type FeedbackTopic,
} from '@/api/community'
import type { VisitorIdentity } from '@/lib/community'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  topics: FeedbackTopic[]
  messages: FeedbackRoomMessage[]
  loading: boolean
  identity: VisitorIdentity
  adminMode: boolean
  adminSecret: string
}>()

const emit = defineEmits<{
  reload: []
  requestIdentity: []
}>()

type Filter = 'active' | 'open' | 'in_progress' | 'resolved' | 'all'

const filter = ref<Filter>('all')
const openedTopicId = ref<number | null>(null)
const quickMessage = ref('')
const detailReply = ref('')
const composerBusy = ref(false)
const actionBusy = ref(false)
const composerError = ref('')
const composerStatus = ref('')
const cardComposerOpen = ref(false)
const emojiOpen = ref(false)
const cardForm = ref({ title: '', kind: 'bug' as FeedbackKind, content: '' })
const selectedTopicIds = ref(new Set<number>())
const mergeOpen = ref(false)
const mergeTargetId = ref<number | null>(null)
const mergeTitle = ref('')
const deleteCandidate = ref<FeedbackTopic | null>(null)
const resolutionDraft = ref<Record<number, string>>({})
const feedbackStream = ref<HTMLElement | null>(null)
const stationOwnerIdentity: VisitorIdentity = {
  nickname: 'Tonks',
  email: '3064517736@qq.com',
  website: 'https://tonks.top/',
}

const EMOJIS = ['😀', '😄', '😊', '🤔', '😭', '👍', '🎉', '❤️', '✨', '🐾', '💻', '👀'] as const
const kindLabels: Record<FeedbackKind, string> = {
  bug: '问题',
  suggestion: '建议',
  content: '内容',
  other: '其他',
}
const statusLabels: Record<FeedbackStatus, string> = {
  open: '待处理',
  in_progress: '处理中',
  resolved: '已完成',
  merged: '已合并',
}
const filterOptions: { key: Filter; label: string }[] = [
  { key: 'active', label: '进行中' },
  { key: 'open', label: '待处理' },
  { key: 'in_progress', label: '处理中' },
  { key: 'resolved', label: '已完成' },
  { key: 'all', label: '全部' },
]

watch(
  () => [props.messages.length, props.topics.length, filter.value],
  async () => {
    await nextTick()
    const stream = feedbackStream.value
    if (stream) stream.scrollTo({ top: stream.scrollHeight, behavior: 'smooth' })
  },
  { immediate: true },
)

const visibleTopics = computed(() => {
  const topics = [...props.topics].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  if (filter.value === 'all') return topics
  if (filter.value === 'active') {
    return topics.filter((topic) => topic.status === 'open' || topic.status === 'in_progress')
  }
  return topics.filter((topic) => topic.status === filter.value)
})

const visibleTimeline = computed(() => {
  const cards = visibleTopics.value.map((topic) => ({
    kind: 'topic' as const,
    id: `topic-${topic.id}`,
    createdAt: topic.created_at,
    topic,
  }))
  const messages = props.messages.map((message) => ({
    kind: 'message' as const,
    id: `message-${message.id}`,
    createdAt: message.created_at,
    message,
  }))
  return [...cards, ...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
})

const openedTopic = computed(
  () => props.topics.find((topic) => topic.id === openedTopicId.value) ?? null,
)
const effectiveIdentity = computed(() =>
  props.adminMode && !(props.identity.nickname.trim() && props.identity.email.trim())
    ? stationOwnerIdentity
    : props.identity,
)

const activeCount = computed(
  () => props.topics.filter((topic) => ['open', 'in_progress'].includes(topic.status)).length,
)
const resolvedCount = computed(
  () => props.topics.filter((topic) => topic.status === 'resolved').length,
)
const roomMembers = computed(() => {
  const members = new Map<
    string,
    {
      key: string
      nickname: string
      website: string
      messageId: number
      avatarKind: 'topic' | 'room'
      count: number
      admin: boolean
    }
  >()
  for (const topic of props.topics) {
    for (const item of topic.messages) {
      const key = item.is_admin ? 'station-owner' : item.author_key
      const previous = members.get(key)
      members.set(key, {
        key,
        nickname: item.nickname,
        website: item.website,
        messageId: item.id,
        avatarKind: 'topic',
        count: (previous?.count ?? 0) + 1,
        admin: Boolean(previous?.admin || item.is_admin),
      })
    }
  }
  for (const item of props.messages) {
    const key = item.is_admin ? 'station-owner' : item.author_key
    const previous = members.get(key)
    members.set(key, {
      key,
      nickname: item.nickname,
      website: item.website,
      messageId: item.id,
      avatarKind: 'room',
      count: (previous?.count ?? 0) + 1,
      admin: Boolean(previous?.admin || item.is_admin),
    })
  }
  return [...members.values()].sort(
    (a, b) => Number(b.admin) - Number(a.admin) || b.count - a.count,
  )
})

function hasIdentity() {
  return Boolean(effectiveIdentity.value.nickname.trim() && effectiveIdentity.value.email.trim())
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || '访客'
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function readableError(cause: unknown, fallback: string) {
  if (
    cause &&
    typeof cause === 'object' &&
    'response' in cause &&
    cause.response &&
    typeof cause.response === 'object' &&
    'data' in cause.response
  ) {
    const data = cause.response.data
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
      return data.message
    }
  }
  return cause instanceof Error && cause.message ? cause.message : fallback
}

function ensureIdentity() {
  if (hasIdentity()) return true
  emit('requestIdentity')
  return false
}

function insertEmoji(emoji: string) {
  if (quickMessage.value.length + emoji.length > 800) return
  quickMessage.value += emoji
  emojiOpen.value = false
}

async function submitChatMessage() {
  const content = quickMessage.value.trim()
  if (!content || composerBusy.value || !ensureIdentity()) return
  composerBusy.value = true
  composerError.value = ''
  composerStatus.value = ''
  try {
    const result = await addFeedbackRoomMessage(
      { ...effectiveIdentity.value, content },
      props.adminMode ? props.adminSecret : '',
    )
    quickMessage.value = ''
    composerStatus.value = result.message
    emit('reload')
  } catch (cause) {
    composerError.value = readableError(cause, '消息发送失败，请稍后重试')
  } finally {
    composerBusy.value = false
  }
}

async function submitCardFeedback() {
  if (
    !cardForm.value.title.trim() ||
    !cardForm.value.content.trim() ||
    composerBusy.value ||
    !ensureIdentity()
  )
    return
  composerBusy.value = true
  composerError.value = ''
  try {
    const result = await createFeedbackTopic(
      { ...effectiveIdentity.value, ...cardForm.value },
      props.adminMode ? props.adminSecret : '',
    )
    cardForm.value = { title: '', kind: 'bug', content: '' }
    cardComposerOpen.value = false
    composerStatus.value = result.message
    emit('reload')
  } catch (cause) {
    composerError.value = readableError(cause, '反馈卡片发送失败，请稍后重试')
  } finally {
    composerBusy.value = false
  }
}

async function submitDetailReply() {
  const topic = openedTopic.value
  if (!topic || !detailReply.value.trim() || composerBusy.value || !ensureIdentity()) return
  composerBusy.value = true
  composerError.value = ''
  try {
    const result = await addFeedbackMessage(
      topic.id,
      { ...effectiveIdentity.value, content: detailReply.value },
      props.adminMode ? props.adminSecret : '',
    )
    detailReply.value = ''
    composerStatus.value = result.message
    emit('reload')
  } catch (cause) {
    composerError.value = readableError(cause, '回复发送失败，请稍后重试')
  } finally {
    composerBusy.value = false
  }
}

function handleQuickKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  void submitChatMessage()
}

function memberAvatar(member: { avatarKind: 'topic' | 'room'; messageId: number }) {
  return member.avatarKind === 'room'
    ? getFeedbackRoomAvatarUrl(member.messageId)
    : getFeedbackAvatarUrl(member.messageId)
}

function toggleSelected(topicId: number) {
  const next = new Set(selectedTopicIds.value)
  if (next.has(topicId)) next.delete(topicId)
  else next.add(topicId)
  selectedTopicIds.value = next
}

function prepareMerge() {
  const ids = [...selectedTopicIds.value]
  if (ids.length < 2) return
  mergeTargetId.value = ids[0]
  mergeTitle.value = props.topics.find((topic) => topic.id === ids[0])?.title ?? ''
  mergeOpen.value = true
}

async function submitMerge() {
  if (!mergeTargetId.value || !props.adminMode || actionBusy.value) return
  const sources = [...selectedTopicIds.value].filter((id) => id !== mergeTargetId.value)
  if (!sources.length) return
  actionBusy.value = true
  try {
    await mergeFeedbackTopics(mergeTargetId.value, sources, mergeTitle.value, props.adminSecret)
    selectedTopicIds.value = new Set()
    mergeOpen.value = false
    openedTopicId.value = mergeTargetId.value
    emit('reload')
  } catch (cause) {
    composerError.value = readableError(cause, '合并失败，请稍后重试')
  } finally {
    actionBusy.value = false
  }
}

async function setStatus(topic: FeedbackTopic, status: Exclude<FeedbackStatus, 'merged'>) {
  if (!props.adminMode || actionBusy.value) return
  actionBusy.value = true
  try {
    await updateFeedbackTopic(
      topic.id,
      {
        status,
        ...(status === 'resolved'
          ? { resolution_note: resolutionDraft.value[topic.id]?.trim() || '已处理完成' }
          : {}),
      },
      props.adminSecret,
    )
    emit('reload')
  } catch (cause) {
    composerError.value = readableError(cause, '状态更新失败')
  } finally {
    actionBusy.value = false
  }
}

async function confirmDeleteTopic() {
  const topic = deleteCandidate.value
  if (!topic || !props.adminMode || actionBusy.value) return
  actionBusy.value = true
  composerError.value = ''
  try {
    const deletedIds = await deleteFeedbackTopic(topic.id, props.adminSecret)
    selectedTopicIds.value = new Set(
      [...selectedTopicIds.value].filter((id) => !deletedIds.includes(id)),
    )
    if (openedTopicId.value && deletedIds.includes(openedTopicId.value)) {
      openedTopicId.value = null
    }
    deleteCandidate.value = null
    composerStatus.value = deletedIds.length > 1 ? `已删除 ${deletedIds.length} 张关联卡片` : '反馈已删除'
    emit('reload')
  } catch (cause) {
    composerError.value = readableError(cause, '删除失败，请稍后重试')
  } finally {
    actionBusy.value = false
  }
}
</script>

<template>
  <div class="feedback-chat-room lg:col-[2/4] lg:row-start-2">
    <section class="feedback-conversation">
      <div ref="feedbackStream" class="feedback-stream">
        <div class="feedback-stream-toolbar">
          <div class="feedback-filter-tabs">
            <button
              v-for="item in filterOptions"
              :key="item.key"
              type="button"
              :class="filter === item.key && 'is-active'"
              @click="filter = item.key"
            >
              {{ item.label }}
            </button>
          </div>
          <Button
            v-if="adminMode && selectedTopicIds.size > 1"
            size="sm"
            variant="outline"
            @click="prepareMerge"
          >
            <GitMerge class="mr-1.5 h-4 w-4" aria-hidden="true" />
            合并 {{ selectedTopicIds.size }} 项
          </Button>
        </div>

        <div class="feedback-date-divider"><span>反馈群</span></div>

        <div v-if="loading" class="feedback-empty">
          <LoaderCircle class="h-6 w-6 animate-spin" aria-hidden="true" />
          <span>正在接收群消息…</span>
        </div>
        <div v-else-if="!visibleTimeline.length" class="feedback-empty">
          <MessageCircle class="h-7 w-7 opacity-35" aria-hidden="true" />
          <span>群里还没有消息</span>
        </div>

        <div v-else class="feedback-message-list">
          <template v-for="item in visibleTimeline" :key="item.id">
            <article
              v-if="item.kind === 'topic'"
              :class="[
                'feedback-card-message',
                (item.topic.owned || (adminMode && item.topic.is_admin)) && 'is-own',
                item.topic.status === 'resolved' && 'is-resolved',
                item.topic.status === 'merged' && 'is-merged',
              ]"
            >
              <span class="feedback-sender-avatar">
                <img
                  v-if="item.topic.messages[0]?.status === 'published'"
                  :src="getFeedbackAvatarUrl(item.topic.messages[0].id)"
                  alt=""
                  draggable="false"
                />
                <span v-else>{{ initials(item.topic.nickname) }}</span>
              </span>
              <div class="feedback-card-message-copy">
                <div class="feedback-sender-meta">
                  <strong>{{ item.topic.nickname }}</strong>
                  <span v-if="item.topic.is_admin" class="feedback-owner-badge">
                    <ShieldCheck class="h-3 w-3" aria-hidden="true" />
                    站长
                  </span>
                  <time>{{ formatTime(item.topic.created_at) }}</time>
                  <label
                    v-if="adminMode && item.topic.status !== 'merged'"
                    class="feedback-select-box"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedTopicIds.has(item.topic.id)"
                      :aria-label="`选择反馈 ${item.topic.title}`"
                      @change="toggleSelected(item.topic.id)"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  class="qq-feedback-card"
                  @click="openedTopicId = item.topic.id"
                >
                  <span class="qq-feedback-app-row">
                    <span class="qq-feedback-app-icon"><FileText class="h-4 w-4" /></span>
                    <span>Tonks Feedback</span>
                    <span :class="['feedback-status-chip', `is-${item.topic.status}`]">
                      {{ statusLabels[item.topic.status] }}
                    </span>
                  </span>
                  <strong>{{ item.topic.title }}</strong>
                  <p>{{ item.topic.messages[0]?.content || '从评论区迁移来的反馈事项' }}</p>
                  <span class="qq-feedback-card-foot">
                    <span>#{{ item.topic.id }} · {{ kindLabels[item.topic.kind] }}</span>
                    <span>
                      {{ item.topic.messages.length }} 条跟进 ·
                      {{ item.topic.sources.length }} 个来源
                    </span>
                    <ChevronRight class="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span v-if="item.topic.status === 'resolved'" class="feedback-resolved-stamp">
                    <Check class="h-3.5 w-3.5" />
                    已完成
                  </span>
                </button>
                <p v-if="item.topic.status === 'merged'" class="feedback-merged-copy">
                  已合并到 #{{ item.topic.merged_into_id }}，原卡片保留为历史记录。
                </p>
              </div>
            </article>

            <article
              v-else
              :class="[
                'feedback-room-message',
                (item.message.owned || (adminMode && item.message.is_admin)) && 'is-own',
                item.message.is_admin && 'is-admin',
              ]"
            >
              <span class="feedback-sender-avatar">
                <img
                  v-if="item.message.status === 'published'"
                  :src="getFeedbackRoomAvatarUrl(item.message.id)"
                  alt=""
                  draggable="false"
                />
                <span v-else>{{ initials(item.message.nickname) }}</span>
              </span>
              <div class="feedback-room-message-copy">
                <div class="feedback-sender-meta">
                  <strong>{{ item.message.nickname }}</strong>
                  <span v-if="item.message.is_admin" class="feedback-owner-badge">
                    <ShieldCheck class="h-3 w-3" aria-hidden="true" />
                    站长
                  </span>
                  <time>{{ formatTime(item.message.created_at) }}</time>
                </div>
                <p>{{ item.message.content }}</p>
              </div>
            </article>
          </template>
        </div>
      </div>

      <footer class="feedback-composer">
        <div v-if="cardComposerOpen" class="feedback-card-composer">
          <div class="feedback-card-composer-head">
            <div>
              <SquarePlus class="h-4 w-4" />
              <strong>发送反馈卡片</strong>
            </div>
            <button type="button" aria-label="收起反馈卡片" @click="cardComposerOpen = false">
              <X class="h-4 w-4" />
            </button>
          </div>
          <input v-model="cardForm.title" maxlength="70" placeholder="反馈标题" />
          <div class="feedback-card-composer-row">
            <select v-model="cardForm.kind">
              <option value="bug">问题</option>
              <option value="suggestion">建议</option>
              <option value="content">内容</option>
              <option value="other">其他</option>
            </select>
            <textarea
              v-model="cardForm.content"
              rows="2"
              maxlength="800"
              placeholder="补充发生了什么、期望怎样…"
            />
            <Button
              size="sm"
              :disabled="composerBusy || !cardForm.title.trim() || !cardForm.content.trim()"
              @click="submitCardFeedback"
            >
              发送卡片
            </Button>
          </div>
        </div>

        <div class="feedback-composer-toolbar">
          <div class="relative flex items-center gap-0.5">
            <button
              type="button"
              class="feedback-tool-button"
              title="选择表情"
              @click="emojiOpen = !emojiOpen"
            >
              <Smile class="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <div v-if="emojiOpen" class="feedback-emoji-picker">
              <button
                v-for="emoji in EMOJIS"
                :key="emoji"
                type="button"
                @click="insertEmoji(emoji)"
              >
                {{ emoji }}
              </button>
            </div>
            <button
              type="button"
              class="feedback-tool-button"
              title="发送反馈卡片"
              :aria-pressed="cardComposerOpen"
              @click="cardComposerOpen = !cardComposerOpen"
            >
              <SquarePlus class="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
          <button type="button" class="feedback-identity-button" @click="emit('requestIdentity')">
            <Pencil v-if="hasIdentity()" class="h-3.5 w-3.5" />
            <UserRound v-else class="h-3.5 w-3.5" />
            {{ hasIdentity() ? effectiveIdentity.nickname : '填写身份' }}
          </button>
        </div>
        <textarea
          v-model="quickMessage"
          rows="3"
          maxlength="800"
          placeholder="在 Feedback 群里说点什么…"
          @keydown="handleQuickKeydown"
        />
        <div class="feedback-send-row">
          <p :class="composerError && 'is-error'">
            {{ composerError || composerStatus || 'Enter 发送，Shift + Enter 换行。' }}
          </p>
          <div>
            <span>{{ quickMessage.length }}/800</span>
            <Button
              size="sm"
              :disabled="composerBusy || !quickMessage.trim()"
              @click="submitChatMessage"
            >
              <Send class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </footer>
    </section>

    <aside class="feedback-info-pane">
      <section>
        <h3>群公告</h3>
        <p>普通输入是群聊消息；需要跟踪的问题请使用反馈卡片。</p>
      </section>
      <section>
        <div class="feedback-info-title">
          <h3>反馈进度</h3>
          <CircleDot class="h-4 w-4" />
        </div>
        <div class="feedback-stats">
          <div>
            <strong>{{ activeCount }}</strong>
            <span>进行中</span>
          </div>
          <div>
            <strong>{{ resolvedCount }}</strong>
            <span>已完成</span>
          </div>
        </div>
      </section>
      <section class="feedback-members-section">
        <div class="feedback-info-title">
          <h3>群成员 {{ roomMembers.length }}</h3>
          <UsersRound class="h-4 w-4" />
        </div>
        <div class="feedback-member-list">
          <a
            v-for="member in roomMembers"
            :key="member.key"
            :href="member.website || undefined"
            :target="member.website ? '_blank' : undefined"
            rel="noopener noreferrer"
            class="feedback-member"
          >
            <span>
              <img :src="memberAvatar(member)" alt="" draggable="false" />
            </span>
            <span>
              <strong>{{ member.nickname }}</strong>
              <small>{{ member.count }} 条消息</small>
            </span>
            <ShieldCheck v-if="member.admin" class="h-3.5 w-3.5 text-primary" />
          </a>
        </div>
      </section>
    </aside>

    <div v-if="openedTopic" class="feedback-detail-layer" @mousedown.self="openedTopicId = null">
      <section
        class="feedback-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-detail-title"
      >
        <header>
          <button type="button" class="feedback-detail-back" @click="openedTopicId = null">
            <ArrowLeft class="h-4 w-4" />
            返回反馈群
          </button>
          <div class="feedback-detail-title">
            <span>#{{ openedTopic.id }} · {{ kindLabels[openedTopic.kind] }}</span>
            <h3 id="feedback-detail-title">{{ openedTopic.title }}</h3>
          </div>
          <button
            type="button"
            class="feedback-detail-close"
            aria-label="关闭反馈详情"
            @click="openedTopicId = null"
          >
            <X class="h-4 w-4" />
          </button>
        </header>
        <div class="feedback-detail-body">
          <div class="feedback-detail-thread">
            <article
              v-for="item in openedTopic.messages"
              :key="item.id"
              :class="[
                'feedback-detail-message',
                (item.owned || (adminMode && item.is_admin)) && 'is-own',
              ]"
            >
              <span>
                <img
                  v-if="item.status === 'published'"
                  :src="getFeedbackAvatarUrl(item.id)"
                  alt=""
                  draggable="false"
                />
                <i v-else>{{ initials(item.nickname) }}</i>
              </span>
              <div>
                <div>
                  <strong>{{ item.nickname }}</strong>
                  <em v-if="item.is_admin">
                    <ShieldCheck class="h-3 w-3" />
                    站长
                  </em>
                  <time>{{ formatTime(item.created_at) }}</time>
                </div>
                <p>{{ item.content }}</p>
              </div>
            </article>
            <details
              v-for="source in openedTopic.sources"
              :key="source.id"
              class="feedback-source-tree"
            >
              <summary>
                <Link2 class="h-3.5 w-3.5" />
                来自 {{ source.page === 'about' ? 'About' : 'Friends' }} 的评论树
                <span>{{ source.comments.length }} 条</span>
              </summary>
              <div>
                <article
                  v-for="comment in source.comments"
                  :key="comment.id"
                  :class="Boolean(comment.parent_id) && 'is-reply'"
                >
                  <strong>{{ comment.nickname }}</strong>
                  <p>{{ comment.content }}</p>
                </article>
              </div>
            </details>
            <div v-if="openedTopic.resolution_note" class="feedback-resolution">
              <Check class="h-4 w-4" />
              {{ openedTopic.resolution_note }}
            </div>
          </div>
          <aside class="feedback-detail-side">
            <span :class="['feedback-status-large', `is-${openedTopic.status}`]">
              {{ statusLabels[openedTopic.status] }}
            </span>
            <dl>
              <div>
                <dt>创建者</dt>
                <dd>{{ openedTopic.nickname }}</dd>
              </div>
              <div>
                <dt>讨论</dt>
                <dd>{{ openedTopic.messages.length }} 条</dd>
              </div>
              <div>
                <dt>来源</dt>
                <dd>{{ openedTopic.sources.length }} 个</dd>
              </div>
              <div>
                <dt>更新</dt>
                <dd>{{ formatTime(openedTopic.updated_at) }}</dd>
              </div>
            </dl>
            <div v-if="adminMode" class="feedback-admin-actions">
              <template v-if="openedTopic.status !== 'merged'">
                <Button
                  v-if="openedTopic.status !== 'in_progress'"
                  size="sm"
                  variant="outline"
                  :disabled="actionBusy"
                  @click="setStatus(openedTopic, 'in_progress')"
                >
                  <CircleDot class="mr-1.5 h-3.5 w-3.5" />
                  处理中
                </Button>
                <template v-if="openedTopic.status !== 'resolved'">
                  <input
                    v-model="resolutionDraft[openedTopic.id]"
                    maxlength="300"
                    placeholder="完成说明（可选）"
                  />
                  <Button
                    size="sm"
                    :disabled="actionBusy"
                    @click="setStatus(openedTopic, 'resolved')"
                  >
                    <Check class="mr-1.5 h-3.5 w-3.5" />
                    完成
                  </Button>
                </template>
                <Button
                  v-else
                  size="sm"
                  variant="outline"
                  :disabled="actionBusy"
                  @click="setStatus(openedTopic, 'open')"
                >
                  <RotateCcw class="mr-1.5 h-3.5 w-3.5" />
                  重新打开
                </Button>
              </template>
              <Button
                size="sm"
                variant="destructive"
                :disabled="actionBusy"
                @click="deleteCandidate = openedTopic"
              >
                <Trash2 class="mr-1.5 h-3.5 w-3.5" />
                删除反馈
              </Button>
            </div>
          </aside>
        </div>
        <footer class="feedback-detail-composer">
          <textarea
            v-model="detailReply"
            rows="2"
            maxlength="800"
            :placeholder="`回复 #${openedTopic.id}…`"
          />
          <Button
            size="sm"
            :disabled="composerBusy || !detailReply.trim()"
            @click="submitDetailReply"
          >
            <Send class="h-4 w-4" />
          </Button>
        </footer>
      </section>
    </div>

    <div v-if="mergeOpen" class="feedback-detail-layer" @mousedown.self="mergeOpen = false">
      <section
        class="feedback-merge-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-merge-title"
      >
        <header>
          <div>
            <span>MERGE</span>
            <h3 id="feedback-merge-title">合并同类反馈</h3>
          </div>
          <button type="button" aria-label="关闭" @click="mergeOpen = false">
            <X class="h-4 w-4" />
          </button>
        </header>
        <label>
          保留为主反馈
          <select v-model="mergeTargetId">
            <option v-for="id in selectedTopicIds" :key="id" :value="id">
              #{{ id }} {{ topics.find((topic) => topic.id === id)?.title }}
            </option>
          </select>
        </label>
        <label>
          合并后的标题
          <input v-model="mergeTitle" maxlength="70" />
        </label>
        <p>其他卡片会保留“已合并”记录，并指向主反馈。</p>
        <footer>
          <span>{{ selectedTopicIds.size }} 项</span>
          <Button :disabled="actionBusy" @click="submitMerge">
            <GitMerge class="mr-1.5 h-4 w-4" />
            确认合并
          </Button>
        </footer>
      </section>
    </div>

    <div
      v-if="deleteCandidate"
      class="feedback-detail-layer"
      @mousedown.self="deleteCandidate = null"
    >
      <section
        class="feedback-merge-panel feedback-delete-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="feedback-delete-title"
      >
        <header>
          <div>
            <span>DELETE</span>
            <h3 id="feedback-delete-title">删除反馈 #{{ deleteCandidate.id }}</h3>
          </div>
          <button type="button" aria-label="关闭" @click="deleteCandidate = null">
            <X class="h-4 w-4" />
          </button>
        </header>
        <strong>{{ deleteCandidate.title }}</strong>
        <p>
          卡片会从反馈群、筛选和统计中隐藏；讨论与来源快照仍保留在数据库中，不会自动恢复到原评论区。
        </p>
        <p v-if="topics.some((topic) => topic.merged_into_id === deleteCandidate?.id)">
          已合并到这张卡片的副卡也会一并隐藏。
        </p>
        <footer>
          <Button variant="outline" :disabled="actionBusy" @click="deleteCandidate = null">
            取消
          </Button>
          <Button variant="destructive" :disabled="actionBusy" @click="confirmDeleteTopic">
            <Trash2 class="mr-1.5 h-4 w-4" />
            确认删除
          </Button>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.feedback-chat-room {
  position: relative;
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr) 248px;
  background: hsl(var(--background));
  overflow: hidden;
}
.feedback-conversation {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
}
.feedback-stream {
  min-height: 0;
  overflow-y: auto;
  padding: 0 1.2rem 1.2rem;
}
.feedback-info-pane {
  min-height: 0;
  overflow-y: auto;
  border-left: 1px solid hsl(var(--border));
  background: hsl(var(--card) / 0.38);
}
.feedback-info-pane > section {
  padding: 1rem;
  border-bottom: 1px solid hsl(var(--border));
}
.feedback-info-pane h3 {
  font-size: 0.72rem;
  font-weight: 650;
}
.feedback-info-pane p {
  margin-top: 0.65rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.62rem;
  line-height: 1.65;
}
.feedback-stream-toolbar {
  position: sticky;
  z-index: 3;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  margin: 0 -1.2rem;
  padding: 0.65rem 1.2rem;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--background) / 0.94);
  backdrop-filter: blur(10px);
}
.feedback-filter-tabs {
  display: flex;
  gap: 0.1rem;
  overflow-x: auto;
}
.feedback-filter-tabs button {
  border-radius: 0.35rem;
  padding: 0.32rem 0.52rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.61rem;
  white-space: nowrap;
}
.feedback-filter-tabs button:hover,
.feedback-filter-tabs button.is-active {
  background: hsl(var(--foreground) / 0.065);
  color: hsl(var(--foreground));
}
.feedback-date-divider {
  display: flex;
  justify-content: center;
  padding: 0.9rem 0;
}
.feedback-date-divider span {
  border-radius: 999px;
  background: hsl(var(--muted) / 0.72);
  padding: 0.18rem 0.55rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.55rem;
}
.feedback-message-list {
  display: grid;
  gap: 0.55rem;
}
.feedback-card-message {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.35rem 0;
}
.feedback-card-message.is-own {
  flex-direction: row-reverse;
}
.feedback-card-message.is-resolved {
  opacity: 0.88;
}
.feedback-card-message.is-merged {
  opacity: 0.48;
}
.feedback-sender-avatar {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: hsl(var(--muted));
  font-size: 0.58rem;
}
.feedback-sender-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.feedback-card-message-copy {
  width: min(25rem, 78%);
}
.feedback-room-message {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.25rem 0;
}
.feedback-room-message.is-own {
  flex-direction: row-reverse;
}
.feedback-room-message-copy {
  max-width: min(30rem, 76%);
}
.feedback-room-message-copy > p {
  width: fit-content;
  border: 1px solid hsl(var(--border));
  border-radius: 0.3rem 0.7rem 0.7rem;
  background: hsl(var(--card));
  padding: 0.58rem 0.72rem;
  color: hsl(var(--foreground));
  font-size: 0.72rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
  box-shadow: 0 1px 3px hsl(var(--foreground) / 0.06);
}
.feedback-room-message.is-own .feedback-room-message-copy > p {
  margin-left: auto;
  border-color: hsl(var(--primary) / 0.22);
  border-radius: 0.7rem 0.3rem 0.7rem 0.7rem;
  background: hsl(var(--primary) / 0.13);
}
.feedback-room-message.is-admin .feedback-room-message-copy > p {
  border-color: hsl(var(--primary) / 0.32);
  box-shadow: inset 2px 0 hsl(var(--primary) / 0.7);
}
.feedback-sender-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.25rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.56rem;
}
.is-own .feedback-sender-meta {
  justify-content: flex-end;
}
.feedback-sender-meta strong {
  color: hsl(var(--foreground));
  font-size: 0.68rem;
}
.feedback-owner-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  border-radius: 999px;
  background: hsl(var(--primary) / 0.12);
  padding: 0.12rem 0.32rem;
  color: hsl(var(--primary));
}
.feedback-select-box {
  margin-left: auto;
}
.is-own .feedback-select-box {
  margin-left: 0;
}
.feedback-select-box input {
  accent-color: hsl(var(--primary));
}
.qq-feedback-card {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 0.3rem 0.65rem 0.65rem;
  background: hsl(var(--card));
  padding: 0.65rem 0.7rem;
  text-align: left;
  box-shadow: 0 1px 3px hsl(var(--foreground) / 0.07);
  transition:
    border-color 150ms ease,
    transform 150ms ease,
    box-shadow 150ms ease;
}
.feedback-card-message.is-resolved .qq-feedback-card {
  border-color: hsl(145 45% 42%/0.3);
  background: linear-gradient(145deg, hsl(145 45% 42%/0.06), transparent 45%), hsl(var(--card));
}
.is-own .qq-feedback-card {
  border-radius: 0.65rem 0.3rem 0.65rem 0.65rem;
  background: linear-gradient(145deg, hsl(var(--primary) / 0.12), hsl(var(--card)));
}
.qq-feedback-card:hover:not(:disabled) {
  border-color: hsl(var(--primary) / 0.38);
  transform: translateY(-1px);
  box-shadow: 0 5px 16px hsl(var(--foreground) / 0.08);
}
.qq-feedback-app-row {
  display: flex;
  align-items: center;
  gap: 0.38rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.58rem;
}
.qq-feedback-app-icon {
  display: grid;
  width: 1.45rem;
  height: 1.45rem;
  place-items: center;
  border-radius: 0.3rem;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}
.feedback-status-chip {
  margin-left: auto;
  border-radius: 999px;
  background: hsl(var(--muted));
  padding: 0.13rem 0.38rem;
  font-size: 0.52rem;
}
.feedback-status-chip.is-in_progress {
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
}
.feedback-status-chip.is-resolved {
  background: hsl(145 45% 45%/0.12);
  color: hsl(145 45% 38%);
}
.qq-feedback-card > strong {
  display: block;
  margin-top: 0.55rem;
  overflow: hidden;
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qq-feedback-card > p {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 0.25rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.65rem;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.qq-feedback-card-foot {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0.65rem -0.7rem -0.65rem;
  padding: 0.45rem 0.7rem;
  border-top: 1px solid hsl(var(--border));
  color: hsl(var(--muted-foreground));
  font-size: 0.54rem;
}
.qq-feedback-card-foot span:nth-child(2) {
  margin-left: auto;
}
.feedback-resolved-stamp {
  position: absolute;
  right: 0.7rem;
  bottom: 2.05rem;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  border: 1px solid hsl(145 45% 42%/0.28);
  border-radius: 999px;
  background: hsl(145 45% 42%/0.08);
  padding: 0.16rem 0.4rem;
  color: hsl(145 45% 35%);
  font-size: 0.5rem;
  font-weight: 650;
  transform: rotate(-2deg);
}
.feedback-merged-copy {
  margin-top: 0.25rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.56rem;
}
.feedback-empty {
  display: grid;
  place-items: center;
  gap: 0.5rem;
  padding: 4rem 1rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.7rem;
}
.feedback-composer {
  position: relative;
  border-top: 1px solid hsl(var(--border));
  background: hsl(var(--card) / 0.46);
}
.feedback-composer-toolbar {
  display: flex;
  height: 2.4rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.75rem 0;
}
.feedback-tool-button {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.35rem;
  color: hsl(var(--muted-foreground));
}
.feedback-tool-button:hover {
  background: hsl(var(--foreground) / 0.07);
  color: hsl(var(--foreground));
}
.feedback-emoji-picker {
  position: absolute;
  z-index: 25;
  bottom: 2.3rem;
  left: 0;
  display: grid;
  width: 12rem;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.2rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.55rem;
  background: hsl(var(--popover));
  padding: 0.45rem;
  box-shadow: 0 12px 32px hsl(var(--foreground) / 0.13);
}
.feedback-emoji-picker button {
  padding: 0.3rem;
  border-radius: 0.3rem;
}
.feedback-emoji-picker button:hover {
  background: hsl(var(--primary) / 0.1);
}
.feedback-identity-button {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  border-radius: 0.35rem;
  padding: 0.35rem 0.45rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6rem;
}
.feedback-identity-button:hover {
  background: hsl(var(--foreground) / 0.06);
  color: hsl(var(--foreground));
}
.feedback-composer > textarea {
  display: block;
  width: 100%;
  min-height: 3.8rem;
  resize: none;
  background: transparent;
  padding: 0 0.95rem;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  line-height: 1.55;
  outline: none;
}
.feedback-send-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0 0.8rem 0.55rem 0.95rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.55rem;
}
.feedback-send-row p.is-error {
  color: hsl(var(--destructive));
}
.feedback-send-row > div {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.feedback-card-composer {
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.25);
  padding: 0.7rem 0.8rem;
}
.feedback-card-composer-head,
.feedback-card-composer-head > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}
.feedback-card-composer-head strong {
  font-size: 0.68rem;
}
.feedback-card-composer input,
.feedback-card-composer select,
.feedback-card-composer textarea {
  border: 1px solid hsl(var(--border));
  border-radius: 0.4rem;
  background: hsl(var(--background));
  padding: 0.45rem 0.55rem;
  color: hsl(var(--foreground));
  font-size: 0.65rem;
  outline: none;
}
.feedback-card-composer > input {
  width: 100%;
  margin-top: 0.55rem;
}
.feedback-card-composer-row {
  display: grid;
  grid-template-columns: 6rem minmax(0, 1fr) auto;
  gap: 0.4rem;
  margin-top: 0.4rem;
}
.feedback-card-composer textarea {
  resize: none;
}
.feedback-info-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.feedback-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.4rem;
  margin-top: 0.65rem;
}
.feedback-stats div {
  display: grid;
  gap: 0.1rem;
  border-radius: 0.4rem;
  background: hsl(var(--background) / 0.65);
  padding: 0.6rem;
}
.feedback-stats strong {
  color: hsl(var(--primary));
  font-size: 1rem;
}
.feedback-stats span {
  color: hsl(var(--muted-foreground));
  font-size: 0.55rem;
}
.feedback-member-list {
  display: grid;
  gap: 0.12rem;
  margin-top: 0.65rem;
}
.feedback-member {
  display: grid;
  grid-template-columns: 1.75rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.45rem;
  border-radius: 0.35rem;
  padding: 0.35rem;
}
.feedback-member:hover {
  background: hsl(var(--foreground) / 0.055);
}
.feedback-member > span:first-child {
  width: 1.75rem;
  height: 1.75rem;
  overflow: hidden;
  border-radius: 50%;
  background: hsl(var(--muted));
}
.feedback-member img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.feedback-member strong,
.feedback-member small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.feedback-member strong {
  font-size: 0.65rem;
}
.feedback-member small {
  color: hsl(var(--muted-foreground));
  font-size: 0.52rem;
}
.feedback-detail-layer {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 0.75rem;
  background: hsl(var(--background) / 0.74);
  backdrop-filter: blur(6px);
  animation: feedback-fade-in 160ms ease;
}
.feedback-detail-panel {
  display: grid;
  width: min(60rem, 100%);
  height: min(92%, 42rem);
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 0.65rem;
  background: hsl(var(--popover));
  box-shadow: 0 20px 70px hsl(var(--foreground) / 0.18);
  animation: feedback-panel-in 180ms ease;
}
.feedback-detail-panel > header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.8rem;
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.7rem 0.85rem;
}
.feedback-detail-back,
.feedback-detail-close {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  border-radius: 0.35rem;
  padding: 0.4rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6rem;
}
.feedback-detail-back:hover,
.feedback-detail-close:hover {
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}
.feedback-detail-title {
  min-width: 0;
}
.feedback-detail-title span {
  color: hsl(var(--primary));
  font-family: monospace;
  font-size: 0.52rem;
}
.feedback-detail-title h3 {
  overflow: hidden;
  margin-top: 0.1rem;
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.feedback-detail-body {
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr) 210px;
}
.feedback-detail-thread {
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
}
.feedback-detail-side {
  overflow-y: auto;
  border-left: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.2);
  padding: 1rem;
}
.feedback-detail-message {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  margin-bottom: 0.7rem;
}
.feedback-detail-message.is-own {
  flex-direction: row-reverse;
}
.feedback-detail-message > span {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: hsl(var(--muted));
  font-size: 0.55rem;
  font-style: normal;
}
.feedback-detail-message img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.feedback-detail-message > div {
  max-width: 78%;
}
.feedback-detail-message > div > div {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.2rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.55rem;
}
.feedback-detail-message > div strong {
  color: hsl(var(--foreground));
  font-size: 0.67rem;
}
.feedback-detail-message em {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  border-radius: 999px;
  background: hsl(var(--primary) / 0.11);
  padding: 0.1rem 0.3rem;
  color: hsl(var(--primary));
  font-style: normal;
}
.feedback-detail-message > div > p {
  border-radius: 0.25rem 0.65rem 0.65rem;
  background: hsl(var(--card));
  padding: 0.55rem 0.7rem;
  font-size: 0.72rem;
  line-height: 1.55;
  white-space: pre-wrap;
}
.feedback-detail-message.is-own > div > p {
  border-radius: 0.65rem 0.25rem 0.65rem 0.65rem;
  background: hsl(var(--primary) / 0.11);
}
.feedback-source-tree {
  margin-top: 0.75rem;
  border: 1px dashed hsl(var(--border));
  border-radius: 0.45rem;
}
.feedback-source-tree summary {
  display: flex;
  cursor: pointer;
  align-items: center;
  gap: 0.35rem;
  padding: 0.55rem 0.65rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.62rem;
}
.feedback-source-tree summary span {
  margin-left: auto;
}
.feedback-source-tree > div {
  display: grid;
  gap: 0.4rem;
  border-top: 1px dashed hsl(var(--border));
  padding: 0.6rem;
}
.feedback-source-tree article {
  border-left: 2px solid hsl(var(--primary) / 0.3);
  padding-left: 0.5rem;
  font-size: 0.62rem;
}
.feedback-source-tree article.is-reply {
  margin-left: 1rem;
}
.feedback-source-tree article p {
  margin-top: 0.1rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.5;
}
.feedback-resolution {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.7rem;
  border-radius: 0.4rem;
  background: hsl(145 45% 45%/0.1);
  padding: 0.55rem;
  color: hsl(145 45% 36%);
  font-size: 0.65rem;
}
.feedback-status-large {
  display: inline-block;
  border-radius: 999px;
  background: hsl(var(--muted));
  padding: 0.25rem 0.55rem;
  font-size: 0.6rem;
}
.feedback-status-large.is-in_progress {
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
}
.feedback-status-large.is-resolved {
  background: hsl(145 45% 45%/0.12);
  color: hsl(145 45% 38%);
}
.feedback-detail-side dl {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.8rem;
}
.feedback-detail-side dl div {
  display: flex;
  justify-content: space-between;
  gap: 0.4rem;
  font-size: 0.58rem;
}
.feedback-detail-side dt {
  color: hsl(var(--muted-foreground));
}
.feedback-admin-actions {
  display: grid;
  gap: 0.45rem;
  margin-top: 1rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.8rem;
}
.feedback-admin-actions input {
  width: 100%;
  border: 1px solid hsl(var(--border));
  border-radius: 0.35rem;
  background: hsl(var(--background));
  padding: 0.45rem;
  color: hsl(var(--foreground));
  font-size: 0.6rem;
}
.feedback-detail-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
  border-top: 1px solid hsl(var(--border));
  padding: 0.65rem 0.8rem;
}
.feedback-detail-composer textarea {
  resize: none;
  background: transparent;
  color: hsl(var(--foreground));
  font-size: 0.7rem;
  outline: none;
}
.feedback-merge-panel {
  width: min(27rem, 100%);
  border: 1px solid hsl(var(--border));
  border-radius: 0.65rem;
  background: hsl(var(--popover));
  padding: 1rem;
  box-shadow: 0 20px 70px hsl(var(--foreground) / 0.18);
}
.feedback-merge-panel header,
.feedback-merge-panel footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.feedback-merge-panel header span {
  color: hsl(var(--primary));
  font-family: monospace;
  font-size: 0.52rem;
  letter-spacing: 0.15em;
}
.feedback-merge-panel h3 {
  font-size: 0.9rem;
}
.feedback-merge-panel label {
  display: grid;
  gap: 0.3rem;
  margin-top: 0.7rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6rem;
}
.feedback-merge-panel select,
.feedback-merge-panel input {
  width: 100%;
  border: 1px solid hsl(var(--border));
  border-radius: 0.4rem;
  background: hsl(var(--background));
  padding: 0.5rem;
  color: hsl(var(--foreground));
  font-size: 0.65rem;
}
.feedback-merge-panel > p {
  margin-top: 0.7rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.58rem;
}
.feedback-merge-panel footer {
  margin-top: 1rem;
}
.feedback-merge-panel footer > span {
  color: hsl(var(--muted-foreground));
  font-size: 0.58rem;
}
.feedback-delete-panel {
  border-color: hsl(var(--destructive) / 0.28);
}
.feedback-delete-panel header span {
  color: hsl(var(--destructive));
}
.feedback-delete-panel > strong {
  display: block;
  margin-top: 0.9rem;
  font-size: 0.75rem;
}
.feedback-delete-panel footer {
  justify-content: flex-end;
}
@keyframes feedback-fade-in {
  from {
    opacity: 0;
  }
}
@keyframes feedback-panel-in {
  from {
    opacity: 0;
    transform: translateY(7px) scale(0.99);
  }
}
@media (max-width: 1023px) {
  .feedback-chat-room {
    grid-template-columns: 1fr;
  }
  .feedback-info-pane {
    display: none;
  }
  .feedback-detail-body {
    grid-template-columns: 1fr;
  }
  .feedback-detail-side {
    display: none;
  }
}
@media (max-width: 639px) {
  .feedback-stream {
    padding: 0 0.7rem 0.8rem;
  }
  .feedback-stream-toolbar {
    margin: 0 -0.7rem;
    padding: 0.55rem 0.7rem;
  }
  .feedback-card-message-copy {
    width: 82%;
  }
  .qq-feedback-card-foot span:nth-child(2) {
    display: none;
  }
  .feedback-card-composer-row {
    grid-template-columns: 1fr;
  }
  .feedback-detail-layer {
    padding: 0.35rem;
  }
  .feedback-detail-panel {
    height: 98%;
  }
  .feedback-detail-back {
    font-size: 0;
  }
  .feedback-detail-message > div {
    max-width: 82%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .feedback-detail-layer,
  .feedback-detail-panel {
    animation: none;
  }
}
</style>
