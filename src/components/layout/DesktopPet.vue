<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { createPetState, W, H, TURN_FRAME_PATH, FRAMES } from './pet/state'
import { usePetCore } from './pet/usePetCore'
import { usePetSinging } from './pet/usePetSinging'
import { usePetTurn } from './pet/usePetTurn'
import SpeechBubble from './pet/SpeechBubble.vue'
import { useSpeechBubble } from './pet/useSpeechBubble'
import { usePetLyrics } from './pet/usePetLyrics'
import ContextMenu from './ContextMenu.vue'
import type { ContextMenuItem } from './ContextMenu.vue'
import { RefreshRight, InfoFilled, Notebook, Setting, Sunny } from '@element-plus/icons-vue'
import { usePetEnvStore } from '@/stores/petEnv'
import { useAdminStore } from '@/stores/admin'
import dialogue from '@/data/pet-dialogue.json'
import questionsData from '@/data/pet-questions.json'
import QuestionBubble from './pet/QuestionBubble.vue'
import CelebrationEffect from './pet/CelebrationEffect.vue'
import MemoryNotebook from './pet/MemoryNotebook.vue'
import DevQuestionPanel from './pet/DevQuestionPanel.vue'
import { usePetMemory } from '@/composables/usePetMemory'
import { usePetQuestions, type PetQuestion } from '@/composables/usePetQuestions'
import { useSpecialDate } from '@/composables/useSpecialDate'
import { useWeatherVisitor, type WeatherIcon } from '@/composables/useWeatherVisitor'
import WeatherBubble from './pet/WeatherBubble.vue'
import WelcomeDialog, { WELCOME_VERSION, WELCOME_LS_KEY } from './WelcomeDialog.vue'

const emit = defineEmits<{ rage: []; rageStart: [] }>()
const state = createPetState()
const petRef = ref<HTMLElement | null>(null)
const petEnv = usePetEnvStore()
const adminStore = useAdminStore()
const allQs = questionsData as PetQuestion[]

// Canvas 预渲染 turnside 镜像 → 静态图，避免 CSS scaleX(-1) 的纹理闪帧
const mirroredTurnSrc = ref(TURN_FRAME_PATH)
const mirrorReady = ref(false)
onMounted(() => {
  const img = new Image()
  img.src = TURN_FRAME_PATH
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d')!
    ctx.translate(c.width, 0); ctx.scale(-1, 1)
    ctx.drawImage(img, 0, 0)
    mirroredTurnSrc.value = c.toDataURL()
    mirrorReady.value = true
  }
})

// Turn — 鼠标跟踪系统（退出时恢复日常计时器）
const turn = usePetTurn(state, () => {
  core.resetIdleTimers()
  core.scheduleBlink()
  core.scheduleAction()
})

// Core — 日常动画 + 情绪 + 拖拽 + 粒子
const core = usePetCore(
  state,
  petRef,
  (e) => (e === 'rage' ? emit('rage') : emit('rageStart')),
  () => singing.tryResumeSinging(),
)

// Singing — 唱歌状态机（退出时恢复 core 日常计时器）
const singing = usePetSinging(state, () => {
  core.resetIdleTimers()
  core.scheduleBlink()
  core.scheduleAction()
})

// ===== 对话气泡 =====
const bubble = useSpeechBubble()

// ===== 记忆与提问系统 =====
const memory = usePetMemory()
const questions = usePetQuestions()
const specialDate = useSpecialDate()
const weatherVisitor = useWeatherVisitor()

// 唱歌时的歌词/音符模式（按播放进度驱动同一个气泡）
usePetLyrics(state, bubble)

type Placement = 'left' | 'right'
// 桌宠在视口右半 → 气泡出现在左侧（尾巴指右）；左半 → 气泡在右侧（尾巴指左）
const placement = computed<Placement>(() =>
  state.pos.value.x + W / 2 > window.innerWidth / 2 ? 'left' : 'right',
)

function pick(arr: string[]): string {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : ''
}

