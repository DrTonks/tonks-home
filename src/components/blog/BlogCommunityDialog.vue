<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  ExternalLink,
  Inbox,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UsersRound,
  XCircle,
} from 'lucide-vue-next'
import {
  deleteCommunityComment,
  getCommunityComments,
  getFriendApplications,
  moderateCommunityComment,
  updateFriendApplication,
  type CommentPage,
  type CommentStatus,
  type CommunityComment,
  type FriendApplication,
  type FriendApplicationStatus,
} from '@/api/community'
import { buildCommentThreads, friendApplicationJson } from '@/lib/community'
import { useAdminStore } from '@/stores/admin'
import { AdminLoginDialog } from '@/components/auth'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import CommentThread from './CommentThread.vue'

type Section = 'comments' | 'applications'
type PageFilter = 'all' | CommentPage
type StatusFilter = 'all' | CommentStatus
type ApplicationFilter = 'all' | FriendApplicationStatus

const open = defineModel<boolean>('open')
const admin = useAdminStore()
const loginOpen = ref(false)
const section = ref<Section>('comments')
const pageFilter = ref<PageFilter>('all')
const statusFilter = ref<StatusFilter>('all')
const applicationFilter = ref<ApplicationFilter>('pending')
const comments = ref<CommunityComment[]>([])
const applications = ref<FriendApplication[]>([])
const commentsLoading = ref(false)
const applicationsLoading = ref(false)
const commentsError = ref('')
const applicationsError = ref('')
const selectedCommentId = ref<number | null>(null)
const selectedApplicationId = ref<number | null>(null)
const reviewNote = ref('')
const applicationNote = ref('')
const actionBusy = ref(false)
const confirmDelete = ref(false)
const copyFeedback = ref('')
const failedApplicationAvatars = ref(new Set<number>())

const pageComments = computed(() =>
  pageFilter.value === 'all'
    ? comments.value
    : comments.value.filter((comment) => comment.page === pageFilter.value),
)
const filteredThreads = computed(() =>
  buildCommentThreads(pageComments.value).filter((thread) => {
    if (statusFilter.value === 'all') return true
    return [thread.root, ...thread.replies].some((comment) => comment.status === statusFilter.value)
  }),
)
const selectedComment = computed(
  () => comments.value.find((comment) => comment.id === selectedCommentId.value) ?? null,
)
const filteredApplications = computed(() =>
  applicationFilter.value === 'all'
    ? applications.value
    : applications.value.filter((item) => item.status === applicationFilter.value),
)
const selectedApplication = computed(
  () => applications.value.find((item) => item.id === selectedApplicationId.value) ?? null,
)
const publishedCount = computed(
  () => comments.value.filter((comment) => comment.status === 'published').length,
)
const pendingCount = computed(
  () => comments.value.filter((comment) => comment.status === 'pending').length,
)
const pendingApplicationCount = computed(
  () => applications.value.filter((item) => item.status === 'pending').length,
)

function pageLabel(page: CommentPage): string {
  return page === 'about' ? '关于本站' : '友链'
}

function statusLabel(status: CommentStatus | FriendApplicationStatus): string {
  return {
    published: '已发布',
    pending: '待审核',
    rejected: '已拒绝',
    approved: '已通过',
  }[status]
}

function formatTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function failApplicationAvatar(id: number) {
  failedApplicationAvatars.value = new Set([...failedApplicationAvatars.value, id])
}

async function loadComments() {
  commentsLoading.value = true
  commentsError.value = ''
  try {
    const secret = admin.isLoggedIn ? admin.secret : ''
    const [about, friends] = await Promise.all([
      getCommunityComments('about', secret),
      getCommunityComments('friends', secret),
    ])
    comments.value = [...about, ...friends]
    if (
      selectedCommentId.value !== null &&
      !comments.value.some((comment) => comment.id === selectedCommentId.value)
    ) {
      selectedCommentId.value = null
    }
  } catch (cause) {
    console.warn('[community] comments load failed', cause)
    commentsError.value = admin.isLoggedIn
      ? '评论读取失败，请确认管理员会话或后端版本'
      : '评论暂时无法读取，请稍后重试'
  } finally {
    commentsLoading.value = false
  }
}

