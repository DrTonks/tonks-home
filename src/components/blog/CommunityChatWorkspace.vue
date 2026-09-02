<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Inbox,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MessageCircle,
  PanelRight,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smile,
  Trash2,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from 'lucide-vue-next'
import {
  deleteCommunityComment,
  getCommunityAvatarUrl,
  getCommunityAvatarPreview,
  getCommunityComments,
  getFeedbackTopics,
  moderateCommunityComment,
  submitCommunityComment,
  type CommentPage,
  type CommunityComment,
  type FeedbackRoomMessage,
  type FeedbackTopic,
} from '@/api/community'
import {
  buildCommunityMembers,
  communityAuthorKey,
  COMMUNITY_ROOMS,
  groupCommunityMessagesByLocalDate,
  indexCommunityMessages,
  latestCommunityMessage,
  sortCommunityMessages,
  type VisitorIdentity,
  type CommunityRoomKey,
} from '@/lib/community'
import {
  clearCommunityProfile,
  getCommunityProfile,
  saveCommunityProfile,
} from '@/lib/community-identity'
import { useAdminStore } from '@/stores/admin'
import { Button } from '@/components/ui/button'
import CommunityIdentityDialog from './CommunityIdentityDialog.vue'
import CommunityFriendApplyDialog from './CommunityFriendApplyDialog.vue'
import CommunityFeedbackChatRoom from './CommunityFeedbackChatRoom.vue'
import CommunityFeedbackConvertDialog from './CommunityFeedbackConvertDialog.vue'
import CommunityMessageBubble from './CommunityMessageBubble.vue'

const props = defineProps<{
  active: boolean
  applicationCount: number
}>()
const emit = defineEmits<{
  login: []
  openApplications: []
  close: []
}>()

const admin = useAdminStore()
const comments = ref<CommunityComment[]>([])
const feedbackTopics = ref<FeedbackTopic[]>([])
const feedbackRoomMessages = ref<FeedbackRoomMessage[]>([])
const localPending = ref<CommunityComment[]>([])
const activePage = ref<CommunityRoomKey>('about')
const loading = ref(false)
const refreshing = ref(false)
const loadError = ref('')
const composerError = ref('')
const composerStatus = ref('')
const composer = ref('')
const sending = ref(false)
const replyTarget = ref<CommunityComment | null>(null)
const selectedCommentId = ref<number | null>(null)
const selectedAuthorKey = ref('')
const reviewNote = ref('')
const actionBusy = ref(false)
const confirmDelete = ref(false)
const identityOpen = ref(false)
const pendingSendAfterIdentity = ref(false)
const failedMemberAvatars = ref(new Set<number>())
const mobilePanel = ref<'members' | 'review' | null>(null)
const roomQuery = ref('')
const messagesViewport = ref<HTMLElement | null>(null)
const composerInput = ref<HTMLTextAreaElement | null>(null)
const identity = ref<VisitorIdentity>({ nickname: '', email: '', website: '' })
const emojiOpen = ref(false)
const emojiPopover = ref<HTMLElement | null>(null)
const friendApplyOpen = ref(false)
const feedbackConvertOpen = ref(false)
const feedbackConvertRootId = ref<number | null>(null)
const profileAvatarUrl = ref('https://blog.tonks.top/assets/home/home.png')
let refreshTimer: ReturnType<typeof setInterval> | null = null

const DEFAULT_PROFILE_AVATAR = 'https://blog.tonks.top/assets/home/home.png'
const COMMUNITY_EMOJIS = [
  '😀',
  '😄',
  '😊',
  '🥰',
  '🤔',
  '😭',
  '😳',
  '👍',
  '👏',
  '🎉',
  '❤️',
  '✨',
  '🌙',
  '🍀',
  '🐾',
  '☕',
  '📚',
  '💻',
  '🚀',
  '👀',
] as const

const activeRoom = computed(
  () => COMMUNITY_ROOMS.find((room) => room.page === activePage.value) ?? COMMUNITY_ROOMS[0],
)
const activeBlogUrl = computed(() =>
  activePage.value === 'about'
    ? 'https://blog.tonks.top/about/'
    : activePage.value === 'friends'
      ? 'https://blog.tonks.top/friends/'
      : '',
)
const activeBlogLabel = computed(() =>
  activePage.value === 'about' ? '前往“关于本站”' : '前往“友链墙”',
)
const visibleRooms = computed(() => {
  const query = roomQuery.value.trim().toLowerCase()
  if (!query) return COMMUNITY_ROOMS
  return COMMUNITY_ROOMS.filter((room) =>
    `${room.name} ${room.label}`.toLowerCase().includes(query),
  )
})
const activeServerMessages = computed(() =>
  activePage.value === 'feedback'
    ? []
    : sortCommunityMessages(comments.value.filter((comment) => comment.page === activePage.value)),
)
const activePendingMessages = computed(() =>
  activePage.value === 'feedback'
    ? []
    : localPending.value.filter((comment) => comment.page === activePage.value),
)
const messageIndex = computed(() => indexCommunityMessages(comments.value))
const activeMembers = computed(() =>
  buildCommunityMembers(
    activeServerMessages.value.filter((comment) => comment.status === 'published'),
  ),
)
const visibleMessages = computed(() => {
  const messages = [...activeServerMessages.value, ...activePendingMessages.value]
  if (!selectedAuthorKey.value) return sortCommunityMessages(messages)
  return sortCommunityMessages(
    messages.filter((comment) => {
      return communityAuthorKey(comment) === selectedAuthorKey.value
    }),
  )
})
const messageGroups = computed(() => groupCommunityMessagesByLocalDate(visibleMessages.value))
const selectedComment = computed(
  () => comments.value.find((comment) => comment.id === selectedCommentId.value) ?? null,
)
const activeMemberCount = computed(() => {
  if (activePage.value !== 'feedback') return activeMembers.value.length
  const members = new Set<string>()
  for (const topic of feedbackTopics.value) {
    for (const item of topic.messages)
      members.add(item.is_admin ? 'station-owner' : item.author_key)
  }
  for (const item of feedbackRoomMessages.value) {
    members.add(item.is_admin ? 'station-owner' : item.author_key)
  }
  return members.size
})

