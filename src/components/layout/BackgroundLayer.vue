<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { LIGHT_BACKGROUND_IMAGES } from '@/config/backgroundImages'
import MagicRings from './MagicRings.vue'

withDefaults(
  defineProps<{
    ringsOpacity?: number
    ringsSpeed?: number
    ringsBaseRadius?: number
    currentIndex?: number
    outgoingIndex?: number | null
  }>(),
  {
    ringsOpacity: 0,
    ringsSpeed: 0.7,
    ringsBaseRadius: 0.18,
    currentIndex: 0,
    outgoingIndex: null,
  },
)

const TRAIL_MAX_POINTS = 24
const TRAIL_SAMPLE_MS = 48
const TRAIL_MIN_DISTANCE = 10
const TRAIL_HOLD_MS = 500
const TRAIL_DURATION_MS = 1_500

interface TrailPoint {
  x: number
  y: number
  createdAt: number
}

const trailLayer = ref<HTMLDivElement | null>(null)

let trailFrame: number | null = null
let trailPoints: TrailPoint[] = []
let lastTrailAt = 0
let lastTrailX = Number.NEGATIVE_INFINITY
let lastTrailY = Number.NEGATIVE_INFINITY

function backgroundStyle(index: number) {
  return { backgroundImage: `url('${LIGHT_BACKGROUND_IMAGES[index]}')` }
}

function renderTrail(now: number) {
  const layer = trailLayer.value
  if (!layer) {
    trailFrame = null
    return
  }

  trailPoints = trailPoints.filter((point) => now - point.createdAt < TRAIL_DURATION_MS)
  if (!trailPoints.length) {
    layer.style.opacity = '0'
    layer.style.removeProperty('-webkit-mask-image')
    layer.style.removeProperty('mask-image')
    trailFrame = null
    return
  }

  const masks = trailPoints.map((point) => {
    const age = now - point.createdAt
    const strength = age <= TRAIL_HOLD_MS
      ? 1
      : 1 - (age - TRAIL_HOLD_MS) / (TRAIL_DURATION_MS - TRAIL_HOLD_MS)
    return `radial-gradient(circle clamp(42px, 4.5vw, 68px) at ${point.x}px ${point.y}px, rgba(0, 0, 0, ${strength.toFixed(3)}) 0, rgba(0, 0, 0, ${strength.toFixed(3)}) 45%, transparent 100%)`
  })

  const maskImage = masks.join(', ')
  layer.style.opacity = 'var(--light-bg-highlight-opacity)'
  layer.style.setProperty('-webkit-mask-image', maskImage)
  layer.style.setProperty('mask-image', maskImage)
  trailFrame = requestAnimationFrame(renderTrail)
}

function addTrailPoint(x: number, y: number) {
  if (window.innerWidth <= 768 || !trailLayer.value) return

  const now = performance.now()
  const distance = Math.hypot(x - lastTrailX, y - lastTrailY)
  if (now - lastTrailAt < TRAIL_SAMPLE_MS && distance < TRAIL_MIN_DISTANCE) return

  lastTrailAt = now
  lastTrailX = x
  lastTrailY = y
  trailPoints.push({ x, y, createdAt: now })
  if (trailPoints.length > TRAIL_MAX_POINTS) trailPoints.shift()
  if (trailFrame === null) trailFrame = requestAnimationFrame(renderTrail)
}

defineExpose({ addTrailPoint })

onBeforeUnmount(() => {
  if (trailFrame !== null) cancelAnimationFrame(trailFrame)
  trailPoints = []
})
</script>

