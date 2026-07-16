<script setup lang="ts">
/**
 * Live2D 桌宠组件 — 独立体系，含唱歌/道具控制/介绍引导。
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useSpeechBubble } from './pet/useSpeechBubble'
import SpeechBubble from './pet/SpeechBubble.vue'
import ContextMenu from './ContextMenu.vue'
import type { ContextMenuItem } from './ContextMenu.vue'
import { RefreshRight, InfoFilled, Monitor, Microphone } from '@element-plus/icons-vue'
import { useLive2DModel, LIVE2D_W, LIVE2D_H } from './pet/live2d/useLive2DModel'
import { useLive2DInteraction } from './pet/live2d/useLive2DInteraction'
import { useLive2DEmotion } from './pet/live2d/useLive2DEmotion'
import { useLive2DSinging } from './pet/live2d/useLive2DSinging'
import { createLive2DState } from './pet/live2d/state'
import { usePetEnvStore } from '@/stores/petEnv'
import dialogue from '@/data/pet-dialogue-live2d.json'

/** 句库类型（greeting 是嵌套对象，其余是 string[]） */
type Live2DDialogue = {
  intro: string[]; greeting: Record<string, string[]>; idle: string[]
  happy: string[]; angry: string[]; cry: string[]; sleep: string[]
  threat: string[]; turn: string[]; click: string[]
}
const dl = dialogue as unknown as Live2DDialogue

const petEnv = usePetEnvStore()
const state = createLive2DState()
const containerRef = ref<HTMLElement | null>(null)

const modelCtrl = useLive2DModel(containerRef)
const { model, error, loadModel, destroy } = modelCtrl
const pixiAppRef = computed(() => modelCtrl.pixiApp.value)

const emotion = useLive2DEmotion(state, model)
const interaction = useLive2DInteraction(pixiAppRef, model, state.pos, state.moved, () => {
  // 10s 鼠标未动后首次移动 → 说 turn 台词
  if (state.mood.value === 'idle' && !bubble.visible.value && Math.random() < 0.6) {
    bubble.say(pick(dl.turn))
  }
})
const bubble = useSpeechBubble()

// ===== 道具状态（用户右键切换） =====
const propsEnabled = ref({ desk: false, mic: false })

// ===== 唱歌 =====
const singing = useLive2DSinging(model, bubble, state.singingChecked, () => {
  emotion.initIdleTimers()
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
  propsEnabled.value[key] = !propsEnabled.value[key]
  const m = model.value
  if (!m) return
  if (key === 'desk') setProp(m, 'Param4', propsEnabled.value.desk)
  if (key === 'mic') setProp(m, 'Param', propsEnabled.value.mic)
}

// 情绪台词（使用 Live2D 专属句库）
watch(() => state.mood.value, (m) => {
  if (!model.value || bubble.visible.value) return
  const key = m as keyof Live2DDialogue
  const lines = dl[key]
  if (lines && Array.isArray(lines)) bubble.say(pick(lines as string[]))
})

// 右键菜单（道具可切换 + 唱歌时 mic 自动呼出）
const ctxMenuShow = ref(false)
const ctxMenuX = ref(0)
const ctxMenuY = ref(0)
const ctxMenuItems = computed<ContextMenuItem[]>(() => [
  {
    label: '唤醒普瑞赛斯', icon: RefreshRight,
    action: () => { if (petEnv.canSwitch()) petEnv.activePetType = 'static' },
    disabled: !petEnv.canSwitch(),
  },
  {
    label: propsEnabled.value.desk ? '桌子（已启用）' : '桌子', icon: Monitor,
    action: () => toggleProp('desk'),
  },
  {
    label: propsEnabled.value.mic ? '麦克风（已启用）' : '麦克风', icon: Microphone,
    action: () => toggleProp('mic'),
  },
  { label: '关于桌宠', icon: InfoFilled, action: () => playIntro() },
])

/** 播放介绍句序列（右键"关于桌宠"触发） */
function playIntro() {
  const sentences = dl.intro
  if (!sentences?.length) return
  let i = 0
  function next() {
    if (i >= sentences.length) return
    bubble.say(sentences[i], true)
    i++
    setTimeout(next, 300 + Math.random() * 200)
  }
  next()
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
  emotion.handleClick()
}

let idleTalkTimer: ReturnType<typeof setInterval> | null = null
let greetTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  await loadModel()

  if (!model.value) { petEnv.isLive2DError = true; return }

  petEnv.isLive2DReady = true
  // 道具初始状态由 propsEnabled 控制，不在此强制开启
  emotion.initIdleTimers()
  interaction.startMouseTracking()
  emotion.checkSingingEnv(petEnv.isMusicPlaying)

  greetTimer = setTimeout(() => {
    const h = new Date().getHours()
    const slot = h < 5 ? 'night' : h < 11 ? 'morning' : h < 18 ? 'afternoon' : h < 23 ? 'evening' : 'night'
    bubble.say(pick(dl.greeting[slot]))
  }, 1600)

  idleTalkTimer = setInterval(() => {
    if (state.mood.value === 'idle' && !bubble.visible.value && Math.random() < 0.55) {
      bubble.say(pick(dl.idle))
    }
  }, 28000)
})

onBeforeUnmount(() => {
  interaction.stopMouseTracking()
  singing.stopSinging()
  emotion.clearIdleTimers()
  bubble.hide()
  petEnv.isLive2DReady = false
  petEnv.isLive2DError = false
  if (idleTalkTimer) clearInterval(idleTalkTimer)
  if (greetTimer) clearTimeout(greetTimer)
  // 延迟销毁 PIXI 资源，让 Transition 离场动画先播完，避免 canvas 闪白
  setTimeout(() => destroy(), 300)
})
</script>

<template>
  <div
    class="fixed z-50 select-none"
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
        :vertical-offset="66"
        :horizontal-offset="66"
      />

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
</style>