function roomComments(page: CommentPage): CommunityComment[] {
  return comments.value.filter((comment) => comment.page === page)
}

function roomPublicCount(page: CommunityRoomKey): number {
  if (page === 'feedback') {
    return (
      feedbackTopics.value.filter((topic) => topic.status !== 'merged').length +
      feedbackRoomMessages.value.filter((message) => message.status === 'published').length
    )
  }
  return roomComments(page).filter((comment) => comment.status === 'published').length
}

function roomPendingCount(page: CommunityRoomKey): number {
  if (page === 'feedback') return 0
  if (!admin.isLoggedIn) return 0
  return roomComments(page).filter((comment) => comment.status === 'pending').length
}

function roomLatest(page: CommunityRoomKey): CommunityComment | null {
  if (page === 'feedback') return null
  return latestCommunityMessage(
    roomComments(page).filter((comment) => comment.status === 'published'),
  )
}

function roomAvatar(page: CommunityRoomKey): string {
  return COMMUNITY_ROOMS.find((room) => room.page === page)?.avatar ?? ''
}

function latestFeedbackEntry():
  | { type: 'topic'; createdAt: string; nickname: string; text: string }
  | { type: 'message'; createdAt: string; nickname: string; text: string }
  | null {
  const entries = [
    ...feedbackTopics.value
      .filter((topic) => topic.status !== 'merged')
      .map((topic) => ({
        type: 'topic' as const,
        createdAt: topic.created_at,
        nickname: topic.nickname,
        text: `[反馈] ${topic.title}`,
      })),
    ...feedbackRoomMessages.value
      .filter((message) => message.status === 'published')
      .map((message) => ({
        type: 'message' as const,
        createdAt: message.created_at,
        nickname: message.nickname,
        text: message.content,
      })),
  ]
  return (
    entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ??
    null
  )
}

function roomLatestTime(page: CommunityRoomKey): string {
  if (page === 'feedback') {
    const latest = latestFeedbackEntry()
    if (!latest) return ''
    return compactRoomTime(latest.createdAt)
  }
  const latest = roomLatest(page)
  if (!latest) return ''
  return compactRoomTime(latest.created_at)
}

function compactRoomTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDifference = Math.round((today.getTime() - target.getTime()) / 86_400_000)

  if (dayDifference === 0) {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)
  }
  if (dayDifference === 1) return '昨天'
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

function roomPreview(page: CommunityRoomKey): string {
  if (page === 'feedback') {
    const latest = latestFeedbackEntry()
    return latest ? `${latest.nickname}：${latest.text}` : '还没有人说话'
  }
  const latest = roomLatest(page)
  return latest ? `${latest.nickname}：${latest.content}` : '还没有人说话'
}

function readIdentity() {
  identity.value = getCommunityProfile()
  void syncProfileAvatar()
}

async function syncProfileAvatar() {
  const email = identity.value.email.trim()
  if (!email) {
    profileAvatarUrl.value = DEFAULT_PROFILE_AVATAR
    return
  }
  try {
    profileAvatarUrl.value = await getCommunityAvatarPreview(email)
  } catch {
    profileAvatarUrl.value = DEFAULT_PROFILE_AVATAR
  }
}

function saveIdentity(nextIdentity: VisitorIdentity, remember: boolean) {
  identity.value = nextIdentity
  if (remember) saveCommunityProfile(nextIdentity)
  else clearCommunityProfile()
  void syncProfileAvatar()
  if (pendingSendAfterIdentity.value) {
    pendingSendAfterIdentity.value = false
    void nextTick(() => sendMessage())
  }
}

function insertEmoji(emoji: string) {
  const input = composerInput.value
  const start = input?.selectionStart ?? composer.value.length
  const end = input?.selectionEnd ?? start
  const next = `${composer.value.slice(0, start)}${emoji}${composer.value.slice(end)}`
  if (next.length > 800) return
  composer.value = next
  emojiOpen.value = false
  void nextTick(() => {
    input?.focus()
    const caret = start + emoji.length
    input?.setSelectionRange(caret, caret)
  })
}

function handleEmojiOutsidePointer(event: PointerEvent) {
  if (!emojiOpen.value) return
  const target = event.target
  if (target instanceof Node && emojiPopover.value?.contains(target)) return
  emojiOpen.value = false
}

function hasIdentity(): boolean {
  return Boolean(identity.value.nickname.trim() && identity.value.email.trim())
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '访客'
}

function failMemberAvatar(commentId: number) {
  failedMemberAvatars.value = new Set([...failedMemberAvatars.value, commentId])
}

