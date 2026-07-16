<script setup lang="ts">
/**
 * Live2D 桌宠组件 — 独立体系，含唱歌/道具/leaf/介绍引导。
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useSpeechBubble } from './pet/useSpeechBubble'
import SpeechBubble from './pet/SpeechBubble.vue'
import ContextMenu from './ContextMenu.vue'
import type { ContextMenuItem } from './ContextMenu.vue'
import { useLive2DModel, LIVE2D_W, LIVE2D_H } from './pet/live2d/useLive2DModel'
import { useLive2DInteraction } from './pet/live2d/useLive2DInteraction'
import { useLive2DEmotion } from './pet/live2d/useLive2DEmotion'
import { useLive2DSinging } from './pet/live2d/useLive2DSinging'
import { usePetIntro } from './pet/usePetIntro'
import { createLive2DState } from './pet/live2d/state'
import { usePetEnvStore } from '@/stores/petEnv'
import dialogue from '@/data/pet-dialogue-live2d.json'

const petEnv = usePetEnvStore()
const state = createLive2DState()
const containerRef = ref<HTMLElement | null>(null)

const modelCtrl = useLive2DModel(containerRef)
const { model, error, loadModel, destroy } = modelCtrl
const pixiAppRef = computed(() => modelCtrl.pixiApp.value)

const emotion = useLive2DEmotion(state, model)
const interaction = useLive2DInteraction(pixiAppRef, model, state.pos, state.moved)
const bubble = useSpeechBubble()

// ===== 道具状态（用户右键切换） =====
const propsEnabled = ref({ desk: true, mic: false, leaf: false })

// ===== 唱歌 =====
const singing = useLive2DSinging(model, bubble, state.singingChecked, () => {
  emotion.initIdleTimers()
})

// ===== 介绍引导 =====
const intro = usePetIntro('live2d', bubble, (dialogue as Record<string, string[]>).intro)

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

function toggleProp(key: 'desk' | 'mic' | 'leaf') {
  propsEnabled.value[key] = !propsEnabled.value[key]
  const m = model.value
  if (!m) return
  if (key === 'desk') setProp(m, 'Param4', propsEnabled.value.desk)
  if (key === 'mic') setProp(m, 'Param', propsEnabled.value.mic)
  if (key === 'leaf') {
    // leaf 需要同时设置两个互补参数：Param31=leaf, Param55=leaf off
    setProp(m, 'Param31', propsEnabled.value.leaf ? 1 : 0)
    setProp(m, 'Param55', propsEnabled.value.leaf ? 0 : 1)
  }
}

// 情绪台词（使用 Live2D 专属句库）
watch(() => state.mood.value, (m) => {
  if (!model.value || bubble.visible.value) return
  const key = m as keyof typeof dialogue
  const lines = (dialogue as Record<string, string[]>)[key]
  if (lines?.length) bubble.say(pick(lines))
})

// 右键菜单（道具可切换 + 唱歌时 mic 自动呼出）
const ctxMenuShow = ref(false)
const ctxMenuX = ref(0)
const ctxMenuY = ref(0)
const ctxMenuItems = computed<ContextMenuItem[]>(() => [
  {
    label: '切换为静态桌宠', icon: '🔄',
    action: () => { if (petEnv.canSwitch()) petEnv.activePetType = 'static' },
    disabled: !petEnv.canSwitch(),
  },
  {
    label: propsEnabled.value.desk ? '🟢 桌子' : '⚫ 桌子', icon: '',
    action: () => toggleProp('desk'),
  },
  {
    label: propsEnabled.value.leaf ? '🍃 叶子（已启用）' : '🍂 叶子', icon: '',
    action: () => toggleProp('leaf'),
  },
  {
    label: propsEnabled.value.mic ? '🎤 麦克风（已启用）' : '🎤 麦克风', icon: '',
    action: () => toggleProp('mic'),
  },
  { label: '关于桌宠', icon: 'ℹ️', action: () => { intro.triggerIntro() } },
])

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  ctxMenuX.value = e.clientX
  ctxMenuY.value = e.clientY
  ctxMenuShow.value = true
}

function handleClick(e: MouseEvent) {
  if (intro.isPrompting() && intro.handlePromptClick()) return
  if (intro.introLocked.value) return
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
  setProp(model.value, 'Param4', 1)
  // 介绍引导（先于问候，引导优先）
  intro.start()
  emotion.initIdleTimers()
  interaction.startMouseTracking()
  emotion.checkSingingEnv(petEnv.isMusicPlaying)

  greetTimer = setTimeout(() => {
    const h = new Date().getHours()
    const slot = h < 5 ? 'night' : h < 11 ? 'morning' : h < 18 ? 'afternoon' : h < 23 ? 'evening' : 'night'
    bubble.say(pick((dialogue as Record<string, Record<string, string[]>>).greeting[slot]))
  }, 1600)

  idleTalkTimer = setInterval(() => {
    if (state.mood.value === 'idle' && !bubble.visible.value && Math.random() < 0.55) {
      bubble.say(pick(dialogue.idle))
    }
  }, 28000)
})

onBeforeUnmount(() => {
  interaction.stopMouseTracking()
  singing.stopSinging()
  emotion.clearIdleTimers()
  destroy()
  bubble.hide()
  petEnv.isLive2DReady = false   // C2: 卸载时重置 ready 状态
  petEnv.isLive2DError = false
  if (idleTalkTimer) clearInterval(idleTalkTimer)
  if (greetTimer) clearTimeout(greetTimer)
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
    <div class="drop-enter drop-layer" style="position:relative"
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
 * 入场动画：src/styles/index.css → @keyframes pet-drop
 * 右键菜单：ContextMenu.vue
 */
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