// 能否说"闲聊"话（点击/空闲/问候/转身）——紧张的威胁态不闲聊
function canDailyTalk(): boolean {
  return (
    !state.singingState.value &&
    !state.rageActive.value &&
    state.mood.value !== 'threat' &&
    !bubble.isMusicMode() &&
    !questions.isActive.value &&
    !showWelcomeBubble.value &&
    !weatherBubbleVisible.value
  )
}

// 能否说"情绪"台词——含威胁态（专属情绪句），只挡唱歌/暴走/歌词/提问
function canEmotionTalk(): boolean {
  return !state.singingState.value && !state.rageActive.value && !bubble.isMusicMode() && !questions.isActive.value
}

// 进页面按时段问候
function greet() {
  const h = new Date().getHours()
  const slot =
    h < 5 ? 'night' : h < 11 ? 'morning' : h < 18 ? 'afternoon' : h < 23 ? 'evening' : 'night'
  bubble.say(pick(dialogue.greeting[slot as keyof typeof dialogue.greeting]))
}

// 情绪变化时说对应情绪的台词（含 threat；空句类自动跳过）
watch(
  () => state.mood.value,
  (m) => {
    if (!canEmotionTalk()) return
    // 威胁：激怒是重要时刻，强制打断当前气泡
    if (m === 'threat') {
      bubble.say(pick(dialogue.threat), true)
      return
    }
    // 其它情绪：上一个气泡还在显示则不打断（等它说完，再配合结束冷却）
    if (bubble.visible.value) return
    if (m === 'happy') bubble.say(pick(dialogue.happy))
    else if (m === 'angry') bubble.say(pick(dialogue.angry))
    else if (m === 'cry') bubble.say(pick(dialogue.cry))
    else if (m === 'sleep') bubble.say(pick(dialogue.sleep))
  },
)

// 一次性转身（转头看鼠标、非跟踪态）时说一句（doTurn 本就是静止 10s 才触发的低频事件）
watch(
  () => state.turnDirection.value,
  (dir, prev) => {
    if (
      dir &&
      !prev &&
      !state.tracking.value &&
      !bubble.visible.value &&
      canDailyTalk() &&
      Math.random() < 0.6
    ) {
      bubble.say(pick(dialogue.turn))
    }
  },
)

let idleTalkTimer: ReturnType<typeof setInterval> | null = null
let greetTimer: ReturnType<typeof setTimeout> | null = null
let questionTimer: ReturnType<typeof setInterval> | null = null

// 点击路由：唱歌模式出音符；日常模式进 core
function handleClick(e: MouseEvent) {
  if (state.rageActive.value) return
  // 拖拽后的伪点击：交给 core 检测并清 moved 标志，不触发任何点击反应/气泡
  if (state.moved.value) {
    core.handleClick(e)
    return
  }
  state.clickScale.value = true
  setTimeout(() => { state.clickScale.value = false }, 300)
  if (state.singingState.value) {
    singing.spawnSingingNotes(5)
    return
  }
  // 点击的说话反馈交给情绪变化：core 改 mood → watch(mood) 说对应情绪句/表情（不再单独用 click 句库）
  core.handleClick(e)
}

// 外部激怒（中指手势等）：进 threat 约 1 秒后直接暴怒（emit rage）
let provokeTimer: ReturnType<typeof setTimeout> | null = null
function provoke() {
  if (state.rageActive.value) return
  if (state.singingState.value) singing.stopAllSinging()
  if (state.mood.value === 'sleep') { core.stopSleepZs(); state.sleepZs.value = [] }
  state.mood.value = 'threat'
  state.showFrame.value = FRAMES.threat
  if (provokeTimer) clearTimeout(provokeTimer)
  provokeTimer = setTimeout(() => {
    if (state.mood.value === 'threat' && !state.rageActive.value) core.startRage()
  }, 1000)
}
defineExpose({ provoke, getCenter: () => ({ x: state.pos.value.x + W / 2, y: state.pos.value.y + H / 2 }) })

