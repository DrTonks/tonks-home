<script setup lang="ts">
/**
 * CelebrationEffect — 生日庆祝特效。
 * 纯 CSS 动画：蛋糕 emoji 弹入 + 蜡烛火焰摇曳 + 暖色粒子飘散。
 * 6~8 秒后自动淡出，emit('complete') 通知父组件。
 */
import { ref, watch, onBeforeUnmount } from 'vue'

const props = withDefaults(
  defineProps<{
    visible?: boolean
    petWidth?: number
  }>(),
  {
    visible: false,
    petWidth: 130,
  },
)

const emit = defineEmits<{ complete: [] }>()

// 火焰配置
interface Flame {
  id: number
  left: string
  delay: string
  duration: string
}

const flames = ref<Flame[]>([])
const particles = ref<{ id: number; x: string; delay: string; hue: number }[]>([])
const isFadingOut = ref(false)

let autoHideTimer: ReturnType<typeof setTimeout> | null = null
let fadeOutTimer: ReturnType<typeof setTimeout> | null = null

function generateEffects() {
  // 3~5 个火焰
  const count = 3 + Math.floor(Math.random() * 3)
  flames.value = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${20 + i * 18 + Math.random() * 8}%`,
    delay: `${i * 0.1 + Math.random() * 0.3}s`,
    duration: `${0.6 + Math.random() * 0.4}s`,
  }))

  // 10~15 个粒子
  const pCount = 10 + Math.floor(Math.random() * 6)
  particles.value = Array.from({ length: pCount }, (_, i) => ({
    id: i,
    x: `${10 + Math.random() * 80}%`,
    delay: `${i * 0.12 + Math.random() * 0.5}s`,
    hue: 30 + Math.random() * 40, // 暖金色范围
  }))
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      isFadingOut.value = false
      generateEffects()
      // 7 秒后淡出
      autoHideTimer = setTimeout(() => {
        isFadingOut.value = true
        fadeOutTimer = setTimeout(() => emit('complete'), 600)
      }, 7000)
    } else {
      if (autoHideTimer) clearTimeout(autoHideTimer)
      if (fadeOutTimer) clearTimeout(fadeOutTimer)
      autoHideTimer = null
      fadeOutTimer = null
      flames.value = []
      particles.value = []
      isFadingOut.value = false
    }
  },
)

onBeforeUnmount(() => {
  if (autoHideTimer) clearTimeout(autoHideTimer)
  if (fadeOutTimer) clearTimeout(fadeOutTimer)
})
</script>

<template>
  <div
    v-if="visible"
    class="celebration-container"
    :class="{ 'fade-out': isFadingOut }"
    :style="{ width: `${petWidth * 2}px` }"
    aria-hidden="true"
  >
    <!-- 蛋糕 -->
    <div class="cake-layer">
      <span class="cake-emoji">🎂</span>
    </div>

    <!-- 蜡烛火焰 -->
    <div class="flame-row">
      <span
        v-for="f in flames"
        :key="f.id"
        class="flame"
        :style="{
          left: f.left,
          animationDelay: f.delay,
          animationDuration: f.duration,
        }"
      />
    </div>

    <!-- 上升粒子 -->
    <span
      v-for="p in particles"
      :key="p.id"
      class="celebration-particle"
      :style="{
        left: p.x,
        animationDelay: p.delay,
        '--particle-hue': `${p.hue}`,
      }"
    />
  </div>
</template>

<style scoped>
.celebration-container {
  position: absolute;
  top: -120px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 65;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  opacity: 1;
  transition: opacity 0.6s ease-out;
}

.celebration-container.fade-out {
  opacity: 0;
}

/* ===== 蛋糕 ===== */
.cake-layer {
  animation: cake-bounce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.cake-emoji {
  font-size: 36px;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.15));
}

@keyframes cake-bounce-in {
  0% {
    transform: translateY(30px) scale(0.3);
    opacity: 0;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

/* ===== 火焰 ===== */
.flame-row {
  position: relative;
  width: 60px;
  height: 20px;
  margin-top: -6px;
}

.flame {
  position: absolute;
  bottom: 0;
  width: 6px;
  height: 16px;
  background: linear-gradient(to top, #ff9800, #ffeb3b 40%, #fff 80%);
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  animation: flicker 0.8s ease-in-out infinite;
  transform-origin: bottom center;
  filter: blur(0.3px);
}

@keyframes flicker {
  0%,
  100% {
    transform: scaleY(1) scaleX(1);
    opacity: 0.85;
  }
  25% {
    transform: scaleY(1.2) scaleX(0.8);
    opacity: 1;
  }
  50% {
    transform: scaleY(0.8) scaleX(1.15);
    opacity: 0.6;
  }
  75% {
    transform: scaleY(1.1) scaleX(0.85);
    opacity: 0.9;
  }
}

/* ===== 粒子 ===== */
.celebration-particle {
  position: absolute;
  bottom: 40px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: hsl(var(--particle-hue, 40), 90%, 60%);
  box-shadow: 0 0 6px hsl(var(--particle-hue, 40), 100%, 60%);
  animation: particle-rise 2.5s ease-out forwards;
  opacity: 0;
}

@keyframes particle-rise {
  0% {
    opacity: 0;
    transform: translateY(0) scale(0.5);
  }
  15% {
    opacity: 1;
    transform: translateY(-15px) scale(1.3);
  }
  60% {
    opacity: 0.6;
    transform: translateY(-60px) translateX(10px) scale(0.8);
  }
  100% {
    opacity: 0;
    transform: translateY(-100px) translateX(20px) scale(0.3);
  }
}
</style>
