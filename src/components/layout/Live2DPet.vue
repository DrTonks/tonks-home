<script setup lang="ts">
/**
 * Live2D 桌宠组件 — 独立体系，含唱歌/道具控制/介绍引导。
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useSpeechBubble } from './pet/useSpeechBubble'
import SpeechBubble from './pet/SpeechBubble.vue'
import ContextMenu from './ContextMenu.vue'
import type { ContextMenuItem } from './ContextMenu.vue'
import { RefreshRight, InfoFilled, Monitor, Microphone, Notebook } from '@element-plus/icons-vue'
import { useLive2DModel, LIVE2D_W, LIVE2D_H } from './pet/live2d/useLive2DModel'
import { useLive2DInteraction } from './pet/live2d/useLive2DInteraction'
import { useLive2DEmotion } from './pet/live2d/useLive2DEmotion'
import { useLive2DSinging } from './pet/live2d/useLive2DSinging'
import { createLive2DState, type Live2DParticle, type Live2DSingingNote, NOTE_SYMBOLS } from './pet/live2d/state'
import { usePetEnvStore } from '@/stores/petEnv'
import dialogue from '@/data/pet-dialogue-live2d.json'
import QuestionBubble from './pet/QuestionBubble.vue'
import CelebrationEffect from './pet/CelebrationEffect.vue'
import MemoryNotebook from './pet/MemoryNotebook.vue'
import { usePetMemory } from '@/composables/usePetMemory'
import { usePetQuestions } from '@/composables/usePetQuestions'
import { useSpecialDate } from '@/composables/useSpecialDate'

/** 句库类型（greeting 是嵌套对象，其余是 string[]） */
type Live2DDialogue = {
  intro: string[]; greeting: Record<string, string[]>; idle: string[]
  happy: string[]; angry: string[]; cry: string[]; sleep: string[]
  threat: string[]; turn: string[]; click: string[]; memory: string[]
}
const dl = dialogue as unknown as Live2DDialogue

const petEnv = usePetEnvStore()
const state = createLive2DState()
const containerRef = ref<HTMLElement | null>(null)

const modelCtrl = useLive2DModel(containerRef)
const { model, error, loadModel, destroy } = modelCtrl
const pixiAppRef = computed(() => modelCtrl.pixiApp.value)
const bubble = useSpeechBubble()

// ===== 记忆与提问系统 =====
const memory = usePetMemory()
const questions = usePetQuestions()
const specialDate = useSpecialDate()

// ===== 粒子/音符特效（在 singing/emotion 前定义，供 singing 引用） =====
let particleId = 0
let singingNoteId = 0

function spawnParticles(count: number, clickX?: number, clickY?: number) {
  const cx = clickX ?? LIVE2D_W / 2
  const cy = clickY ?? LIVE2D_H / 2
  const newP: Live2DParticle[] = Array.from({ length: count }, () => ({
    id: ++particleId,
    originX: cx + (Math.random() - 0.5) * 16,
    originY: cy + (Math.random() - 0.5) * 16,
    dx: (Math.random() - 0.5) * 200,
    dy: (Math.random() - 0.5) * 200 - 50,
    delay: Math.random() * 120,
  }))
  state.particles.value = [...state.particles.value, ...newP]
  setTimeout(() => { state.particles.value = state.particles.value.filter(p => !newP.includes(p)) }, 1000)
}

function spawnSingingNotes(count: number) {
  const notes: Live2DSingingNote[] = Array.from({ length: count }, () => ({
    id: ++singingNoteId,
    x: LIVE2D_W * 0.2 + Math.random() * LIVE2D_W * 0.7,
    y: -10 + Math.random() * 40,
    symbol: NOTE_SYMBOLS[Math.floor(Math.random() * NOTE_SYMBOLS.length)],
    hue: Math.random() * 360,
    delay: Math.random() * 300,
  }))
  state.singingNotes.value = [...state.singingNotes.value, ...notes]
  setTimeout(() => { state.singingNotes.value = state.singingNotes.value.filter(n => !notes.includes(n)) }, 2500)
}

// ===== 道具状态（用户右键切换） =====
const propsEnabled = ref({ desk: false, mic: false })

// ===== 唱歌（必须在 emotion 前，emotion 依赖 singing.isSinging） =====
const singing = useLive2DSinging(model, bubble, state.singingChecked, () => {
  emotion.clearIdleTimers()  // 唱歌开始 → 清闲置计时器
  interaction.pauseTracking() // B9: 暂停鼠标跟踪，避免与唱歌摇头打架
}, () => {
  interaction.resumeTracking()
  // 唱歌结束 → 收回 mic + 同步菜单状态
  propsEnabled.value.mic = false
  emotion.applyMood('idle')
  emotion.initIdleTimers()
}, (count: number) => spawnSingingNotes(count))

