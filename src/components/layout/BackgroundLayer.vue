<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { LIGHT_BACKGROUND_IMAGES } from '@/config/backgroundImages'
import MagicRings from './MagicRings.vue'

const props = withDefaults(
  defineProps<{
    ringsOpacity?: number
    ringsSpeed?: number
    ringsBaseRadius?: number
    currentIndex?: number
    outgoingIndex?: number | null
    artworkEnabled?: boolean
  }>(),
  {
    ringsOpacity: 0,
    ringsSpeed: 0.7,
    ringsBaseRadius: 0.18,
    currentIndex: 0,
    outgoingIndex: null,
    artworkEnabled: true,
  },
)

const TRAIL_SAMPLE_MS = 32
const TRAIL_MIN_DISTANCE = 4
const RINGS_LEAVE_MS = 800
const RINGS_UNMOUNT_DELAY_MS = RINGS_LEAVE_MS + 80

const trailPath = ref('')
const trailImageIndex = ref(props.currentIndex)
const trailClearing = ref(false)
const trailImageHref = computed(() => LIGHT_BACKGROUND_IMAGES[trailImageIndex.value])

let hasActiveStroke = false
let lastTrailAt = 0
let lastTrailX = Number.NEGATIVE_INFINITY
let lastTrailY = Number.NEGATIVE_INFINITY

const ringsMounted = ref(props.ringsOpacity > 0)
const ringsVisible = ref(false)
let ringsUnmountTimer: ReturnType<typeof setTimeout> | null = null
let ringsVisibilityFrame: number | null = null

function backgroundStyle(index: number) {
  return { backgroundImage: `url('${LIGHT_BACKGROUND_IMAGES[index]}')` }
}

function clearTrail() {
  trailPath.value = ''
  hasActiveStroke = false
  lastTrailAt = 0
  lastTrailX = Number.NEGATIVE_INFINITY
  lastTrailY = Number.NEGATIVE_INFINITY
}

function addTrailPoint(x: number, y: number) {
  if (!props.artworkEnabled || props.outgoingIndex !== null || trailClearing.value) return

  const now = performance.now()
  const distance = Math.hypot(x - lastTrailX, y - lastTrailY)
  if (
    hasActiveStroke
    && (now - lastTrailAt < TRAIL_SAMPLE_MS || distance < TRAIL_MIN_DISTANCE)
  ) return

  lastTrailAt = now
  lastTrailX = x
  lastTrailY = y
  const command = hasActiveStroke ? 'L' : 'M'
  trailPath.value += `${command}${x.toFixed(1)},${y.toFixed(1)} `
  hasActiveStroke = true
}

function endTrailStroke() {
  hasActiveStroke = false
}

watch(() => props.outgoingIndex, (outgoingIndex, previousIndex) => {
  if (outgoingIndex !== null) {
    trailClearing.value = true
    endTrailStroke()
    return
  }

  if (previousIndex !== null) {
    clearTrail()
    trailImageIndex.value = props.currentIndex
    trailClearing.value = false
  }
})

watch(() => props.currentIndex, (currentIndex) => {
  if (props.outgoingIndex === null && currentIndex !== trailImageIndex.value) {
    clearTrail()
    trailImageIndex.value = currentIndex
  }
})

watch(() => props.artworkEnabled, (enabled) => {
  if (!enabled) clearTrail()
})

watch(() => props.ringsOpacity, async (opacity) => {
  if (ringsUnmountTimer) {
    clearTimeout(ringsUnmountTimer)
    ringsUnmountTimer = null
  }
  if (ringsVisibilityFrame !== null) {
    cancelAnimationFrame(ringsVisibilityFrame)
    ringsVisibilityFrame = null
  }

  if (opacity > 0) {
    ringsMounted.value = true
    await nextTick()
    if (props.ringsOpacity <= 0) return
    ringsVisibilityFrame = requestAnimationFrame(() => {
      ringsVisibilityFrame = null
      ringsVisible.value = true
    })
    return
  }

  ringsVisible.value = false
  if (!ringsMounted.value) return
  ringsUnmountTimer = setTimeout(() => {
    ringsUnmountTimer = null
    if (props.ringsOpacity <= 0) ringsMounted.value = false
  }, RINGS_UNMOUNT_DELAY_MS)
}, { immediate: true })

onBeforeUnmount(() => {
  if (ringsUnmountTimer) clearTimeout(ringsUnmountTimer)
  if (ringsVisibilityFrame !== null) cancelAnimationFrame(ringsVisibilityFrame)
})

defineExpose({ addTrailPoint, endTrailStroke })
</script>

<template>
  <div class="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
    <!-- 轮播与点亮尾迹仅在桌面端显示，并保持在天蓝色背景效果下方。 -->
    <div v-if="artworkEnabled" class="theme-carousel-art-stage bg-art-stage absolute inset-0">
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
      <svg
        class="bg-art-trail absolute inset-0 h-full w-full"
        :class="{ 'is-clearing': trailClearing }"
        aria-hidden="true"
      >
        <defs>
          <filter id="light-trail-soften" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <mask
            id="light-trail-mask"
            x="0"
            y="0"
            width="100%"
            height="100%"
            maskUnits="userSpaceOnUse"
            style="mask-type: luminance"
          >
            <path
              :d="trailPath"
              fill="none"
              stroke="white"
              stroke-width="140"
              stroke-linecap="round"
              stroke-linejoin="round"
              opacity="0.72"
              filter="url(#light-trail-soften)"
            />
            <path
              :d="trailPath"
              fill="none"
              stroke="white"
              stroke-width="96"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </mask>
        </defs>
        <image
          :href="trailImageHref"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
          mask="url(#light-trail-mask)"
        />
      </svg>
    </div>

    <div class="bg-base absolute inset-0" />
    <div class="bg-topglow absolute" />
    <div class="bg-grid absolute inset-0" />
    <div class="bg-corner-glow absolute" />

    <div
      v-if="ringsMounted"
      class="rings-layer absolute inset-0"
      :class="{ 'is-visible': ringsVisible }"
      aria-hidden="true"
    >
      <MagicRings
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
    </div>
  </div>
</template>

<style scoped>
.bg-art-stage {
  /* 常态图片可见度，以及鼠标点亮层额外叠加的可见度。 */
  --light-bg-base-opacity: 0.08;
  --light-bg-highlight-opacity: 0.18;
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
  opacity: var(--light-bg-highlight-opacity);
  transition: opacity 1.8s ease-in-out;
  will-change: opacity;
}

.bg-art-trail.is-clearing {
  opacity: 0;
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

.rings-layer {
  opacity: 0;
  transition: opacity 0.8s ease-in;
}

.rings-layer.is-visible {
  opacity: 1;
  transition: opacity 1.5s ease-out;
}

@media (max-width: 768px) {
  .bg-art-stage {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bg-art-current.is-entering,
  .bg-art-outgoing,
  .bg-art-trail {
    animation-duration: 1ms;
    transition-duration: 1ms;
    transform: none;
  }
}
</style>
