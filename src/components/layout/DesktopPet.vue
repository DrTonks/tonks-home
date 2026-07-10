<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { createPetState, W, H } from './pet/state'
import { usePetCore } from './pet/usePetCore'
import { usePetSinging } from './pet/usePetSinging'

const emit = defineEmits<{ rage: [] }>()
const state = createPetState()
const petRef = ref<HTMLElement | null>(null)

// Core — 日常动画 + 情绪 + 拖拽 + 粒子
const core = usePetCore(state, petRef, () => emit('rage'), () => singing.tryResumeSinging())

// Singing — 唱歌状态机（退出时恢复 core 日常计时器）
const singing = usePetSinging(state, () => {
  core.resetIdleTimers()
  core.scheduleBlink()
  core.scheduleAction()
})

// 点击路由：唱歌模式出音符；日常模式进 core
function handleClick(e: MouseEvent) {
  if (state.singingState.value) {
    state.clickScale.value = true
    setTimeout(() => { state.clickScale.value = false }, 300)
    singing.spawnSingingNotes(5)
    return
  }
  core.handleClick(e)
}

// 清理
onBeforeUnmount(() => {
  singing.stopAllSinging()
})
</script>

<template>
  <div
    class="fixed z-50 select-none cursor-grab active:cursor-grabbing"
    :style="{ left: `${state.pos.value.x}px`, top: `${state.pos.value.y}px`, width: `${W}px`, height: `${H}px` }"
    @pointerdown="core.onPointerDown"
    @pointermove="core.onPointerMove"
    @pointerup="core.onPointerUp"
    @pointercancel="core.onPointerUp"
    @click="handleClick"
    @dragstart.prevent
  >
    <div class="drop-enter drop-layer">
      <div ref="petRef" class="relative !overflow-visible">
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
        <img
          :src="state.showFrame.value"
          alt="桌宠"
          class="pointer-events-none select-none transition-transform duration-200"
          :class="state.clickScale.value ? 'scale-110' : 'scale-100'"
          :style="{ width: `${W}px`, height: `${H}px`, objectFit: 'contain' }"
          draggable="false"
        />
        <!-- 唱歌拖拽生气标记 -->
        <img
          v-if="state.singingAngry.value"
          src="/assets/pet/angry-icon.png"
          class="angry-mark absolute pointer-events-none z-50 select-none"
          alt="angry"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
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
