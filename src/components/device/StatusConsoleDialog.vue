<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  Activity,
  BookOpen,
  CircleHelp,
  Gamepad2,
  Inbox,
  Library,
  MonitorCog,
  Music2,
  Radio,
  RotateCw,
  TerminalSquare,
} from 'lucide-vue-next'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  getRecommendations,
  recommendationSourceLabel,
  submitRecommendation,
  type Recommendation,
  type RecommendationCategory,
} from '@/api/recommendations'
import { formatTimestamp, timeAgo } from '@/lib/utils'
import { getStatusHistory, type StatusHistoryItem } from '@/api/device'
import { useThemeStore } from '@/stores/theme'
import { useAdminStore } from '@/stores/admin'

interface StatusDisplay {
  key: string
  color: string
  appName: string
  desc: string
  pulse: boolean
}

const props = defineProps<{
  visible: boolean
  status: StatusDisplay
  timestamp: number | null
}>()
const emit = defineEmits<{ close: [] }>()
const theme = useThemeStore()
const admin = useAdminStore()

type ModuleName = 'status' | 'inbox' | 'system' | 'help' | 'empty'
type CategoryFilter = RecommendationCategory | 'all'

const open = computed({
  get: () => props.visible,
  set: (value) => {
    if (!value) emit('close')
  },
})

const activeModule = ref<ModuleName>('empty')
const phase = ref<'boot' | 'typing' | 'ready'>('boot')
const command = ref('')
const commandPlaceholder = ref('输入 /help 查看命令')
const bootLines = ref<string[]>([])
const inputRef = ref<HTMLInputElement | null>(null)
const waitAnimationActive = ref(true)
const waitFinalReady = ref(false)
const bulletinText = ref('')
const recommendations = ref<Recommendation[]>([])
const recommendationLoading = ref(false)
const recommendationError = ref('')
const commandFeedback = ref<{ kind: 'success' | 'error'; message: string } | null>(null)
const commandPending = ref(false)
const statusHistory = ref<StatusHistoryItem[]>([])
const historyLoading = ref(false)
const category = ref<CategoryFilter>('all')
const now = ref(new Date())
let timers: ReturnType<typeof setTimeout>[] = []
let clockTimer: ReturnType<typeof setInterval> | null = null
let waitAnimationTimer: ReturnType<typeof setTimeout> | null = null
let bulletinTimer: ReturnType<typeof setTimeout> | null = null
let feedbackTimer: ReturnType<typeof setTimeout> | null = null
let transitionGeneration = 0
let bulletinIndex = 0

const WAIT_ANIMATION_MS = 1680
const DAILY_BOOT_KEY = 'tonks-console-last-boot-date'

const commandPlaceholders = [
  '输入 /help 查看命令',
  '输入 /recommend-books [book-name] 以推荐书籍（每日一次）',
  '输入 /theme toggle 切换网站主题',
  '输入 /system 查看网站系统信息',
  '输入 /inbox 查看推荐收信箱',
  '输入 /clear 清空终端内容',
  '输入 /status 查看作者电脑当前状态',
]

const moduleItems = [
  { id: 'status' as const, label: '我在干什么？', command: '/status', icon: Activity },
  { id: 'inbox' as const, label: '推荐收信箱', command: '/inbox', icon: Inbox },
  { id: 'system' as const, label: '系统信息', command: '/system', icon: MonitorCog },
  { id: 'help' as const, label: '命令帮助', command: '/help', icon: CircleHelp },
]

const bootSequence = [
  'initializing personal telemetry',
  'syncing presence feed',
  'mounting recommendation channel',
  'visual link established',
]

const bulletinMessages = [
  '欢迎来到tonks的个人网站！',
  '可以输入/help查看可用命令，点击条目后自动装填。',
  '可以向其他人推荐最近遇到的好作品',
  '右键桌宠可唤出菜单并互动',
  '左键点击桌宠可以戳一戳（不要戳太过了！）',
  '桌宠偶尔会通过提问来记录与你的回忆',
  '对于一些提问，桌宠会调用大模型进行回答，信息来源需要自行鉴别真伪',
  '网站通过访客的ip来查询天气，数据缓存在本地，不会用于其他目的',
  '网站的右下角可开启网站手势控制模式',
]

const helpCommands = [
  ...moduleItems.map((item) => ({
    command: item.command,
    fill: item.command,
    description: item.label,
  })),
  { command: '/clear', fill: '/clear', description: '清空当前输出，返回待机画面' },
  { command: '/theme [mode]', fill: '/theme ', description: '切换 light、dark 或 toggle 主题' },
  { command: '/recommend-songs', fill: '/recommend-songs ', description: '推荐歌曲，例如《晴天》' },
  { command: '/recommend-books', fill: '/recommend-books ', description: '推荐书籍' },
  { command: '/recommend-games', fill: '/recommend-games ', description: '推荐游戏' },
  { command: '/recommend-anime', fill: '/recommend-anime ', description: '推荐番剧' },
]

const categoryItems: Array<{ id: CategoryFilter; label: string; icon: typeof Music2 }> = [
  { id: 'all', label: '全部', icon: Library },
  { id: 'music', label: '音乐', icon: Music2 },
  { id: 'book', label: '书籍', icon: BookOpen },
  { id: 'game', label: '游戏', icon: Gamepad2 },
  { id: 'anime', label: '番剧', icon: Radio },
]

