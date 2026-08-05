<script setup lang="ts">
/**
 * 暗色主题背景：深空 CSS 渐变作永久底层（切换瞬间铺满、零延迟、不白屏），
 * Galaxy WebGL 星空叠在上面懒加载并淡入，掩盖 shader 初始化耗时。
 * 整层 pointer-events:none，不拦截上层卡片；Galaxy 的鼠标交互监听 window。
 *
 * 音频联动：复用 useAudioAnalyzer 的模块级单例 hasSignal（不新建 AudioContext），
 * 有实际音频信号时星速/辉光/闪烁提升、色相微暖移；Galaxy 内部逐帧 lerp 平滑过渡，
 * 无音频时平滑回落。整体成本为每帧几个 float 的 lerp，无逐帧 FFT。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Galaxy from './Galaxy.vue'
import { useMusicStore } from '@/stores/music'
import { useAudioAnalyzer } from '@/composables/useAudioAnalyzer'
import { getDarkBackgroundUrl } from '@/config/backgroundImages'

withDefaults(
  defineProps<{
    currentIndex?: number
    outgoingIndex?: number | null
  }>(),
  {
    currentIndex: 0,
    outgoingIndex: null,
  },
)

const music = useMusicStore()
const { hasSignal, startSignalCheck } = useAudioAnalyzer()

// 手机端不加载 Galaxy WebGL，只留深空渐变底（省电、省性能）；随视口变化响应
const mql = window.matchMedia('(max-width: 768px)')
const isMobile = ref(mql.matches)
const onMqlChange = (e: MediaQueryListEvent) => {
  isMobile.value = e.matches
}

// 挂载时若正在播放，确保信号检测在跑（幂等；stop 交由 HomeView 管，避免冲突）
onMounted(() => {
  mql.addEventListener('change', onMqlChange)
  if (music.isPlaying) startSignalCheck()
})
onUnmounted(() => {
  mql.removeEventListener('change', onMqlChange)
})

const active = computed(() => music.isPlaying && hasSignal.value)
const starSpeed = computed(() => (active.value ? 0.7 : 0.3))
const glowIntensity = computed(() => (active.value ? 0.3 : 0.1))
const hueShift = computed(() => (active.value ? 224 : 210))
const twinkleIntensity = computed(() => (active.value ? 0.3 : 0.15))

function backgroundStyle(index: number) {
  return { backgroundImage: `url('${getDarkBackgroundUrl(index)}')` }
}
</script>

<template>
  <div class="galaxy-bg absolute inset-0 -z-10 overflow-hidden pointer-events-none">
    <div class="galaxy-gradient absolute inset-0" />
    <div v-if="!isMobile" class="theme-carousel-art-stage dark-art-stage absolute inset-0">
      <div
        v-if="outgoingIndex !== null"
        :key="`dark-outgoing-${outgoingIndex}`"
        class="dark-art dark-art-outgoing absolute inset-0"
        :style="backgroundStyle(outgoingIndex)"
      />
      <div
        :key="`dark-current-${currentIndex}`"
        class="dark-art dark-art-current absolute inset-0"
        :class="{ 'is-entering': outgoingIndex !== null }"
        :style="backgroundStyle(currentIndex)"
      />
    </div>
    <Galaxy
      v-if="!isMobile"
      class="galaxy-canvas absolute inset-0"
      :density="0.9"
      :hue-shift="hueShift"
      :saturation="0.2"
      :star-warmth="0.3"
      :flare-max-radius="0.4"
      :max-fps="60"
      :glow-intensity="glowIntensity"
      :star-speed="starSpeed"
      :twinkle-intensity="twinkleIntensity"
      :rotation-speed="0.06"
      :mouse-interaction="true"
      :mouse-repulsion="false"
      :repulsion-strength="0.1"
    />
  </div>
</template>

<style scoped>
.galaxy-gradient {
  z-index: 0;
  background: radial-gradient(ellipse 120% 90% at 50% 22%, #10203a 0%, #0a1120 46%, #05070e 100%);
}

.dark-art-stage {
  z-index: 1;
  /* 暗色轮播图的可见度与模糊程度，可直接在这里手动调整。 */
  --dark-bg-opacity: 0.12;
  --dark-bg-blur: 1.25px;
}

.dark-art {
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  filter: blur(var(--dark-bg-blur));
}

.dark-art-current {
  z-index: 0;
  opacity: var(--dark-bg-opacity);
  transform: scale(1.006);
}

.dark-art-current.is-entering {
  animation: dark-bg-enter 1.8s ease-in-out both;
}

.dark-art-outgoing {
  z-index: 1;
  animation: dark-bg-leave 1.8s ease-in-out both;
}

@keyframes dark-bg-enter {
  from {
    opacity: 0;
    transform: scale(1.006);
  }
  to {
    opacity: var(--dark-bg-opacity);
    transform: scale(1.006);
  }
}

@keyframes dark-bg-leave {
  from {
    opacity: var(--dark-bg-opacity);
    transform: scale(1.006);
  }
  to {
    opacity: 0;
    transform: scale(1.04);
  }
}

.galaxy-canvas {
  z-index: 2;
  opacity: 0;
  mix-blend-mode: screen;
  animation: galaxy-fade-in 1.2s ease-out 0.15s forwards;
}
@keyframes galaxy-fade-in {
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .dark-art-current.is-entering,
  .dark-art-outgoing {
    animation-duration: 1ms;
    transform: none;
  }

  .galaxy-canvas {
    animation: none;
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .dark-art-stage {
    display: none;
  }
}
</style>
