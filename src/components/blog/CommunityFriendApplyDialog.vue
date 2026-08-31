<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import {
  Check,
  ClipboardCopy,
  Clock3,
  ExternalLink,
  History,
  Link2,
  LoaderCircle,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-vue-next'
import {
  getTrackedFriendApplications,
  submitFriendApplication,
  type FriendApplicationStatus,
  type TrackedFriendApplication,
} from '@/api/community'
import {
  readFriendApplicationTokens,
  rememberFriendApplicationToken,
} from '@/lib/friend-application-tracking'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const open = defineModel<boolean>('open')
const view = ref<'apply' | 'mine'>('apply')
const submitting = ref(false)
const loadingMine = ref(false)
const error = ref('')
const success = ref('')
const latestTrackingToken = ref('')
const copied = ref('')
const applications = ref<TrackedFriendApplication[]>([])
const form = reactive({ name: '', website: '', avatar: '', email: '', description: '' })

const SITE_FIELDS = [
  ['站点名称', "Tonks' blog"],
  ['站点描述', '我用全部记忆写下，你此刻的盛大'],
  ['站点链接', 'https://blog.tonks.top'],
  ['头像链接', 'https://blog.tonks.top/assets/home/home.png'],
] as const

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

function statusLabel(status: FriendApplicationStatus): string {
  if (status === 'approved') return '已通过'
  if (status === 'rejected') return '未通过'
  return '审核中'
}

function statusIcon(status: FriendApplicationStatus) {
  if (status === 'approved') return Check
  if (status === 'rejected') return XCircle
  return Clock3
}

async function copyText(value: string, key: string) {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = key
    window.setTimeout(() => {
      if (copied.value === key) copied.value = ''
    }, 1600)
  } catch {
    error.value = '复制失败，请手动选择文本'
  }
}

async function loadMine() {
  const tokens = readFriendApplicationTokens()
  if (!tokens.length) {
    applications.value = []
    return
  }
  loadingMine.value = true
  error.value = ''
  try {
    applications.value = await getTrackedFriendApplications(tokens)
  } catch (cause) {
    error.value = errorMessage(cause, '申请状态读取失败，请稍后再试')
  } finally {
    loadingMine.value = false
  }
}

function validate(): string {
  if (!form.name.trim()) return '请填写站点名称'
  if (!/^https?:\/\/[^\s]+$/i.test(form.website.trim())) return '请填写完整的站点链接'
  if (form.avatar.trim() && !/^https?:\/\/[^\s]+$/i.test(form.avatar.trim())) {
    return '头像链接需要以 http:// 或 https:// 开头'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return '请填写格式正确的邮箱'
  if (form.description.trim().length < 2) return '请简单介绍一下你的网站'
  return ''
}

async function submit() {
  const validationError = validate()
  if (validationError) {
    error.value = validationError
    return
  }
  submitting.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await submitFriendApplication(form)
    rememberFriendApplicationToken(result.trackingToken)
    latestTrackingToken.value = result.trackingToken
    success.value = result.message
    form.name = ''
    form.website = ''
    form.avatar = ''
    form.email = ''
    form.description = ''
    await loadMine()
    view.value = 'mine'
  } catch (cause) {
    error.value = errorMessage(cause, '友链申请提交失败，请稍后再试')
  } finally {
    submitting.value = false
  }
}

watch(open, (visible) => {
  if (!visible) return
  error.value = ''
  success.value = ''
  void loadMine()
})