const visibleRecommendations = computed(() => recommendations.value.slice(0, 10))
const relativeStatusTime = computed(() => (props.timestamp ? timeAgo(props.timestamp) : '等待数据'))
const absoluteStatusTime = computed(() =>
  props.timestamp ? formatTimestamp(props.timestamp) : '未知',
)
function recommendationTimeAgo(value: string): string {
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? value : timeAgo(parsed / 1000)
}
const clock = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now.value),
)
const siteRunningDays = computed(() => {
  const start = new Date(2025, 8, 11)
  const today = new Date(now.value.getFullYear(), now.value.getMonth(), now.value.getDate())
  return Math.max(1, Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1)
})

function historyTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp * 1000))
}

function historyKind(item: StatusHistoryItem): string {
  const color = 'color' in item.info ? item.info.color : ''
  if (color === 'sleeping') return 'SLEEP'
  if (item.app_name === '关机中') return 'OFFLINE'
  return item.status === 0 ? 'ACTIVE' : 'STATUS'
}

async function loadStatusHistory() {
  historyLoading.value = true
  try {
    statusHistory.value = (await getStatusHistory()).history.slice(0, 5)
  } catch (error) {
    console.warn('[status-console] status history unavailable', error)
    statusHistory.value = []
  } finally {
    historyLoading.value = false
  }
}

function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}

function stopBulletin() {
  if (bulletinTimer) clearTimeout(bulletinTimer)
  bulletinTimer = null
}

function startBulletin() {
  stopBulletin()
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const message = bulletinMessages[bulletinIndex]
  if (reduced) {
    bulletinText.value = message
    bulletinTimer = setTimeout(() => {
      bulletinIndex = (bulletinIndex + 1) % bulletinMessages.length
      startBulletin()
    }, 5200)
    return
  }
  let position = 0
  let deleting = false
  const holdDuration = 2800 + 500 + message.length * 65
  const tick = () => {
    bulletinText.value = message.slice(0, position)
    if (!deleting && position < message.length) {
      position += 1
      bulletinTimer = setTimeout(tick, 54)
    } else if (!deleting) {
      deleting = true
      bulletinTimer = setTimeout(tick, holdDuration)
    } else if (position > 0) {
      position -= 1
      bulletinTimer = setTimeout(tick, 27)
    } else {
      bulletinIndex = (bulletinIndex + 1) % bulletinMessages.length
      bulletinTimer = setTimeout(startBulletin, 420)
    }
  }
  tick()
}

function prefillCommand(value: string) {
  phase.value = 'ready'
  command.value = value
  void nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.setSelectionRange(value.length, value.length)
  })
}

async function preloadFinalFrame() {
  const image = new Image()
  image.src = '/assets/terminal/wait-final.png'
  try {
    if (image.decode) await image.decode()
    else
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('final frame failed to load'))
      })
    waitFinalReady.value = true
  } catch (error) {
    console.warn('[status-console] final frame unavailable', error)
  }
}

function delay(callback: () => void, ms: number) {
  const timer = setTimeout(callback, ms)
  timers.push(timer)
}

async function loadRecommendations(filter: CategoryFilter = category.value) {
  recommendationLoading.value = true
  recommendationError.value = ''
  try {
    recommendations.value = await getRecommendations(filter === 'all' ? {} : { category: filter })
  } catch (error) {
    console.warn('[status-console] recommendations unavailable', error)
    recommendationError.value = '推荐信道暂时不可用，请稍后重试。'
  } finally {
    recommendationLoading.value = false
  }
}

function activateModule(module: ModuleName) {
  activeModule.value = module
  phase.value = 'ready'
  command.value = ''
  if (module === 'inbox') void loadRecommendations()
  if (module === 'status') void loadStatusHistory()
  void nextTick(() => inputRef.value?.focus())
}

function moduleFromCommand(value: string): ModuleName | null {
  const normalized = value.trim().toLowerCase().split(/\s+/)[0]
  const aliases: Record<string, ModuleName> = {
    '/status': 'status',
    '/inbox': 'inbox',
    '/system': 'system',
    '/help': 'help',
    '/clear': 'empty',
    status: 'status',
    inbox: 'inbox',
    system: 'system',
    help: 'help',
    clear: 'empty',
  }
  return aliases[normalized] ?? null
}

function rotateCommandPlaceholder() {
  if (commandPlaceholders.length < 2) return
  const candidates = commandPlaceholders.filter((item) => item !== commandPlaceholder.value)
  commandPlaceholder.value = candidates[Math.floor(Math.random() * candidates.length)]
}

function executeCommand() {
  rotateCommandPlaceholder()
  const raw = command.value.trim()
  const module = moduleFromCommand(raw)
  if (module) activateModule(module)
  else if (/^\/theme(?:\s|$)/i.test(raw)) void executeThemeCommand(raw)
  else if (/^\/recommend-(songs|books|games|anime)(?:\s|$)/i.test(raw)) {
    void executeRecommendationCommand(raw)
  } else {
    commandFeedback.value = { kind: 'error', message: `未知命令：${raw || '(empty)'}` }
    activeModule.value = 'help'
    phase.value = 'ready'
  }
}