async function loadApplications() {
  if (!admin.isLoggedIn) return
  applicationsLoading.value = true
  applicationsError.value = ''
  try {
    applications.value = await getFriendApplications(admin.secret)
    if (
      selectedApplicationId.value !== null &&
      !applications.value.some((item) => item.id === selectedApplicationId.value)
    ) {
      selectedApplicationId.value = null
    }
  } catch (cause) {
    console.warn('[community] applications load failed', cause)
    applicationsError.value = '友链申请读取失败，请确认管理员会话或后端版本'
  } finally {
    applicationsLoading.value = false
  }
}

function selectComment(comment: CommunityComment) {
  selectedCommentId.value = comment.id
  reviewNote.value = ''
  confirmDelete.value = false
}

function selectApplication(application: FriendApplication) {
  selectedApplicationId.value = application.id
  applicationNote.value = application.moderation_note || ''
  copyFeedback.value = ''
}

async function moderateSelected(status: Extract<CommentStatus, 'published' | 'rejected'>) {
  const comment = selectedComment.value
  if (!comment || !admin.isLoggedIn) return
  actionBusy.value = true
  commentsError.value = ''
  try {
    const fallback = status === 'published' ? 'manual: 人工审核通过' : 'manual: 人工审核拒绝'
    await moderateCommunityComment(
      comment.id,
      status,
      reviewNote.value.trim() || fallback,
      admin.secret,
    )
    await loadComments()
  } catch (cause) {
    console.warn('[community] moderation failed', cause)
    commentsError.value = '审核操作失败，请稍后重试'
  } finally {
    actionBusy.value = false
  }
}

async function deleteSelected() {
  const comment = selectedComment.value
  if (!comment || !admin.isLoggedIn) return
  actionBusy.value = true
  commentsError.value = ''
  try {
    await deleteCommunityComment(comment.id, admin.secret)
    selectedCommentId.value = null
    confirmDelete.value = false
    await loadComments()
  } catch (cause) {
    console.warn('[community] comment delete failed', cause)
    commentsError.value = '删除失败，请稍后重试'
  } finally {
    actionBusy.value = false
  }
}

async function updateSelectedApplication(status: FriendApplicationStatus) {
  const application = selectedApplication.value
  if (!application || !admin.isLoggedIn) return
  actionBusy.value = true
  applicationsError.value = ''
  try {
    await updateFriendApplication(
      application.id,
      status,
      applicationNote.value.trim(),
      admin.secret,
    )
    await loadApplications()
  } catch (cause) {
    console.warn('[community] friend application update failed', cause)
    applicationsError.value = '友链申请更新失败，请稍后重试'
  } finally {
    actionBusy.value = false
  }
}

async function copySelectedApplication() {
  const application = selectedApplication.value
  if (!application) return
  try {
    await navigator.clipboard.writeText(friendApplicationJson(application))
    copyFeedback.value = '已复制，可粘贴到 friends.json'
  } catch {
    copyFeedback.value = '复制失败，请手动复制站点资料'
  }
}

function showSection(next: Section) {
  if (next === 'applications' && !admin.isLoggedIn) return
  section.value = next
  if (next === 'applications' && !applications.value.length) void loadApplications()
}

watch(open, (visible) => {
  if (!visible) return
  section.value = 'comments'
  void loadComments()
  if (admin.isLoggedIn) void loadApplications()
})