function errorMessage(cause: unknown, fallback: string): string {
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

async function scrollMessagesToBottom() {
  await nextTick()
  const viewport = messagesViewport.value
  if (viewport) viewport.scrollTop = viewport.scrollHeight
}

async function loadComments(options: { quiet?: boolean; scroll?: boolean } = {}) {
  if (options.quiet) refreshing.value = true
  else loading.value = true
  loadError.value = ''
  try {
    const secret = admin.isLoggedIn ? admin.secret : ''
    const [about, friends, feedback] = await Promise.all([
      getCommunityComments('about', secret),
      getCommunityComments('friends', secret),
      getFeedbackTopics(secret),
    ])
    comments.value = [...about, ...friends]
    feedbackTopics.value = feedback.topics
    feedbackRoomMessages.value = feedback.messages
    if (
      selectedCommentId.value !== null &&
      !comments.value.some((comment) => comment.id === selectedCommentId.value)
    ) {
      selectedCommentId.value = null
      mobilePanel.value = null
    }
    if (options.scroll) await scrollMessagesToBottom()
  } catch (cause) {
    console.warn('[community-chat] load failed', cause)
    loadError.value = admin.isLoggedIn
      ? '留言读取失败，请确认管理员会话或后端版本'
      : '留言暂时无法读取，请稍后重试'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function startRefreshTimer() {
  stopRefreshTimer()
  refreshTimer = setInterval(() => {
    if (props.active && document.visibilityState === 'visible') void loadComments({ quiet: true })
  }, 30_000)
}

function stopRefreshTimer() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = null
}

function handleVisibilityChange() {
  if (props.active && document.visibilityState === 'visible') void loadComments({ quiet: true })
}

function selectRoom(page: CommunityRoomKey) {
  activePage.value = page
  selectedAuthorKey.value = ''
  selectedCommentId.value = null
  replyTarget.value = null
  composerStatus.value = ''
  mobilePanel.value = null
  void scrollMessagesToBottom()
}

function convertToFeedback(comment: CommunityComment) {
  if (!admin.isLoggedIn || comment.id < 1) return
  feedbackConvertRootId.value = comment.root_id || comment.id
  feedbackConvertOpen.value = true
}

function selectMember(authorKey: string) {
  selectedAuthorKey.value = selectedAuthorKey.value === authorKey ? '' : authorKey
  mobilePanel.value = null
  void scrollMessagesToBottom()
}

function replyTo(comment: CommunityComment) {
  replyTarget.value = comment
  composerStatus.value = ''
  requestAnimationFrame(() =>
    document.querySelector<HTMLTextAreaElement>('#community-composer')?.focus(),
  )
}

function inspectComment(comment: CommunityComment) {
  if (!admin.isLoggedIn) return
  selectedCommentId.value = comment.id
  reviewNote.value = comment.moderation_reason || ''
  confirmDelete.value = false
  mobilePanel.value = 'review'
}

function showMembers() {
  selectedCommentId.value = null
  mobilePanel.value = 'members'
}

function requestSend() {
  if (!composer.value.trim() || sending.value) return
  if (!hasIdentity()) {
    pendingSendAfterIdentity.value = true
    identityOpen.value = true
    return
  }
  void sendMessage()
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  requestSend()
}

async function sendMessage() {
  if (activePage.value === 'feedback') return
  const page = activePage.value
  const content = composer.value.trim()
  if (!content || sending.value || !hasIdentity()) return
  sending.value = true
  composerError.value = ''
  composerStatus.value = ''
  const target = replyTarget.value
  try {
    const result = await submitCommunityComment(
      page,
      {
        ...identity.value,
        content,
        parent_id: target?.id ?? null,
      },
      admin.isLoggedIn ? admin.secret : '',
    )
    if (result.comment) {
      comments.value = [...comments.value, result.comment]
    } else {
      localPending.value = [
        ...localPending.value,
        {
          id: -Date.now(),
          page,
          parent_id: target?.id ?? null,
          root_id: target?.root_id ?? -Date.now(),
          nickname: identity.value.nickname,
          email: identity.value.email,
          website: identity.value.website,
          content,
          status: 'pending',
          is_admin: false,
          owned: true,
          author_key: 'local-pending-author',
          created_at: new Date().toISOString(),
          reply_to_name: target?.nickname ?? '',
          moderation_reason: '',
        },
      ]
    }
    composer.value = ''
    replyTarget.value = null
    composerStatus.value = result.message
    await scrollMessagesToBottom()
  } catch (cause) {
    console.warn('[community-chat] submit failed', cause)
    composerError.value = errorMessage(cause, '消息发送失败，请稍后重试')
  } finally {
    sending.value = false
  }
}

async function moderateSelected(status: 'published' | 'rejected') {
  const comment = selectedComment.value
  if (!comment || !admin.isLoggedIn || actionBusy.value) return
  actionBusy.value = true
  loadError.value = ''
  try {
    const fallback = status === 'published' ? 'manual: 人工审核通过' : 'manual: 人工审核拒绝'
    await moderateCommunityComment(
      comment.id,
      status,
      reviewNote.value.trim() || fallback,
      admin.secret,
    )
    await loadComments({ quiet: true })
  } catch (cause) {
    loadError.value = errorMessage(cause, '审核操作失败，请稍后重试')
  } finally {
    actionBusy.value = false
  }
}

async function deleteSelected() {
  const comment = selectedComment.value
  if (!comment || !admin.isLoggedIn || actionBusy.value) return
  actionBusy.value = true
  loadError.value = ''
  try {
    await deleteCommunityComment(comment.id, admin.secret)
    selectedCommentId.value = null
    confirmDelete.value = false
    mobilePanel.value = null
    await loadComments({ quiet: true })
  } catch (cause) {
    loadError.value = errorMessage(cause, '删除失败，请稍后重试')
  } finally {
    actionBusy.value = false
  }
}

watch(
  () => props.active,
  (visible) => {
    if (!visible) {
      stopRefreshTimer()
      return
    }
    readIdentity()
    void loadComments({ scroll: true })
    startRefreshTimer()
  },
  { immediate: true },
)

watch(
  () => admin.isLoggedIn,
  () => {
    if (props.active) void loadComments({ quiet: true })
  },
)

watch(identityOpen, (visible) => {
  if (!visible) pendingSendAfterIdentity.value = false
})

document.addEventListener('visibilitychange', handleVisibilityChange)
document.addEventListener('pointerdown', handleEmojiOutsidePointer)
onBeforeUnmount(() => {
  stopRefreshTimer()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('pointerdown', handleEmojiOutsidePointer)
})
</script>

<template>
  <div
    class="qq-chat-shell relative grid min-h-0 min-w-0 flex-1 overflow-hidden lg:grid-cols-[244px_minmax(0,1fr)_248px] lg:grid-rows-[4rem_minmax(0,1fr)]"
  >
    <aside
      class="qq-session-pane hidden min-h-0 border-r border-border lg:row-span-2 lg:flex lg:flex-col"
    >
      <div class="qq-profile-bar">
        <img
          class="qq-profile-avatar"
          :src="profileAvatarUrl"
          alt=""
          draggable="false"
          referrerpolicy="no-referrer"
          @error="profileAvatarUrl = DEFAULT_PROFILE_AVATAR"
        />
        <div class="min-w-0 flex-1">
          <strong>Tonks' Chat</strong>
          <span>{{ admin.isLoggedIn ? '管理模式' : '访客模式' }}</span>
        </div>
        <button
          type="button"
          class="qq-icon-button"
          :aria-label="admin.isLoggedIn ? '打开友链申请' : '管理员登录'"
          @click="admin.isLoggedIn ? emit('openApplications') : emit('login')"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div class="qq-search-row">
        <label class="qq-search-box">
          <Search class="h-3.5 w-3.5" aria-hidden="true" />
          <input v-model="roomQuery" type="search" placeholder="搜索" aria-label="搜索留言房间" />
        </label>
      </div>
      <nav class="qq-session-list" aria-label="留言房间">
        <button
          v-for="room in visibleRooms"
          :key="room.page"
          type="button"
          :class="['room-entry', activePage === room.page && 'is-active']"
          @click="selectRoom(room.page)"
        >
          <img
            class="qq-room-avatar"
            :src="roomAvatar(room.page)"
            :alt="`${room.name} 群头像`"
            draggable="false"
          />
          <span class="room-entry-copy">
            <span class="room-title-row">
              <strong>{{ room.name }}</strong>
              <time v-if="roomLatestTime(room.page)">{{ roomLatestTime(room.page) }}</time>
            </span>
            <span class="room-preview-row">
              <span class="room-preview">{{ roomPreview(room.page) }}</span>
              <span v-if="roomPendingCount(room.page)" class="room-pending">
                {{ roomPendingCount(room.page) }}
              </span>
            </span>
          </span>
        </button>
        <p v-if="!visibleRooms.length" class="px-4 py-10 text-center text-xs text-muted-foreground">
          没有找到会话
        </p>
      </nav>

      <div v-if="admin.isLoggedIn" class="mt-auto border-t border-border p-2">
        <button type="button" class="room-entry" @click="emit('openApplications')">
          <span class="room-icon"><Link2 class="h-4 w-4" aria-hidden="true" /></span>
          <span class="min-w-0 flex-1 text-left">
            <strong>友链申请</strong>
            <span class="room-preview">新的系统消息</span>
          </span>
          <span v-if="applicationCount" class="room-pending">{{ applicationCount }}</span>
        </button>
      </div>
    </aside>

    <header class="qq-shared-header lg:col-[2/4] lg:row-start-1">
      <div class="flex min-w-0 items-center gap-2">
        <h3 class="truncate text-[15px] font-semibold">
          {{ activeRoom.name }} 交流群
          <span class="ml-1 text-xs font-normal text-muted-foreground">
            ({{ activeMemberCount }})
          </span>
        </h3>
      </div>
      <div class="qq-shared-actions">
        <a
          v-if="activeBlogUrl"
          :href="activeBlogUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="qq-header-action qq-header-action--labelled"
          :title="activeBlogLabel"
          :aria-label="activeBlogLabel"
        >
          <ExternalLink class="h-4 w-4" aria-hidden="true" />
          <span>{{ activeBlogLabel }}</span>
        </a>
        <button
          v-if="activePage === 'friends'"
          type="button"
          class="qq-header-action"
          title="申请友链或查看申请状态"
          aria-label="申请友链或查看申请状态"
          @click="friendApplyOpen = true"
        >
          <Link2 class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="qq-header-action"
          :disabled="loading || refreshing"
          title="刷新当前房间"
          aria-label="刷新当前房间"
          @click="loadComments({ quiet: true })"
        >
          <RefreshCw :class="['h-4 w-4', refreshing && 'animate-spin']" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="qq-header-action lg:hidden"
          title="查看群公告与成员"
          aria-label="查看群公告与成员"
          @click="showMembers"
        >
          <PanelRight class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="qq-header-action"
          title="关闭留言群聊"
          aria-label="关闭留言群聊"
          @click="emit('close')"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div class="qq-mobile-rooms lg:hidden">
        <button
          v-for="room in COMMUNITY_ROOMS"
          :key="room.page"
          type="button"
          :class="['mobile-room-tab', activePage === room.page && 'is-active']"
          @click="selectRoom(room.page)"
        >
          {{ room.name }}
          <span>{{ roomPublicCount(room.page) }}</span>
        </button>
        <button
          v-if="admin.isLoggedIn"
          type="button"
          class="mobile-room-tab"
          @click="emit('openApplications')"
        >
          审核
          <span v-if="applicationCount">{{ applicationCount }}</span>
        </button>
      </div>
    </header>

    <CommunityFeedbackChatRoom
      v-if="activePage === 'feedback'"
      :topics="feedbackTopics"
      :messages="feedbackRoomMessages"
      :loading="loading"
      :identity="identity"
      :admin-mode="admin.isLoggedIn"
      :admin-secret="admin.secret"
      @reload="loadComments({ quiet: true })"
      @request-identity="identityOpen = true"
    />

    <section
      v-if="activePage !== 'feedback'"
      class="qq-conversation-pane grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden lg:col-start-2 lg:row-start-2"
    >
      <div
        ref="messagesViewport"
        class="community-message-scroll min-h-0 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5"
      >
        <p
          v-if="loadError"
          class="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {{ loadError }}
        </p>
        <div v-if="loading" class="grid place-items-center gap-2 py-16 text-muted-foreground">
          <LoaderCircle class="h-6 w-6 animate-spin" aria-hidden="true" />
          <p class="text-xs">正在连接留言房间…</p>
        </div>
        <div
          v-else-if="!visibleMessages.length"
          class="grid place-items-center gap-2 py-16 text-center text-muted-foreground"
        >
          <Inbox class="h-8 w-8 opacity-35" aria-hidden="true" />
          <p class="text-sm">{{ selectedAuthorKey ? '这位成员还没有可见消息' : '这里还很安静' }}</p>
          <button
            v-if="selectedAuthorKey"
            type="button"
            class="text-xs text-primary hover:underline"
            @click="selectedAuthorKey = ''"
          >
            查看全部消息
          </button>
        </div>
        <div v-else class="grid gap-1">
          <template v-for="group in messageGroups" :key="group.key">
            <div class="qq-time-divider">
              <span>{{ group.label }}</span>
            </div>
            <CommunityMessageBubble
              v-for="message in group.messages"
              :key="message.id"
              :comment="message"
              :parent="message.parent_id ? messageIndex.get(message.parent_id) : undefined"
              :admin-mode="admin.isLoggedIn"
              :selected="selectedCommentId === message.id"
              :local-pending="message.id < 0"
              @reply="replyTo"
              @inspect="inspectComment"
              @feedback="convertToFeedback"
            />
          </template>
        </div>
      </div>

      <footer class="qq-composer-panel border-t border-border">
        <div
          v-if="replyTarget"
          class="qq-reply-context mx-3 mt-2 flex min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-md bg-primary/7 px-3 py-2 text-xs sm:mx-5"
        >
          <MessageCircle class="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <p class="min-w-0 flex-1 truncate">
            回复
            <strong>@{{ replyTarget.nickname }}</strong>
            ：{{ replyTarget.content }}
          </p>
          <button
            type="button"
            class="rounded p-1 hover:bg-muted"
            aria-label="取消回复"
            @click="replyTarget = null"
          >
            <X class="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div class="qq-composer-toolbar">
          <div ref="emojiPopover" class="flex items-center gap-0.5">
            <button
              type="button"
              class="qq-tool-button"
              title="选择表情"
              aria-label="选择表情"
              :aria-expanded="emojiOpen"
              @click="emojiOpen = !emojiOpen"
            >
              <Smile class="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <div v-if="emojiOpen" class="qq-emoji-picker" role="listbox" aria-label="表情">
              <button
                v-for="emoji in COMMUNITY_EMOJIS"
                :key="emoji"
                type="button"
                role="option"
                @click="insertEmoji(emoji)"
              >
                {{ emoji }}
              </button>
            </div>
          </div>
          <button
            type="button"
            class="qq-identity-button"
            :title="hasIdentity() ? '编辑访客身份' : '填写访客身份'"
            @click="identityOpen = true"
          >
            <Pencil v-if="hasIdentity()" class="h-3.5 w-3.5" aria-hidden="true" />
            <UserRound v-else class="h-3.5 w-3.5" aria-hidden="true" />
            <span class="hidden sm:inline">
              {{ hasIdentity() ? identity.nickname : '填写身份' }}
            </span>
          </button>
        </div>
        <div class="community-composer">
          <textarea
            ref="composerInput"
            id="community-composer"
            v-model="composer"
            rows="3"
            maxlength="800"
            class="qq-composer-input"
            :placeholder="
              replyTarget ? `回复 @${replyTarget.nickname}…` : `在 ${activeRoom.name} 说点什么…`
            "
            :disabled="sending"
            @keydown="handleComposerKeydown"
          />
        </div>
        <div class="qq-composer-actions">
          <p :class="composerError && 'text-destructive'">
            {{
              composerError ||
              composerStatus ||
              'Enter 发送，Shift + Enter 换行；消息会经过内容审核。'
            }}
          </p>
          <div class="flex shrink-0 items-center gap-2">
            <span class="tabular-nums text-muted-foreground">{{ composer.length }} / 800</span>
            <Button
              size="sm"
              class="qq-send-button"
              :disabled="!composer.trim() || sending"
              aria-label="发送留言"
              @click="requestSend"
            >
              <LoaderCircle v-if="sending" class="h-4 w-4 animate-spin" aria-hidden="true" />
              <template v-else>发送</template>
            </Button>
          </div>
        </div>
      </footer>
    </section>

    <aside
      v-if="activePage !== 'feedback'"
      :class="[
        'qq-info-pane min-h-0 flex-col overflow-y-auto border-l border-border',
        mobilePanel ? 'absolute inset-0 z-20 flex bg-popover/98 backdrop-blur-xl' : 'hidden',
        'lg:static lg:col-start-3 lg:row-start-2 lg:flex lg:backdrop-blur-none',
      ]"
    >
      <Button
        size="sm"
        variant="ghost"
        class="m-3 self-start lg:hidden"
        @click="mobilePanel = null"
      >
        <ArrowLeft class="mr-1.5 h-4 w-4" aria-hidden="true" />
        返回群聊
      </Button>

      <template v-if="admin.isLoggedIn && selectedComment">
        <div class="p-4">
          <p class="font-mono text-[9px] tracking-[0.18em] text-primary/75">
            REVIEW / #{{ selectedComment.id }}
          </p>
          <h3 class="mt-1 text-base font-semibold">审核消息</h3>
          <div class="mt-4 grid gap-2 text-xs">
            <div class="rounded-xl border border-border bg-card/70 p-3">
              <p class="text-muted-foreground">作者</p>
              <p class="mt-1 font-medium">{{ selectedComment.nickname }}</p>
            </div>
            <div
              v-if="selectedComment.email"
              class="rounded-xl border border-border bg-card/70 p-3"
            >
              <p class="flex items-center gap-1 text-muted-foreground">
                <Mail class="h-3 w-3" aria-hidden="true" />
                邮箱（仅管理员可见）
              </p>
              <a
                class="mt-1 block break-all font-medium hover:text-primary"
                :href="`mailto:${selectedComment.email}`"
              >
                {{ selectedComment.email }}
              </a>
            </div>
            <div class="rounded-xl border border-border bg-card/70 p-3">
              <p class="text-muted-foreground">模型判断</p>
              <p class="mt-1 break-words leading-5">
                {{ selectedComment.moderation_reason || '没有审核说明' }}
              </p>
            </div>
          </div>
          <label class="mt-4 grid gap-1.5 text-xs text-muted-foreground">
            人工备注
            <textarea
              v-model="reviewNote"
              rows="3"
              maxlength="300"
              class="resize-none rounded-lg border border-border bg-background/70 p-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div class="mt-4 grid grid-cols-2 gap-2">
            <Button
              :disabled="actionBusy || selectedComment.status === 'published'"
              @click="moderateSelected('published')"
            >
              <Check class="mr-1.5 h-4 w-4" aria-hidden="true" />
              通过
            </Button>
            <Button
              variant="outline"
              :disabled="actionBusy || selectedComment.status === 'rejected'"
              @click="moderateSelected('rejected')"
            >
              <XCircle class="mr-1.5 h-4 w-4" aria-hidden="true" />
              拒绝
            </Button>
          </div>
          <div
            v-if="confirmDelete"
            class="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3"
          >
            <p class="text-xs leading-5 text-destructive">
              将软删除这条留言及其所有回复，确定继续吗？
            </p>
            <div class="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                :disabled="actionBusy"
                @click="deleteSelected"
              >
                确认删除
              </Button>
              <Button
                size="sm"
                variant="ghost"
                :disabled="actionBusy"
                @click="confirmDelete = false"
              >
                取消
              </Button>
            </div>
          </div>
          <Button
            v-else
            variant="ghost"
            class="mt-3 w-full text-destructive hover:text-destructive"
            :disabled="actionBusy"
            @click="confirmDelete = true"
          >
            <Trash2 class="mr-1.5 h-4 w-4" aria-hidden="true" />
            删除留言树
          </Button>
          <Button variant="ghost" class="mt-2 w-full" @click="selectedCommentId = null">
            返回成员列表
          </Button>
        </div>
      </template>

      <template v-else>
        <section class="qq-group-section border-b border-border">
          <h3>群公告</h3>
          <p>{{ activeRoom.description }}</p>
        </section>
        <section class="qq-group-section flex-1">
          <div class="flex items-center justify-between gap-2">
            <h3>群成员 {{ activeMembers.length }}</h3>
            <button
              v-if="selectedAuthorKey"
              type="button"
              class="rounded-md px-2 py-1 text-[9px] text-primary hover:bg-primary/10"
              @click="selectedAuthorKey = ''"
            >
              全部消息
            </button>
          </div>
          <p class="mt-1 text-[10px] text-muted-foreground">按发言时间排序</p>
          <div v-if="activeMembers.length" class="mt-3 grid gap-0.5">
            <button
              v-for="member in activeMembers"
              :key="member.authorKey"
              type="button"
              :class="['member-entry', selectedAuthorKey === member.authorKey && 'is-active']"
              @click="selectMember(member.authorKey)"
            >
              <span class="member-avatar">
                <img
                  v-if="!failedMemberAvatars.has(member.avatarCommentId)"
                  :src="getCommunityAvatarUrl(member.avatarCommentId)"
                  alt=""
                  draggable="false"
                  @error="failMemberAvatar(member.avatarCommentId)"
                />
                <span v-else>{{ initials(member.nickname) }}</span>
              </span>
              <span class="min-w-0 flex-1 text-left">
                <span class="flex items-center gap-1">
                  <strong class="truncate">{{ member.nickname }}</strong>
                  <ShieldCheck
                    v-if="member.isAdmin"
                    class="h-3 w-3 shrink-0 text-primary"
                    aria-label="站长"
                  />
                </span>
                <span class="block truncate text-[9px] text-muted-foreground">
                  {{ member.messageCount }} 条消息
                </span>
              </span>
              <ExternalLink
                v-if="member.website"
                class="h-3 w-3 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </div>
          <div v-else class="grid place-items-center gap-2 py-12 text-center text-muted-foreground">
            <UsersRound class="h-7 w-7 opacity-35" aria-hidden="true" />
            <p class="text-xs">还没有群成员</p>
          </div>
        </section>

        <div v-if="!admin.isLoggedIn" class="qq-manager-entry">
          <LockKeyhole class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <button type="button" @click="emit('login')">管理员登录</button>
        </div>
      </template>
    </aside>
  </div>

  <CommunityIdentityDialog v-model:open="identityOpen" :identity="identity" @save="saveIdentity" />
  <CommunityFriendApplyDialog v-model:open="friendApplyOpen" />
  <CommunityFeedbackConvertDialog
    v-model:open="feedbackConvertOpen"
    :root-comment-id="feedbackConvertRootId"
    :topics="feedbackTopics"
    :admin-secret="admin.secret"
    @converted="loadComments({ quiet: true })"
  />
</template>

<style scoped>
.qq-chat-shell {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  background: hsl(var(--background));
  contain: inline-size;
}

.qq-session-pane {
  background: hsl(var(--muted) / 0.42);
}

.qq-profile-bar {
  display: flex;
  min-height: 4rem;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.75rem;
}

.qq-profile-avatar {
  display: block;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
  object-fit: cover;
  border-radius: 50%;
  background: hsl(var(--muted));
  user-select: none;
}

.qq-profile-bar strong,
.qq-profile-bar span {
  display: block;
}

.qq-profile-bar strong {
  overflow: hidden;
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qq-profile-bar span:not(.qq-profile-avatar) {
  margin-top: 0.15rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.55rem;
}

.qq-icon-button,
.qq-tool-button {
  display: grid;
  place-items: center;
  color: hsl(var(--muted-foreground));
  transition:
    color 140ms ease,
    background-color 140ms ease;
}

.qq-icon-button {
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 0.35rem;
}

.qq-icon-button:hover,
.qq-tool-button:not(:disabled):hover {
  background: hsl(var(--foreground) / 0.07);
  color: hsl(var(--foreground));
}

.qq-search-row {
  padding: 0 0.75rem 0.65rem;
}

.qq-search-box {
  display: flex;
  height: 1.9rem;
  align-items: center;
  gap: 0.4rem;
  border-radius: 0.35rem;
  background: hsl(var(--background) / 0.55);
  padding: 0 0.55rem;
  color: hsl(var(--muted-foreground));
}

.qq-search-box input {
  min-width: 0;
  flex: 1;
  background: transparent;
  color: hsl(var(--foreground));
  font-size: 0.65rem;
  outline: none;
}

.qq-search-box input::placeholder {
  color: hsl(var(--muted-foreground));
}

.qq-session-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 0.15rem 0.3rem;
}

.room-entry {
  position: relative;
  display: flex;
  width: 100%;
  align-items: center;
  min-height: 3.8rem;
  gap: 0.68rem;
  border: 0;
  border-radius: 0.22rem;
  padding: 0.48rem 0.58rem;
  color: hsl(var(--foreground) / 0.82);
  transition:
    color 140ms ease,
    background-color 140ms ease;
}

.room-entry:hover {
  background: hsl(var(--foreground) / 0.055);
}

.room-entry.is-active {
  background: hsl(var(--foreground) / 0.085);
  color: hsl(var(--foreground));
}

.room-icon {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.qq-room-avatar {
  display: block;
  width: 2.65rem;
  height: 2.65rem;
  flex: 0 0 auto;
  border-radius: 50%;
  background: hsl(var(--muted));
  object-fit: cover;
  user-select: none;
}

.room-entry-copy {
  display: block;
  min-width: 0;
  flex: 1;
  text-align: left;
}

.room-title-row,
.room-preview-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
}

.room-entry strong {
  display: block;
  overflow: hidden;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-title-row time {
  flex: 0 0 auto;
  color: hsl(var(--muted-foreground));
  font-size: 0.54rem;
  font-variant-numeric: tabular-nums;
}

.room-preview {
  display: block;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  margin-top: 0.2rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.61rem;
  line-height: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qq-conversation-pane {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  background: hsl(var(--background));
}

.qq-shared-header {
  position: relative;
  z-index: 2;
  display: flex;
  min-height: 4rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--card) / 0.32);
  padding: 0.75rem 1.2rem;
}

.qq-header-action {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.3rem;
  color: hsl(var(--muted-foreground));
  transition:
    color 140ms ease,
    background-color 140ms ease;
}

.qq-header-action--labelled {
  display: inline-flex;
  width: auto;
  gap: 0.35rem;
  padding: 0 0.55rem;
  font-size: 0.6rem;
}

.qq-header-action:hover:not(:disabled) {
  background: hsl(var(--foreground) / 0.07);
  color: hsl(var(--foreground));
}

.qq-header-action:disabled {
  cursor: wait;
  opacity: 0.45;
}

.qq-shared-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.15rem;
}