watch(view, (next) => {
  error.value = ''
  if (next === 'mine') void loadMine()
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="friend-apply-dialog max-h-[88vh] max-w-5xl overflow-hidden p-0">
      <div class="friend-apply-heading border-b border-border px-5 pb-4 pt-5 sm:px-7">
        <DialogHeader>
          <p class="font-mono text-[9px] tracking-[0.2em] text-primary/75">FRIEND LINK</p>
          <DialogTitle class="flex items-center gap-2 text-xl">
            <Link2 class="h-5 w-5 text-primary" aria-hidden="true" />
            申请友链
          </DialogTitle>
          <DialogDescription>
            有兴趣留下属于你的足迹吗？
          </DialogDescription>
        </DialogHeader>
        <div class="mt-4 flex gap-1 rounded-lg bg-muted/55 p-1">
          <button
            type="button"
            :class="['friend-tab', view === 'apply' && 'is-active']"
            @click="view = 'apply'"
          >
            <Send class="h-3.5 w-3.5" aria-hidden="true" />
            提交申请
          </button>
          <button
            type="button"
            :class="['friend-tab', view === 'mine' && 'is-active']"
            @click="view = 'mine'"
          >
            <History class="h-3.5 w-3.5" aria-hidden="true" />
            我的申请
            <span v-if="applications.length">{{ applications.length }}</span>
          </button>
        </div>
      </div>

      <div class="max-h-[calc(88vh-10.5rem)] overflow-y-auto px-5 py-5 sm:px-7">
        <template v-if="view === 'apply'">
          <div class="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <section class="friend-panel">
              <div class="flex items-center gap-3">
                <img
                  class="h-12 w-12 rounded-xl object-cover"
                  src="https://blog.tonks.top/assets/home/home.png"
                  alt="Tonks' blog"
                  draggable="false"
                />
                <div>
                  <h3 class="font-semibold">Tonks' blog</h3>
                  <p class="mt-1 text-xs text-muted-foreground">我用全部记忆写下，你此刻的盛大</p>
                </div>
              </div>
              <dl class="mt-4 grid gap-2">
                <div v-for="([label, value], index) in SITE_FIELDS" :key="label" class="site-field">
                  <div class="min-w-0">
                    <dt>{{ label }}</dt>
                    <dd>{{ value }}</dd>
                  </div>
                  <button
                    type="button"
                    :aria-label="`复制${label}`"
                    @click="copyText(value, `site-${index}`)"
                  >
                    <Check v-if="copied === `site-${index}`" class="h-3.5 w-3.5" />
                    <ClipboardCopy v-else class="h-3.5 w-3.5" />
                  </button>
                </div>
              </dl>
              <div
                class="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-4 text-xs leading-6 text-muted-foreground"
              >
                <strong class="block text-foreground">申请约定</strong>
                <p>网站可正常访问并支持 HTTPS，以原创内容为主，保持基本更新。</p>
                <p>不收录广告聚合、违法违规或长期失联的站点；友链会不定期检查。</p>
              </div>
            </section>

            <form class="friend-panel grid content-start gap-3" @submit.prevent="submit">
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="friend-field">
                  <span>站点名称 *</span>
                  <input v-model="form.name" maxlength="50" placeholder="你的网站名称" />
                </label>
                <label class="friend-field">
                  <span>联系邮箱 *</span>
                  <input
                    v-model="form.email"
                    type="email"
                    maxlength="254"
                    placeholder="仅用于联系"
                  />
                </label>
              </div>
              <label class="friend-field">
                <span>站点链接 *</span>
                <input
                  v-model="form.website"
                  type="url"
                  maxlength="300"
                  placeholder="https://example.com"
                />
              </label>
              <label class="friend-field">
                <span>头像链接</span>
                <input
                  v-model="form.avatar"
                  type="url"
                  maxlength="300"
                  placeholder="https://example.com/avatar.png"
                />
              </label>
              <label class="friend-field">
                <span>站点描述 *</span>
                <textarea
                  v-model="form.description"
                  rows="3"
                  maxlength="160"
                  placeholder="一句话介绍你的网站"
                />
              </label>
              <p v-if="error" class="friend-alert is-error" role="alert">{{ error }}</p>
              <Button type="submit" class="justify-self-end" :disabled="submitting">
                <LoaderCircle v-if="submitting" class="mr-1.5 h-4 w-4 animate-spin" />
                <Send v-else class="mr-1.5 h-4 w-4" />
                提交申请
              </Button>
            </form>
          </div>
        </template>

        <template v-else>
          <p v-if="success" class="friend-alert is-success">{{ success }}</p>
          <div
            v-if="latestTrackingToken"
            class="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4"
          >
            <p class="text-sm font-medium">请保存本次查询码</p>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">
              浏览器已自动保存；清理站点数据后可凭此码找回申请。不要公开分享。
            </p>
            <div class="mt-3 flex items-center gap-2 rounded-lg bg-background/80 p-2">
              <code class="min-w-0 flex-1 truncate text-[11px]">{{ latestTrackingToken }}</code>
              <button
                type="button"
                class="copy-token"
                @click="copyText(latestTrackingToken, 'token')"
              >
                <Check v-if="copied === 'token'" class="h-3.5 w-3.5" />
                <ClipboardCopy v-else class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div v-if="loadingMine" class="grid place-items-center gap-2 py-16 text-muted-foreground">
            <LoaderCircle class="h-6 w-6 animate-spin" />
            <span class="text-xs">正在同步申请状态…</span>
          </div>
          <p v-else-if="error" class="friend-alert is-error" role="alert">{{ error }}</p>
          <div v-else-if="applications.length" class="grid gap-3">
            <article
              v-for="application in applications"
              :key="application.id"
              class="application-card"
            >
              <img
                v-if="application.avatar"
                :src="application.avatar"
                alt=""
                draggable="false"
                referrerpolicy="no-referrer"
              />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <a :href="application.website" target="_blank" rel="noopener noreferrer">
                    {{ application.name }}
                    <ExternalLink class="inline h-3 w-3" />
                  </a>
                  <span :class="['application-status', `is-${application.status}`]">
                    <component :is="statusIcon(application.status)" class="h-3 w-3" />
                    {{ statusLabel(application.status) }}
                  </span>
                </div>
                <p class="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {{ application.description }}
                </p>
                <p v-if="application.moderation_note" class="mt-2 text-xs text-muted-foreground">
                  审核备注：{{ application.moderation_note }}
                </p>
                <time class="mt-2 block text-[10px] text-muted-foreground">
                  更新于 {{ new Date(application.updated_at).toLocaleString('zh-CN') }}
                </time>
              </div>
            </article>
          </div>
          <div v-else class="grid place-items-center gap-2 py-16 text-center text-muted-foreground">
            <ShieldCheck class="h-8 w-8 opacity-35" />
            <p class="text-sm">这台设备还没有保存过友链申请</p>
            <button
              type="button"
              class="text-xs text-primary hover:underline"
              @click="view = 'apply'"
            >
              去提交第一份申请
            </button>
          </div>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.friend-apply-heading {
  background: linear-gradient(135deg, hsl(var(--primary) / 0.09), transparent 55%);
}

.friend-tab {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border-radius: 0.45rem;
  padding: 0.55rem 0.8rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  transition: 150ms ease;
}

.friend-tab.is-active {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  box-shadow: 0 1px 5px hsl(var(--foreground) / 0.08);
}

.friend-tab span {
  border-radius: 999px;
  background: hsl(var(--primary) / 0.12);
  padding: 0.05rem 0.38rem;
  color: hsl(var(--primary));
  font-size: 0.62rem;
}

.friend-panel {
  border: 1px solid hsl(var(--border));
  border-radius: 0.8rem;
  background: hsl(var(--card) / 0.5);
  padding: 1.1rem;
}

.site-field {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
  border-radius: 0.6rem;
  background: hsl(var(--muted) / 0.5);
  padding: 0.6rem 0.7rem;
}

.site-field div {
  min-width: 0;
  flex: 1;
}

.site-field dt,
.friend-field span {
  color: hsl(var(--muted-foreground));
  font-size: 0.66rem;
}

.site-field dd {
  overflow: hidden;
  margin-top: 0.12rem;
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.site-field button,
.copy-token {
  display: grid;
  width: 1.9rem;
  height: 1.9rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.45rem;
  color: hsl(var(--muted-foreground));
}

.site-field button:hover,
.copy-token:hover {
  background: hsl(var(--foreground) / 0.07);
  color: hsl(var(--foreground));
}

.friend-field {
  display: grid;
  gap: 0.35rem;
}

.friend-field input,
.friend-field textarea {
  width: 100%;
  border: 1px solid hsl(var(--border));
  border-radius: 0.55rem;
  background: hsl(var(--background) / 0.7);
  padding: 0.62rem 0.72rem;
  color: hsl(var(--foreground));
  font-size: 0.8rem;
  outline: none;
  transition: 150ms ease;
}

.friend-field textarea {
  resize: vertical;
}

.friend-field input:focus,
.friend-field textarea:focus {
  border-color: hsl(var(--primary) / 0.55);
  box-shadow: 0 0 0 3px hsl(var(--ring) / 0.13);
}

.friend-alert {
  border-radius: 0.55rem;
  padding: 0.65rem 0.75rem;
  font-size: 0.72rem;
}

.friend-alert.is-error {
  background: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
}

.friend-alert.is-success {
  margin-bottom: 1rem;
  background: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
}

.application-card {
  display: flex;
  gap: 0.9rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  background: hsl(var(--card) / 0.48);
  padding: 0.9rem;
}

.application-card > img {
  width: 2.8rem;
  height: 2.8rem;
  flex: 0 0 auto;
  border-radius: 0.65rem;
  object-fit: cover;
}

.application-card a {
  font-size: 0.82rem;
  font-weight: 600;
}

.application-card a:hover {
  color: hsl(var(--primary));
}

.application-status {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 999px;
  padding: 0.18rem 0.48rem;
  font-size: 0.61rem;
}

.application-status.is-pending {
  background: hsl(38 92% 50% / 0.13);
  color: hsl(34 78% 42%);
}

.application-status.is-approved {
  background: hsl(150 62% 42% / 0.13);
  color: hsl(150 58% 37%);
}

.application-status.is-rejected {
  background: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
}
</style>