// ===== 右键菜单 =====
const showNotebook = ref(false)
const showDevPanel = ref(false)
// 首次访问欢迎引导
const showWelcomeBubble = ref(false)
const showWelcomeDialog = ref(false)
// 天气气泡状态
const weatherBubbleVisible = ref(false)
const weatherBubbleData = ref<ReturnType<typeof weatherVisitor.getWeatherData>>(null)
const weatherCareText = ref('')
const ctxMenuShow = ref(false)
const ctxMenuX = ref(0)
const ctxMenuY = ref(0)
const ctxMenuItems = computed<ContextMenuItem[]>(() => {
  const items: ContextMenuItem[] = []
  // 唱歌时隐藏切换项，堵死切换路径
  if (!state.singingState.value) {
    items.push({
      label: '唤出U酱！',
      icon: RefreshRight,
      action: () => {
        if (petEnv.canSwitch()) petEnv.activePetType = 'live2d'
      },
      disabled: !petEnv.canSwitch(),
    })
  }
  items.push({ label: '关于我？', icon: InfoFilled, action: () => playIntro(), disabled: !!state.singingState.value })
  items.push({ label: '今日天气', icon: Sunny, action: () => showWeatherBubble(), disabled: !!state.singingState.value })
  items.push({ label: '查看记忆', icon: Notebook, action: () => { showNotebook.value = true } })
  if (adminStore.isLoggedIn) {
    items.push({ label: '调试提问', icon: Setting, action: () => { showDevPanel.value = true } })
  }
  return items
})

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  ctxMenuX.value = e.clientX
  ctxMenuY.value = e.clientY
  ctxMenuShow.value = true
}

let introPlaying = false

/** 唤醒桌宠：从 sleep/cry/threat 回到 idle，重置闲置计时器。幂等，idle 时调用无副作用。 */
function wakeUp() {
  if (state.mood.value === 'sleep' || state.mood.value === 'cry') {
    core.stopSleepZs()
    state.sleepZs.value = []
    core.resetIdleTimers() // 内部：cry/sleep → idle + scheduleBlink + scheduleAction
  }
  if (state.mood.value === 'threat') {
    state.mood.value = 'idle'
    state.showFrame.value = FRAMES.idle
    core.resetIdleTimers()
  }
}

/** 播放介绍句序列（右键"关于桌宠"触发） */
function playIntro() {
  if (introPlaying) return // B19: 重入守卫
  const sentences = dialogue.intro
  if (!sentences?.length) return
  wakeUp()
  introPlaying = true
  let i = 0
  function next() {
    if (i >= sentences.length) { introPlaying = false; return }
    bubble.say(sentences[i], true)
    i++
    const s = sentences[i - 1]
    const typeMs = s.length * 45
    const thinkMs = s.length >= 4 ? 140 * s.length : 0
    setTimeout(next, thinkMs + typeMs + 2000)
  }
  next()
}

// ===== 提问事件处理 =====
function onQuestionSubmit(answer: string) {
  const q = questions.currentQuestion.value
  if (q) {
    questions.submitAnswer(q, answer)
    questions.dismiss()
    petEnv.isQuestionActive = false
    // 心情问题 → 触发对应回复（force 跳过所有守卫）
    if (q.id === 'q_mood') {
      wakeUp()
      const replies = (dialogue as Record<string, unknown>).mood_replies as Record<string, string[]> | undefined
      const moodLines = replies?.[answer]
      if (moodLines?.length) {
        setTimeout(() => bubble.say(pick(moodLines), true), 400)
      }
    }
  } else {
    questions.dismiss()
    petEnv.isQuestionActive = false
  }
}

function onQuestionReject() {
  const q = questions.currentQuestion.value
  if (q) {
    // 已答问题拒绝时只关闭，不加入拒绝列表
    if (!q.key || !memory.hasMemory(q.key)) {
      questions.rejectCurrent(q)
    }
  }
  questions.dismiss()
  petEnv.isQuestionActive = false
}