function parseOptions(input: string): { content: string; city?: string; source?: string } {
  const optionPattern = /\s+-(city|source)\s+("[^"]+"|'[^']+'|\S+)/gi
  const options: { city?: string; source?: string } = {}
  let match: RegExpExecArray | null
  while ((match = optionPattern.exec(input))) {
    const value = match[2].replace(/^["']|["']$/g, '')
    options[match[1].toLowerCase() as 'city' | 'source'] = value
  }
  return { content: input.replace(optionPattern, '').trim(), ...options }
}

async function executeRecommendationCommand(raw: string) {
  const match = raw.match(/^\/recommend-(songs|books|games|anime)\s+(.+)$/i)
  if (!match) {
    commandFeedback.value = { kind: 'error', message: '缺少推荐内容，请在命令后输入名称。' }
    activeModule.value = 'help'
    phase.value = 'ready'
    return
  }
  const categoryMap: Record<string, RecommendationCategory> = {
    songs: 'music',
    books: 'book',
    games: 'game',
    anime: 'anime',
  }
  const parsed = parseOptions(match[2])
  if (!parsed.content) {
    commandFeedback.value = { kind: 'error', message: '推荐内容不能为空。' }
    activeModule.value = 'help'
    phase.value = 'ready'
    return
  }
  commandPending.value = true
  commandFeedback.value = null
  try {
    await submitRecommendation({
      category: categoryMap[match[1].toLowerCase()],
      content: parsed.content,
      ...(admin.isLoggedIn && parsed.source ? { user_name: parsed.source } : {}),
      ...(admin.isLoggedIn && parsed.city ? { city: parsed.city } : {}),
    })
    commandFeedback.value = { kind: 'success', message: `推荐已送达：${parsed.content}` }
    category.value = categoryMap[match[1].toLowerCase()]
    activateModule('inbox')
  } catch (error: any) {
    const code = error?.code || error?.response?.data?.code
    commandFeedback.value = {
      kind: 'error',
      message:
        code === 'daily limit reached'
          ? '今天已经提交过推荐了，请明天再来。'
          : '推荐发送失败，请稍后重试。',
    }
    activeModule.value = 'help'
    phase.value = 'ready'
  } finally {
    commandPending.value = false
  }
}

function executeThemeCommand(raw: string) {
  const requested = raw.split(/\s+/)[1]?.toLowerCase() || 'toggle'
  const x = window.innerWidth / 2
  const y = window.innerHeight / 2
  if (requested === 'toggle') theme.toggle(x, y)
  else if (requested === 'light' || requested === 'dark') {
    const wantsDark = requested === 'dark'
    if (theme.isDark !== wantsDark) theme.toggle(x, y)
  } else {
    commandFeedback.value = { kind: 'error', message: '主题参数仅支持 light、dark 或 toggle。' }
    activeModule.value = 'help'
    phase.value = 'ready'
    return
  }
  commandFeedback.value = { kind: 'success', message: `主题已切换为 ${requested}。` }
  phase.value = 'ready'
  command.value = ''
}

function runCommand(commandText: string, animate = true) {
  const generation = ++transitionGeneration
  clearTimers()
  command.value = ''
  phase.value = animate ? 'typing' : 'ready'
  if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    command.value = commandText
    executeCommand()
    return
  }
  let index = 0
  const typeNext = () => {
    if (generation !== transitionGeneration) return
    command.value = commandText.slice(0, ++index)
    if (index < commandText.length) delay(typeNext, 34)
    else delay(() => generation === transitionGeneration && executeCommand(), 120)
  }
  delay(typeNext, 70)
}

function selectModule(module: ModuleName, commandText: string) {
  const generation = ++transitionGeneration
  clearTimers()
  rotateCommandPlaceholder()

  // 内容立即切换，命令输入仅作为同步的视觉回显，不再阻塞导航。
  activeModule.value = module
  phase.value = 'typing'
  command.value = ''
  if (module === 'inbox') void loadRecommendations()
  if (module === 'status') void loadStatusHistory()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    phase.value = 'ready'
    void nextTick(() => inputRef.value?.focus())
    return
  }

  let index = 0
  const typeNext = () => {
    if (generation !== transitionGeneration) return
    command.value = commandText.slice(0, ++index)
    if (index < commandText.length) {
      delay(typeNext, 28)
      return
    }
    delay(() => {
      if (generation !== transitionGeneration) return
      command.value = ''
      phase.value = 'ready'
      void nextTick(() => inputRef.value?.focus())
    }, 100)
  }
  delay(typeNext, 30)
}

function startBoot() {
  ++transitionGeneration
  clearTimers()
  bootLines.value = []
  activeModule.value = 'empty'
  phase.value = 'boot'
  command.value = ''
  category.value = 'all'
  commandFeedback.value = null
  waitAnimationActive.value = true
  waitFinalReady.value = false
  void preloadFinalFrame()
  void nextTick(() => {
    if (waitAnimationTimer) clearTimeout(waitAnimationTimer)
    waitAnimationTimer = setTimeout(() => {
      waitAnimationActive.value = false
    }, WAIT_ANIMATION_MS)
  })
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    runCommand('/status', false)
    return
  }
  const today = new Intl.DateTimeFormat('en-CA').format(new Date())
  const firstBootToday = localStorage.getItem(DAILY_BOOT_KEY) !== today
  localStorage.setItem(DAILY_BOOT_KEY, today)
  const lineStart = firstBootToday ? 260 : 180
  const lineGap = firstBootToday ? 260 : 170
  bootSequence.forEach((line, index) => {
    delay(() => bootLines.value.push(line), lineStart + index * lineGap)
  })
  delay(() => runCommand('/status'), firstBootToday ? 2700 : 1400)
}

function selectCategory(nextCategory: CategoryFilter) {
  if (category.value === nextCategory) return
  category.value = nextCategory
  void loadRecommendations(nextCategory)
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && command.value) {
    event.stopPropagation()
    command.value = ''
  }
}