<template>
  <div class="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
    <!-- 轮播与点亮尾迹仅在桌面端显示，并保持在天蓝色背景效果下方。 -->
    <div class="bg-art-stage absolute inset-0">
      <div
        v-if="outgoingIndex !== null"
        :key="`outgoing-${outgoingIndex}`"
        class="bg-art bg-art-outgoing absolute inset-0"
        :style="backgroundStyle(outgoingIndex)"
      />
      <div
        :key="`current-${currentIndex}`"
        class="bg-art bg-art-current absolute inset-0"
        :class="{ 'is-entering': outgoingIndex !== null }"
        :style="backgroundStyle(currentIndex)"
      />
      <div
        ref="trailLayer"
        class="bg-art bg-art-trail absolute inset-0"
        :style="backgroundStyle(currentIndex)"
      />
    </div>

    <div class="bg-base absolute inset-0" />
    <div class="bg-topglow absolute" />
    <div class="bg-grid absolute inset-0" />
    <div class="bg-corner-glow absolute" />

    <Transition name="rings-fade">
      <MagicRings
        v-if="ringsOpacity > 0"
        color="#4bd7ff"
        color-two="#ffffff"
        :ring-count="4"
        :speed="ringsSpeed"
        :attenuation="10"
        :line-thickness="4"
        :base-radius="ringsBaseRadius"
        :radius-step="0.1"
        :scale-rate="0.1"
        :opacity="0.7"
        :blur="6"
        :noise-amount="0.1"
        :rotation="0"
        :ring-gap="2"
        :fade-in="0.7"
        :fade-out="0.5"
        :follow-mouse="false"
        :mouse-influence="0"
        :hover-scale="1.0"
        :parallax="0.05"
        :click-burst="false"
      />
    </Transition>
  </div>
</template>

<style scoped>
.bg-art-stage {
  /* 常态图片可见度，以及鼠标点亮层额外叠加的可见度。 */
  --light-bg-base-opacity: 0.07;
  --light-bg-highlight-opacity: 0.11;
}

.bg-art {
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}

.bg-art-current {
  z-index: 0;
  opacity: var(--light-bg-base-opacity);
}

.bg-art-current.is-entering {
  animation: bg-carousel-enter 1.8s ease-in-out both;
}

.bg-art-outgoing {
  z-index: 1;
  animation: bg-carousel-leave 1.8s ease-in-out both;
}

.bg-art-trail {
  z-index: 2;
  opacity: 0;
  will-change: opacity;
}

@keyframes bg-carousel-enter {
  from {
    opacity: 0;
    transform: scale(1);
  }
  to {
    opacity: var(--light-bg-base-opacity);
    transform: scale(1);
  }
}

@keyframes bg-carousel-leave {
  from {
    opacity: var(--light-bg-base-opacity);
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(1.035);
  }
}

.bg-base {
  background:
    radial-gradient(ellipse 100% 80% at 50% 0%, hsl(var(--color-sky) / 0.12) 0%, transparent 55%),
    linear-gradient(160deg, hsl(var(--color-sky) / 0.06) 0%, transparent 45%, hsl(var(--color-mint) / 0.07) 100%);
}

.bg-topglow {
  top: -20vh;
  left: 50%;
  width: 70vw;
  height: 50vh;
  transform: translateX(-50%);
  background: radial-gradient(ellipse at center, hsl(var(--color-sky) / 0.18), transparent 70%);
  filter: blur(30px);
  pointer-events: none;
}

.bg-grid {
  background-image:
    linear-gradient(hsl(var(--color-sky-soft) / 0.18) 1px, transparent 1px),
    linear-gradient(90deg, hsl(var(--color-sky-soft) / 0.18) 1px, transparent 1px);
  background-size: 56px 56px;
  -webkit-mask-image: radial-gradient(ellipse at center, black 18%, transparent 78%);
  mask-image: radial-gradient(ellipse at center, black 18%, transparent 78%);
  pointer-events: none;
}

.bg-corner-glow {
  right: -10%;
  bottom: -15%;
  width: 50%;
  height: 40%;
  background: radial-gradient(
    ellipse at center,
    hsl(var(--color-sky) / 0.18),
    hsl(var(--color-mint) / 0.1) 50%,
    transparent 70%
  );
  filter: blur(60px);
  pointer-events: none;
}

.rings-fade-enter-active {
  transition: opacity 1.5s ease-out;
}

.rings-fade-leave-active {
  transition: opacity 0.8s ease-in;
}

.rings-fade-enter-from,
.rings-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .bg-art-stage {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bg-art-current.is-entering,
  .bg-art-outgoing {
    animation-duration: 1ms;
    transform: none;
  }
}
</style>
