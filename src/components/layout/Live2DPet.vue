<script setup lang="ts">
/**
 * Live2D 桌宠组件 — 独立于旧桌宠的体系。
 * - 从天而降入场动画（复用 pet-drop keyframes）
 * - 气泡位置适配 taller 容器（top: 50px vs 14px）
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Hand } from 'lucide-vue-next'
import { useSpeechBubble } from './pet/useSpeechBubble'
import SpeechBubble from './pet/SpeechBubble.vue'
import ContextMenu from './ContextMenu.vue'
import type { ContextMenuItem } from './ContextMenu.vue'
import { useLive2DModel, LIVE2D_W, LIVE2D_H } from './pet/live2d/useLive2DModel'
import { useLive2DInteraction } from './pet/live2d/useLive2DInteraction'
import { useLive2DEmotion } from './pet/live2d/useLive2DEmotion'
import { createLive2DState } from './pet/live2d/state'
import { usePetEnvStore } from '@/stores/petEnv'
import dialogue from '@/data/pet-dialogue.json'

const petEnv = usePetEnvStore()
const state = createLive2DState()
const containerRef = ref<HTMLElement | null>(null)
const modelCtrl = useLive2DModel(containerRef)
const { model, error, loadModel, destroy } = modelCtrl
const pixiAppRef = computed(() => modelCtrl.pixiApp.value)

const emotion = useLive2DEmotion(state, model)
const interaction = useLive2DInteraction(pixiAppRef, model, state.pos, state.moved)

const bubble = useSpeechBubble()

type Placement = 'left' | 'right'
const placement = computed<Placement>(() =>
  state.pos.value.x + LIVE2D_W / 2 > window.innerWidth / 2 ? 'left' : 'right',
)

function pick(arr: string[]): string {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : ''
}

watch(() => state.mood.value, (m) => {
  if (!model.value || bubble.visible.value) return
  if (m === 'happy') bubble.say(pick(dialogue.happy))
  else if (m === 'angry') bubble.say(pick(dialogue.angry))
  else if (m === 'cry') bubble.say(pick(dialogue.cry))
  else if (m === 'sleep') bubble.say(pick(dialogue.sleep))
})

const ctxMenuShow = ref(false)
const ctxMenuX = ref(0)
const ctxMenuY = ref(0)
const ctxMenuItems = computed<ContextMenuItem[]>(() => [
  {
    label: '切换为静态桌宠',
    icon: '🔄',
    action: () => { if (petEnv.canSwitch()) petEnv.activePetType = 'static' },
    disabled: !petEnv.canSwitch(),
  },
  { label: '关于桌宠', icon: 'ℹ️', action: () => { bubble.say('我是 Live2D 桌宠 UG！') } },
])

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
  console.log('[Live2DPet] Mounted, loading model...')
  await loadModel()

  if (!model.value) {
    console.error('[Live2DPet] Model failed to load:', error.value)
    petEnv.isLive2DError = true
    return
  }

  console.log('[Live2DPet] Model loaded successfully')
  petEnv.isLive2DReady = true
  emotion.initIdleTimers()
  interaction.startMouseTracking()
  emotion.checkSingingEnv(petEnv.isMusicPlaying)

  greetTimer = setTimeout(() => {
    const h = new Date().getHours()
    const slot = h < 5 ? 'night' : h < 11 ? 'morning' : h < 18 ? 'afternoon' : h < 23 ? 'evening' : 'night'
    bubble.say(pick(dialogue.greeting[slot as keyof typeof dialogue.greeting]))
  }, 1600)

  idleTalkTimer = setInterval(() => {
    if (state.mood.value === 'idle' && !bubble.visible.value && Math.random() < 0.55) {
      bubble.say(pick(dialogue.idle))
    }
  }, 28000)

})

onBeforeUnmount(() => {
  interaction.stopMouseTracking()
  emotion.clearIdleTimers()
  destroy()
  bubble.hide()
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
    <!-- 从天而降入场动画（复用全局 pet-drop keyframes） -->
    <div class="drop-enter drop-layer" style="position:relative" @pointerdown="interaction.onPointerDown"
      @pointermove="interaction.onPointerMove"
      @pointerup="interaction.onPointerUp"
      @pointercancel="interaction.onPointerUp"
      @click="handleClick"
      @contextmenu="onContextMenu"
      @dragstart.prevent>
      <!-- 气泡容器 -->
      <div class="relative bubble-offset">
        <SpeechBubble
          :visible="bubble.visible.value"
          :mode="bubble.mode.value"
          :text="bubble.text.value"
          :original="bubble.original.value"
          :translation="bubble.translation.value"
          :emoji="bubble.emoji.value"
          :placement="placement"
        />
      </div>

      <!-- Live2D 画布 -->
      <div
        ref="containerRef"
        class="live2d-canvas-container"
        :class="{ 'click-bounce': state.clickScale.value }"
      />

      <!-- 加载错误 -->
      <div
        v-if="error"
        class="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-destructive/10 rounded-xl border border-destructive/30"
      >
        <span class="text-xs text-destructive px-2 text-center">{{ error }}</span>
      </div>

      <!-- hover 切换按钮 -->
      <div class="absolute -bottom-2 -right-2 z-10 opacity-0 hover:opacity-100 transition-opacity duration-200">
        <button
          class="h-7 w-7 rounded-full bg-card/90 backdrop-blur border border-border shadow-sm flex items-center justify-center hover:border-primary/40 transition-colors"
          @click.stop="petEnv.canSwitch() && (petEnv.activePetType = 'static')"
          title="切换为静态桌宠"
        >
          <Hand class="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  </div>

  <ContextMenu
    :items="ctxMenuItems"
    :x="ctxMenuX"
    :y="ctxMenuY"
    :show="ctxMenuShow"
    @close="ctxMenuShow = false"
  />
</template>

<style scoped>
.bubble-offset {
  position: relative;
  z-index: 1;
  transform: translateY(52px);
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