// ===== 调试面板回调 =====
function onDevTriggerQuestion(qId: string) {
  const q = allQs.find(q => q.id === qId)
  if (!q || questions.isActive.value) return
  if (q.key && memory.hasMemory(q.key)) return
  if (memory.isRejected(qId)) memory.unrejectQuestion(qId)
  bubble.hide()
  questions.currentQuestion.value = q
  questions.isActive.value = true
  petEnv.isQuestionActive = true
}

function onDevTriggerMemory() {
  const memLine = memory.pickMemoryLine(dialogue.memory)
  if (memLine) bubble.say(memLine, true)
}

function onDevTriggerWeather(icon: string, desc: string, temp: number, tMin: number, tMax: number) {
  const city = weatherVisitor.getLocationData()?.city || '模拟城市'
  // 模拟心知天气码（用于 weatherCode 字段，图标由 icon 参数直接指定）
  const mockCode: Record<string, number> = { sunny: 0, 'partly-cloudy': 4, cloudy: 3, rain: 14, shower: 10, snow: 21, thunder: 11, fog: 30 }
  const wCode = mockCode[icon] ?? 2
  weatherBubbleData.value = {
    icon: icon as WeatherIcon,
    temp,
    desc,
    city,
    weatherCode: wCode,
    tomorrow: { icon: icon as WeatherIcon, tempMin: tMin, tempMax: tMax, desc, weatherCode: wCode },
  }
  weatherCareText.value = weatherVisitor.pickWeatherCareLine(
    (dialogue as Record<string, unknown>).weather_talk as Record<string, string[]> | undefined,
  )
  weatherBubbleVisible.value = true
  bubble.hide()
  console.log('[DesktopPet] 模拟天气气泡:', weatherBubbleData.value)
}

// ===== 欢迎气泡回调 =====
function onWelcomeExpand() {
  showWelcomeBubble.value = false
  showWelcomeDialog.value = true
}

function onWelcomeConfirm() {
  showWelcomeDialog.value = false
  localStorage.setItem(WELCOME_LS_KEY, WELCOME_VERSION)
  // 弹窗关闭后补一段问候
  if (greetTimer) clearTimeout(greetTimer)
  greetTimer = setTimeout(greet, 400)
}

// ===== 天气气泡 =====
async function showWeatherBubble() {
  wakeUp() // B1: 先唤醒
  if (!weatherVisitor.getWeatherData()) {
    bubble.say('正在查询天气…', true)
    await weatherVisitor.ensureLoaded()
  }
  const data = weatherVisitor.getWeatherData()
  if (!data) {
    bubble.say('天气数据获取失败…请稍后再试', true)
    return
  }
  console.log('[DesktopPet] showWeatherBubble 数据:', data)
  weatherBubbleData.value = data
  weatherCareText.value = weatherVisitor.pickWeatherCareLine(
    (dialogue as Record<string, unknown>).weather_talk as Record<string, string[]> | undefined,
  )
  weatherBubbleVisible.value = true
  bubble.hide() // 互斥
}

function onWeatherBubbleClose() {
  weatherBubbleVisible.value = false
}

// 其他气泡出现时自动关闭天气气泡（防止重叠覆盖）
watch(() => bubble.visible.value, (v) => {
  if (v) weatherBubbleVisible.value = false
})

// 同步暴怒状态到 petEnv（阻挡切换）
watch(() => state.rageActive.value, (v) => {
  petEnv.isRageActive = v
})