const emotion = useLive2DEmotion(state, model, singing.isSinging)
const interaction = useLive2DInteraction(pixiAppRef, model, state.pos, state.moved, () => {
  if (state.mood.value === 'idle' && !bubble.visible.value && Math.random() < 0.6) {
    bubble.say(pick(dl.turn))
  }
})

// B1: defineExpose 必须在 <script setup> 顶层
defineExpose({
  provokeLive2D: () => { if (!singing.isSinging.value) emotion.applyMood('angry') },
  getCenter: () => ({ x: state.pos.value.x + LIVE2D_W / 2, y: state.pos.value.y + LIVE2D_H / 2 }),
})

type Placement = 'left' | 'right'
const placement = computed<Placement>(() =>
  state.pos.value.x + LIVE2D_W / 2 > window.innerWidth / 2 ? 'left' : 'right',
)

function pick(arr: string[]): string {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setProp(model: any, paramId: string, on: boolean) {
  try {
    const core = model.internalModel?.coreModel as Record<string, unknown> | null
    const fn = core?.setParameterValueById as
      ((id: string, value: number, weight?: number) => void) | undefined
    fn?.call(core, paramId, on ? 1 : 0, 1)
  } catch { /* ignore */ }
}

function toggleProp(key: 'desk' | 'mic') {
  const m = model.value
  if (!m) return // B13: 模型未就绪则忽略，避免菜单标签与实际状态失同步
  propsEnabled.value[key] = !propsEnabled.value[key]
  if (key === 'desk') setProp(m, 'Param4', propsEnabled.value.desk)
  if (key === 'mic') setProp(m, 'Param', propsEnabled.value.mic)
}

// 情绪台词（使用 Live2D 专属句库）
watch(() => state.mood.value, (m) => {
  if (!model.value || bubble.visible.value || questions.isActive.value) return
  const key = m as keyof Live2DDialogue
  const lines = dl[key]
  if (lines && Array.isArray(lines)) bubble.say(pick(lines as string[]))
})

// 右键菜单（道具可切换 + 唱歌时 mic 自动呼出）
const showNotebook = ref(false)
const ctxMenuShow = ref(false)
const ctxMenuX = ref(0)
const ctxMenuY = ref(0)
const ctxMenuItems = computed<ContextMenuItem[]>(() => {
  const items: ContextMenuItem[] = []
  // 唱歌时隐藏切换项，堵死切换路径
  if (!singing.isSinging.value) {
    items.push({
      label: '唤醒普瑞赛斯', icon: RefreshRight,
      action: () => { if (petEnv.canSwitch()) petEnv.activePetType = 'static' },
      disabled: !petEnv.canSwitch(),
    })
  }
  items.push(
    {
    label: propsEnabled.value.desk ? '桌子（已启用）' : '桌子', icon: Monitor,
    action: () => toggleProp('desk'),
  },
  {
    label: propsEnabled.value.mic ? '麦克风（已启用）' : '麦克风', icon: Microphone,
    action: () => toggleProp('mic'),
  },
  { label: '关于我？', icon: InfoFilled, action: () => playIntro() },
  { label: '查看记忆', icon: Notebook, action: () => { showNotebook.value = true } },
  )
  return items
})

/** 播放介绍句序列（右键"关于我？"触发） */
let introPlaying = false
function playIntro() {
  if (introPlaying) return // B19: 重入守卫
  const sentences = dl.intro
  if (!sentences?.length) return
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
  if (questions.currentQuestion.value) {
    questions.submitAnswer(questions.currentQuestion.value, answer)
  }
  questions.dismiss()
  petEnv.isQuestionActive = false
}

function onQuestionReject() {
  if (questions.currentQuestion.value) {
    questions.rejectCurrent(questions.currentQuestion.value)
  }
  questions.dismiss()
  petEnv.isQuestionActive = false
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  ctxMenuX.value = e.clientX
  ctxMenuY.value = e.clientY
  ctxMenuShow.value = true
}

function handleClick(e: MouseEvent) {
  if (state.moved.value) { state.moved.value = false; return }
  state.clickScale.value = true
  setTimeout(() => { state.clickScale.value = false }, 300)
  // 唱歌时点击出音符，否则走情绪升级
  if (singing.isSinging.value) {
    spawnSingingNotes(5)
    return
  }
  // 粒子从鼠标点击位置飘出
  const rect = containerRef.value?.getBoundingClientRect?.()
  spawnParticles(8, rect ? e.clientX - rect.left : undefined, rect ? e.clientY - rect.top : undefined)
  emotion.handleClick()
}

let idleTalkTimer: ReturnType<typeof setInterval> | null = null
let greetTimer: ReturnType<typeof setTimeout> | null = null
let questionTimer: ReturnType<typeof setInterval> | null = null
let disposed = false // B4: 加载中卸载标志

onMounted(async () => {
  await loadModel()

  if (disposed) { destroy(); return }  // B4: 加载期间已卸载 → 清理后退出
  if (!model.value) { petEnv.isLive2DError = true; return }

  petEnv.isLive2DReady = true
  // 道具初始状态由 propsEnabled 控制，不在此强制开启
  emotion.initIdleTimers()
  interaction.startMouseTracking()
  emotion.checkSingingEnv(petEnv.isMusicPlaying)
  // B5: 挂载时若音乐已在播放且音频有信号，显式启动唱歌
  if (petEnv.isMusicPlaying) singing.startSinging()

  // 特殊日期检测（生日等）— U酱的活泼庆祝文案
  const isSpecialDay = specialDate.checkToday(bubble, '生日快乐！！！U酱给你准备了惊喜哦~🎂🎉')
  // 非特殊日期才按时段问候，避免覆盖生日祝福
  if (!isSpecialDay) {
    greetTimer = setTimeout(() => {
      const h = new Date().getHours()
      const slot = h < 5 ? 'night' : h < 11 ? 'morning' : h < 18 ? 'afternoon' : h < 23 ? 'evening' : 'night'
      bubble.say(pick(dl.greeting[slot]))
    }, 1600)
  }

  idleTalkTimer = setInterval(() => {
    // B12: 唱歌时跳过闲聊
    if (state.mood.value !== 'idle' || singing.isSinging.value || bubble.visible.value || questions.isActive.value) return

    // 30% 概率尝试触发记忆句
    if (Math.random() < 0.3) {
      const memLine = memory.pickMemoryLine(dl.memory)
      if (memLine) {
        bubble.say(memLine)
        return
      }
    }

    if (Math.random() < 0.55) {
      bubble.say(pick(dl.idle))
    }
  }, 28000)

  // 提问定时器（每 120s 尝试一次）
  questionTimer = setInterval(() => {
    if (!questions.canAskNow()) return
    if (singing.isSinging.value || questions.isActive.value) return
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
  disposed = true  // B4: 标记已卸载
  interaction.stopMouseTracking()
  singing.stopSinging()
  emotion.clearIdleTimers()
  bubble.hide()
  petEnv.isLive2DReady = false
  petEnv.isLive2DError = false
  petEnv.isQuestionActive = false
  if (idleTalkTimer) clearInterval(idleTalkTimer)
  if (greetTimer) clearTimeout(greetTimer)
  if (questionTimer) clearInterval(questionTimer)
  // 延迟销毁 PIXI 资源，让 Transition 离场动画先播完，避免 canvas 闪白
  setTimeout(() => destroy(), 300)
})
</script>

<template>
  <div
    class="fixed z-50 select-none"
    :class="{ 'pet-collapsing': petEnv.isCollapsing }"
    :style="{
      left: `${state.pos.value.x}px`,
      top: `${state.pos.value.y}px`,
      width: `${LIVE2D_W}px`,
      height: `${LIVE2D_H}px`,
    }"
  >
    <div class="drop-enter-live2d drop-layer" style="position:relative"
      @pointerdown="interaction.onPointerDown"
      @pointermove="interaction.onPointerMove"
      @pointerup="interaction.onPointerUp"
      @pointercancel="interaction.onPointerUp"
      @click="handleClick"
      @contextmenu="onContextMenu"
      @dragstart.prevent
    >
      <SpeechBubble
        :visible="bubble.visible.value"
        :mode="bubble.mode.value"
        :text="bubble.text.value"
        :original="bubble.original.value"
        :translation="bubble.translation.value"
        :emoji="bubble.emoji.value"
        :placement="placement"
        :vertical-offset="46"
        :horizontal-offset="56"
      />

      <!-- 提问云朵气泡 -->
      <QuestionBubble
        :visible="questions.isActive.value && !!questions.currentQuestion.value"
        :question-text="questions.currentQuestion.value?.personas.live2d ?? ''"
        :input-type="questions.currentQuestion.value?.inputType ?? 'text'"
        :choices="questions.currentQuestion.value?.choices ?? []"
        :placeholder="questions.currentQuestion.value?.placeholder ?? ''"
        :icon-name="questions.currentQuestion.value?.icon ?? 'User'"
        placement="top"
        :vertical-offset="35"
        @submit="onQuestionSubmit"
        @reject="onQuestionReject"
        @close="questions.dismiss(); petEnv.isQuestionActive = false"
      />

      <!-- 庆祝特效 -->
      <CelebrationEffect
        :visible="specialDate.isCelebrating.value"
        :pet-width="LIVE2D_W"
        @complete="specialDate.isCelebrating.value = false"
      />

      <!-- 粒子 -->
      <span
        v-for="p in state.particles.value"
        :key="p.id"
        class="pet-particle-l2d absolute w-2.5 h-2.5 rounded-full pointer-events-none z-50"
        :style="{
          '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--delay': `${p.delay}ms`,
          left: `${p.originX}px`, top: `${p.originY}px`,
        }"
      />
      <!-- 唱歌音符 -->
      <span
        v-for="n in state.singingNotes.value"
        :key="n.id"
        class="singing-note-l2d absolute pointer-events-none z-50 select-none"
        :style="{ left: `${n.x}px`, top: `${n.y}px`, '--hue': `${n.hue}`, animationDelay: `${n.delay}ms` }"
      >{{ n.symbol }}</span>

      <div
        ref="containerRef"
        class="live2d-canvas-container"
        :class="{ 'click-bounce': state.clickScale.value }"
      />

      <div
        v-if="error"
        class="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-destructive/10 rounded-xl border border-destructive/30"
      >
        <span class="text-xs text-destructive px-2 text-center">{{ error }}</span>
      </div>

    </div>
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
  </div>
</template>

<style scoped>
/*
 * === 微调指南 ===
 *
 * 入场动画（从天而降）：
 *   - DesktopPet: src/styles/index.css → @keyframes pet-drop
 *   - Live2DPet: 本文件下方 → @keyframes pet-drop-live2d
 *
 * 气泡位置：
 *   - DesktopPet: 使用默认值 verticalOffset=14, horizontalOffset=13
 *   - Live2DPet verticalOffset/horizontalOffset: 见模板 SpeechBubble 上的 :vertical-offset / :horizontal-offset
 *   - 改大 verticalOffset → 气泡下移；改大 horizontalOffset → 气泡远离桌宠
 */

@keyframes pet-drop-live2d {
  0%   { transform: translateY(-120vh); opacity: 0; }
  15%  { opacity: 0.4; filter: blur(2px); }
  50%  { opacity: 1; filter: blur(0); }
  100% { transform: translateY(-5vh); opacity: 1; filter: blur(0); }
}
.drop-enter-live2d {
  animation: pet-drop-live2d 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s both;
}

.live2d-canvas-container {
  width: 100%;
  height: 100%;
}

.click-bounce {
  animation: live2d-bounce 0.3s ease-out;
}

@keyframes live2d-bounce {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.08); }
  100% { transform: scale(1); }
}