.qq-mobile-rooms {
  display: flex;
  width: 100%;
  gap: 0.3rem;
}

@media (min-width: 1024px) {
  .qq-mobile-rooms {
    display: none;
  }
}

.qq-time-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0 0.75rem;
}

.qq-time-divider span {
  border-radius: 999px;
  background: hsl(var(--muted) / 0.7);
  padding: 0.18rem 0.55rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.55rem;
}

.room-pending {
  display: grid;
  min-width: 1.05rem;
  height: 1.05rem;
  place-items: center;
  border-radius: 999px;
  background: hsl(38 90% 50% / 0.16);
  color: hsl(34 75% 42%);
  font-size: 0.55rem;
  font-weight: 700;
}

.mobile-room-tab {
  display: inline-flex;
  min-height: 1.75rem;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  background: hsl(var(--background) / 0.58);
  padding: 0 0.7rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.65rem;
}

.mobile-room-tab.is-active {
  border-color: hsl(var(--primary) / 0.35);
  background: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
}

.mobile-room-tab span {
  font-size: 0.55rem;
  font-variant-numeric: tabular-nums;
}

.qq-composer-panel {
  position: relative;
  min-width: 0;
  max-width: 100%;
  min-height: 9.5rem;
  background: hsl(var(--card) / 0.46);
}