onMounted(async () => {
  turn.startMouseSystem()

  // 首次访问 / 版本更新 → 显示欢迎气泡
  const isFirstVisit = localStorage.getItem(WELCOME_LS_KEY) !== WELCOME_VERSION
  if (isFirstVisit) {
    showWelcomeBubble.value = true
  }

  // 特殊日期检测（生日等）—— 最高优先级，覆盖一切
  const isSpecialDay = specialDate.checkToday(bubble, '生日快乐。')

  if (!isSpecialDay) {
    // === 每日天气首屏（5s，与欢迎气泡共存） ===
    if (!weatherVisitor.isDailyWeatherShown()) {
      await weatherVisitor.ensureLoaded()
      const wData = weatherVisitor.getWeatherData()
      if (wData) {
        weatherBubbleData.value = wData
        weatherCareText.value = weatherVisitor.pickWeatherCareLine(
          (dialogue as Record<string, unknown>).weather_talk as Record<string, string[]> | undefined,
        )
        weatherBubbleVisible.value = true
        weatherVisitor.markDailyWeatherShown()
        // 7s 后关闭天气气泡；非首次访问时补问候
        greetTimer = setTimeout(() => {
          weatherBubbleVisible.value = false
          if (!isFirstVisit) greet()
        }, 7000)
      } else if (!isFirstVisit) {
        // 天气获取失败且非首次访问 → 降级为正常问候
        greetTimer = setTimeout(greet, 1600)
      }
    } else if (!isFirstVisit) {
      // === 今天已展示天气 → 正常流程（地址切换 + 按时段问候） ===
      const locPromise = weatherVisitor.ensureLoaded()
      const locationChanged = await Promise.race([
        locPromise.then(() => weatherVisitor.hasLocationChanged()),
        new Promise<boolean>(r => setTimeout(() => r(false), 1400)),
      ])

      greetTimer = setTimeout(() => {
        if (locationChanged) {
          const line = weatherVisitor.pickLocationChangeLine(
            (dialogue as Record<string, unknown>).location_change as string[],
          )
          if (line) bubble.say(line, true)
        } else {
          greet()
        }
      }, 1600)
    }
    // 首次访问 + 今天已展示天气 → 不做任何事，等用户点欢迎气泡
    // （onWelcomeConfirm 里会补一段问候）
  }

  // 空闲随机冒泡（仅真正 idle 时）
  idleTalkTimer = setInterval(() => {
    if (
      state.mood.value === 'idle' &&
      canDailyTalk() &&
      !bubble.visible.value
    ) {
      // 30% 概率尝试触发记忆句
      if (Math.random() < 0.3) {
        const memLine = memory.pickMemoryLine(dialogue.memory)
        if (memLine) {
          bubble.say(memLine)
          return
        }
      }
      // 30% 概率尝试触发天气闲聊句（1.2 新增）
      if (Math.random() < 0.3) {
        const weatherLine = weatherVisitor.pickWeatherLine(
          (dialogue as Record<string, unknown>).weather_talk as Record<string, string[]> | undefined,
        )
        if (weatherLine) {
          bubble.say(weatherLine)
          return
        }
      }
      // 正常 idle 闲聊
      if (Math.random() < 0.55) {
        bubble.say(pick(dialogue.idle))
      }
    }
  }, 28000)

  // 提问定时器（每 120s 尝试一次）
  questionTimer = setInterval(() => {
    if (!questions.canAskNow()) return
    if (!canDailyTalk()) return
    if (bubble.visible.value) return
    const q = questions.pickQuestion()
    if (q) {
      bubble.hide()
      questions.isActive.value = true
      petEnv.isQuestionActive = true
    }
  }, 120_000)
})

onBeforeUnmount(() => {
  singing.stopAllSinging()
  bubble.hide()
  petEnv.isRageActive = false // B3: 暴怒中折叠时复位，防止永久锁死
  petEnv.isQuestionActive = false
  if (idleTalkTimer) clearInterval(idleTalkTimer)
  if (greetTimer) clearTimeout(greetTimer)
  if (provokeTimer) clearTimeout(provokeTimer)
  if (questionTimer) clearInterval(questionTimer)
})
</script>

