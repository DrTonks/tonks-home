<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
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

const RINGS_LEAVE_MS = 800
const RINGS_UNMOUNT_DELAY_MS = RINGS_LEAVE_MS + 80

const ringsMounted = ref(props.ringsOpacity > 0)
const ringsVisible = ref(false)
let ringsUnmountTimer: ReturnType<typeof setTimeout> | null = null
let ringsVisibilityFrame: number | null = null

function backgroundStyle(index: number) {
  return { backgroundImage: `url('${LIGHT_BACKGROUND_IMAGES[index]}')` }
}

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

</script>

<template>
  <div class="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
    <!-- 轮播图仅在桌面端显示，并保持在天蓝色背景效果下方。 -->
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
    </div>

    <div class="bg-base absolute inset-0" />
    <!-- <div class="bg-topglow absolute" /> -->
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
  /* 亮色轮播图的常态可见度。 */
  --light-bg-base-opacity: 0.2;
  --light-bg-blur: 1.2px;
}

.bg-art {
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  filter: blur(var(--light-bg-blur));
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
  .bg-art-outgoing {
    animation-duration: 1ms;
    transition-duration: 1ms;
    transform: none;
  }
}
</style>