watch(
  () => admin.isLoggedIn,
  (loggedIn) => {
    if (!open.value) return
    if (!loggedIn) {
      section.value = 'comments'
      applications.value = []
      selectedApplicationId.value = null
    }
    void loadComments()
    if (loggedIn) void loadApplications()
  },
)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="grid h-[min(86dvh,820px)] w-[calc(100vw-1.5rem)] max-w-5xl grid-rows-[auto_auto_minmax(0,1fr)] gap-0 overflow-hidden p-0"
    >
      <DialogHeader class="border-b border-border px-5 pb-4 pt-5 sm:px-6">
        <div class="flex flex-wrap items-start justify-between gap-3 pr-8">
          <div>
            <p class="mb-1 font-mono text-[9px] tracking-[0.22em] text-primary/75">
              COMMUNITY / INBOX
            </p>
            <DialogTitle class="flex items-center gap-2 text-xl">
              <MessageCircle class="h-5 w-5 text-primary" aria-hidden="true" />
              评论收件箱
            </DialogTitle>
            <DialogDescription class="mt-1">
              浏览关于本站与友链页面的留言，管理员可以处理待审核内容。
            </DialogDescription>
          </div>
          <div class="flex items-center gap-2">
            <span
              class="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] text-muted-foreground"
            >
              {{ publishedCount }} 条公开留言
            </span>
            <Button
              v-if="!admin.isLoggedIn"
              size="sm"
              variant="outline"
              class="h-8"
              @click="loginOpen = true"
            >
              <LockKeyhole class="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              管理员登录
            </Button>
            <span
              v-else
              class="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary"
            >
              <ShieldCheck class="h-3.5 w-3.5" aria-hidden="true" />
              管理模式
            </span>
          </div>
        </div>
      </DialogHeader>

      <div
        class="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/25 px-5 py-3 sm:px-6"
      >
        <div class="flex items-center rounded-lg border border-border bg-background/60 p-1">
          <button
            type="button"
            :class="['community-tab', section === 'comments' && 'is-active']"
            @click="showSection('comments')"
          >
            <MessageCircle class="h-3.5 w-3.5" aria-hidden="true" />
            留言
            <span v-if="admin.isLoggedIn && pendingCount" class="community-count">
              {{ pendingCount }}
            </span>
          </button>
          <button
            v-if="admin.isLoggedIn"
            type="button"
            :class="['community-tab', section === 'applications' && 'is-active']"
            @click="showSection('applications')"
          >
            <UsersRound class="h-3.5 w-3.5" aria-hidden="true" />
            友链申请
            <span v-if="pendingApplicationCount" class="community-count">
              {{ pendingApplicationCount }}
            </span>
          </button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          class="h-8"
          :disabled="commentsLoading || applicationsLoading"
          @click="section === 'comments' ? loadComments() : loadApplications()"
        >
          <RefreshCw
            :class="[
              'mr-1.5 h-3.5 w-3.5',
              { 'animate-spin': commentsLoading || applicationsLoading },
            ]"
            aria-hidden="true"
          />
          刷新
        </Button>
      </div>

      <div
        v-if="section === 'comments'"
        class="relative grid min-h-0 lg:grid-cols-[minmax(0,1fr)_300px]"
      >
        <section class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] border-border lg:border-r">
          <div class="flex flex-wrap gap-2 border-b border-border px-4 py-3 sm:px-5">
            <div class="flex rounded-lg bg-muted/60 p-1">
              <button
                v-for="option in [
                  ['all', '全部'],
                  ['about', '关于本站'],
                  ['friends', '友链'],
                ] as const"
                :key="option[0]"
                type="button"
                :class="['filter-chip', pageFilter === option[0] && 'is-active']"
                @click="pageFilter = option[0]"
              >
                {{ option[1] }}
              </button>
            </div>
            <div v-if="admin.isLoggedIn" class="flex rounded-lg bg-muted/60 p-1">
              <button
                v-for="option in [
                  ['all', '全部状态'],
                  ['published', '已发布'],
                  ['pending', '待审核'],
                  ['rejected', '已拒绝'],
                ] as const"
                :key="option[0]"
                type="button"
                :class="['filter-chip', statusFilter === option[0] && 'is-active']"
                @click="statusFilter = option[0]"
              >
                {{ option[1] }}
              </button>
            </div>
          </div>

          <div class="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
            <p
              v-if="commentsError"
              class="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {{ commentsError }}
            </p>
            <div
              v-if="commentsLoading"
              class="grid place-items-center gap-2 py-16 text-muted-foreground"
              role="status"
            >
              <LoaderCircle class="h-6 w-6 animate-spin" aria-hidden="true" />
              <p class="text-sm">正在整理留言档案…</p>
            </div>
            <div
              v-else-if="!filteredThreads.length"
              class="grid place-items-center gap-2 py-16 text-muted-foreground"
            >
              <Inbox class="h-8 w-8 opacity-40" aria-hidden="true" />
              <p class="text-sm">当前筛选条件下还没有留言</p>
            </div>
            <div v-else class="grid gap-3">
              <div v-for="thread in filteredThreads" :key="`${thread.root.page}-${thread.root.id}`">
                <p class="mb-1.5 pl-1 font-mono text-[9px] tracking-[0.16em] text-muted-foreground">
                  {{ pageLabel(thread.root.page) }} / THREAD
                  {{ String(thread.root.id).padStart(3, '0') }}
                </p>
                <CommentThread
                  :thread="thread"
                  :admin-mode="admin.isLoggedIn"
                  :selected-id="selectedCommentId"
                  @select="selectComment"
                />
              </div>
            </div>
          </div>
        </section>

        <aside
          :class="[
            'min-h-0 overflow-y-auto bg-popover/95 p-4 backdrop-blur-xl sm:p-5 lg:static lg:z-auto lg:block lg:bg-muted/20 lg:backdrop-blur-none',
            admin.isLoggedIn && selectedComment ? 'absolute inset-0 z-20 block' : 'hidden lg:block',
          ]"
        >
          <template v-if="admin.isLoggedIn && selectedComment">
            <Button
              size="sm"
              variant="ghost"
              class="mb-3 -ml-2 lg:hidden"
              @click="selectedCommentId = null"
            >
              <ArrowLeft class="mr-1.5 h-4 w-4" aria-hidden="true" />
              返回留言列表
            </Button>
            <p class="font-mono text-[9px] tracking-[0.18em] text-primary/75">
              REVIEW / #{{ selectedComment.id }}
            </p>
            <h3 class="mt-1 text-base font-semibold">审核留言</h3>
            <div class="mt-4 grid gap-3 text-xs">
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
                placeholder="可选；拒绝时建议说明原因"
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
          </template>
          <div
            v-else-if="admin.isLoggedIn"
            class="grid place-items-center gap-2 py-16 text-center text-muted-foreground"
          >
            <ShieldCheck class="h-8 w-8 opacity-35" aria-hidden="true" />
            <p class="text-sm">选择一条留言查看审核详情</p>
          </div>
          <div v-else class="grid place-items-center gap-3 py-16 text-center text-muted-foreground">
            <MessageCircle class="h-8 w-8 opacity-35" aria-hidden="true" />
            <p class="max-w-52 text-sm leading-6">
              这里展示两个页面中已经公开的留言。管理员登录后可处理待审核内容。
            </p>
            <Button size="sm" variant="outline" @click="loginOpen = true">
              <LockKeyhole class="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              管理员登录
            </Button>
          </div>
        </aside>
      </div>

      <div v-else class="relative grid min-h-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] border-border lg:border-r">
          <div class="flex flex-wrap gap-2 border-b border-border px-4 py-3 sm:px-5">
            <button
              v-for="option in [
                ['pending', '待审核'],
                ['approved', '已通过'],
                ['rejected', '已拒绝'],
                ['all', '全部'],
              ] as const"
              :key="option[0]"
              type="button"
              :class="['filter-chip', applicationFilter === option[0] && 'is-active']"
              @click="applicationFilter = option[0]"
            >
              {{ option[1] }}
            </button>
          </div>
          <div class="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
            <p
              v-if="applicationsError"
              class="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {{ applicationsError }}
            </p>
            <div
              v-if="applicationsLoading"
              class="grid place-items-center gap-2 py-16 text-muted-foreground"
              role="status"
            >
              <LoaderCircle class="h-6 w-6 animate-spin" aria-hidden="true" />
              <p class="text-sm">正在读取友链申请…</p>
            </div>
            <div
              v-else-if="!filteredApplications.length"
              class="grid place-items-center gap-2 py-16 text-muted-foreground"
            >
              <Link2 class="h-8 w-8 opacity-40" aria-hidden="true" />
              <p class="text-sm">当前没有对应的友链申请</p>
            </div>
            <div v-else class="grid gap-3 sm:grid-cols-2">
              <button
                v-for="application in filteredApplications"
                :key="application.id"
                type="button"
                :class="[
                  'flex min-w-0 items-start gap-3 rounded-2xl border bg-card/75 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectedApplicationId === application.id
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border',
                ]"
                @click="selectApplication(application)"
              >
                <div
                  class="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted text-xs font-semibold text-muted-foreground"
                >
                  <img
                    v-if="application.avatar && !failedApplicationAvatars.has(application.id)"
                    :src="application.avatar"
                    alt=""
                    draggable="false"
                    class="h-full w-full select-none object-cover"
                    @error="failApplicationAvatar(application.id)"
                  />
                  <span v-else>{{ application.name.slice(0, 2) }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <h3 class="truncate text-sm font-semibold">{{ application.name }}</h3>
                    <span
                      class="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground"
                    >
                      {{ statusLabel(application.status) }}
                    </span>
                  </div>
                  <p class="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {{ application.description }}
                  </p>
                  <time
                    class="mt-2 block text-[9px] text-muted-foreground"
                    :datetime="application.created_at"
                  >
                    {{ formatTime(application.created_at) }}
                  </time>
                </div>
              </button>
            </div>
          </div>
        </section>

        <aside
          :class="[
            'min-h-0 overflow-y-auto bg-popover/95 p-4 backdrop-blur-xl sm:p-5 lg:static lg:z-auto lg:block lg:bg-muted/20 lg:backdrop-blur-none',
            selectedApplication ? 'absolute inset-0 z-20 block' : 'hidden lg:block',
          ]"
        >
          <template v-if="selectedApplication">
            <Button
              size="sm"
              variant="ghost"
              class="mb-3 -ml-2 lg:hidden"
              @click="selectedApplicationId = null"
            >
              <ArrowLeft class="mr-1.5 h-4 w-4" aria-hidden="true" />
              返回申请列表
            </Button>
            <p class="font-mono text-[9px] tracking-[0.18em] text-primary/75">
              FRIEND / #{{ selectedApplication.id }}
            </p>
            <h3 class="mt-1 text-lg font-semibold">{{ selectedApplication.name }}</h3>
            <p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">
              {{ selectedApplication.description }}
            </p>
            <div class="mt-4 grid gap-2 text-xs">
              <a
                :href="selectedApplication.website"
                target="_blank"
                rel="noopener noreferrer nofollow"
                class="flex items-center gap-2 rounded-xl border border-border bg-card/70 p-3 transition-colors hover:border-primary/40 hover:text-primary"
              >
                <ExternalLink class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span class="min-w-0 break-all">{{ selectedApplication.website }}</span>
              </a>
              <a
                v-if="selectedApplication.email"
                :href="`mailto:${selectedApplication.email}`"
                class="flex items-center gap-2 rounded-xl border border-border bg-card/70 p-3 transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Mail class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span class="min-w-0 break-all">{{ selectedApplication.email }}</span>
              </a>
            </div>
            <label class="mt-4 grid gap-1.5 text-xs text-muted-foreground">
              审核备注
              <textarea
                v-model="applicationNote"
                rows="3"
                maxlength="300"
                class="resize-none rounded-lg border border-border bg-background/70 p-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="可选，记录通过或拒绝原因"
              />
            </label>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <Button
                :disabled="actionBusy || selectedApplication.status === 'approved'"
                @click="updateSelectedApplication('approved')"
              >
                <Check class="mr-1.5 h-4 w-4" aria-hidden="true" />
                通过
              </Button>
              <Button
                variant="outline"
                :disabled="actionBusy || selectedApplication.status === 'rejected'"
                @click="updateSelectedApplication('rejected')"
              >
                <XCircle class="mr-1.5 h-4 w-4" aria-hidden="true" />
                拒绝
              </Button>
            </div>
            <Button variant="ghost" class="mt-2 w-full" @click="copySelectedApplication">
              <ClipboardCopy class="mr-1.5 h-4 w-4" aria-hidden="true" />
              复制友链 JSON
            </Button>
            <p
              v-if="copyFeedback"
              class="mt-2 text-center text-[10px] text-muted-foreground"
              role="status"
            >
              {{ copyFeedback }}
            </p>
          </template>
          <div v-else class="grid place-items-center gap-2 py-16 text-center text-muted-foreground">
            <UsersRound class="h-8 w-8 opacity-35" aria-hidden="true" />
            <p class="text-sm">选择一份申请查看完整资料</p>
          </div>
        </aside>
      </div>
    </DialogContent>
  </Dialog>

  <AdminLoginDialog v-model:open="loginOpen" />
</template>

<style scoped>
.community-tab,
.filter-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border-radius: 0.5rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.7rem;
  line-height: 1;
  transition:
    color 180ms ease,
    background-color 180ms ease,
    box-shadow 180ms ease;
}

.community-tab {
  min-height: 2rem;
  padding: 0 0.7rem;
}

.filter-chip {
  min-height: 1.75rem;
  padding: 0 0.65rem;
}

.community-tab:hover,
.filter-chip:hover,
.community-tab.is-active,
.filter-chip.is-active {
  color: hsl(var(--primary));
  background: hsl(var(--background) / 0.9);
}

.community-tab.is-active,
.filter-chip.is-active {
  box-shadow: 0 1px 4px hsl(var(--foreground) / 0.08);
}

.community-count {
  min-width: 1rem;
  border-radius: 999px;
  padding: 0.15rem 0.3rem;
  background: hsl(var(--primary) / 0.14);
  color: hsl(var(--primary));
  font-size: 0.55rem;
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .community-tab,
  .filter-chip {
    transition: none;
  }
}
</style>