<template>
  <div
    class="fixed z-50 select-none cursor-grab active:cursor-grabbing"
    :class="{ 'pet-collapsing': petEnv.isCollapsing }"
    :style="{ left: `${state.pos.value.x}px`, top: `${state.pos.value.y}px`, width: `${W}px`, height: `${H}px` }"
    @pointerdown="core.onPointerDown"
    @pointermove="core.onPointerMove"
    @pointerup="core.onPointerUp"
    @pointercancel="core.onPointerUp"
    @click="handleClick"
    @contextmenu="onContextMenu"
    @dragstart.prevent
  >
    <div class="drop-enter drop-layer">
      <div ref="petRef" class="relative !overflow-visible">
        <!-- 对话气泡 -->
        <SpeechBubble
          :visible="bubble.visible.value"
          :mode="bubble.mode.value"
          :text="bubble.text.value"
          :original="bubble.original.value"
          :translation="bubble.translation.value"
          :emoji="bubble.emoji.value"
          :placement="placement"
        />

        <!-- 提问云朵气泡 -->
        <QuestionBubble
          :visible="questions.isActive.value && !!questions.currentQuestion.value"
          :question-text="questions.currentQuestion.value?.personas.static ?? ''"
          :input-type="questions.currentQuestion.value?.inputType ?? 'text'"
          :choices="questions.currentQuestion.value?.choices ?? []"
          :placeholder="questions.currentQuestion.value?.placeholder ?? ''"
          :icon-name="questions.currentQuestion.value?.icon ?? 'User'"
          placement="top"
          :vertical-offset="60"
          @submit="onQuestionSubmit"
          @reject="onQuestionReject"
          @close="questions.dismiss(); petEnv.isQuestionActive = false"
        />

        <!-- 首次访问欢迎气泡（云朵形态，点击后弹出弹窗而非输入框） -->
        <QuestionBubble
          :visible="showWelcomeBubble"
          question-text="戳我一下~"
          icon-name="Sunny"
          placement="top"
          :vertical-offset="60"
          :prevent-expand="true"
          @expand="onWelcomeExpand"
          @close="showWelcomeBubble = false"
        />

        <!-- 天气气泡 -->
        <WeatherBubble
          :visible="weatherBubbleVisible"
          :weather-data="weatherBubbleData"
          :placement="placement"
          :care-text="weatherCareText"
          :vertical-offset="14"
          @close="onWeatherBubbleClose"
        />

        <!-- 庆祝特效 -->
        <CelebrationEffect
          :visible="specialDate.isCelebrating.value"
          :pet-width="W"
          @complete="specialDate.isCelebrating.value = false"
        />
        <!-- 粒子 -->
        <span
          v-for="p in state.particles.value"
          :key="p.id"
          class="pet-particle absolute w-2.5 h-2.5 rounded-full pointer-events-none z-50"
          :style="{
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            '--delay': `${p.delay}ms`,
            left: `${p.originX}px`,
            top: `${p.originY}px`,
          }"
        />
        <!-- 睡眠 Z -->
        <span
          v-for="z in state.sleepZs.value"
          :key="z.id"
          class="sleep-z absolute pointer-events-none z-50 select-none"
          :style="{ left: `${z.x}px`, top: `${z.y}px`, animationDelay: `${z.delay}ms` }"
        >{{ z.text }}</span>
        <!-- 唱歌音符 -->
        <span
          v-for="n in state.singingNotes.value"
          :key="n.id"
          class="singing-note absolute pointer-events-none z-50 select-none"
          :style="{ left: `${n.x}px`, top: `${n.y}px`, '--hue': `${n.hue}`, animationDelay: `${n.delay}ms` }"
        >{{ n.symbol }}</span>
        <!-- 桌宠本体 -->
        <span :class="state.clickScale.value ? 'click-bounce' : ''" class="inline-block">
          <img
            :src="state.turnDirection.value === 'left' && mirrorReady && state.showFrame.value === TURN_FRAME_PATH ? mirroredTurnSrc : state.showFrame.value"
            alt="桌宠"
            class="pointer-events-none select-none pet-breathe"
            :style="{ width: `${W}px`, height: `${H}px`, objectFit: 'contain' }"
            draggable="false"
          />
        </span>
        <!-- 唱歌拖拽生气标记 -->
        <img
          v-if="state.singingAngry.value"
          src="/assets/pet/angry-icon.png"
          class="angry-mark absolute pointer-events-none z-50 select-none"
          alt="angry"
        />
      </div>
    </div>
    <!-- 右键菜单（移入 root div 内，消除多根节点 Transition 警告） -->
    <ContextMenu
      :items="ctxMenuItems"
      :x="ctxMenuX"
      :y="ctxMenuY"
      :show="ctxMenuShow"
      @close="ctxMenuShow = false"
    />

    <!-- 记忆笔记窗口 -->
    <MemoryNotebook
      :visible="showNotebook"
      @close="showNotebook = false"
    />

    <!-- 首次访问欢迎弹窗 -->
    <WelcomeDialog
      :visible="showWelcomeDialog"
      @confirm="onWelcomeConfirm"
    />

    <!-- 调试提问面板（仅管理员） -->
    <DevQuestionPanel
      :visible="showDevPanel"
      persona="static"
      :has-memories="memory.getFilledKeys().length > 0"
      :question-is-active="questions.isActive.value"
      @trigger-question="onDevTriggerQuestion"
      @trigger-memory="onDevTriggerMemory"
      @trigger-weather="onDevTriggerWeather"
      @close="showDevPanel = false"
    />
  </div>
