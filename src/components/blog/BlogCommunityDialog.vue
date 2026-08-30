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
  RefreshCw,
  ShieldCheck,
  UsersRound,
  XCircle,
} from 'lucide-vue-next'
import {
  getFriendApplications,
  updateFriendApplication,
  type FriendApplication,
  type FriendApplicationStatus,
} from '@/api/community'
import { friendApplicationJson } from '@/lib/community'
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
import CommunityChatWorkspace from './CommunityChatWorkspace.vue'

type Section = 'comments' | 'applications'
type ApplicationFilter = 'all' | FriendApplicationStatus

const open = defineModel<boolean>('open')
const admin = useAdminStore()
const loginOpen = ref(false)
const section = ref<Section>('comments')
const applicationFilter = ref<ApplicationFilter>('pending')
const applications = ref<FriendApplication[]>([])
const applicationsLoading = ref(false)
const applicationsError = ref('')
const selectedApplicationId = ref<number | null>(null)
const applicationNote = ref('')
const actionBusy = ref(false)
const copyFeedback = ref('')
const failedApplicationAvatars = ref(new Set<number>())

const filteredApplications = computed(() =>
  applicationFilter.value === 'all'
    ? applications.value
    : applications.value.filter((item) => item.status === applicationFilter.value),
)
const selectedApplication = computed(
  () => applications.value.find((item) => item.id === selectedApplicationId.value) ?? null,
)
const pendingApplicationCount = computed(
  () => applications.value.filter((item) => item.status === 'pending').length,
)

function statusLabel(status: FriendApplicationStatus): string {
  return {
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

function selectApplication(application: FriendApplication) {
  selectedApplicationId.value = application.id
  applicationNote.value = application.moderation_note || ''
  copyFeedback.value = ''
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
  selectedApplicationId.value = null
  if (next === 'applications') void loadApplications()
}

watch(open, (visible) => {
  if (!visible) return
  section.value = 'comments'
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
      return
    }
    void loadApplications()
  },
)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="qq-community-window grid h-[min(92dvh,900px)] w-[calc(100vw-0.75rem)] max-w-[1280px] grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden border-border/70 p-0 sm:w-[calc(100vw-1.5rem)]"
    >
      <DialogHeader v-if="section === 'comments'" class="sr-only">
        <DialogTitle>留言群聊</DialogTitle>
        <DialogDescription>About 与 Friends 留言房间</DialogDescription>
      </DialogHeader>

      <DialogHeader
        v-else
        class="border-b border-border bg-card/70 px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-5"
      >
        <div class="flex flex-wrap items-start justify-between gap-3 pr-8">
          <div>
            <p class="mb-1 font-mono text-[9px] tracking-[0.22em] text-primary/75">
              COMMUNITY / APPLICATIONS
            </p>
            <DialogTitle class="flex items-center gap-2 text-xl">
              <Link2 class="h-5 w-5 text-primary" aria-hidden="true" />
              友链申请
            </DialogTitle>
            <DialogDescription class="mt-1">查看和整理等待处理的友链资料。</DialogDescription>
          </div>
          <div class="flex items-center gap-2">
            <Button size="sm" variant="ghost" class="h-8" @click="showSection('comments')">
              <ArrowLeft class="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              返回群聊
            </Button>
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

      <CommunityChatWorkspace
        v-if="section === 'comments'"
        :active="Boolean(open && section === 'comments')"
        :application-count="pendingApplicationCount"
        @login="loginOpen = true"
        @open-applications="showSection('applications')"
      />

      <div v-else class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/25 px-4 py-3 sm:px-5"
        >
          <div class="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1">
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
          <Button
            size="sm"
            variant="ghost"
            class="h-8"
            :disabled="applicationsLoading"
            @click="loadApplications"
          >
            <RefreshCw
              :class="['mr-1.5 h-3.5 w-3.5', applicationsLoading && 'animate-spin']"
              aria-hidden="true"
            />
            刷新
          </Button>
        </div>

        <div class="relative grid min-h-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section class="min-h-0 overflow-y-auto border-border px-4 py-4 sm:px-5 lg:border-r">
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
              <Inbox class="h-8 w-8 opacity-40" aria-hidden="true" />
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
            <div
              v-else
              class="grid place-items-center gap-2 py-16 text-center text-muted-foreground"
            >
              <UsersRound class="h-8 w-8 opacity-35" aria-hidden="true" />
              <p class="text-sm">选择一份申请查看完整资料</p>
            </div>
          </aside>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <AdminLoginDialog v-model:open="loginOpen" />
</template>

<style scoped>
.qq-community-window {
  background: hsl(var(--background));
  box-shadow:
    0 28px 80px hsl(var(--foreground) / 0.22),
    0 2px 12px hsl(var(--foreground) / 0.08);
}

.filter-chip {
  display: inline-flex;
  min-height: 1.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  padding: 0 0.65rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.7rem;
  line-height: 1;
  transition:
    color 180ms ease,
    background-color 180ms ease,
    box-shadow 180ms ease;
}

.filter-chip:hover,
.filter-chip.is-active {
  background: hsl(var(--background) / 0.9);
  color: hsl(var(--primary));
}

.filter-chip.is-active {
  box-shadow: 0 1px 4px hsl(var(--foreground) / 0.08);
}

@media (prefers-reduced-motion: reduce) {
  .filter-chip {
    transition: none;
  }
}
</style>