.qq-reply-context p {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qq-emoji-picker {
  position: absolute;
  bottom: calc(100% + 0.4rem);
  left: 0.75rem;
  z-index: 30;
  display: grid;
  width: min(17rem, calc(100% - 1.5rem));
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.2rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.6rem;
  background: hsl(var(--popover));
  padding: 0.55rem;
  box-shadow: 0 0.8rem 2rem hsl(var(--foreground) / 0.13);
}

.qq-emoji-picker button {
  display: grid;
  aspect-ratio: 1;
  place-items: center;
  border-radius: 0.35rem;
  font-size: 1.05rem;
  transition:
    background-color 120ms ease,
    transform 120ms ease;
}

.qq-emoji-picker button:hover,
.qq-emoji-picker button:focus-visible {
  background: hsl(var(--primary) / 0.12);
  transform: scale(1.08);
}

.qq-composer-toolbar {
  display: flex;
  min-width: 0;
  height: 2.4rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.75rem 0;
}

.qq-tool-button {
  width: 2rem;
  height: 2rem;
  border-radius: 0.35rem;
}

.qq-tool-button:disabled {
  cursor: default;
  opacity: 0.42;
}

.qq-identity-button {
  display: inline-flex;
  min-height: 1.8rem;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.3rem;
  border-radius: 0.35rem;
  padding: 0 0.45rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6rem;
  transition:
    color 150ms ease,
    background-color 150ms ease;
}

.qq-identity-button:hover {
  background: hsl(var(--foreground) / 0.06);
  color: hsl(var(--foreground));
}

.community-composer {
  min-width: 0;
  max-width: 100%;
  padding: 0 0.95rem;
}

.qq-composer-input {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  min-height: 4.2rem;
  resize: none;
  background: transparent;
  color: hsl(var(--foreground));
  font-size: 0.78rem;
  line-height: 1.55;
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: pre-wrap;
  outline: none;
}

.qq-composer-input::placeholder {
  color: hsl(var(--muted-foreground) / 0.72);
}

.qq-composer-actions {
  display: flex;
  min-width: 0;
  max-width: 100%;
  min-height: 2.3rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0 0.8rem 0.55rem 0.95rem;
  font-size: 0.55rem;
}

.qq-composer-actions > p {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qq-send-button {
  height: 1.8rem;
  min-width: 4.2rem;
  border-radius: 0.3rem;
  font-size: 0.68rem;
}

.qq-info-pane {
  background: hsl(var(--card) / 0.38);
}

.qq-group-section {
  padding: 1rem;
}

.qq-group-section h3 {
  color: hsl(var(--foreground));
  font-size: 0.72rem;
  font-weight: 650;
}

.qq-group-section > p {
  margin-top: 0.65rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.62rem;
  line-height: 1.65;
}

.qq-manager-entry {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  border-top: 1px solid hsl(var(--border));
  padding: 0.75rem 1rem;
  font-size: 0.62rem;
}

.qq-manager-entry button:hover {
  color: hsl(var(--primary));
}

.member-entry {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.55rem;
  border: 0;
  border-radius: 0.3rem;
  padding: 0.45rem;
  transition:
    border-color 150ms ease,
    background-color 150ms ease;
}

.member-entry:hover,
.member-entry.is-active {
  background: hsl(var(--foreground) / 0.055);
}

.member-entry.is-active {
  background: hsl(var(--primary) / 0.1);
}

.member-avatar {
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 50%;
  background: hsl(var(--muted));
}

.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}

.member-entry strong {
  font-size: 0.68rem;
}

.community-message-scroll {
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) transparent;
}

@media (max-width: 1023px) {
  .qq-chat-shell {
    grid-template-rows: auto minmax(0, 1fr);
  }

  .qq-shared-header {
    flex-wrap: wrap;
    padding: 1rem 0.75rem 0.7rem 1rem;
  }

  .qq-composer-panel {
    min-height: 8.4rem;
  }

  .qq-composer-input {
    min-height: 3.2rem;
  }
}

@media (max-width: 639px) {
  .qq-header-action--labelled {
    width: 2rem;
    padding: 0;
  }

  .qq-header-action--labelled span {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .room-entry,
  .qq-identity-button,
  .member-entry {
    transition: none;
  }
}
</style>