</template>

<style scoped>
.pet-breathe {
  animation: pet-breathe 2.5s ease-in-out infinite;
  transform-origin: bottom center;
}
@keyframes pet-breathe {
  0%, 100% { transform: scaleY(1); }
  50%      { transform: scaleY(1.03); }
}

.click-bounce {
  animation: click-bounce 0.3s ease-out;
}
@keyframes click-bounce {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.12); }
  100% { transform: scale(1); }
}

.pet-particle {
  animation: pet-particle 0.8s ease-out forwards;
  animation-delay: var(--delay);
  background: #fff !important;
  box-shadow: 0 0 6px 2px rgba(255,255,255,0.7);
}
@keyframes pet-particle {
  0%   { opacity: 1; transform: scale(1.3); }
  40%  { opacity: 0.8; }
  100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.4); }
}

.sleep-z {
  font-family: 'Geist Sans', sans-serif;
  font-weight: 700;
  font-size: 22px;
  color: rgba(0, 0, 0, 0.65);
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.15);
  animation: sleep-z-float 2.5s ease-out forwards;
  animation-delay: var(--delay, 0ms);
  opacity: 0;
}
@keyframes sleep-z-float {
  0%   { opacity: 0; transform: translateY(0) scale(0.6); }
  15%  { opacity: 0.9; transform: translateY(-5px) scale(1); }
  70%  { opacity: 0.5; transform: translateY(-50px) translateX(8px) scale(1.1); }
  100% { opacity: 0; transform: translateY(-80px) translateX(15px) scale(0.7); }
}

.angry-mark {
  top: -12px; right: 2px; width: 28px; height: 28px;
  object-fit: contain;
  animation: angry-pop 0.3s ease-out;
}
@keyframes angry-pop {
  0%   { transform: scale(0); opacity: 0; }
  60%  { transform: scale(1.4); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.singing-note {
  font-size: 18px;
  color: hsl(var(--hue, 50), 80%, 65%);
  text-shadow: 0 0 10px hsl(var(--hue, 50), 90%, 60%),
               0 0 20px hsl(var(--hue, 50), 80%, 55%);
  animation: note-float 2.5s ease-out forwards;
  animation-delay: var(--delay, 0ms);
  opacity: 0;
}
@keyframes note-float {
  0%   { opacity: 0; transform: translateY(0) scale(0.5) rotate(-10deg); }
  20%  { opacity: 1; transform: translateY(-10px) scale(1.2) rotate(5deg); }
  60%  { opacity: 0.7; transform: translateY(-45px) translateX(10px) scale(1) rotate(15deg); }
  100% { opacity: 0; transform: translateY(-75px) translateX(20px) scale(0.5) rotate(30deg); }
}
</style>