/* 点击粒子（照搬 DesktopPet） */
.pet-particle-l2d {
  animation: pet-particle-l2d 0.8s ease-out forwards;
  animation-delay: var(--delay);
  background: #fff !important;
  box-shadow: 0 0 6px 2px rgba(255,255,255,0.7);
}
@keyframes pet-particle-l2d {
  0%   { opacity: 1; transform: scale(1.3); }
  40%  { opacity: 0.8; }
  100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.4); }
}

/* 唱歌音符（照搬 DesktopPet） */
.singing-note-l2d {
  font-size: 18px;
  color: hsl(var(--hue, 50), 80%, 65%);
  text-shadow: 0 0 10px hsl(var(--hue, 50), 90%, 60%),
               0 0 20px hsl(var(--hue, 50), 80%, 55%);
  animation: note-float-l2d 2.5s ease-out forwards;
  animation-delay: var(--delay, 0ms);
  opacity: 0;
}
@keyframes note-float-l2d {
  0%   { opacity: 0; transform: translateY(0) scale(0.5) rotate(-10deg); }
  20%  { opacity: 1; transform: translateY(-10px) scale(1.2) rotate(5deg); }
  60%  { opacity: 0.7; transform: translateY(-45px) translateX(10px) scale(1) rotate(15deg); }
  100% { opacity: 0; transform: translateY(-75px) translateX(20px) scale(0.5) rotate(30deg); }
}
</style>