watch(commandFeedback, (feedback) => {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = feedback
    ? setTimeout(
        () => {
          commandFeedback.value = null
        },
        feedback.kind === 'success' ? 3600 : 5200,
      )
    : null
})

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      startBoot()
      startBulletin()
      clockTimer = setInterval(() => {
        now.value = new Date()
      }, 1000)
    } else {
      clearTimers()
      if (clockTimer) clearInterval(clockTimer)
      if (waitAnimationTimer) clearTimeout(waitAnimationTimer)
      if (feedbackTimer) clearTimeout(feedbackTimer)
      stopBulletin()
      clockTimer = null
    }
  },
)

onBeforeUnmount(() => {
  clearTimers()
  if (clockTimer) clearInterval(clockTimer)
  if (waitAnimationTimer) clearTimeout(waitAnimationTimer)
  if (feedbackTimer) clearTimeout(feedbackTimer)
  stopBulletin()
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="status-console max-w-none gap-0 overflow-hidden border-0 p-0 sm:rounded-[18px]"
    >
      <header class="console-titlebar">
        <div class="flex min-w-0 items-center gap-2.5">
          <TerminalSquare class="h-4 w-4 text-[var(--console-prompt)]" aria-hidden="true" />
          <span class="truncate font-semibold tracking-[0.08em]">TONKS CONSOLE</span>
          <span class="hidden text-[var(--console-muted)] sm:inline">/ {{ activeModule }}</span>
        </div>
        <div
          class="mr-10 flex items-center gap-3 text-[10px] tracking-[0.1em] text-[var(--console-muted)]"
        >
          <span class="console-online">
            <i />
            ONLINE
          </span>
          <time class="hidden tabular-nums sm:inline">{{ clock }}</time>
        </div>
      </header>

      <div class="console-layout">
        <aside class="console-sidebar" aria-label="控制台模块">
          <nav class="console-nav">
            <p class="console-eyebrow">MODULES</p>
            <button
              v-for="item in moduleItems"
              :key="item.id"
              type="button"
              class="console-nav-item"
              :class="{ active: activeModule === item.id }"
              :aria-current="activeModule === item.id ? 'page' : undefined"
              @click="selectModule(item.id, item.command)"
            >
              <component :is="item.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
              <span class="min-w-0 flex-1 text-left">
                <strong>{{ item.label }}</strong>
                <small>{{ item.command }}</small>
              </span>
              <span class="nav-caret">›</span>
            </button>
          </nav>

          <div class="avatar-feed">
            <div class="feed-header">
              <span>OPERATOR.ID</span>
              <span class="feed-live">READY</span>
            </div>
            <div class="avatar-viewport">
              <img src="/assets/terminal/leftA.png" alt="Tonks 终端头像" draggable="false" />
            </div>
          </div>
          <div class="sidebar-bulletin" aria-live="polite">
            <div class="bulletin-label">
              <span>NOTICE.LOG</span>
              <span>AUTO</span>
            </div>
            <p>
              {{ bulletinText }}
              <i aria-hidden="true" />
            </p>
          </div>
        </aside>

        <section class="console-terminal" aria-live="polite">
          <img
            src="/assets/terminal/wait.gif"
            class="terminal-wait-background terminal-wait-gif"
            :class="{ hidden: !waitAnimationActive && waitFinalReady }"
            alt=""
            aria-hidden="true"
            draggable="false"
          />
          <img
            src="/assets/terminal/wait-final.png"
            class="terminal-wait-background terminal-wait-final"
            :class="{ visible: !waitAnimationActive && waitFinalReady }"
            alt=""
            aria-hidden="true"
            draggable="false"
          />
          <div class="terminal-viewport">
            <Transition name="console-content" mode="out-in">
              <div v-if="phase === 'boot'" key="boot" class="boot-screen">
                <div class="boot-log font-mono">
                  <p class="boot-brand">
                    PERSONAL TELEMETRY INTERFACE
                    <span>v0.1</span>
                  </p>
                  <p v-for="line in bootLines" :key="line">
                    <span>›</span>
                    {{ line }}
                    <b>OK</b>
                  </p>
                  <p class="boot-wait">
                    <span class="spinner">◒</span>
                    preparing status module
                  </p>
                </div>
              </div>

              <div
                v-else-if="activeModule === 'status'"
                key="status"
                class="module-view status-module"
              >
                <div class="command-echo">
                  <span>tonks@home:~ $</span>
                  /status
                </div>
                <div class="module-heading">
                  <div>
                    <p class="console-eyebrow">CURRENT SESSION</p>
                  </div>
                  <span class="status-sync">SYNC {{ relativeStatusTime }}</span>
                </div>

                <article class="current-status-panel">
                  <div
                    class="status-beacon"
                    :style="{ '--status-color': status.color }"
                    :class="{ pulse: status.pulse }"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="status-kicker">NOW RUNNING</p>
                    <h3 :style="{ color: status.color }">{{ status.appName }}</h3>
                    <p>{{ status.desc }}</p>
                  </div>
                  <div class="status-time">
                    <span>LAST SIGNAL</span>
                    <strong>{{ absoluteStatusTime }}</strong>
                  </div>
                </article>

                <section class="timeline-panel">
                  <div class="panel-label">
                    <span>SESSION TRACE</span>
                    <small>LATEST 5</small>
                  </div>
                  <p v-if="historyLoading" class="history-state">正在读取状态记录…</p>
                  <p v-else-if="!statusHistory.length" class="history-state">暂无历史状态。</p>
                  <ol v-else>
                    <li
                      v-for="(entry, index) in statusHistory"
                      :key="`${entry.timestamp}-${index}`"
                      :class="{ active: index === 0 }"
                    >
                      <time>{{ historyTime(entry.timestamp) }}</time>
                      <i />
                      <div>
                        <strong>{{ entry.info.name }}</strong>
                        <span>{{ historyKind(entry) }}</span>
                      </div>
                    </li>
                  </ol>
                </section>
              </div>

              <div
                v-else-if="activeModule === 'inbox'"
                key="inbox"
                class="module-view inbox-module"
              >
                <div class="command-echo">
                  <span>tonks@home:~ $</span>
                  /inbox
                </div>
                <div class="module-heading">
                  <div>
                    <p class="console-eyebrow">PUBLIC CHANNEL</p>
                    <h2>推荐收信箱</h2>
                  </div>
                  <span class="status-sync">LATEST 10</span>
                </div>
                <div class="category-filter" role="tablist" aria-label="推荐类别">
                  <button
                    v-for="item in categoryItems"
                    :key="item.id"
                    type="button"
                    role="tab"
                    :aria-selected="category === item.id"
                    :class="{ active: category === item.id }"
                    @click="selectCategory(item.id)"
                  >
                    <component :is="item.icon" class="h-3.5 w-3.5" aria-hidden="true" />
                    {{ item.label }}
                  </button>
                </div>
                <div v-if="recommendationLoading" class="terminal-message">
                  <RotateCw class="animate-spin" />
                  正在同步推荐信道…
                </div>
                <div v-else-if="recommendationError" class="terminal-message error">
                  {{ recommendationError }}
                </div>
                <div v-else-if="!visibleRecommendations.length" class="terminal-message">
                  <Inbox />
                  当前类别还没有收到推荐。
                </div>
                <ol v-else class="recommendation-list">
                  <li v-for="(item, index) in visibleRecommendations" :key="item.id">
                    <span class="recommendation-index">
                      {{ String(index + 1).padStart(2, '0') }}
                    </span>
                    <div>
                      <div class="recommendation-meta">
                        <strong>{{ item.category.toUpperCase() }}</strong>
                        <span>{{ recommendationSourceLabel(item) }}</span>
                        <time>{{ recommendationTimeAgo(item.created_at) }}</time>
                      </div>
                      <p>{{ item.content }}</p>
                    </div>
                  </li>
                </ol>
              </div>

              <div
                v-else-if="activeModule === 'system'"
                key="system"
                class="module-view system-module"
              >
                <div class="command-echo">
                  <span>tonks@home:~ $</span>
                  /system
                </div>
                <div class="module-heading">
                  <div>
                    <p class="console-eyebrow">SYSTEM MANIFEST</p>
                    <h2>站点运行信息</h2>
                  </div>
                  <span class="status-sync">STABLE</span>
                </div>
                <div class="system-grid">
                  <article>
                    <span>RUNTIME</span>
                    <strong>Vue 3.5</strong>
                    <small>Composition API</small>
                  </article>
                  <article>
                    <span>BUILDER</span>
                    <strong>Vite 6</strong>
                    <small>TypeScript</small>
                  </article>
                  <article>
                    <span>THEME</span>
                    <strong>Auto Sync</strong>
                    <small>Light / Dark</small>
                  </article>
                  <article>
                    <span>UPTIME</span>
                    <strong>{{ siteRunningDays }} Days</strong>
                    <small>since 2025-09-11</small>
                  </article>
                  <article>
                    <span>ASSET LINK</span>
                    <strong>Local</strong>
                    <small>terminal sequence</small>
                  </article>
                </div>
                <div class="manifest-block font-mono">
                  <p>
                    <span>interface</span>
                    tonks-home
                  </p>
                  <p>
                    <span>renderer</span>
                    DOM + Canvas-ready
                  </p>
                  <p>
                    <span>motion</span>
                    reduced-motion aware
                  </p>
                  <p>
                    <span>status</span>
                    <b>operational</b>
                  </p>
                </div>
              </div>

              <div v-else-if="activeModule === 'help'" key="help" class="module-view help-module">
                <div class="command-echo">
                  <span>tonks@home:~ $</span>
                  /help
                </div>
                <div class="module-heading">
                  <div>
                    <p class="console-eyebrow">COMMAND INDEX</p>
                    <h2>可用命令</h2>
                  </div>
                </div>
                <div class="command-list">
                  <button
                    v-for="item in helpCommands"
                    :key="item.command"
                    type="button"
                    @click="prefillCommand(item.fill)"
                  >
                    <code>{{ item.command }}</code>
                    <span>{{ item.description }}</span>
                  </button>
                </div>
                <p v-if="admin.isLoggedIn" class="admin-command-note">
                  ADMIN OPTIONS: -city 福州 -source 自定义访客
                </p>
              </div>

              <div v-else key="empty" class="idle-screen">
                <div>
                  <p>NO MODULE MOUNTED</p>
                  <span>输入 /help 或从左侧选择一个模块</span>
                </div>
              </div>
            </Transition>
          </div>

          <form class="terminal-input-row" @submit.prevent="executeCommand">
            <label for="status-console-command" class="sr-only">输入控制台命令</label>
            <span class="prompt-label">tonks@home:~ $</span>
            <input
              id="status-console-command"
              ref="inputRef"
              v-model="command"
              autocomplete="off"
              spellcheck="false"
              :placeholder="commandPlaceholder"
              :readonly="phase !== 'ready'"
              :disabled="commandPending"
              @keydown="onInputKeydown"
              @keydown.enter.prevent="executeCommand"
            />
            <span class="key-hint">ENTER</span>
          </form>
          <Transition name="console-content">
            <div
              v-if="commandFeedback"
              class="command-feedback"
              :class="commandFeedback.kind"
              role="status"
            >
              {{ commandFeedback.message }}
            </div>
          </Transition>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
:global(.status-console) {
  width: min(960px, calc(100vw - 96px));
  height: min(650px, calc(100dvh - 88px));
  color: var(--console-text);
  background: var(--console-shell);
  box-shadow:
    0 28px 100px rgba(10, 27, 38, 0.28),
    0 0 0 1px var(--console-border),
    0 0 48px var(--console-glow);
  font-family: 'JetBrains Mono', 'Geist Mono', ui-monospace, monospace;
  grid-template-rows: 45px minmax(0, 1fr) !important;
  gap: 0 !important;
}
.console-titlebar {
  height: 45px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--console-border);
  padding: 0 14px 0 17px;
  background: var(--console-titlebar);
  font-size: 11px;
}
.console-online {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.console-online i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--console-success);
  box-shadow: 0 0 8px color-mix(in srgb, var(--console-success), transparent 35%);
}
.console-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: 0;
  height: auto;
}
.console-sidebar {
  display: flex;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid var(--console-border);
  background: var(--console-sidebar);
}
.console-nav {
  padding: 13px 10px 8px;
}
.console-eyebrow {
  margin: 0 0 9px;
  color: var(--console-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
}
.console-nav-item {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 47px;
  align-items: center;
  gap: 9px;
  border-radius: 9px;
  padding: 5px 8px;
  color: var(--console-muted);
  transition:
    color 150ms ease,
    background 150ms ease;
}
.console-nav-item:hover {
  color: var(--console-text);
  background: var(--console-hover);
}
.console-nav-item.active {
  color: var(--console-prompt);
  background: var(--console-selected);
}
.console-nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 2px;
  border-radius: 2px;
  background: var(--console-prompt);
  box-shadow: 0 0 10px var(--console-glow);
}
.console-nav-item strong,
.console-nav-item small {
  display: block;
}
.console-nav-item strong {
  overflow: hidden;
  color: inherit;
  font-family: var(--font-sans, sans-serif);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.console-nav-item small {
  margin-top: 3px;
  color: var(--console-faint);
  font-size: 9px;
}
.nav-caret {
  opacity: 0.45;
}
.avatar-feed {
  border-top: 1px solid var(--console-border);
  padding: 10px;
}
.feed-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--console-muted);
  font-size: 8px;
  letter-spacing: 0.14em;
}
.feed-live {
  color: var(--console-success);
}
.avatar-viewport {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--console-border);
  border-radius: 8px;
  background: var(--console-pane);
}
.avatar-viewport img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  filter: saturate(0.82) contrast(1.08);
}
.console-terminal {
  position: relative;
  isolation: isolate;
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) 48px;
  background-color: var(--console-pane);
  background-image:
    linear-gradient(var(--console-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--console-grid) 1px, transparent 1px);
  background-size: 24px 24px;
}
.sidebar-bulletin {
  min-height: 78px;
  flex: 1;
  margin: 0 10px 10px;
  border: 1px solid var(--console-border);
  border-radius: 7px;
  padding: 9px 10px;
  background: color-mix(in srgb, var(--console-pane), transparent 48%);
}
.bulletin-label {
  display: flex;
  justify-content: space-between;
  color: var(--console-faint);
  font-size: 7px;
  letter-spacing: 0.15em;
}
.sidebar-bulletin p {
  margin: 10px 0 0;
  color: var(--console-muted);
  font-family: var(--font-sans, sans-serif);
  font-size: 10px;
  line-height: 1.65;
}
.sidebar-bulletin i {
  display: inline-block;
  width: 5px;
  height: 10px;
  margin-left: 2px;
  vertical-align: -1px;
  background: var(--console-prompt);
  animation: cursor-blink 900ms steps(1) infinite;
}
.terminal-wait-background {
  position: absolute;
  z-index: -1;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.16;
  pointer-events: none;
  user-select: none;
  transition: opacity 180ms ease;
}
.terminal-wait-gif.hidden {
  opacity: 0;
}
.terminal-wait-final {
  opacity: 0;
}
.terminal-wait-final.visible {
  opacity: 0.16;
}
.terminal-viewport {
  position: relative;
  z-index: 1;
  min-height: 0;
  overflow-y: auto;
  padding: clamp(18px, 3vw, 34px);
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.terminal-viewport::-webkit-scrollbar {
  display: none;
}
.module-view {
  max-width: 820px;
  margin: 0 auto;
}
.command-echo {
  margin-bottom: 25px;
  color: var(--console-text);
  font-size: 11px;
}
.command-echo span {
  margin-right: 9px;
  color: var(--console-prompt);
}
.module-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.module-heading h2 {
  margin: 0;
  font-family: var(--font-sans, sans-serif);
  font-size: clamp(22px, 3vw, 31px);
  line-height: 1;
  letter-spacing: -0.03em;
}
.status-sync {
  border: 1px solid var(--console-border);
  border-radius: 999px;
  padding: 5px 8px;
  color: var(--console-muted);
  font-size: 8px;
  letter-spacing: 0.1em;
}
.current-status-panel,
.timeline-panel,
.system-grid article,
.manifest-block {
  border: 1px solid var(--console-border);
  background: var(--console-surface);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.08);
  -webkit-backdrop-filter: blur(6px) saturate(125%);
  backdrop-filter: blur(6px) saturate(125%);
}
.current-status-panel {
  display: flex;
  align-items: center;
  gap: 18px;
  border-radius: 12px;
  padding: clamp(17px, 2.5vw, 25px);
}
.status-beacon {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  border: 3px solid color-mix(in srgb, var(--status-color), transparent 70%);
  border-radius: 50%;
  background: var(--status-color);
  box-shadow: 0 0 18px var(--status-color);
}
.status-beacon.pulse {
  animation: beacon 2s ease-in-out infinite;
}
.status-kicker,
.status-time span {
  color: var(--console-muted);
  font-size: 8px;
  letter-spacing: 0.14em;
}
.current-status-panel h3 {
  margin: 5px 0 4px;
  font-family: var(--font-sans, sans-serif);
  font-size: 24px;
}
.current-status-panel p:last-child {
  margin: 0;
  color: var(--console-muted);
  font-family: var(--font-sans, sans-serif);
  font-size: 12px;
  line-height: 1.65;
}
.status-time {
  flex: 0 0 auto;
  text-align: right;
}
.status-time strong {
  display: block;
  margin-top: 6px;
  font-size: 10px;
  font-weight: 500;
}
.timeline-panel {
  margin-top: 13px;
  border-radius: 12px;
  padding: 17px 20px 14px;
}
.panel-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 11px;
  color: var(--console-muted);
  font-size: 8px;
  letter-spacing: 0.14em;
}
.panel-label small {
  border: 1px solid var(--console-border);
  border-radius: 4px;
  padding: 3px 5px;
  color: var(--console-faint);
  font-size: 7px;
}
.timeline-panel ol {
  margin: 0;
  padding: 0;
  list-style: none;
}
.timeline-panel li {
  display: grid;
  grid-template-columns: 42px 14px minmax(0, 1fr);
  align-items: center;
  min-height: 44px;
  color: var(--console-muted);
}
.timeline-panel li time {
  font-size: 9px;
}
.timeline-panel li i {
  position: relative;
  width: 7px;
  height: 7px;
  border: 1px solid var(--console-faint);
  border-radius: 50%;
}
.timeline-panel li:not(:last-child) i::after {
  content: '';
  position: absolute;
  top: 7px;
  left: 2px;
  width: 1px;
  height: 38px;
  background: var(--console-border);
}
.timeline-panel li.active i {
  border-color: var(--console-prompt);
  background: var(--console-prompt);
  box-shadow: 0 0 9px var(--console-glow);
}
.timeline-panel li div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--console-border);
  padding: 10px 0;
}
.timeline-panel li:last-child div {
  border-bottom: 0;
}
.timeline-panel li strong {
  color: var(--console-text);
  font-family: var(--font-sans, sans-serif);
  font-size: 11px;
  font-weight: 500;
}
.timeline-panel li span {
  font-size: 8px;
  letter-spacing: 0.1em;
}
.history-state {
  margin: 0;
  padding: 25px 0;
  color: var(--console-faint);
  text-align: center;
  font-family: var(--font-sans, sans-serif);
  font-size: 10px;
}
.category-filter {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.category-filter button {
  display: inline-flex;
  min-height: 34px;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--console-border);
  border-radius: 7px;
  padding: 0 10px;
  color: var(--console-muted);
  font-family: var(--font-sans, sans-serif);
  font-size: 10px;
}
.category-filter button:hover {
  color: var(--console-text);
  background: var(--console-hover);
}
.category-filter button.active {
  border-color: color-mix(in srgb, var(--console-prompt), transparent 40%);
  color: var(--console-prompt);
  background: var(--console-selected);
}
.recommendation-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.recommendation-list li {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 11px;
  border-top: 1px solid var(--console-border);
  padding: 14px 4px;
}
.recommendation-index {
  color: var(--console-faint);
  font-size: 10px;
}
.recommendation-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 7px;
  color: var(--console-muted);
  font-size: 9px;
  font-weight: 500;
}
.recommendation-meta strong {
  color: var(--console-prompt);
  letter-spacing: 0.1em;
}
.recommendation-meta > span {
  color: var(--console-text);
  opacity: 0.78;
}
.recommendation-meta time {
  margin-left: auto;
  color: var(--console-muted);
  font-weight: 400;
}
.recommendation-list p {
  margin: 0;
  color: var(--console-text);
  font-family: var(--font-sans, sans-serif);
  font-size: 12px;
  line-height: 1.6;
}
.terminal-message {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: var(--console-muted);
  font-family: var(--font-sans, sans-serif);
  font-size: 12px;
}
.terminal-message svg {
  width: 18px;
  height: 18px;
}
.terminal-message.error {
  color: var(--console-error);
}
.system-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.system-grid article {
  border-radius: 10px;
  padding: 16px;
}
.system-grid span,
.system-grid small {
  display: block;
  color: var(--console-muted);
  font-size: 8px;
  letter-spacing: 0.1em;
}
.system-grid strong {
  display: block;
  margin: 12px 0 6px;
  font-size: 17px;
}
.manifest-block {
  margin-top: 10px;
  border-radius: 10px;
  padding: 14px 17px;
  font-size: 10px;
  line-height: 2;
}
.manifest-block p {
  margin: 0;
}
.manifest-block span {
  display: inline-block;
  width: 90px;
  color: var(--console-muted);
}
.manifest-block b {
  color: var(--console-success);
  font-weight: 500;
}
.command-list {
  border-top: 1px solid var(--console-border);
}
.command-list button {
  display: grid;
  width: 100%;
  grid-template-columns: 140px 1fr;
  border-bottom: 1px solid var(--console-border);
  padding: 0;
  text-align: left;
  transition: background 130ms ease;
}
.command-list button:hover,
.command-list button:focus-visible {
  outline: 0;
  background: var(--console-hover);
}
.command-list code,
.command-list span {
  padding: 12px 8px;
  font-size: 10px;
}
.command-list code {
  color: var(--console-prompt);
}
.command-list span {
  color: var(--console-muted);
  font-family: var(--font-sans, sans-serif);
}
.boot-screen {
  display: grid;
  min-height: 100%;
  place-items: center;
  align-content: end;
  padding-bottom: 9%;
}
.boot-log {
  width: min(440px, 88%);
  border: 1px solid var(--console-border);
  border-radius: 8px;
  padding: 12px 14px;
  color: var(--console-text);
  background: color-mix(in srgb, var(--console-pane), transparent 16%);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.14);
  font-size: 10px;
  line-height: 1.85;
  text-shadow: 0 1px 4px var(--console-pane);
}
.boot-log p {
  margin: 0;
}
.boot-log p span {
  color: var(--console-prompt);
}
.boot-log p b {
  float: right;
  color: var(--console-success);
  font-weight: 500;
}
.boot-brand {
  margin-bottom: 6px !important;
  color: var(--console-text);
  letter-spacing: 0.12em;
}
.boot-brand span {
  float: right;
  color: var(--console-faint) !important;
}
.boot-wait {
  margin-top: 6px !important;
  color: var(--console-faint);
}
.spinner {
  display: inline-block;
  animation: spinner 1s linear infinite;
}
.idle-screen {
  display: grid;
  min-height: 100%;
  place-items: center;
  align-content: center;
  text-align: center;
}
.idle-screen div {
  padding: 18px 22px;
  border: 1px solid var(--console-border);
  border-radius: 10px;
  background: var(--console-surface);
}
.idle-screen p {
  margin: 0 0 8px;
  color: var(--console-muted);
  font-size: 10px;
  letter-spacing: 0.17em;
}
.idle-screen span {
  color: var(--console-faint);
  font-family: var(--font-sans, sans-serif);
  font-size: 10px;
}
.terminal-input-row {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  border-top: 1px solid var(--console-border);
  background: var(--console-input);
  padding: 0 17px;
}
.prompt-label {
  flex: 0 0 auto;
  color: var(--console-prompt);
  font-size: 10px;
}
.terminal-input-row input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  padding: 0 10px;
  color: var(--console-text);
  font-family: inherit;
  font-size: 11px;
}
.terminal-input-row input::placeholder {
  color: var(--console-faint);
}
.key-hint {
  border: 1px solid var(--console-border);
  border-radius: 4px;
  padding: 3px 5px;
  color: var(--console-faint);
  font-size: 7px;
}
.command-feedback {
  position: absolute;
  z-index: 5;
  right: 14px;
  bottom: 58px;
  max-width: min(440px, calc(100% - 28px));
  border: 1px solid var(--console-border);
  border-radius: 8px;
  padding: 9px 12px;
  background: var(--console-titlebar);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  font-family: var(--font-sans, sans-serif);
  font-size: 10px;
}
.command-feedback.success {
  color: var(--console-success);
}
.command-feedback.error {
  color: var(--console-error);
}
.admin-command-note {
  margin: 15px 0 0;
  color: var(--console-prompt);
  font-size: 8px;
  letter-spacing: 0.08em;
}
.console-content-enter-active,
.console-content-leave-active {
  transition:
    opacity 150ms ease,
    transform 180ms ease;
}
.console-content-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.console-content-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
@keyframes beacon {
  50% {
    opacity: 0.62;
    transform: scale(0.82);
  }
}
@keyframes spinner {
  to {
    transform: rotate(360deg);
  }
}
@keyframes cursor-blink {
  50% {
    opacity: 0;
  }
}
@media (max-width: 700px) {
  :global(.status-console) {
    width: calc(100vw - 16px);
    height: calc(100dvh - 18px);
  }
  .console-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }
  .console-sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--console-border);
  }
  .console-nav {
    display: flex;
    gap: 5px;
    overflow-x: auto;
    padding: 8px 10px;
  }
  .console-nav > .console-eyebrow,
  .avatar-feed,
  .sidebar-bulletin {
    display: none;
  }
  .console-nav-item {
    min-width: 46px;
    min-height: 42px;
    flex: 1 0 46px;
    justify-content: center;
    padding: 7px;
  }
  .console-nav-item span {
    display: none;
  }
  .console-nav-item.active::before {
    top: auto;
    right: 9px;
    bottom: 2px;
    left: 9px;
    width: auto;
    height: 2px;
  }
  .console-terminal {
    grid-template-rows: minmax(0, 1fr) 46px;
  }
  .terminal-viewport {
    padding: 17px 14px;
  }
  .current-status-panel {
    align-items: flex-start;
  }
  .status-time {
    display: none;
  }
  .system-grid {
    grid-template-columns: 1fr 1fr;
  }
  .key-hint {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .status-beacon.pulse,
  .spinner,
  .sidebar-bulletin i {
    animation: none;
  }
  .console-content-enter-active,
  .console-content-leave-active {
    transition: none;
  }
}
</style>
